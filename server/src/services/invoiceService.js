const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');

function normalizeInvoice(invoice) {
  if (!invoice) return null;

  const total = Number(invoice.total || 0);
  const amountPaid = Number(invoice.amountPaid || 0);
  const outstanding = Math.max(0, Number((total - amountPaid).toFixed(2)));
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const overdueDate = dueDate ? new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate())) : null;
  let daysOverdue = 0;
  if (invoice.status === 'CONFIRMED' && dueDate && outstanding > 0 && overdueDate < todayUtc) {
    daysOverdue = Math.max(0, Math.floor((todayUtc.getTime() - overdueDate.getTime()) / (24 * 60 * 60 * 1000)));
  }

  return {
    ...invoice,
    status: invoice.status,
    total,
    amountPaid,
    outstanding,
    daysOverdue,
    subtotal: Number(invoice.subtotal),
    discountTotal: Number(invoice.discountTotal),
    taxTotal: Number(invoice.taxTotal)
  };
}

async function listInvoices({ page = 1, limit = 25, status, customerId, subscriptionId, overdue, dateRange, dueRange, search, sort = 'createdAt', order = 'desc' } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const skip = (safePage - 1) * safeLimit;

  const where = {};
  if (customerId) where.customerId = customerId;
  if (status) where.status = String(status).toUpperCase();
  if (subscriptionId) where.subscriptionId = subscriptionId;

  const normalizedDateRange = (() => {
    if (!dateRange) return null;
    if (Array.isArray(dateRange)) return dateRange;
    if (typeof dateRange === 'string') return dateRange.split(',').map((part) => part.trim()).filter(Boolean);
    return null;
  })();

  const normalizedDueRange = (() => {
    if (!dueRange) return null;
    if (Array.isArray(dueRange)) return dueRange;
    if (typeof dueRange === 'string') return dueRange.split(',').map((part) => part.trim()).filter(Boolean);
    return null;
  })();

  if (normalizedDateRange && normalizedDateRange.length === 2) {
    where.issueDate = { gte: new Date(normalizedDateRange[0]), lte: new Date(normalizedDateRange[1]) };
  }

  if (normalizedDueRange && normalizedDueRange.length === 2) {
    where.dueDate = { gte: new Date(normalizedDueRange[0]), lte: new Date(normalizedDueRange[1]) };
  }

  if (overdue === 'true' || overdue === true) {
    where.status = { not: 'PAID' };
    where.dueDate = { lt: new Date() };
  }

  if (search) {
    where.OR = [
      { number: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } }
    ];
  }

  const orderByMap = {
    createdAt: { createdAt: order === 'asc' ? 'asc' : 'desc' },
    total: { total: order === 'asc' ? 'asc' : 'desc' },
    dueDate: { dueDate: order === 'asc' ? 'asc' : 'desc' },
    status: { status: order === 'asc' ? 'asc' : 'desc' }
  };

  const [rows, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy: orderByMap[sort] || orderByMap.createdAt,
      include: { customer: true, lines: true, discounts: true }
    }),
    prisma.invoice.count({ where })
  ]);

  return {
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
    data: rows.map(normalizeInvoice)
  };
}

async function getInvoiceById(id, customerId = null) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      subscription: true,
      lines: true,
      discounts: { include: { discount: true } },
      payments: true
    }
  });

  if (!invoice) {
    throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found.');
  }

  if (customerId && invoice.customerId !== customerId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to this invoice.');
  }

  return normalizeInvoice(invoice);
}

async function changeInvoiceStatus(id, nextStatus, options = {}) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found.');

  const transitions = {
    DRAFT: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PAID', 'CANCELLED'],
    PAID: [],
    CANCELLED: []
  };

  const target = String(nextStatus).toUpperCase();
  if (!transitions[invoice.status]?.includes(target)) {
    throw new AppError(409, 'INVALID_INVOICE_STATUS', `Invalid transition from ${invoice.status} to ${target}.`);
  }

  if (target === 'CANCELLED') {
    const paymentCount = await prisma.payment.count({ where: { invoiceId: id } });
    if (paymentCount > 0) {
      throw new AppError(409, 'INVOICE_HAS_PAYMENTS', 'Cannot cancel an invoice that already has payments.');
    }
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      status: target,
      ...(target === 'PAID' ? { sentAt: invoice.sentAt || new Date() } : {})
    }
  });

  return normalizeInvoice(updated);
}

