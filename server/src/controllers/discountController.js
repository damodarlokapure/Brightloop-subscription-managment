const { z } = require('zod');
const { asyncHandler } = require('../utils/asyncHandler');
const discountService = require('../services/discountService');

const discountSchema = z.object({
  name: z.string().trim().min(1, 'Discount name is required.'),
  type: z.enum(['FIXED', 'PERCENTAGE']),
  value: z.coerce.number().min(0, 'Discount value must be >= 0'),
  scope: z.enum(['PRODUCT', 'SUBSCRIPTION']),
  minPurchaseAmount: z.coerce.number().min(0).optional().nullable(),
  minQuantity: z.coerce.number().int().min(1).optional().nullable(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  usageLimit: z.coerce.number().int().min(1).optional().nullable(),
  productIds: z.array(z.string().uuid()).optional().default([]),
  subscriptionIds: z.array(z.string().uuid()).optional().default([]),
  isActive: z.boolean().optional().default(true)
});

const discountUpdateSchema = discountSchema.partial();

async function createDiscount(req, res) {
  const validated = discountSchema.parse(req.body);
  const result = await discountService.createDiscount(validated);
  res.status(201).json(result);
}

async function listDiscounts(req, res) {
  const result = await discountService.listDiscounts();
  res.json(result);
}

async function updateDiscount(req, res) {
  const validated = discountUpdateSchema.parse(req.body);
  const result = await discountService.updateDiscount(req.params.id, validated);
  res.json(result);
}

async function deleteDiscount(req, res) {
  const result = await discountService.deleteDiscount(req.params.id);
  res.json(result);
}

module.exports = {
  createDiscount: asyncHandler(createDiscount),
  listDiscounts: asyncHandler(listDiscounts),
  updateDiscount: asyncHandler(updateDiscount),
  deleteDiscount: asyncHandler(deleteDiscount)
};
