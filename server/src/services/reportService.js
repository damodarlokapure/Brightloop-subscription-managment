const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');

const cache = new Map();

function cacheKey(prefix, params) {
  return `${prefix}:${JSON.stringify(params || {})}`;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number(value.toFixed(2));
  if (typeof value.toNumber === 'function') return Number(value.toNumber().toFixed(2));
  return Number(Number(value).toFixed(2));
}

function normalizeSummaryRow(row) {
  return {
    activeSubscriptions: Number(row.activeSubscriptions || 0),
    newSubscriptions: Number(row.newSubscriptions || 0),
    closedSubscriptions: Number(row.closedSubscriptions || 0),
    mrr: toNumber(row.mrr),
    arr: toNumber(row.arr),
    revenueCollected: toNumber(row.revenueCollected),
    invoicedTotal: toNumber(row.invoicedTotal),
    outstandingTotal: toNumber(row.outstandingTotal),
    overdueCount: Number(row.overdueCount || 0),
    overdueTotal: toNumber(row.overdueTotal),
    paidInvoiceCount: Number(row.paidInvoiceCount || 0)
  };
}

async function getSummaryReport(from, to) {
  const params = { from, to };
  const key = cacheKey('summary', params);
  const cached = cache.get(key);
  if (cached) return cached;

  const fromDate = from ? new Date(from) : new Date('2000-01-01T00:00:00Z');
  const toDate = to ? new Date(to) : new Date();

  const row = await prisma.$queryRaw`
    WITH subscription_stats AS (
      SELECT
        COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS "activeSubscriptions",
        COUNT(*) FILTER (WHERE "createdAt" >= ${fromDate} AND "createdAt" <= ${toDate})::int AS "newSubscriptions",
        COUNT(*) FILTER (WHERE status = 'CLOSED' AND "closedAt" >= ${fromDate} AND "closedAt" <= ${toDate})::int AS "closedSubscriptions"
      FROM "Subscription"
    ),
    revenue AS (
      SELECT
        COALESCE(SUM(CASE
          WHEN "billingPeriod" = 'MONTHLY' THEN "price"
          WHEN "billingPeriod" = 'YEARLY' THEN "price" / 12
          WHEN "billingPeriod" = 'WEEKLY' THEN "price" * 52 / 12
          WHEN "billingPeriod" = 'DAILY' THEN "price" * 30
          ELSE 0
        END), 0)::numeric AS "mrr",
        COALESCE(SUM(CASE
          WHEN "billingPeriod" = 'MONTHLY' THEN "price" * 12
          WHEN "billingPeriod" = 'YEARLY' THEN "price"
          WHEN "billingPeriod" = 'WEEKLY' THEN "price" * 52
          WHEN "billingPeriod" = 'DAILY' THEN "price" * 365
          ELSE 0
        END), 0)::numeric AS "arr"
      FROM "Plan" p
      JOIN "Subscription" s ON s."planId" = p.id
      WHERE s.status = 'ACTIVE'
    ),
    invoice_totals AS (
      SELECT
        COALESCE(SUM(CASE WHEN "issueDate" >= ${fromDate} AND "issueDate" <= ${toDate} THEN "total" ELSE 0 END), 0)::numeric AS "invoicedTotal",
        COALESCE(SUM(CASE WHEN status != 'CANCELLED' AND ("total" - "amountPaid") > 0 THEN ("total" - "amountPaid") ELSE 0 END), 0)::numeric AS "outstandingTotal",
        COALESCE(SUM(CASE WHEN "status" = 'CONFIRMED' AND "dueDate" < NOW() AND ("total" - "amountPaid") > 0 THEN 1 ELSE 0 END), 0)::int AS "overdueCount",
        COALESCE(SUM(CASE WHEN "status" = 'CONFIRMED' AND "dueDate" < NOW() AND ("total" - "amountPaid") > 0 THEN ("total" - "amountPaid") ELSE 0 END), 0)::numeric AS "overdueTotal",
        COALESCE(SUM(CASE WHEN status = 'PAID' AND "updatedAt" >= ${fromDate} AND "updatedAt" <= ${toDate} THEN 1 ELSE 0 END), 0)::int AS "paidInvoiceCount"
      FROM "Invoice"
    ),
    payment_totals AS (
      SELECT COALESCE(SUM("amount"), 0)::numeric AS "revenueCollected"
      FROM "Payment"
      WHERE "paymentDate" >= ${fromDate} AND "paymentDate" <= ${toDate}
    )
    SELECT
      s.*,
      r.*,
      i.*,
      p.*
    FROM subscription_stats s
    CROSS JOIN revenue r
    CROSS JOIN invoice_totals i
    CROSS JOIN payment_totals p;
  `;

  const result = normalizeSummaryRow(row[0] || {});

  cache.set(key, result, { expires: 30000 });
  setTimeout(() => cache.delete(key), 30000);
  return result;
}

