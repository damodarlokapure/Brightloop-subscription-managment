const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');

function normalizeTax(tax) {
  if (!tax) return null;
  return {
    ...tax,
    ratePercent: Number(tax.ratePercent)
  };
}

function validateTaxInput(input) {
  if (!input.name || !String(input.name).trim()) {
    throw new AppError(400, 'INVALID_TAX', 'Tax name is required.');
  }

  const ratePercent = Number(input.ratePercent);
  if (Number.isNaN(ratePercent) || ratePercent < 0 || ratePercent > 100) {
    throw new AppError(400, 'INVALID_TAX_RATE', 'Tax rate must be between 0 and 100.');
  }
}

async function createTax(input) {
  validateTaxInput(input);

  const tax = await prisma.tax.create({
    data: {
      name: String(input.name).trim(),
      ratePercent: Number(input.ratePercent),
      isActive: input.isActive !== undefined ? Boolean(input.isActive) : true,
      appliesToProductType: input.appliesToProductType ? String(input.appliesToProductType).toUpperCase() : null
    }
  });

  return normalizeTax(tax);
}

async function listTaxes() {
  const taxes = await prisma.tax.findMany({ orderBy: { createdAt: 'desc' } });
  return taxes.map(normalizeTax);
}

async function getTaxById(id) {
  const tax = await prisma.tax.findUnique({ where: { id } });
  if (!tax) throw new AppError(404, 'TAX_NOT_FOUND', 'Tax not found.');
  return normalizeTax(tax);
}

async function updateTax(id, input) {
  const existing = await prisma.tax.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'TAX_NOT_FOUND', 'Tax not found.');

  const payload = {};
  if (input.name !== undefined) payload.name = String(input.name).trim();
  if (input.ratePercent !== undefined) payload.ratePercent = Number(input.ratePercent);
  if (input.isActive !== undefined) payload.isActive = Boolean(input.isActive);
  if (input.appliesToProductType !== undefined) {
    payload.appliesToProductType = input.appliesToProductType ? String(input.appliesToProductType).toUpperCase() : null;
  }

  if (payload.name !== undefined && !payload.name) {
    throw new AppError(400, 'INVALID_TAX', 'Tax name is required.');
  }
  if (payload.ratePercent !== undefined && (Number.isNaN(payload.ratePercent) || payload.ratePercent < 0 || payload.ratePercent > 100)) {
    throw new AppError(400, 'INVALID_TAX_RATE', 'Tax rate must be between 0 and 100.');
  }

  const tax = await prisma.tax.update({
    where: { id },
    data: payload
  });

  return normalizeTax(tax);
}

async function deleteTax(id) {
  const existing = await prisma.tax.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'TAX_NOT_FOUND', 'Tax not found.');

  await prisma.tax.update({
    where: { id },
    data: { isActive: false }
  });

  return { deleted: false, deactivated: true, id };
}

module.exports = {
  createTax,
  listTaxes,
  getTaxById,
  updateTax,
  deleteTax
};
