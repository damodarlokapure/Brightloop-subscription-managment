const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const { effectiveUnitPrice } = require('./pricing');

function normalizeDecimalValue(value) {
  if (typeof value === 'number') return Number(value.toFixed(2));
  if (value && typeof value.toNumber === 'function') return Number(value.toNumber().toFixed(2));
  return Number(Number(value || 0).toFixed(2));
}

function serializeProduct(product) {
  if (!product) return null;

  const serialized = {
    ...product,
    salesPrice: normalizeDecimalValue(product.salesPrice),
    costPrice: normalizeDecimalValue(product.costPrice),
    variants: Array.isArray(product.variants)
      ? product.variants.map((variant) => ({
          ...variant,
          extraPrice: normalizeDecimalValue(variant.extraPrice),
          effectivePrice: effectiveUnitPrice(product, variant)
        }))
      : product.variants,
    tax: product.tax ? { ...product.tax } : null
  };

  if (product._count && typeof product._count.variants === 'number') {
    serialized.variantCount = product._count.variants;
  }

  return serialized;
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function validateProductPricing({ salesPrice, costPrice }) {
  if (salesPrice < 0 || costPrice < 0) {
    throw new AppError(400, 'INVALID_PRICE', 'Prices must be greater than or equal to zero.');
  }

  if (costPrice > salesPrice) {
    console.warn(`Warning: costPrice (${costPrice}) exceeds salesPrice (${salesPrice}) for a product.`);
  }
}

async function ensureTaxExists(tx, taxId) {
  if (!taxId) return null;
  const tax = await tx.tax.findUnique({ where: { id: taxId } });
  if (!tax) {
    throw new AppError(404, 'TAX_NOT_FOUND', 'Tax not found.');
  }
  return tax;
}

async function createProduct(input) {
  const payload = {
    name: String(input.name || '').trim(),
    type: String(input.type || '').toUpperCase(),
    salesPrice: Number(input.salesPrice),
    costPrice: Number(input.costPrice),
    notes: input.notes ?? null,
    defaultTaxId: input.defaultTaxId || null,
    variants: Array.isArray(input.variants) ? input.variants : []
  };

  if (!payload.name) {
    throw new AppError(400, 'INVALID_NAME', 'Product name is required.');
  }

  const seen = new Set();
  for (const variant of payload.variants) {
    const variantKey = `${String(variant.attribute || '').trim().toLowerCase()}::${String(variant.value || '').trim().toLowerCase()}`;
    if (!variantKey || !String(variant.attribute || '').trim() || !String(variant.value || '').trim()) {
      throw new AppError(400, 'INVALID_VARIANT', 'Variant attribute and value are required.');
    }
    if (variant.extraPrice < 0) {
      throw new AppError(400, 'INVALID_PRICE', 'Variant extraPrice must be greater than or equal to zero.');
    }
    if (seen.has(variantKey)) {
      throw new AppError(409, 'VARIANT_EXISTS', 'Each variant attribute+value pair must be unique for the product.');
    }
    seen.add(variantKey);
  }

  validateProductPricing(payload);

  return prisma.$transaction(async (tx) => {
    await ensureTaxExists(tx, payload.defaultTaxId);

    const product = await tx.product.create({
      data: {
        name: payload.name,
        type: payload.type,
        salesPrice: payload.salesPrice,
        costPrice: payload.costPrice,
        notes: payload.notes,
        taxId: payload.defaultTaxId,
        isActive: true,
        variants: {
          create: payload.variants.map((variant) => ({
            attribute: String(variant.attribute || '').trim(),
            value: String(variant.value || '').trim(),
            extraPrice: Number(variant.extraPrice || 0)
          }))
        }
      },
      include: {
        variants: true,
        tax: true,
        _count: { select: { variants: true } }
      }
    });

    return serializeProduct(product);
  });
}

async function listProducts({ page = 1, limit = 25, search = '', type, isActive, sort = 'createdAt', order = 'desc' }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const skip = (safePage - 1) * safeLimit;
  const cleanSearch = String(search || '').trim();
  const cleanType = type ? String(type).toUpperCase() : undefined;
  const activeFilter = parseBoolean(isActive);

  const where = {
    ...(cleanSearch ? { name: { contains: cleanSearch, mode: 'insensitive' } } : {}),
    ...(cleanType ? { type: cleanType } : {}),
    ...(activeFilter !== undefined ? { isActive: activeFilter } : {})
  };

  const orderByMap = {
    name: { name: order === 'asc' ? 'asc' : 'desc' },
    salesPrice: { salesPrice: order === 'asc' ? 'asc' : 'desc' },
    createdAt: { createdAt: order === 'asc' ? 'asc' : 'desc' },
    updatedAt: { updatedAt: order === 'asc' ? 'asc' : 'desc' }
  };

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy: orderByMap[sort] || orderByMap.createdAt,
      include: {
        tax: true,
        variants: true,
        _count: { select: { variants: true } }
      }
    }),
    prisma.product.count({ where })
  ]);

  return {
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
    data: rows.map((product) => serializeProduct(product))
  };
}