async function getRevenueTrend({ from, to, groupBy = 'month' }) {
  const fromDate = from ? new Date(from) : new Date(new Date().getFullYear() - 1 + '-01-01T00:00:00Z');
  const toDate = to ? new Date(to) : new Date();
  const unit = groupBy === 'day' ? 'day' : groupBy === 'week' ? 'week' : 'month';

  const rows = await prisma.$queryRaw`
    WITH invoice_series AS (
      SELECT
        date_trunc(${unit}, "issueDate") AS bucket,
        SUM("total")::numeric AS invoiced
      FROM "Invoice"
      WHERE "issueDate" >= ${fromDate} AND "issueDate" <= ${toDate}
      GROUP BY 1
    ),
    payment_series AS (
      SELECT
        date_trunc(${unit}, "paymentDate") AS bucket,
        SUM("amount")::numeric AS collected
      FROM "Payment"
      WHERE "paymentDate" >= ${fromDate} AND "paymentDate" <= ${toDate}
      GROUP BY 1
    )
    SELECT
      COALESCE(i.bucket, p.bucket) AS bucket,
      COALESCE(i.invoiced, 0)::numeric AS invoiced,
      COALESCE(p.collected, 0)::numeric AS collected
    FROM invoice_series i
    FULL OUTER JOIN payment_series p ON i.bucket = p.bucket
    ORDER BY bucket ASC;
  `;

  return rows.map((row) => ({
    bucket: new Date(row.bucket).toISOString(),
    invoiced: toNumber(row.invoiced),
    collected: toNumber(row.collected)
  }));
}

async function getSubscriptionsByStatus() {
  const rows = await prisma.$queryRaw`
    SELECT status, COUNT(*)::int AS count
    FROM "Subscription"
    GROUP BY status
    ORDER BY count DESC, status ASC;
  `;

  return rows.map((row) => ({ status: row.status, count: Number(row.count) }));
}

async function getSubscriptionsByPlan() {
  const rows = await prisma.$queryRaw`
    SELECT p.name, COUNT(s.id)::int AS count
    FROM "Subscription" s
    JOIN "Plan" p ON p.id = s."planId"
    GROUP BY p.name
    ORDER BY count DESC, p.name ASC;
  `;

  return rows.map((row) => ({ plan: row.name, count: Number(row.count) }));
}

async function getPaymentsByMethod() {
  const rows = await prisma.$queryRaw`
    SELECT method, SUM(amount)::numeric AS total
    FROM "Payment"
    GROUP BY method
    ORDER BY total DESC, method ASC;
  `;

  return rows.map((row) => ({ method: row.method, total: toNumber(row.total) }));
}

