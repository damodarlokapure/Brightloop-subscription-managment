const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');

function buildTemplateLine(product, variant) {
  return {
    productId: product.id,
    variantId: variant?.id || null,
    quantity: 1,
    product: product ? { ...product } : null
  };
}

async function createQuotationTemplate(input) {
  const { name, validityDays, planId, notes, lines = [] } = input;
  if (!name || !String(name).trim()) throw new AppError(400, 'INVALID_TEMPLATE', 'Template name is required.');
  if (!planId) throw new AppError(400, 'INVALID_PLAN', 'Template planId is required.');

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new AppError(404, 'PLAN_NOT_FOUND', 'Plan not found.');

  const template = await prisma.quotationTemplate.create({
    data: {
      name: String(name).trim(),
      validityDays: Number(validityDays || 30),
      planId,
      notes: notes || null,
      lines: {
        create: lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId || null,
          quantity: Number(line.quantity || 1)
        }))
      }
    },
    include: {
      lines: true,
      plan: true
    }
  });

  return template;
}

async function listQuotationTemplates() {
  return prisma.quotationTemplate.findMany({
    include: {
      plan: true,
      lines: true
    },
    orderBy: { createdAt: 'desc' }
  });
}

async function getQuotationTemplateById(id) {
  const template = await prisma.quotationTemplate.findUnique({
    where: { id },
    include: { plan: true, lines: true }
  });
  if (!template) throw new AppError(404, 'TEMPLATE_NOT_FOUND', 'Quotation template not found.');
  return template;
}

async function updateQuotationTemplate(id, input) {
  const existing = await prisma.quotationTemplate.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'TEMPLATE_NOT_FOUND', 'Quotation template not found.');

  const data = {};
  if (input.name !== undefined) data.name = String(input.name).trim();
  if (input.validityDays !== undefined) data.validityDays = Number(input.validityDays);
  if (input.planId !== undefined) data.planId = input.planId;
  if (input.notes !== undefined) data.notes = input.notes || null;

  const template = await prisma.quotationTemplate.update({
    where: { id },
    data,
    include: { plan: true, lines: true }
  });

  return template;
}

async function deleteQuotationTemplate(id) {
  const template = await prisma.quotationTemplate.findUnique({ where: { id } });
  if (!template) throw new AppError(404, 'TEMPLATE_NOT_FOUND', 'Quotation template not found.');

  await prisma.quotationTemplate.delete({ where: { id } });
  return { deleted: true, id };
}

module.exports = {
  createQuotationTemplate,
  listQuotationTemplates,
  getQuotationTemplateById,
  updateQuotationTemplate,
  deleteQuotationTemplate,
  buildTemplateLine
};
