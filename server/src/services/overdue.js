const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const nodemailer = require('nodemailer');

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number(value.toFixed(2));
  if (typeof value.toNumber === 'function') return Number(value.toNumber().toFixed(2));
  return Number(Number(value).toFixed(2));
}

function dateOnly(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date supplied to overdue utility.');
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getOutstanding(invoice) {
  const total = toNumber(invoice.total);
  const amountPaid = toNumber(invoice.amountPaid);
  return Math.max(0, Number((total - amountPaid).toFixed(2)));
}

function getInvoiceOverdueMeta(invoice, asOfDate = new Date()) {
  const total = toNumber(invoice.total);
  const amountPaid = toNumber(invoice.amountPaid);
  const outstanding = Math.max(0, Number((total - amountPaid).toFixed(2)));
  if (!invoice || invoice.status !== 'CONFIRMED' || outstanding <= 0) {
    return { isOverdue: false, outstanding, daysOverdue: 0 };
  }

  const today = dateOnly(asOfDate);
  const dueDate = dateOnly(invoice.dueDate);
  if (dueDate >= today) {
    return { isOverdue: false, outstanding, daysOverdue: 0 };
  }

  const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)));
  return { isOverdue: true, outstanding, daysOverdue };
}

async function getOverdueInvoiceIds(asOfDate = new Date()) {
  const today = dateOnly(asOfDate);
  const rows = await prisma.$queryRaw`
    SELECT id
    FROM "Invoice"
    WHERE status = 'CONFIRMED'
      AND "dueDate" < ${today}
      AND ("total" - "amountPaid") > 0
    ORDER BY "dueDate" ASC;
  `;

  return rows.map((row) => row.id);
}

async function getReceivablesSummary(asOfDate = new Date()) {
  const today = dateOnly(asOfDate);
  const row = await prisma.$queryRaw`
    SELECT
      COALESCE(SUM(CASE
        WHEN status != 'CANCELLED' AND ("total" - "amountPaid") > 0 THEN ("total" - "amountPaid")
        ELSE 0
      END), 0)::numeric AS "outstandingTotal",
      COALESCE(SUM(CASE
        WHEN status = 'CONFIRMED' AND "dueDate" < ${today} AND ("total" - "amountPaid") > 0 THEN ("total" - "amountPaid")
        ELSE 0
      END), 0)::numeric AS "overdueTotal",
      COALESCE(SUM("amountPaid"), 0)::numeric AS "paidTotal",
      COALESCE(SUM(CASE
        WHEN status = 'CONFIRMED' AND "dueDate" < ${today} AND ("total" - "amountPaid") > 0 AND ((DATE(${today}) - DATE("dueDate"))::int) BETWEEN 0 AND 30 THEN ("total" - "amountPaid")
        ELSE 0
      END), 0)::numeric AS "aging0To30",
      COALESCE(SUM(CASE
        WHEN status = 'CONFIRMED' AND "dueDate" < ${today} AND ("total" - "amountPaid") > 0 AND ((DATE(${today}) - DATE("dueDate"))::int) BETWEEN 31 AND 60 THEN ("total" - "amountPaid")
        ELSE 0
      END), 0)::numeric AS "aging31To60",
      COALESCE(SUM(CASE
        WHEN status = 'CONFIRMED' AND "dueDate" < ${today} AND ("total" - "amountPaid") > 0 AND ((DATE(${today}) - DATE("dueDate"))::int) BETWEEN 61 AND 90 THEN ("total" - "amountPaid")
        ELSE 0
      END), 0)::numeric AS "aging61To90",
      COALESCE(SUM(CASE
        WHEN status = 'CONFIRMED' AND "dueDate" < ${today} AND ("total" - "amountPaid") > 0 AND ((DATE(${today}) - DATE("dueDate"))::int) >= 91 THEN ("total" - "amountPaid")
        ELSE 0
      END), 0)::numeric AS "aging90Plus"
    FROM "Invoice";
  `;

  const summary = row[0] || {};
  return {
    outstandingTotal: toNumber(summary.outstandingTotal),
    overdueTotal: toNumber(summary.overdueTotal),
    paidTotal: toNumber(summary.paidTotal),
    aging: {
      '0-30': toNumber(summary.aging0To30),
      '31-60': toNumber(summary.aging31To60),
      '61-90': toNumber(summary.aging61To90),
      '90+': toNumber(summary.aging90Plus)
    }
  };
}

async function sendInvoiceReminder(invoiceId, actorId = null) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { customer: true }
  });

  if (!invoice) {
    throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found.');
  }

  const outstanding = getOutstanding(invoice);
  if (outstanding <= 0) {
    throw new AppError(409, 'INVOICE_NOT_OVERDUE', 'This invoice is not overdue and does not need a reminder.');
  }

  const customerEmail = invoice.customer?.email;
  const subject = `Reminder: Invoice ${invoice.number} is due`;
  const text = `Hello ${invoice.customer?.name || 'Customer'},\n\nThis is a reminder that invoice ${invoice.number} is outstanding. Amount due: ${outstanding.toFixed(2)}. Due date: ${new Date(invoice.dueDate).toISOString().slice(0, 10)}.\n\nThanks,\nBrightloop`;

  const smtpHost = process.env.SMTP_HOST;
  if (smtpHost) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Boolean(process.env.SMTP_SECURE === 'true'),
      auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined
    });

    if (customerEmail) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'no-reply@brightloop.local',
        to: customerEmail,
        subject,
        text
      });
    }
  } else {
    console.log('[invoice-reminder]', { invoiceId, customerEmail, subject, text });
  }

  await prisma.auditLog.create({
    data: {
      userId: actorId || null,
      action: 'INVOICE_REMINDER_SENT',
      entity: 'Invoice',
      entityId: invoice.id,
      meta: {
        invoiceNumber: invoice.number,
        customerId: invoice.customerId,
        customerEmail,
        outstanding: outstanding.toString(),
        dueDate: invoice.dueDate.toISOString()
      }
    }
  });

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    customerEmail,
    sent: true,
    outstanding
  };
}

async function remindOverdueInvoices(asOfDate = new Date(), actorId = null) {
  const invoiceIds = await getOverdueInvoiceIds(asOfDate);
  const results = [];

  for (const invoiceId of invoiceIds) {
    try {
      const result = await sendInvoiceReminder(invoiceId, actorId);
      results.push(result);
    } catch (error) {
      results.push({ invoiceId, error: error.message });
    }
  }

  return {
    total: invoiceIds.length,
    sent: results.filter((result) => result.sent).length,
    results
  };
}

module.exports = {
  dateOnly,
  getOutstanding,
  getInvoiceOverdueMeta,
  getOverdueInvoiceIds,
  getReceivablesSummary,
  sendInvoiceReminder,
  remindOverdueInvoices
};
