const { z } = require('zod');
const { asyncHandler } = require('../utils/asyncHandler');
const quotationService = require('../services/quotationService');

const templateSchema = z.object({
  name: z.string().trim().min(1, 'Template name is required.'),
  validityDays: z.coerce.number().int().min(1).default(30),
  planId: z.string().uuid('Plan ID must be a valid UUID.'),
  notes: z.string().trim().optional().nullable(),
  lines: z.array(z.object({
    productId: z.string().uuid('Product ID must be a valid UUID.'),
    variantId: z.string().uuid().optional().nullable(),
    quantity: z.coerce.number().int().min(1).default(1)
  })).optional().default([])
});

const templateUpdateSchema = templateSchema.partial();

async function createTemplate(req, res) {
  const validated = templateSchema.parse(req.body);
  const result = await quotationService.createQuotationTemplate(validated);
  res.status(201).json(result);
}

async function listTemplates(req, res) {
  const result = await quotationService.listQuotationTemplates();
  res.json(result);
}

async function getTemplate(req, res) {
  const result = await quotationService.getQuotationTemplateById(req.params.id);
  res.json(result);
}

async function updateTemplate(req, res) {
  const validated = templateUpdateSchema.parse(req.body);
  const result = await quotationService.updateQuotationTemplate(req.params.id, validated);
  res.json(result);
}

async function deleteTemplate(req, res) {
  const result = await quotationService.deleteQuotationTemplate(req.params.id);
  res.json(result);
}

module.exports = {
  createTemplate: asyncHandler(createTemplate),
  listTemplates: asyncHandler(listTemplates),
  getTemplate: asyncHandler(getTemplate),
  updateTemplate: asyncHandler(updateTemplate),
  deleteTemplate: asyncHandler(deleteTemplate)
};