async function getProductById(id) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      tax: true,
      variants: true,
      _count: { select: { variants: true } }
    }
  });

  if (!product) {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
  }

  return serializeProduct(product);
}

async function updateProduct(id, input) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
  }

  const payload = {
    ...(input.name !== undefined ? { name: String(input.name || '').trim() } : {}),
    ...(input.type !== undefined ? { type: String(input.type || '').toUpperCase() } : {}),
    ...(input.salesPrice !== undefined ? { salesPrice: Number(input.salesPrice) } : {}),
    ...(input.costPrice !== undefined ? { costPrice: Number(input.costPrice) } : {}),
    ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
    ...(input.defaultTaxId !== undefined ? { taxId: input.defaultTaxId || null } : {}),
    ...(input.isActive !== undefined ? { isActive: Boolean(input.isActive) } : {})
  };

  if (payload.name && !payload.name) {
    throw new AppError(400, 'INVALID_NAME', 'Product name is required.');
  }

  if (payload.salesPrice !== undefined || payload.costPrice !== undefined) {
    validateProductPricing({
      salesPrice: payload.salesPrice ?? Number(existing.salesPrice),
      costPrice: payload.costPrice ?? Number(existing.costPrice)
    });
  }

  if (payload.taxId !== undefined && payload.taxId) {
    await ensureTaxExists(prisma, payload.taxId);
  }

  const product = await prisma.product.update({
    where: { id },
    data: payload,
    include: {
      tax: true,
      variants: true,
      _count: { select: { variants: true } }
    }
  });

  return serializeProduct(product);
}

async function softDeleteProduct(id) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { variants: true }
  });

  if (!product) {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
  }

  const subscriptionLine = await prisma.subscriptionLine.findFirst({
    where: { productId: id },
    select: { id: true }
  });

  if (subscriptionLine) {
    const updated = await prisma.product.update({
      where: { id },
      data: { isActive: false },
      include: {
        tax: true,
        variants: true,
        _count: { select: { variants: true } }
      }
    });

    return {
      deleted: false,
      softDeleted: true,
      product: serializeProduct(updated)
    };
  }

  await prisma.product.delete({ where: { id } });
  return { deleted: true, softDeleted: false };
}

async function addVariant(productId, input) {
  const product = await prisma.product.findUnique({ where: { productId } });
  if (!product) {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
  }

  const variant = {
    attribute: String(input.attribute || '').trim(),
    value: String(input.value || '').trim(),
    extraPrice: Number(input.extraPrice || 0)
  };

  if (!variant.attribute || !variant.value) {
    throw new AppError(400, 'INVALID_VARIANT', 'Variant attribute and value are required.');
  }
  if (variant.extraPrice < 0) {
    throw new AppError(400, 'INVALID_PRICE', 'Variant extraPrice must be greater than or equal to zero.');
  }

  const existing = await prisma.productVariant.findFirst({
    where: {
      productId,
      attribute: variant.attribute,
      value: variant.value
    }
  });

  if (existing) {
    throw new AppError(409, 'VARIANT_EXISTS', 'A variant with this attribute and value already exists for this product.');
  }

  const created = await prisma.productVariant.create({
    data: {
      productId,
      attribute: variant.attribute,
      value: variant.value,
      extraPrice: variant.extraPrice
    }
  });

  return {
    ...created,
    extraPrice: normalizeDecimalValue(created.extraPrice),
    effectivePrice: effectiveUnitPrice(product, created)
  };
}

async function updateVariant(productId, variantId, input) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
  }

  const existingVariant = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!existingVariant || existingVariant.productId !== productId) {
    throw new AppError(404, 'VARIANT_NOT_FOUND', 'Variant not found.');
  }

  const payload = {
    ...(input.attribute !== undefined ? { attribute: String(input.attribute).trim() } : {}),
    ...(input.value !== undefined ? { value: String(input.value).trim() } : {}),
    ...(input.extraPrice !== undefined ? { extraPrice: Number(input.extraPrice) } : {})
  };

  if ((payload.attribute !== undefined && !payload.attribute) || (payload.value !== undefined && !payload.value)) {
    throw new AppError(400, 'INVALID_VARIANT', 'Variant attribute and value are required.');
  }

  if (payload.extraPrice !== undefined && payload.extraPrice < 0) {
    throw new AppError(400, 'INVALID_PRICE', 'Variant extraPrice must be greater than or equal to zero.');
  }

  const updated = await prisma.productVariant.update({
    where: { id: variantId },
    data: payload
  });

  return {
    ...updated,
    extraPrice: normalizeDecimalValue(updated.extraPrice),
    effectivePrice: effectiveUnitPrice(product, updated)
  };
}

async function deleteVariant(productId, variantId) {
  const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!variant || variant.productId !== productId) {
    throw new AppError(404, 'VARIANT_NOT_FOUND', 'Variant not found.');
  }

  await prisma.productVariant.delete({ where: { id: variantId } });
  return { deleted: true, variantId };
}

module.exports = {
  createProduct,
  listProducts,
  getProductById,
  updateProduct,
  softDeleteProduct,
  addVariant,
  updateVariant,
  deleteVariant
};
