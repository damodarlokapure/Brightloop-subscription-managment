function isDiscountWithinWindow(discount, onDate) {
  const compareDate = new Date(onDate);
  if (discount.startDate && compareDate < new Date(discount.startDate)) return false;
  if (discount.endDate && compareDate > new Date(discount.endDate)) return false;
  return true;
}

function calculateDiscountAmount(discount, base) {
  const subtotal = Number(base || 0);
  if (discount.type === 'FIXED') {
    return Number(Math.min(subtotal, Number(discount.value || 0)).toFixed(2));
  }

  const percentValue = Number(discount.value || 0);
  return Number((subtotal * percentValue / 100).toFixed(2));
}

function applyMultipleDiscounts(discountList, subtotal) {
  const sorted = [...discountList].sort((a, b) => b.saving - a.saving);
  let remaining = Number(subtotal || 0);
  const applied = [];

  for (const item of sorted) {
    const cap = Math.min(remaining, item.amount);
    if (cap <= 0) continue;
    applied.push({ ...item, amount: Number(cap.toFixed(2)) });
    remaining = Number((remaining - cap).toFixed(2));
    if (remaining <= 0) break;
  }

  return {
    applied,
    total: Number((subtotal - remaining).toFixed(2))
  };
}

function applicableDiscounts(subscription, invoiceDraftLines, onDate) {
  const sourceDiscounts = subscription?.discounts || [];
  const eligible = sourceDiscounts.filter((discount) => {
    if (!discount.isActive) return false;
    if (!isDiscountWithinWindow(discount, onDate)) return false;
    if (discount.usageLimit && discount.usageCount >= discount.usageLimit) return false;
    return true;
  });

  const subtotal = Number((invoiceDraftLines || []).reduce((sum, line) => {
    return sum + Number(line.amount || 0);
  }, 0).toFixed(2));

  const matching = eligible.filter((discount) => {
    if (discount.minPurchaseAmount && subtotal < Number(discount.minPurchaseAmount)) return false;
    if (discount.minQuantity && invoiceDraftLines.length < Number(discount.minQuantity)) return false;
    return true;
  });

  const productMatches = matching.filter((discount) => discount.scope === 'PRODUCT');
  const subscriptionMatches = matching.filter((discount) => discount.scope === 'SUBSCRIPTION');

  const lineScoped = (invoiceDraftLines || []).reduce((acc, line) => {
    const lineDiscounts = productMatches.filter((discount) => {
      const ids = discount.productIds || [];
      return ids.includes(line.productId) || ids.includes(line.product?.id);
    });

    if (lineDiscounts.length) {
      const resolved = lineDiscounts.map((discount) => {
        const amount = calculateDiscountAmount(discount, line.amount || 0);
        return {
          discount,
          lineId: line.id,
          amount,
          saving: amount
        };
      });
      acc.push(...resolved);
    }
    return acc;
  }, []);

  const subscriptionScoped = subscriptionMatches.map((discount) => {
    const amount = calculateDiscountAmount(discount, subtotal);
    return {
      discount,
      lineId: null,
      amount,
      saving: amount
    };
  });

  const allItems = [...lineScoped, ...subscriptionScoped].sort((a, b) => b.saving - a.saving);
  const totalDiscount = applyMultipleDiscounts(allItems, subtotal);

  return {
    items: allItems,
    totalDiscount: totalDiscount.total,
    subtotal,
    finalTotal: Number((subtotal - totalDiscount.total).toFixed(2))
  };
}

module.exports = {
  calculateDiscountAmount,
  applicableDiscounts
};
