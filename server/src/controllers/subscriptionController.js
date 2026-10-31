const { z } = require('zod');
const { asyncHandler } = require('../utils/asyncHandler');
const subscriptionService = require('../services/subscriptionService');

const subscriptionSchema = z.object({
  customerId: z.string().uuid('Customer ID must be a valid UUID.'),
  planId: z.string().uuid('Plan ID must be a valid UUID.'),
  templateId: z.string().uuid().optional().nullable(),
  status: z.enum(['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED']).optional().default('DRAFT'),
  startDate: z.coerce.date().optional(),
  quotationValidUntil: z.coerce.date().optional().nullable(),
  paymentTerms: z.coerce.number().int().min(0).optional().default(0),
  createdById: z.string().uuid().optional().nullable(),
  lines: z.array(z.object({
    productId: z.string().uuid().optional().nullable(),
    variantId: z.string().uuid().optional().nullable(),
    quantity: z.coerce.number().int().min(1).default(1),
    unitPrice: z.coerce.number().min(0).optional().default(0),
    amount: z.coerce.number().min(0).optional().default(0),
    taxRate: z.coerce.number().min(0).optional().default(0),
    taxAmount: z.coerce.number().min(0).optional().default(0),
    discountAmount: z.coerce.number().min(0).optional().default(0)
  })).optional().default([])
});

const transitionSchema = z.object({
  status: z.enum(['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED']),
  reason: z.string().trim().optional().nullable()
});

async function createSubscription(req, res) {
  const validated = subscriptionSchema.parse(req.body);
  const result = await subscriptionService.createSubscription(validated);
  res.status(201).json(result);
}

async function listSubscriptions(req, res) {
  const scopeCustomerId = req.user?.role === 'CUSTOMER' ? req.user.customerId : req.query.customerId;
  const result = await subscriptionService.listSubscriptions({
    page: req.query.page,
    limit: req.query.limit,
    customerId: scopeCustomerId,
    status: req.query.status
  });
  res.json(result);
}

async function getSubscription(req, res) {
  const result = await subscriptionService.getSubscriptionById(req.params.id, req.user?.role === 'CUSTOMER' ? req.user.customerId : null);
  res.json(result);
}

async function transitionStatus(req, res) {
  const validated = transitionSchema.parse(req.body);
  const result = await subscriptionService.transitionStatus(req.params.id, validated.status, validated.reason);
  res.json(result);
}

async function stats(req, res) {
  const result = await subscriptionService.getSubscriptionStats();
  res.json(result);
}

module.exports = {
  createSubscription: asyncHandler(createSubscription),
  listSubscriptions: asyncHandler(listSubscriptions),
  getSubscription: asyncHandler(getSubscription),
  transitionStatus: asyncHandler(transitionStatus),
  stats: asyncHandler(stats)
};
