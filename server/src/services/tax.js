const prisma = require('../config/prisma');

function roundCurrency(value) {
  return Number(Number(value || 0).toFixed(2));
}

async function resolveTax(product, explicitTaxId) {
  if (explicitTaxId) {
    const tax = await prisma.tax.findUnique({ where: { id: explicitTaxId } });
    if (tax && tax.isActive) return tax;
  }

  if (product?.taxId) {
    const productTax = await prisma.tax.findUnique({ where: { id: product.taxId } });
    if (productTax && productTax.isActive) return productTax;
  }

  if (product?.type) {
    const typeTax = await prisma.tax.findFirst({
      where: {
        appliesToProductType: product.type,
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (typeTax) return typeTax;
  }

  return null;
}

function calcLineTax(amountAfterDiscount, ratePercent) {
  if (amountAfterDiscount === undefined || amountAfterDiscount === null) return 0;
  const value = Number(amountAfterDiscount) * Number(ratePercent || 0) / 100;
  return roundCurrency(value);
}

module.exports = {
  resolveTax,
  calcLineTax,
  roundCurrency
};
