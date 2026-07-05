const { Op } = require('sequelize');
const { Order, Payment, PaymentLog, Request } = require('../models');
const {
  createCheckoutPayment,
  getTransactionStatus,
  verifyCallbackSignature,
  mapMidtransStatus,
  mapInternalPaymentStatus,
} = require('../services/payment/midtransService');

const FAILED_PROVIDER_STATUSES = new Set(['FAILED', 'EXPIRED', 'REFUNDED']);

const getPaymentUrl = (responsePayload) =>
  responsePayload?.redirect_url ||
  responsePayload?.payment?.url ||
  responsePayload?.payment_url ||
  null;

const extractTransactionStatus = (responsePayload) =>
  responsePayload?.transaction_status ||
  responsePayload?.status ||
  'pending';

const extractFraudStatus = (responsePayload) =>
  responsePayload?.fraud_status ||
  null;

const extractInvoiceNumber = (responsePayload) =>
  responsePayload?.order_id ||
  responsePayload?.invoice_number ||
  null;

const extractProviderErrorMessage = (responsePayload) =>
  responsePayload?.error_messages?.[0] ||
  responsePayload?.status_message ||
  responsePayload?.error?.message ||
  responsePayload?.message ||
  null;

const getTrustedReturnUrl = (req) => {
  const rawUrl = String(req.body?.returnUrl || '').trim();
  if (!rawUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return null;
    }

    const requestOrigin = String(req.headers.origin || '').trim();
    if (requestOrigin && parsedUrl.origin !== requestOrigin) {
      return null;
    }

    return parsedUrl.toString();
  } catch (_error) {
    return null;
  }
};

const findExistingIdempotent = async ({ idempotencyKey, orderId }) => {
  if (!idempotencyKey) {
    return null;
  }

  return PaymentLog.findOne({
    where: {
      idempotency_key: idempotencyKey,
      ...(orderId ? { order_id: orderId } : {}),
    },
    order: [['created_at', 'DESC']],
  });
};

const findLatestPaymentLogByPaymentId = async (paymentId) => {
  if (!paymentId) {
    return null;
  }

  return PaymentLog.findOne({
    where: { payment_id: paymentId },
    order: [['created_at', 'DESC']],
  });
};

const syncOrderStatusForPaidPayment = async (payment) => {
  if (!payment || payment.status !== 'succeeded') {
    return;
  }

  const order = await Order.findByPk(payment.order_id);
  if (!order) {
    return;
  }

  if (payment.type === 'dp') {
    return;
  }

  if (payment.type === 'final') {
    const completedAt = order.completed_at || new Date();
    await order.update({
      status: 'completed',
      completed_at: completedAt,
    });

    if (order.request_id) {
      await Request.update(
        { status: 'completed' },
        { where: { id: order.request_id } }
      );
    }
  }
};

const syncPaymentStatusFromProvider = async ({ providerInvoiceId, payment, paymentLog }) => {
  const lookupId = String(providerInvoiceId || '').trim();
  if (!lookupId) {
    return { synced: false, reason: 'missing_lookup_id' };
  }

  const statusResponse = await getTransactionStatus({ orderIdOrTransactionId: lookupId });

  if (!statusResponse.ok) {
    return {
      synced: false,
      statusCode: statusResponse.statusCode,
      response: statusResponse.response,
    };
  }

  const providerStatus = mapMidtransStatus({
    transactionStatus: extractTransactionStatus(statusResponse.response),
    fraudStatus: extractFraudStatus(statusResponse.response),
  });
  const internalStatus = mapInternalPaymentStatus(providerStatus);

  if (payment) {
    const paymentUpdate = {};
    if (payment.status !== internalStatus) {
      paymentUpdate.status = internalStatus;
    }
    if (!payment.provider_txn_id) {
      paymentUpdate.provider_txn_id = lookupId;
    }

    if (Object.keys(paymentUpdate).length > 0) {
      await payment.update(paymentUpdate);
    }
    await syncOrderStatusForPaidPayment(payment);
  }

  const providerCheckPayload = {
    checkedAt: new Date().toISOString(),
    statusCode: statusResponse.statusCode,
    response: statusResponse.response,
  };

  const providerTransactionId = statusResponse?.response?.transaction_id || null;

  let syncedLog = paymentLog;
  if (paymentLog) {
    await paymentLog.update({
      status: providerStatus,
      external_id: providerTransactionId || paymentLog.external_id,
      payload: {
        ...(paymentLog.payload || {}),
        providerStatusCheck: providerCheckPayload,
      },
    });
    syncedLog = paymentLog;
  } else if (payment) {
    syncedLog = await PaymentLog.create({
      order_id: payment.order_id,
      payment_id: payment.id,
      doku_invoice_id: lookupId,
      request_id: null,
      external_id: providerTransactionId,
      status: providerStatus,
      payload: {
        providerStatusCheck: providerCheckPayload,
      },
    });
  }

  return {
    synced: true,
    providerStatus,
    internalStatus,
    statusCode: statusResponse.statusCode,
    response: statusResponse.response,
    payment,
    paymentLog: syncedLog,
  };
};

