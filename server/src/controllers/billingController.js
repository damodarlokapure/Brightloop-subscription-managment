const { z } = require('zod');
const { asyncHandler } = require('../utils/asyncHandler');
const { generateInvoiceForSubscription, runBillingRun } = require('../services/billing');

const billingRunSchema = z.object({
  asOfDate: z.coerce.date().optional(),
  dryRun: z.boolean().optional().default(false)
});

async function runBilling(req, res) {
  const validated = billingRunSchema.parse(req.body || {});
  const result = await runBillingRun(validated.asOfDate || new Date(), req.user?.id || null, { dryRun: Boolean(validated.dryRun) });
  res.json(result);
}

async function generateForSubscription(req, res) {
  const result = await generateInvoiceForSubscription(req.params.id, req.body?.asOfDate || new Date(), req.user?.id || null);
  res.json(result);
}

module.exports = {
  runBilling: asyncHandler(runBilling),
  generateForSubscription: asyncHandler(generateForSubscription)
};
