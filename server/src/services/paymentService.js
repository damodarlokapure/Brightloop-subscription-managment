const { Prisma } = require('@prisma/client');
const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');

function normalizePayment(payment) {
  if (!payment) return null;
  return {
    ...payment,
    amount: Number(payment.amount)
  };
}

function safeOutstanding(total, amountPaid) {
  return Math.max(0, Number((Number(total) - Number(amountPaid)).toFixed(2)));
}

async function listPayments({ page = 1, limit = 25, method, invoiceId, customerId, fromDate, toDate, sort = 'paymentDate', order = 'desc' } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const skip = (safePage - 1) * safeLimit;

  const where = {};
  if (method) where.method = String(method).toUpperCase();
  if (invoiceId) where.invoiceId = invoiceId;
  if (customerId) where.invoice = { customerId };

  if (fromDate || toDate) {
    where.paymentDate = {};
    if (fromDate) where.paymentDate.gte = new Date(fromDate);
    if (toDate) where.paymentDate.lte = new Date(toDate);
  }

  const orderByMap = {
    paymentDate: { paymentDate: order === 'asc' ? 'asc' : 'desc' },
    amount: { amount: order === 'asc' ? 'asc' : 'desc' },
    createdAt: { createdAt: order === 'asc' ? 'asc' : 'desc' }
  };

  const [rows, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy: orderByMap[sort] || orderByMap.paymentDate,
      include: { invoice: { include: { customer: true } }, recordedBy: true }
    }),
    prisma.payment.count({ where })
  ]);

  return {
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
    data: rows.map(normalizePayment)
  };
}

async function getPaymentById(id, customerId = null) {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { invoice: { include: { customer: true } }, recordedBy: true }
  });

  if (!payment) {
    throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found.');
  }

  if (customerId && payment.invoice.customerId !== customerId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to this payment.');
  }

  return normalizePayment(payment);
}

async function getInvoicePayments(invoiceId, customerId = null) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found.');
  }

  if (customerId && invoice.customerId !== customerId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to this invoice.');
  }

  const rows = await prisma.payment.findMany({
    where: { invoiceId },
    orderBy: { paymentDate: 'desc' },
    include: { recordedBy: true }
  });

  return rows.map(normalizePayment);
}

async function createPayment({ invoiceId, method, amount, paymentDate, note, recordedById }) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new AppError(400, 'INVALID_PAYMENT_AMOUNT', 'Payment amount must be greater than 0.');
  }

  const normalizedMethod = String(method || '').toUpperCase();
  const validMethods = ['CASH', 'CARD', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'ONLINE'];
  if (!validMethods.includes(normalizedMethod)) {
    throw new AppError(400, 'INVALID_PAYMENT_METHOD', 'Payment method is invalid.');
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT * FROM "Invoice" WHERE id = ${invoiceId}::uuid FOR UPDATE`;

    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found.');
    }

    if (invoice.status !== 'CONFIRMED') {
      throw new AppError(409, 'INVALID_INVOICE_STATUS', 'Payments can only be recorded on a confirmed invoice.');
    }

    const outstandingBefore = safeOutstanding(invoice.total, invoice.amountPaid);
    if (numericAmount > outstandingBefore) {
      throw new AppError(409, 'PAYMENT_EXCEEDS_OUTSTANDING', 'Payment exceeds the outstanding balance.');
    }

    const nextAmountPaid = Number((Number(invoice.amountPaid) + numericAmount).toFixed(2));
    const nextStatus = nextAmountPaid >= Number(invoice.total) ? 'PAID' : 'CONFIRMED';

    const payment = await tx.payment.create({
      data: {
        invoiceId,
        method: normalizedMethod,
        amount: new Prisma.Decimal(numericAmount.toFixed(2)),
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        note: note || null,
        recordedById: recordedById || null
      }
    });

    const updatedInvoice = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: new Prisma.Decimal(nextAmountPaid.toFixed(2)),
        status: nextStatus
      }
    });

    await tx.auditLog.create({
      data: {
        userId: recordedById || null,
        action: 'PAYMENT_CREATED',
        entity: 'Payment',
        entityId: payment.id,
        meta: {
          invoiceId,
          amount: numericAmount.toFixed(2),
          method: normalizedMethod,
          paymentDate: payment.paymentDate.toISOString(),
          outstandingBefore: outstandingBefore.toFixed(2),
          invoiceStatusAfter: nextStatus
        }
      }
    });

    return {
      payment: normalizePayment(payment),
      invoice: {
        ...updatedInvoice,
        total: Number(updatedInvoice.total),
        amountPaid: Number(updatedInvoice.amountPaid),
        outstanding: safeOutstanding(updatedInvoice.total, updatedInvoice.amountPaid)
      }
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });
}

async function voidPayment(paymentId, actorId = null) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: true }
    });

    if (!payment) {
      throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found.');
    }

    await tx.$queryRaw`SELECT * FROM "Invoice" WHERE id = ${payment.invoiceId}::uuid FOR UPDATE`;

    const invoice = await tx.invoice.findUnique({ where: { id: payment.invoiceId } });
    if (!invoice) {
      throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found.');
    }

    const reducedAmountPaid = Math.max(0, Number((Number(invoice.amountPaid) - Number(payment.amount)).toFixed(2)));
    const nextStatus = reducedAmountPaid >= Number(invoice.total) ? 'PAID' : 'CONFIRMED';

    await tx.invoice.update({
      where: { id: payment.invoiceId },
      data: {
        amountPaid: new Prisma.Decimal(reducedAmountPaid.toFixed(2)),
        status: nextStatus
      }
    });

    await tx.payment.delete({ where: { id: paymentId } });

    await tx.auditLog.create({
      data: {
        userId: actorId || null,
        action: 'PAYMENT_VOIDED',
        entity: 'Payment',
        entityId: paymentId,
        meta: {
          invoiceId: payment.invoiceId,
          amount: Number(payment.amount).toFixed(2),
          invoiceStatusBefore: invoice.status,
          invoiceStatusAfter: nextStatus,
          amountPaidAfter: reducedAmountPaid.toFixed(2)
        }
      }
    });

    return {
      paymentId,
      invoiceId: payment.invoiceId,
      voided: true,
      amountPaidAfter: reducedAmountPaid,
      status: nextStatus
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });
}

module.exports = {
  listPayments,
  getPaymentById,
  getInvoicePayments,
  createPayment,
  voidPayment,
  normalizePayment,
  safeOutstanding
};
