const crypto = require('crypto');

const MIDTRANS_SNAP_SANDBOX_URL = 'https://app.sandbox.midtrans.com/snap/v1/transactions';
const MIDTRANS_SNAP_PRODUCTION_URL = 'https://app.midtrans.com/snap/v1/transactions';
const MIDTRANS_API_SANDBOX_BASE_URL = 'https://api.sandbox.midtrans.com';
const MIDTRANS_API_PRODUCTION_BASE_URL = 'https://api.midtrans.com';

const createRequestId = () => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
};

const isProductionMode = () => String(process.env.MIDTRANS_IS_PRODUCTION || 'false').toLowerCase() === 'true';

const getSnapApiUrl = () => (isProductionMode() ? MIDTRANS_SNAP_PRODUCTION_URL : MIDTRANS_SNAP_SANDBOX_URL);
const getApiBaseUrl = () => (isProductionMode() ? MIDTRANS_API_PRODUCTION_BASE_URL : MIDTRANS_API_SANDBOX_BASE_URL);

const createBasicAuthHeader = (serverKey) =>
  `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`;

const mapMidtransStatus = ({ transactionStatus, fraudStatus }) => {
  const status = String(transactionStatus || '').toLowerCase();
  const fraud = String(fraudStatus || '').toLowerCase();

  if (status === 'settlement') {
    return 'PAID';
  }

  if (status === 'capture') {
    if (fraud && fraud !== 'accept') {
      return 'PENDING';
    }
    return 'PAID';
  }

  if (status === 'pending' || status === 'authorize') {
    return 'PENDING';
  }

  if (status === 'expire') {
    return 'EXPIRED';
  }

  if (status === 'refund' || status === 'partial_refund') {
    return 'REFUNDED';
  }

  if (status === 'deny' || status === 'cancel' || status === 'failure' || status === 'chargeback' || status === 'partial_chargeback') {
    return 'FAILED';
  }

  return 'PENDING';
};

const mapInternalPaymentStatus = (providerStatus) => {
  if (providerStatus === 'PAID') {
    return 'succeeded';
  }

  if (['FAILED', 'EXPIRED', 'REFUNDED'].includes(providerStatus)) {
    return 'failed';
  }

  return 'pending';
};

const buildCreateTransactionPayload = ({
  amount,
  invoiceNumber,
  customer,
  paymentDueDate,
  callbackUrls,
}) => {
  const payload = {
    transaction_details: {
      order_id: invoiceNumber,
      gross_amount: amount,
    },
    credit_card: {
      secure: true,
    },
  };

  if (customer && (customer.name || customer.email || customer.phone)) {
    payload.customer_details = {
      ...(customer.name ? { first_name: customer.name } : {}),
      ...(customer.email ? { email: customer.email } : {}),
      ...(customer.phone ? { phone: customer.phone } : {}),
    };
  }

  const safeDueDate = Number.isFinite(Number(paymentDueDate))
    ? Number(paymentDueDate)
    : Number(process.env.MIDTRANS_PAYMENT_EXPIRED_MINUTES || 60);

  if (Number.isFinite(safeDueDate) && safeDueDate > 0) {
    payload.expiry = {
      unit: 'minute',
      duration: safeDueDate,
    };
  }

  const finishUrl = String(
    callbackUrls?.finish || process.env.MIDTRANS_FINISH_URL || ''
  ).trim();
  const unfinishUrl = String(
    callbackUrls?.unfinish || process.env.MIDTRANS_UNFINISH_URL || ''
  ).trim();
  const errorUrl = String(
    callbackUrls?.error || process.env.MIDTRANS_ERROR_URL || ''
  ).trim();
  const callbacks = {
    ...(finishUrl ? { finish: finishUrl } : {}),
    ...(unfinishUrl ? { unfinish: unfinishUrl } : {}),
    ...(errorUrl ? { error: errorUrl } : {}),
  };

  if (Object.keys(callbacks).length > 0) {
    payload.callbacks = callbacks;
  }

  return payload;
};

const createCheckoutPayment = async ({
  amount,
  invoiceNumber,
  customer,
  paymentDueDate,
  callbackUrls,
}) => {
  const serverKey = String(process.env.MIDTRANS_SERVER_KEY || '').trim();

  if (!serverKey) {
    throw new Error('MIDTRANS_SERVER_KEY is required');
  }

  const payload = buildCreateTransactionPayload({
    amount,
    invoiceNumber,
    customer,
    paymentDueDate,
    callbackUrls,
  });

  const notificationUrl = String(
    process.env.MIDTRANS_NOTIFICATION_URL || process.env.MIDTRANS_CALLBACK_URL || ''
  ).trim();

  const requestId = createRequestId();
  const requestTimestamp = new Date().toISOString();

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: createBasicAuthHeader(serverKey),
  };

  if (notificationUrl) {
    headers['X-Override-Notification'] = notificationUrl;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(getSnapApiUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const responseJson = await response.json().catch(() => ({}));

    return {
      ok: response.ok,
      statusCode: response.status,
      requestId,
      requestTimestamp,
      payload,
      response: responseJson,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const getTransactionStatus = async ({ orderIdOrTransactionId }) => {
  const serverKey = String(process.env.MIDTRANS_SERVER_KEY || '').trim();
  const lookupId = encodeURIComponent(String(orderIdOrTransactionId || '').trim());

  if (!serverKey) {
    throw new Error('MIDTRANS_SERVER_KEY is required');
  }

  if (!lookupId) {
    throw new Error('orderIdOrTransactionId is required');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${getApiBaseUrl()}/v2/${lookupId}/status`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: createBasicAuthHeader(serverKey),
      },
      signal: controller.signal,
    });

    const responseJson = await response.json().catch(() => ({}));
    return {
      ok: response.ok,
      statusCode: response.status,
      response: responseJson,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const calculateNotificationSignature = ({ orderId, statusCode, grossAmount, serverKey }) => {
  const raw = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  return crypto.createHash('sha512').update(raw).digest('hex');
};

const verifyCallbackSignature = ({ payload }) => {
  const serverKey = String(process.env.MIDTRANS_SERVER_KEY || '').trim();

  if (!serverKey) {
    return false;
  }

  const orderId = payload?.order_id;
  const statusCode = payload?.status_code;
  const grossAmount = payload?.gross_amount;
  const signatureKey = String(payload?.signature_key || '').toLowerCase();

  if (!orderId || !statusCode || grossAmount === undefined || !signatureKey) {
    return false;
  }

  const expectedSignature = calculateNotificationSignature({
    orderId: String(orderId),
    statusCode: String(statusCode),
    grossAmount: String(grossAmount),
    serverKey,
  }).toLowerCase();

  return signatureKey === expectedSignature;
};

module.exports = {
  createCheckoutPayment,
  getTransactionStatus,
  verifyCallbackSignature,
  mapMidtransStatus,
  mapInternalPaymentStatus,
};
