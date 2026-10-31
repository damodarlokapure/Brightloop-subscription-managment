const { z } = require('zod');
const { asyncHandler } = require('../utils/asyncHandler');
const reportService = require('../services/reportService');

const summarySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional()
});

const trendSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  groupBy: z.enum(['day', 'week', 'month']).optional().default('month')
});

async function summary(req, res) {
  const validated = summarySchema.parse(req.query);
  const data = await reportService.getSummaryReport(validated.from, validated.to);
  res.json(data);
}

async function revenueTrend(req, res) {
  const validated = trendSchema.parse(req.query);
  const data = await reportService.getRevenueTrend(validated);
  res.json(data);
}

async function byStatus(req, res) {
  const data = await reportService.getSubscriptionsByStatus();
  res.json(data);
}

async function byPlan(req, res) {
  const data = await reportService.getSubscriptionsByPlan();
  res.json(data);
}

async function byMethod(req, res) {
  const data = await reportService.getPaymentsByMethod();
  res.json(data);
}

async function overdueInvoices(req, res) {
  const data = await reportService.getOverdueInvoices({
    page: req.query.page,
    limit: req.query.limit,
    customerId: req.user?.role === 'CUSTOMER' ? req.user.customerId : req.query.customerId
  });
  res.json(data);
}

async function topCustomers(req, res) {
  const data = await reportService.getTopCustomers({
    page: req.query.page,
    limit: req.query.limit
  });
  res.json(data);
}

async function exportReport(req, res) {
  const type = req.params.type;
  const format = req.query.format || 'csv';
  const data = await reportService.exportReport(type, format, {
    customerId: req.user?.role === 'CUSTOMER' ? req.user.customerId : req.query.customerId,
    status: req.query.status,
    invoiceId: req.query.invoiceId
  });
  res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
  res.send(data);
}

module.exports = {
  summary: asyncHandler(summary),
  revenueTrend: asyncHandler(revenueTrend),
  byStatus: asyncHandler(byStatus),
  byPlan: asyncHandler(byPlan),
  byMethod: asyncHandler(byMethod),
  overdueInvoices: asyncHandler(overdueInvoices),
  topCustomers: asyncHandler(topCustomers),
  exportReport: asyncHandler(exportReport)
};