async function confirmInvoice(id) {
  return changeInvoiceStatus(id, 'CONFIRMED');
}

async function cancelInvoice(id) {
  return changeInvoiceStatus(id, 'CANCELLED');
}

async function sendInvoice(id) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found.');
  if (invoice.status !== 'CONFIRMED') {
    throw new AppError(409, 'INVALID_INVOICE_STATUS', 'Only confirmed invoices can be sent.');
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: { sentAt: new Date() }
  });

  return normalizeInvoice(updated);
}

function buildPrintHtml(invoice, customer, lines, discounts) {
  const rows = lines.map((line) => `
    <tr>
      <td>${line.description}</td>
      <td>${line.quantity}</td>
      <td>${Number(line.unitPrice).toFixed(2)}</td>
      <td>${Number(line.taxAmount).toFixed(2)}</td>
      <td>${Number(line.discountAmount).toFixed(2)}</td>
      <td>${Number(line.amount).toFixed(2)}</td>
    </tr>
  `).join('');

  const discountRows = discounts.map((discount) => `
    <tr>
      <td>${discount.discount?.name || 'Discount'}</td>
      <td>${Number(discount.amount).toFixed(2)}</td>
    </tr>
  `).join('') || '<tr><td colspan="2">No discounts</td></tr>';

  return `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 28px; color: #1a1a1a; }
          .header { display: flex; justify-content: space-between; border-bottom: 1px solid #ddd; padding-bottom: 14px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 18px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .totals { margin-top: 18px; display: flex; justify-content: flex-end; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h2>Brightloop</h2>
            <div>Invoice ${invoice.number}</div>
          </div>
          <div>
            <div>Customer: ${customer?.name || 'N/A'}</div>
            <div>Email: ${customer?.email || 'N/A'}</div>
            <div>Due: ${new Date(invoice.dueDate).toISOString().slice(0,10)}</div>
          </div>
        </div>
        <h3>Line items</h3>
        <table>
          <thead>
            <tr><th>Description</th><th>Qty</th><th>Unit</th><th>Tax</th><th>Discount</th><th>Total</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <h3>Discounts</h3>
        <table>
          <thead><tr><th>Discount</th><th>Amount</th></tr></thead>
          <tbody>${discountRows}</tbody>
        </table>
        <div class="totals">
          <table style="width: 320px;">
            <tr><td>Subtotal</td><td>${Number(invoice.subtotal).toFixed(2)}</td></tr>
            <tr><td>Discount</td><td>${Number(invoice.discountTotal).toFixed(2)}</td></tr>
            <tr><td>Tax</td><td>${Number(invoice.taxTotal).toFixed(2)}</td></tr>
            <tr><td>Total</td><td>${Number(invoice.total).toFixed(2)}</td></tr>
          </table>
        </div>
      </body>
    </html>
  `;
}

async function printInvoice(id) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      lines: true,
      discounts: { include: { discount: true } }
    }
  });

  if (!invoice) throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found.');
  return buildPrintHtml(invoice, invoice.customer, invoice.lines, invoice.discounts);
}

async function bulkConfirmInvoice(ids) {
  const uniqueIds = [...new Set(ids || [])];
  const results = [];
  for (const id of uniqueIds) {
    try {
      const invoice = await confirmInvoice(id);
      results.push(invoice);
    } catch (error) {
      results.push({ id, error: error.message });
    }
  }
  return results;
}

async function bulkSendInvoices(ids) {
  const uniqueIds = [...new Set(ids || [])];
  const results = [];
  for (const id of uniqueIds) {
    try {
      const invoice = await sendInvoice(id);
      results.push(invoice);
    } catch (error) {
      results.push({ id, error: error.message });
    }
  }
  return results;
}

module.exports = {
  listInvoices,
  getInvoiceById,
  confirmInvoice,
  cancelInvoice,
  sendInvoice,
  printInvoice,
  bulkConfirmInvoice,
  bulkSendInvoices
};