async function getOverdueInvoices({ page = 1, limit = 25, customerId } = {}) {
  const query = {
    page: Math.max(1, Number(page) || 1),
    limit: Math.min(100, Math.max(1, Number(limit) || 25))
  };

  const offset = (query.page - 1) * query.limit;
  const whereClause = customerId ? `AND i."customerId" = ${JSON.stringify(customerId)}` : '';

  const rows = await prisma.$queryRaw`
    SELECT i.id, i.number, i."customerId", c.name AS customer, i."dueDate",
           DATE_PART('day', NOW() - i."dueDate")::int AS "daysOverdue",
           (i.total - i."amountPaid")::numeric AS outstanding
    FROM "Invoice" i
    JOIN "Customer" c ON c.id = i."customerId"
    WHERE i.status = 'CONFIRMED' AND i."dueDate" < NOW() AND (i.total - i."amountPaid") > 0
      ${customerId ? prisma.$queryRaw`AND i."customerId" = ${customerId}::uuid` : prisma.$queryRaw``}
    ORDER BY "daysOverdue" DESC, i."dueDate" ASC
    LIMIT ${query.limit} OFFSET ${offset};
  `;

  const totalRows = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS total
    FROM "Invoice" i
    WHERE i.status = 'CONFIRMED' AND i."dueDate" < NOW() AND (i.total - i."amountPaid") > 0
      ${customerId ? prisma.$queryRaw`AND i."customerId" = ${customerId}::uuid` : prisma.$queryRaw``};
  `;

  return {
    page: query.page,
    limit: query.limit,
    total: Number(totalRows[0]?.total || 0),
    totalPages: Math.ceil((Number(totalRows[0]?.total || 0)) / query.limit),
    data: rows.map((row) => ({
      id: row.id,
      number: row.number,
      customerId: row.customerId,
      customer: row.customer,
      dueDate: new Date(row.dueDate),
      daysOverdue: Number(row.daysOverdue || 0),
      outstanding: toNumber(row.outstanding)
    }))
  };
}

async function getTopCustomers({ page = 1, limit = 10 } = {}) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
  const offset = (pageNum - 1) * limitNum;

  const rows = await prisma.$queryRaw`
    SELECT c.id, c.name, c.email,
           SUM(i.total)::numeric AS revenue,
           COUNT(i.id)::int AS invoiceCount
    FROM "Customer" c
    LEFT JOIN "Invoice" i ON i."customerId" = c.id
    GROUP BY c.id, c.name, c.email
    ORDER BY revenue DESC NULLS LAST, invoiceCount DESC
    LIMIT ${limitNum} OFFSET ${offset};
  `;

  return rows.map((row) => ({
    customerId: row.id,
    name: row.name,
    email: row.email,
    revenue: toNumber(row.revenue),
    invoiceCount: Number(row.invoiceCount || 0)
  }));
}

async function exportReport(type, format = 'csv', filters = {}) {
  const rows = [];
  if (type === 'invoices') {
    const invoiceRows = await prisma.invoice.findMany({
      where: {
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
        ...(filters.status ? { status: filters.status } : {})
      },
      select: { id: true, number: true, customerId: true, status: true, total: true, amountPaid: true, dueDate: true }
    });
    rows.push(...invoiceRows);
  }
  if (type === 'payments') {
    const paymentRows = await prisma.payment.findMany({
      where: {
        ...(filters.customerId ? { invoice: { customerId: filters.customerId } } : {}),
        ...(filters.invoiceId ? { invoiceId: filters.invoiceId } : {})
      },
      select: { id: true, invoiceId: true, method: true, amount: true, paymentDate: true }
    });
    rows.push(...paymentRows);
  }
  if (type === 'subscriptions') {
    const subscriptionRows = await prisma.subscription.findMany({
      where: {
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
        ...(filters.status ? { status: filters.status } : {})
      },
      select: { id: true, number: true, customerId: true, status: true, nextBillingDate: true }
    });
    rows.push(...subscriptionRows);
  }

  if (format === 'csv') {
    const headers = Object.keys(rows[0] || {});
    const lines = [headers.join(',')];
    for (const row of rows) {
      const values = headers.map((header) => {
        const value = row[header];
        const text = value === null || value === undefined ? '' : String(value).replace(/,/g, '');
        return `"${text}"`;
      });
      lines.push(values.join(','));
    }
    return lines.join('\n');
  }

  return rows;
}

module.exports = {
  getSummaryReport,
  getRevenueTrend,
  getSubscriptionsByStatus,
  getSubscriptionsByPlan,
  getPaymentsByMethod,
  getOverdueInvoices,
  getTopCustomers,
  exportReport
};
