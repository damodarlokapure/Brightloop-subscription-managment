const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');

function validateDiscount(payload) {
  if (!payload.name || !String(payload.name).trim()) {
    throw new AppError(400, 'INVALID_DISCOUNT', 'Discount name is required.');
  }
  if (!['FIXED', 'PERCENTAGE'].includes(payload.type)) {
    throw new AppError(400, 'INVALID_DISCOUNT_TYPE', 'Discount type must be FIXED or PERCENTAGE.');
  }
  if (!['PRODUCT', 'SUBSCRIPTION'].includes(payload.scope)) {
    throw new AppError(400, 'INVALID_DISCOUNT_SCOPE', 'Discount scope must be PRODUCT or SUBSCRIPTION.');
  }

  const value = Number(payload.value);
  if (payload.type === 'PERCENTAGE' && (Number.isNaN(value) || value < 0 || value > 100)) {
    throw new AppError(400, 'INVALID_DISCOUNT_VALUE', 'Percentage discounts must be between 0 and 100.');
  }
  if (payload.type === 'FIXED' && (Number.isNaN(value) || value <= 0)) {
    throw new AppError(400, 'INVALID_DISCOUNT_VALUE', 'Fixed discounts must be greater than zero.');
  }

  if (payload.endDate && payload.startDate && new Date(payload.endDate) < new Date(payload.startDate)) {
    throw new AppError(400, 'INVALID_DATE_RANGE', 'Discount endDate must be on or after startDate.');
  }

  if (payload.scope === 'PRODUCT' && (!Array.isArray(payload.productIds) || payload.productIds.length === 0)) {
    throw new AppError(400, 'INVALID_PRODUCT_SCOPE', 'Product discounts require at least one productId.');
  }

  if (payload.scope === 'SUBSCRIPTION' && Array.isArray(payload.subscriptionIds) && payload.subscriptionIds.length > 0) {
    // valid optional explicit list
  }
}

async function createDiscount(input) {
  validateDiscount(input);

  const payload = {
    name: String(input.name).trim(),
    type: input.type,
    value: Number(input.value),
    scope: input.scope,
    minPurchaseAmount: input.minPurchaseAmount !== undefined ? Number(input.minPurchaseAmount) : null,
    minQuantity: input.minQuantity !== undefined ? Number(input.minQuantity) : null,
    startDate: new Date(input.startDate),
    endDate: input.endDate ? new Date(input.endDate) : null,
    usageLimit: input.usageLimit !== undefined ? Number(input.usageLimit) : null,
    isActive: input.isActive !== undefined ? Boolean(input.isActive) : true
  };

  const discount = await prisma.discount.create({
    data: {
      ...payload,
      products: {
        create: (input.productIds || []).map((productId) => ({ productId }))
      },
      subscriptions: {
        create: (input.subscriptionIds || []).map((subscriptionId) => ({ subscriptionId }))
      }
    },
    include: {
      products: true,
      subscriptions: true
    }
  });

  return discount;
}

async function listDiscounts() {
  return prisma.discount.findMany({
    include: {
      products: true,
      subscriptions: true
    },
    orderBy: { createdAt: 'desc' }
  });
}

async function updateDiscount(id, input) {
  const existing = await prisma.discount.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'DISCOUNT_NOT_FOUND', 'Discount not found.');

  const payload = { ...input };
  if (payload.name !== undefined) payload.name = String(payload.name).trim();
  if (payload.type !== undefined) payload.type = payload.type;
  if (payload.value !== undefined) payload.value = Number(payload.value);
  if (payload.scope !== undefined) payload.scope = payload.scope;
  if (payload.minPurchaseAmount !== undefined) payload.minPurchaseAmount = payload.minPurchaseAmount === null ? null : Number(payload.minPurchaseAmount);
  if (payload.minQuantity !== undefined) payload.minQuantity = payload.minQuantity === null ? null : Number(payload.minQuantity);
  if (payload.startDate !== undefined) payload.startDate = new Date(payload.startDate);
  if (payload.endDate !== undefined) payload.endDate = payload.endDate ? new Date(payload.endDate) : null;
  if (payload.usageLimit !== undefined) payload.usageLimit = payload.usageLimit === null ? null : Number(payload.usageLimit);
  if (payload.isActive !== undefined) payload.isActive = Boolean(payload.isActive);
  validateDiscount({ ...existing, ...payload });

  if (payload.productIds) {
    await prisma.discountProduct.deleteMany({ where: { discountId: id } });
    await prisma.discountProduct.createMany({
      data: payload.productIds.map((productId) => ({ discountId: id, productId }))
    });
  }

  if (payload.subscriptionIds) {
    await prisma.discountSubscription.deleteMany({ where: { discountId: id } });
    await prisma.discountSubscription.createMany({
      data: payload.subscriptionIds.map((subscriptionId) => ({ discountId: id, subscriptionId }))
    });
  }

  const { productIds, subscriptionIds, ...data } = payload;
  const discount = await prisma.discount.update({
    where: { id },
    data,
    include: {
      products: true,
      subscriptions: true
    }
  });

  return discount;
}

async function deleteDiscount(id) {
  const existing = await prisma.discount.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'DISCOUNT_NOT_FOUND', 'Discount not found.');

  await prisma.discount.update({
    where: { id },
    data: { isActive: false }
  });

  return { deleted: false, deactivated: true, id };
}

module.exports = {
  createDiscount,
  listDiscounts,
  updateDiscount,
  deleteDiscount,
  validateDiscount
};
