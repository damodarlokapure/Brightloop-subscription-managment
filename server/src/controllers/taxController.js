const { z } = require('zod');
const { asyncHandler } = require('../utils/asyncHandler');
const taxService = require('../services/taxService');

const taxSchema = z.object({
  name: z.string().trim().min(1, 'Tax name is required.'),
  ratePercent: z.coerce.number().min(0, 'Tax rate must be >= 0').max(100, 'Tax rate must be <= 100'),
  appliesToProductType: z.enum(['SERVICE', 'SOFTWARE', 'ADDON', 'PHYSICAL']).optional().nullable(),
  isActive: z.boolean().optional().default(true)
});

const taxUpdateSchema = taxSchema.partial();

async function createTax(req, res) {
  const validated = taxSchema.parse(req.body);
  const result = await taxService.createTax(validated);
  res.status(201).json(result);
}

async function listTaxes(req, res) {
  const result = await taxService.listTaxes();
  res.json(result);
}

async function getTax(req, res) {
  const result = await taxService.getTaxById(req.params.id);
  res.json(result);
}

async function updateTax(req, res) {
  const validated = taxUpdateSchema.parse(req.body);
  const result = await taxService.updateTax(req.params.id, validated);
  res.json(result);
}

async function deleteTax(req, res) {
  const result = await taxService.deleteTax(req.params.id);
  res.json(result);
}

module.exports = {
  createTax: asyncHandler(createTax),
  listTaxes: asyncHandler(listTaxes),
  getTax: asyncHandler(getTax),
  updateTax: asyncHandler(updateTax),
  deleteTax: asyncHandler(deleteTax)
};
