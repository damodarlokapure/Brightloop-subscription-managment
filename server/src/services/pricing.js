function effectiveUnitPrice(product, variant) {
  const basePrice = Number(product?.salesPrice ?? 0);
  const variantExtra = variant && variant.extraPrice !== undefined && variant.extraPrice !== null
    ? Number(variant.extraPrice)
    : 0;

  return Number((basePrice + variantExtra).toFixed(2));
}

module.exports = {
  effectiveUnitPrice
};
