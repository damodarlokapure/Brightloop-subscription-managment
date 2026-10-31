const { z } = require('zod');
const { asyncHandler } = require('../utils/asyncHandler');
const productService = require('../services/productService');

const productVariantSchema = z.object({
  attribute: z.string().trim().min(1, 'Variant attribute is required.'),
  value: z.string().trim().min(1, 'Variant value is required.'),
  extraPrice: z.coerce.number().min(0, 'Variant extra price must be >= 0')
});

const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required.'),
  type: z.enum(['SERVICE', 'SOFTWARE', 'ADDON', 'PHYSICAL']),
  salesPrice: z.coerce.number().min(0, 'Sales price must be >= 0'),
  costPrice: z.coerce.number().min(0, 'Cost price must be >= 0'),
  notes: z.string().trim().optional().nullable(),
  defaultTaxId: z.string().uuid().optional().nullable(),
  variants: z.array(productVariantSchema).optional().default([])
});

const updateProductSchema = createProductSchema.partial();

const variantCreateSchema = productVariantSchema;
const variantUpdateSchema = z.object({
  variantId: z.string().uuid('Variant id must be a valid UUID.'),
  attribute: z.string().trim().min(1, 'Variant attribute is required.').optional(),
  value: z.string().trim().min(1, 'Variant value is required.').optional(),
  extraPrice: z.coerce.number().min(0, 'Variant extra price must be >= 0').optional()
});
const variantDeleteSchema = z.object({
  variantId: z.string().uuid('Variant id must be a valid UUID.')
});

async function createProduct(req, res) {
  const validated = createProductSchema.parse(req.body);
  const result = await productService.createProduct(validated);
  res.status(201).json(result);
}

async function listProducts(req, res) {
  const query = req.query;
  const result = await productService.listProducts({
    page: query.page,
    limit: query.limit,
    search: query.search,
    type: query.type,
    isActive: query.isActive,
    sort: query.sort,
    order: query.order
  });
  res.json(result);
}

async function getProduct(req, res) {
  const result = await productService.getProductById(req.params.id);
  res.json(result);
}

async function updateProduct(req, res) {
  const validated = updateProductSchema.parse(req.body);
  const result = await productService.updateProduct(req.params.id, validated);
  res.json(result);
}

async function deleteProduct(req, res) {
  const result = await productService.softDeleteProduct(req.params.id);
  res.json(result);
}

async function addVariant(req, res) {
  const validated = variantCreateSchema.parse(req.body);
  const result = await productService.addVariant(req.params.id, validated);
  res.status(201).json(result);
}

async function updateVariant(req, res) {
  const validated = variantUpdateSchema.parse(req.body);
  const result = await productService.updateVariant(req.params.id, validated.variantId, {
    attribute: validated.attribute,
    value: validated.value,
    extraPrice: validated.extraPrice
  });
  res.json(result);
}

async function deleteVariant(req, res) {
  const variantId = req.body?.variantId ?? req.query?.variantId;
  const validated = variantDeleteSchema.parse({ variantId });
  const result = await productService.deleteVariant(req.params.id, validated.variantId);
  res.json(result);
}

module.exports = {
  createProduct: asyncHandler(createProduct),
  listProducts: asyncHandler(listProducts),
  getProduct: asyncHandler(getProduct),
  updateProduct: asyncHandler(updateProduct),
  deleteProduct: asyncHandler(deleteProduct),
  addVariant: asyncHandler(addVariant),
  updateVariant: asyncHandler(updateVariant),
  deleteVariant: asyncHandler(deleteVariant)
};