const create = async (req, res) => {
  try {
    const orderId = Number.parseInt(req.body?.orderId, 10);
    const providedAmount = Number(req.body?.amount);
    const type = req.body?.type || 'final';
    const validTypes = ['dp', 'final', 'refund', 'payout_fee'];

    if (!Number.isInteger(orderId)) {
      return res.status(400).json({ message: 'orderId is required' });
    }

    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid payment type' });
    }

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const amount = Number.isFinite(providedAmount) && providedAmount > 0
      ? Math.round(providedAmount)
      : Math.round(Number(order.total_price));

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const idempotencyKey =
      req.headers['x-idempotency-key'] || req.body?.idempotencyKey || null;

    const existingIdempotent = await findExistingIdempotent({ idempotencyKey, orderId });
    if (existingIdempotent) {
      const payload = existingIdempotent.payload || {};
      const responsePayload = payload.response || {};
      const previousStatusCode = Number(payload.statusCode || 200);
      const providerErrorMessage = extractProviderErrorMessage(responsePayload);
      const shouldTreatAsFailure =
        previousStatusCode >= 400 || FAILED_PROVIDER_STATUSES.has(existingIdempotent.status);

      if (shouldTreatAsFailure) {
        return res.status(502).json({
          reused: true,
          message: 'Failed to create Midtrans payment',
          statusCode: previousStatusCode,
          providerError: providerErrorMessage,
          logId: existingIdempotent.id,
          response: responsePayload,
        });
      }

      return res.json({
        reused: true,
        message: 'Idempotency key already processed',
        paymentId: existingIdempotent.payment_id,
        orderId: existingIdempotent.order_id,
        invoiceNumber: existingIdempotent.doku_invoice_id,
        paymentUrl: getPaymentUrl(responsePayload),
        snapToken: responsePayload?.token || null,
        snapClientKey: String(process.env.MIDTRANS_CLIENT_KEY || '').trim() || null,
        isProduction: String(process.env.MIDTRANS_IS_PRODUCTION || 'false') === 'true',
        status: existingIdempotent.status,
        logId: existingIdempotent.id,
        requestId: existingIdempotent.request_id,
      });
    }

    let payment = await Payment.findOne({
      where: {
        order_id: orderId,
        type,
      },
      order: [['created_at', 'DESC']],
    });

    if (!payment) {
      payment = await Payment.create({
        order_id: order.id,
        user_id: order.user_id,
        merchant_id: order.merchant_id,
        amount,
        type,
        status: 'pending',
      });
    }

    let latestLog = await findLatestPaymentLogByPaymentId(payment.id);
    const providerLookupId = latestLog?.doku_invoice_id || payment.provider_txn_id || null;

    if (providerLookupId) {
      let providerSync = null;
      try {
        providerSync = await syncPaymentStatusFromProvider({
          providerInvoiceId: providerLookupId,
          payment,
          paymentLog: latestLog,
        });
      } catch (error) {
        providerSync = null;
      }

      latestLog = await findLatestPaymentLogByPaymentId(payment.id);

      const latestProviderStatus = providerSync?.providerStatus || latestLog?.status || null;
      if (latestProviderStatus === 'PAID' || payment.status === 'succeeded') {
        return res.json({
          reused: true,
          message: 'Payment already paid',
          paymentId: payment.id,
          orderId: order.id,
          invoiceNumber: providerLookupId,
          paymentUrl: getPaymentUrl(latestLog?.payload?.response || {}),
          snapToken: latestLog?.payload?.response?.token || null,
          snapClientKey: String(process.env.MIDTRANS_CLIENT_KEY || '').trim() || null,
          isProduction: String(process.env.MIDTRANS_IS_PRODUCTION || 'false') === 'true',
          status: 'PAID',
          logId: latestLog?.id || null,
          requestId: latestLog?.request_id || null,
        });
      }

      const canReusePendingPayment =
        latestProviderStatus === 'PENDING' ||
        (!providerSync && latestLog?.status === 'PENDING');

      if (canReusePendingPayment && latestLog?.payload?.response?.token) {
        return res.json({
          reused: true,
          message: 'Existing pending payment reused',
          paymentId: payment.id,
          orderId: order.id,
          invoiceNumber: latestLog.doku_invoice_id,
          paymentUrl: getPaymentUrl(latestLog.payload.response),
          snapToken: latestLog.payload.response.token,
          snapClientKey: String(process.env.MIDTRANS_CLIENT_KEY || '').trim() || null,
          isProduction: String(process.env.MIDTRANS_IS_PRODUCTION || 'false') === 'true',
          status: 'PENDING',
          logId: latestLog.id,
          requestId: latestLog.request_id,
        });
      }
    }

    const invoiceNumber = req.body?.invoiceNumber || `INV-${orderId}-${type.toUpperCase()}-${Date.now()}`;

    const customer = {
      name: req.body?.customerName,
      email: req.body?.customerEmail,
      phone: req.body?.customerPhone,
    };
    const trustedReturnUrl = getTrustedReturnUrl(req);

    const midtransResponse = await createCheckoutPayment({
      amount,
      invoiceNumber,
      customer,
      paymentDueDate: req.body?.paymentDueDate,
      callbackUrls: trustedReturnUrl
        ? {
            finish: trustedReturnUrl,
            unfinish: trustedReturnUrl,
            error: trustedReturnUrl,
          }
        : null,
    });

    const providerStatus = mapMidtransStatus({
      transactionStatus: extractTransactionStatus(midtransResponse.response),
      fraudStatus: extractFraudStatus(midtransResponse.response),
    });
    const internalStatus = mapInternalPaymentStatus(providerStatus);
    const providerInvoiceId = extractInvoiceNumber(midtransResponse.response) || invoiceNumber;

    await payment.update({
      provider_txn_id: providerInvoiceId,
      status: internalStatus,
    });
    await syncOrderStatusForPaidPayment(payment);

    const paymentLog = await PaymentLog.create({
      order_id: order.id,
      payment_id: payment.id,
      doku_invoice_id: providerInvoiceId,
      request_id: midtransResponse.requestId,
      external_id: midtransResponse?.response?.transaction_id || null,
      idempotency_key: idempotencyKey,
      status: providerStatus,
      payload: {
        request: midtransResponse.payload,
        response: midtransResponse.response,
        requestTimestamp: midtransResponse.requestTimestamp,
        statusCode: midtransResponse.statusCode,
      },
    });

    if (!midtransResponse.ok) {
      const providerErrorMessage = extractProviderErrorMessage(midtransResponse.response);
      return res.status(502).json({
        message: 'Failed to create Midtrans payment',
        statusCode: midtransResponse.statusCode,
        providerError: providerErrorMessage,
        logId: paymentLog.id,
        response: midtransResponse.response,
      });
    }

    return res.status(201).json({
      message: 'Payment invoice created',
      paymentId: payment.id,
      orderId: order.id,
      invoiceNumber: providerInvoiceId,
      paymentUrl: getPaymentUrl(midtransResponse.response),
      snapToken: midtransResponse?.response?.token || null,
      snapClientKey: String(process.env.MIDTRANS_CLIENT_KEY || '').trim() || null,
      isProduction: String(process.env.MIDTRANS_IS_PRODUCTION || 'false') === 'true',
      status: providerStatus,
      logId: paymentLog.id,
      requestId: midtransResponse.requestId,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

const callback = async (req, res) => {
  try {
    const payload = req.body || {};
    const skipSignatureValidation = String(process.env.MIDTRANS_SKIP_SIGNATURE_VALIDATION || 'false') === 'true';

    const isValidSignature = skipSignatureValidation
      ? true
      : verifyCallbackSignature({ payload });

    if (!isValidSignature) {
      return res.status(401).json({ message: 'Invalid callback signature' });
    }

    const providerInvoiceId = payload?.order_id || null;

    const providerStatus = mapMidtransStatus({
      transactionStatus: payload?.transaction_status || payload?.status,
      fraudStatus: payload?.fraud_status,
    });
    const internalStatus = mapInternalPaymentStatus(providerStatus);

    const paymentLog = providerInvoiceId
      ? await PaymentLog.findOne({
          where: { doku_invoice_id: providerInvoiceId },
          order: [['created_at', 'DESC']],
        })
      : null;

    let payment = null;

    if (paymentLog?.payment_id) {
      payment = await Payment.findByPk(paymentLog.payment_id);
    }

    if (!payment && providerInvoiceId) {
      payment = await Payment.findOne({ where: { provider_txn_id: providerInvoiceId } });
    }

    if (payment) {
      await payment.update({ status: internalStatus });
      await syncOrderStatusForPaidPayment(payment);
    }

    if (paymentLog) {
      await paymentLog.update({
        status: providerStatus,
        external_id: payload?.transaction_id || paymentLog.external_id,
        payload: {
          ...(paymentLog.payload || {}),
          callback: payload,
        },
      });
    } else {
      await PaymentLog.create({
        payment_id: payment?.id || null,
        order_id: payment?.order_id || null,
        doku_invoice_id: providerInvoiceId,
        request_id:
          req.headers['x-request-id'] ||
          req.headers['request-id'] ||
          null,
        external_id: payload?.transaction_id || null,
        status: providerStatus,
        payload: {
          callback: payload,
        },
      });
    }

    return res.json({ message: 'Callback received', status: providerStatus });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

const status = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = String(req.query.scope || 'auto').trim().toLowerCase();
    const numericId = Number.parseInt(id, 10);
    const findLogs = async (where) =>
      PaymentLog.findAll({
        where,
        order: [['created_at', 'DESC']],
        limit: 20,
      });

    let logs = [];

    if (scope === 'order') {
      if (!Number.isInteger(numericId)) {
        return res.status(400).json({ message: 'Numeric order id is required' });
      }
      logs = await findLogs({ order_id: numericId });
    } else if (scope === 'payment') {
      if (!Number.isInteger(numericId)) {
        return res.status(400).json({ message: 'Numeric payment id is required' });
      }
      logs = await findLogs({ payment_id: numericId });
    } else if (scope === 'invoice') {
      logs = await findLogs({ doku_invoice_id: id });
    } else if (Number.isInteger(numericId)) {
      logs = await findLogs({ order_id: numericId });
      if (!logs.length) {
        logs = await findLogs({ payment_id: numericId });
      }
      if (!logs.length) {
        logs = await findLogs({ doku_invoice_id: id });
      }
    } else {
      logs = await findLogs({ doku_invoice_id: id });
    }

    if (!logs.length) {
      return res.status(404).json({ message: 'Payment status not found' });
    }

    let latest = logs[0];
    let payment = latest.payment_id ? await Payment.findByPk(latest.payment_id) : null;

    const providerLookupId = latest.doku_invoice_id || payment?.provider_txn_id || null;
    if (providerLookupId) {
      try {
        const providerSync = await syncPaymentStatusFromProvider({
          providerInvoiceId: providerLookupId,
          payment,
          paymentLog: latest,
        });

        if (providerSync?.synced) {
          if (providerSync.paymentLog) {
            latest = providerSync.paymentLog;
          }
          if (providerSync.payment) {
            payment = providerSync.payment;
          }
        }
      } catch (error) {
        // fallback to stored local status
      }
    }

    let refreshedLogs = [];
    if (scope === 'order' && Number.isInteger(numericId)) {
      refreshedLogs = await findLogs({ order_id: numericId });
    } else if (scope === 'payment' && Number.isInteger(numericId)) {
      refreshedLogs = await findLogs({ payment_id: numericId });
    } else if (scope === 'invoice') {
      refreshedLogs = await findLogs({ doku_invoice_id: id });
    } else if (Number.isInteger(numericId)) {
      refreshedLogs = await findLogs({ order_id: numericId });
      if (!refreshedLogs.length) {
        refreshedLogs = await findLogs({ payment_id: numericId });
      }
      if (!refreshedLogs.length) {
        refreshedLogs = await findLogs({ doku_invoice_id: id });
      }
    } else {
      refreshedLogs = await findLogs({ doku_invoice_id: id });
    }

    if (refreshedLogs.length > 0) {
      latest = refreshedLogs[0];
    }

    if (latest.payment_id) {
      payment = await Payment.findByPk(latest.payment_id);
    }

    return res.json({
      id,
      status: latest.status,
      internalStatus: mapInternalPaymentStatus(latest.status),
      payment: payment
        ? {
            id: payment.id,
            order_id: payment.order_id,
            type: payment.type,
            status: payment.status,
            amount: payment.amount,
          }
        : null,
      latest,
      history: refreshedLogs.length > 0 ? refreshedLogs : logs,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

module.exports = {
  create,
  callback,
  status,
};
