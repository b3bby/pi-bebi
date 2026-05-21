const crypto = require('crypto');

const DOKU_PAYMENT_PATH = '/checkout/v1/payment';

const getUtcIsoTimestamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

const toBase64Sha256 = (value) =>
  crypto.createHash('sha256').update(value).digest('base64');

const createSignatureString = ({ clientId, requestId, requestTimestamp, requestTarget, digest }) =>
  [
    `Client-Id:${clientId}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${requestTimestamp}`,
    `Request-Target:${requestTarget}`,
    `Digest:${digest}`,
  ].join('\n');

const createDokuSignature = ({ secretKey, stringToSign }) =>
  `HMACSHA256=${crypto.createHmac('sha256', secretKey).update(stringToSign).digest('base64')}`;

const createRequestId = () => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
};

const mapDokuStatus = (rawStatus) => {
  const status = String(rawStatus || '').toUpperCase();

  if (status === 'SUCCESS' || status === 'PAID') {
    return 'PAID';
  }

  if (status === 'FAILED') {
    return 'FAILED';
  }

  if (status === 'EXPIRED') {
    return 'EXPIRED';
  }

  if (status === 'REFUNDED') {
    return 'REFUNDED';
  }

  return 'PENDING';
};

const mapInternalPaymentStatus = (dokuStatus) => {
  if (dokuStatus === 'PAID') {
    return 'succeeded';
  }

  if (['FAILED', 'EXPIRED', 'REFUNDED'].includes(dokuStatus)) {
    return 'failed';
  }

  return 'pending';
};

const buildCheckoutPayload = ({
  amount,
  invoiceNumber,
  callbackUrl,
  successUrl,
  failedUrl,
  paymentDueDate,
  customer,
}) => {
  const payload = {
    order: {
      amount,
      invoice_number: invoiceNumber,
      currency: 'IDR',
      callback_url: callbackUrl,
      callback_url_result: successUrl,
      callback_url_cancel: failedUrl,
      auto_redirect: false,
    },
    payment: {
      payment_due_date: paymentDueDate,
    },
  };

  if (customer && (customer.name || customer.email || customer.phone)) {
    payload.customer = {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
    };
  }

  return payload;
};

const buildCheckoutRequestHeaders = ({ clientId, secretKey, requestId, requestTimestamp, requestTarget, rawBody }) => {
  const digest = toBase64Sha256(rawBody);
  const stringToSign = createSignatureString({
    clientId,
    requestId,
    requestTimestamp,
    requestTarget,
    digest,
  });
  const signature = createDokuSignature({ secretKey, stringToSign });

  return {
    'Client-Id': clientId,
    'Request-Id': requestId,
    'Request-Timestamp': requestTimestamp,
    Signature: signature,
    'Content-Type': 'application/json',
  };
};

const createCheckoutPayment = async ({ amount, invoiceNumber, customer, paymentDueDate }) => {
  const clientId = String(process.env.DOKU_CLIENT_ID || '').trim();
  const secretKey = String(process.env.DOKU_SECRET_KEY || '').trim();
  const baseUrl = String(process.env.DOKU_BASE_URL || 'https://api-sandbox.doku.com').trim();
  const callbackUrl = String(process.env.DOKU_CALLBACK_URL || '').trim();
  const successUrl = String(process.env.DOKU_RETURN_URL || callbackUrl).trim();
  const failedUrl = String(process.env.DOKU_FAILED_URL || callbackUrl).trim();

  if (!clientId || !secretKey || !callbackUrl) {
    throw new Error('DOKU credentials are incomplete in environment variables');
  }

  const safeDueDate = Number.isFinite(Number(paymentDueDate))
    ? Number(paymentDueDate)
    : Number(process.env.DOKU_PAYMENT_EXPIRED_MINUTES || 60);

  const payload = buildCheckoutPayload({
    amount,
    invoiceNumber,
    callbackUrl,
    successUrl,
    failedUrl,
    paymentDueDate: safeDueDate,
    customer,
  });

  const rawBody = JSON.stringify(payload);
  const requestId = createRequestId();
  const requestTimestamp = getUtcIsoTimestamp();

  const headers = buildCheckoutRequestHeaders({
    clientId,
    secretKey,
    requestId,
    requestTimestamp,
    requestTarget: DOKU_PAYMENT_PATH,
    rawBody,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${baseUrl}${DOKU_PAYMENT_PATH}`, {
      method: 'POST',
      headers,
      body: rawBody,
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

const normalizeHeader = (headers, key) => {
  const candidates = [key, key.toLowerCase(), key.toUpperCase()];
  for (const candidate of candidates) {
    if (headers[candidate] !== undefined) {
      return headers[candidate];
    }
  }

  const found = Object.keys(headers).find((headerKey) => headerKey.toLowerCase() === key.toLowerCase());
  return found ? headers[found] : undefined;
};

const verifyCallbackSignature = ({ headers, requestTarget, rawBody }) => {
  const clientId = String(process.env.DOKU_CLIENT_ID || '').trim();
  const secretKey = String(process.env.DOKU_SECRET_KEY || '').trim();

  if (!clientId || !secretKey) {
    return false;
  }

  const requestId =
    normalizeHeader(headers, 'Request-Id') ||
    normalizeHeader(headers, 'X-External-Id') ||
    normalizeHeader(headers, 'X-Request-Id');
  const requestTimestamp = normalizeHeader(headers, 'Request-Timestamp') || normalizeHeader(headers, 'X-TIMESTAMP');
  const signature = normalizeHeader(headers, 'Signature') || normalizeHeader(headers, 'X-SIGNATURE');

  if (!requestId || !requestTimestamp || !signature) {
    return false;
  }

  const digest = toBase64Sha256(rawBody || '{}');
  const stringToSign = createSignatureString({
    clientId,
    requestId,
    requestTimestamp,
    requestTarget,
    digest,
  });

  const expectedSignature = createDokuSignature({ secretKey, stringToSign });
  return signature === expectedSignature;
};

module.exports = {
  createCheckoutPayment,
  verifyCallbackSignature,
  mapDokuStatus,
  mapInternalPaymentStatus,
};
