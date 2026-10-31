const { z } = require('zod');
const { asyncHandler } = require('../utils/asyncHandler');
const planService = require('../services/planService');

const planSchema = z.object({
  name: z.string().trim().min(1, 'Plan name is required.'),
  price: z.coerce.number().min(0, 'Price must be >= 0'),
  billingPeriod: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
  minQuantity: z.coerce.number().int().min(1, 'minQuantity must be >= 1'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().optional(),
  autoCloseOnEnd: z.boolean().optional().default(false),
  allowEarlyClose: z.boolean().optional().default(false),
  allowPause: z.boolean().optional().default(false),
  allowRenew: z.boolean().optional().default(true)
});

const planUpdateSchema = planSchema.partial();

const renewSchema = z.object({
  endDate: z.coerce.date().optional()
});

async function createPlan(req, res) {
  const validated = planSchema.parse(req.body);
  const result = await planService.createPlan(validated);
  res.status(201).json(result);
}

async function listPlans(req, res) {
  const result = await planService.listPlans({
    userRole: req.user?.role,
    page: req.query.page,
    limit: req.query.limit,
    state: req.query.state,
    billingPeriod: req.query.billingPeriod,
    availableOn: req.query.availableOn
  });
  res.json(result);
}

async function getPlan(req, res) {
  const result = await planService.getPlanById(req.params.id);
  res.json(result);
}

async function updatePlan(req, res) {
  const validated = planUpdateSchema.parse(req.body);
  const result = await planService.updatePlan(req.params.id, validated);
  res.json(result);
}

async function deletePlan(req, res) {
  const result = await planService.deletePlan(req.params.id);
  res.json(result);
}

async function closePlan(req, res) {
  const result = await planService.closePlan(req.params.id);
  res.json(result);
}

async function pausePlan(req, res) {
  const result = await planService.pausePlan(req.params.id);
  res.json(result);
}

async function resumePlan(req, res) {
  const result = await planService.resumePlan(req.params.id);
  res.json(result);
}

async function renewPlan(req, res) {
  const validated = renewSchema.parse(req.body || {});
  const result = await planService.renewPlan(req.params.id, validated);
  res.json(result);
}

async function runJob(req, res) {
  const { closeExpiredPlans } = require('../services/planService');
  const result = await closeExpiredPlans();
  res.json({
    message: 'Expired plan auto-close job completed.',
    ...result
  });
}

module.exports = {
  createPlan: asyncHandler(createPlan),
  listPlans: asyncHandler(listPlans),
  getPlan: asyncHandler(getPlan),
  updatePlan: asyncHandler(updatePlan),
  deletePlan: asyncHandler(deletePlan),
  closePlan: asyncHandler(closePlan),
  pausePlan: asyncHandler(pausePlan),
  resumePlan: asyncHandler(resumePlan),
  renewPlan: asyncHandler(renewPlan),
  runJob: asyncHandler(runJob)
};
