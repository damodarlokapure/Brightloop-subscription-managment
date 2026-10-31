const { Prisma } = require('@prisma/client');
const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const { addPeriod } = require('../utils/billingDates');
const { getNextNumber } = require('../utils/numbering');
const { applicableDiscounts } = require('./discountEngine');

function decimalNumber(value) {
  if (typeof value === 'number') return Number(value.toFixed(2));
  if (value && typeof value.toNumber === 'function') return Number(value.toNumber().toFixed(2));
  return Number(Number(value || 0).toFixed(2));
}

function dateOnly(dateValue) {
  const value = new Date(dateValue);
  if (Number.isNaN(value.getTime())) throw new Error('Invalid date supplied to billing utility.');
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function endOfBillingPeriod(periodStart, billingPeriod) {
  const next = addPeriod(periodStart, billingPeriod);
  return new Date(next.getTime() - 24 * 60 * 60 * 1000);
}

function buildDiscountInput(subscription) {
  const discountRows = subscription?.discountSubscriptions || [];
  return discountRows.map((entry) => {
    const discount = entry.discount;
    if (!discount) return null;
    return {
      ...discount,
      value: decimalNumber(discount.value),
      minPurchaseAmount: discount.minPurchaseAmount ? decimalNumber(discount.minPurchaseAmount) : null,
      usageCount: Number(discount.usageCount || 0),
      isActive: Boolean(discount.isActive),
      startDate: discount.startDate ? new Date(discount.startDate) : null,
      endDate: discount.endDate ? new Date(discount.endDate) : null,
      productIds: (discount.products || []).map((link) => link.productId),
      products: discount.products || []
    };
  }).filter(Boolean);
}

function makeInvoiceLine(line, discountAmount) {
  const quantity = Number(line.quantity || 1);
  const unitPrice = decimalNumber(line.unitPrice || 0);
  const originalAmount = decimalNumber(unitPrice * quantity);
  const netAfterDiscount = decimalNumber(Math.max(0, originalAmount - discountAmount));
  const taxRate = decimalNumber(line.taxRate || 0);
  const taxAmount = decimalNumber(netAfterDiscount * taxRate / 100);

  return {
    productId: line.productId,
    description: line.product?.name || 'Subscription item',
    quantity,
    unitPrice,
    taxRate,
    taxAmount,
    discountAmount: decimalNumber(discountAmount),
    amount: netAfterDiscount,
    originalAmount
  };
}

async function previewInvoiceForSubscription(subscriptionId, asOfDate) {
  const targetDate = new Date(asOfDate);
  if (Number.isNaN(targetDate.getTime())) {
    throw new AppError(400, 'INVALID_DATE', 'asOfDate must be a valid date.');
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      customer: true,
      plan: true,
      lines: { include: { product: true } },
      discountSubscriptions: { include: { discount: { include: { products: true } } } }
    }
  });

  if (!subscription) {
    throw new AppError(404, 'SUBSCRIPTION_NOT_FOUND', 'Subscription not found.');
  }

  if (subscription.status !== 'ACTIVE') {
    return { skipped: true, reason: 'SUBSCRIPTION_NOT_ACTIVE' };
  }

  if (subscription.expiryDate && dateOnly(targetDate) > dateOnly(subscription.expiryDate)) {
    return { skipped: true, reason: 'SUBSCRIPTION_EXPIRED' };
  }

  const nextBillingDate = new Date(subscription.nextBillingDate || subscription.startDate);
  if (nextBillingDate > dateOnly(targetDate)) {
    return { skipped: true, reason: 'NOT_DUE_YET' };
  }

  const periodStart = new Date(nextBillingDate);
  const periodEnd = endOfBillingPeriod(periodStart, subscription.plan.billingPeriod);
  const invoiceExists = await prisma.invoice.findFirst({
    where: { subscriptionId, periodStart, periodEnd }
  });
  if (invoiceExists) {
    return { skipped: true, reason: 'ALREADY_BILLED' };
  }

  const candidateLines = subscription.lines.map((line) => ({
    id: line.id,
    productId: line.productId,
    product: line.product,
    quantity: Number(line.quantity || 1),
    amount: decimalNumber(Number(line.unitPrice || 0) * Number(line.quantity || 1)),
    unitPrice: decimalNumber(line.unitPrice || 0)
  }));

  const discounts = buildDiscountInput(subscription);
  const discountResult = applicableDiscounts({ discounts }, candidateLines, targetDate);
  const invoiceLines = candidateLines.map((line) => {
    const discountForLine = discountResult.items
      .filter((item) => item.lineId === line.id)
      .reduce((sum, item) => sum + decimalNumber(item.amount), 0);
    return makeInvoiceLine({ ...line, taxRate: decimalNumber(line.amount > 0 ? (subscription.plan?.price || 0) : 0) }, discountForLine);
  });

  const subtotal = decimalNumber(invoiceLines.reduce((sum, line) => sum + line.originalAmount, 0));
  const discountTotal = decimalNumber(invoiceLines.reduce((sum, line) => sum + line.discountAmount, 0));
  const taxTotal = decimalNumber(invoiceLines.reduce((sum, line) => sum + line.taxAmount, 0));
  const total = decimalNumber(subtotal - discountTotal + taxTotal);

  return {
    skipped: false,
    preview: {
      subscriptionId,
      periodStart,
      periodEnd,
      issueDate: dateOnly(targetDate),
      dueDate: new Date(dateOnly(targetDate).getTime() + Number(subscription.paymentTerms || 0) * 24 * 60 * 60 * 1000),
      subtotal,
      discountTotal,
      taxTotal,
      total,
      lines: invoiceLines,
      discounts: discountResult.items.map((item) => ({
        discountId: item.discount.id,
        amount: decimalNumber(item.amount)
      }))
    }
  };
}

async function generateInvoiceForSubscription(subscriptionId, asOfDate, actor = null) {
  const targetDate = new Date(asOfDate);
  if (Number.isNaN(targetDate.getTime())) {
    throw new AppError(400, 'INVALID_DATE', 'asOfDate must be a valid date.');
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT * FROM "Subscription" WHERE id = ${subscriptionId}::uuid FOR UPDATE`;

    const subscription = await tx.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        customer: true,
        plan: true,
        lines: { include: { product: { include: { tax: true } } } },
        discountSubscriptions: { include: { discount: { include: { products: true } } } }
      }
    });

    if (!subscription) {
      throw new AppError(404, 'SUBSCRIPTION_NOT_FOUND', 'Subscription not found.');
    }

    if (subscription.status !== 'ACTIVE') {
      return { skipped: true, reason: 'SUBSCRIPTION_NOT_ACTIVE' };
    }

    if (subscription.expiryDate && dateOnly(targetDate) > dateOnly(subscription.expiryDate)) {
      return { skipped: true, reason: 'SUBSCRIPTION_EXPIRED' };
    }

    const nextBillingDate = new Date(subscription.nextBillingDate || subscription.startDate);
    if (nextBillingDate > dateOnly(targetDate)) {
      return { skipped: true, reason: 'NOT_DUE_YET' };
    }

    const periodStart = new Date(nextBillingDate);
    const periodEnd = endOfBillingPeriod(periodStart, subscription.plan.billingPeriod);

    const duplicate = await tx.invoice.findFirst({
      where: { subscriptionId, periodStart, periodEnd }
    });
    if (duplicate) {
      return { skipped: true, reason: 'ALREADY_BILLED' };
    }

    if (!subscription.lines || subscription.lines.length === 0) {
      return { skipped: true, reason: 'NO_LINES' };
    }

    const candidateLines = subscription.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      product: line.product,
      quantity: Number(line.quantity || 1),
      amount: decimalNumber(Number(line.unitPrice || 0) * Number(line.quantity || 1)),
      unitPrice: decimalNumber(line.unitPrice || 0)
    }));

    const discounts = buildDiscountInput(subscription);
    const discountResult = applicableDiscounts({ discounts }, candidateLines, targetDate);
    const invoiceLines = candidateLines.map((line) => {
      const discountForLine = discountResult.items
        .filter((item) => item.lineId === line.id)
        .reduce((sum, item) => sum + decimalNumber(item.amount), 0);

      const baseAmount = decimalNumber(Number(line.unitPrice || 0) * Number(line.quantity || 1));
      const netAfterDiscount = decimalNumber(Math.max(0, baseAmount - discountForLine));
      const taxRate = decimalNumber(line.product?.tax?.ratePercent || 0);
      const taxAmount = decimalNumber(netAfterDiscount * taxRate / 100);

      return {
        productId: line.productId,
        description: line.product?.name || 'Subscription item',
        quantity: Number(line.quantity || 1),
        unitPrice: decimalNumber(line.unitPrice || 0),
        taxRate,
        taxAmount,
        discountAmount: decimalNumber(discountForLine),
        amount: netAfterDiscount,
        originalAmount: baseAmount
      };
    });

    const subtotal = decimalNumber(invoiceLines.reduce((sum, line) => sum + line.originalAmount, 0));
    const discountTotal = decimalNumber(invoiceLines.reduce((sum, line) => sum + line.discountAmount, 0));
    const taxTotal = decimalNumber(invoiceLines.reduce((sum, line) => sum + line.taxAmount, 0));
    const total = decimalNumber(subtotal - discountTotal + taxTotal);

    let invoice;
    try {
      invoice = await tx.invoice.create({
        data: {
          number: await getNextNumber(tx, 'invoice-number', 'INV-'),
          subscriptionId: subscription.id,
          customerId: subscription.customerId,
          status: 'DRAFT',
          periodStart,
          periodEnd,
          issueDate: dateOnly(targetDate),
          dueDate: new Date(dateOnly(targetDate).getTime() + Number(subscription.paymentTerms || 0) * 24 * 60 * 60 * 1000),
          subtotal,
          discountTotal,
          taxTotal,
          total,
          amountPaid: 0,
          notes: `Recurring billing for ${subscription.plan.name}`
        }
      });
    } catch (error) {
      if (error && error.code === 'P2002') {
        return { skipped: true, reason: 'ALREADY_BILLED' };
      }
      throw error;
    }

    const createdLines = await Promise.all(invoiceLines.map((line) => tx.invoiceLine.create({
      data: {
        invoiceId: invoice.id,
        productId: line.productId,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxRate: line.taxRate,
        taxAmount: line.taxAmount,
        discountAmount: line.discountAmount,
        amount: line.amount
      }
    })));

    const appliedDiscountIds = [...new Set(discountResult.items.filter((item) => item.amount > 0).map((item) => item.discount.id))];
    if (appliedDiscountIds.length > 0) {
      await tx.invoiceDiscount.createMany({
        data: appliedDiscountIds.map((discountId) => ({
          invoiceId: invoice.id,
          discountId,
          amount: decimalNumber(discountResult.items.filter((item) => item.discount.id === discountId).reduce((sum, item) => sum + decimalNumber(item.amount), 0))
        })),
        skipDuplicates: true
      });

      await Promise.all(appliedDiscountIds.map((discountId) =>
        tx.discount.update({
          where: { id: discountId },
          data: { usageCount: { increment: 1 } }
        })
      ));
    }

    const nextBilling = new Date(dateOnly(periodEnd).getTime() + 24 * 60 * 60 * 1000);
    await tx.subscription.update({
      where: { id: subscriptionId },
      data: { nextBillingDate: nextBilling }
    });

    await tx.auditLog.create({
      data: {
        userId: actor || null,
        action: 'BILLING_INVOICE_CREATED',
        entity: 'Invoice',
        entityId: invoice.id,
        meta: {
          subscriptionId,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          invoiceNumber: invoice.number,
          total: total.toString()
        }
      }
    });

    return {
      created: true,
      invoice: {
        ...invoice,
        subtotal,
        discountTotal,
        taxTotal,
        total,
        lines: createdLines
      }
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });
}

async function runBillingRun(asOfDate = new Date(), actor = null, options = {}) {
  const { dryRun = false } = options;
  const targetDate = dateOnly(asOfDate);
  const summary = { due: 0, created: 0, skipped: 0, failed: [] };

  let offset = 0;
  const pageSize = 200;

  while (true) {
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        nextBillingDate: { lte: targetDate },
        OR: [
          { expiryDate: null },
          { expiryDate: { gte: targetDate } }
        ]
      },
      orderBy: { nextBillingDate: 'asc' },
      skip: offset,
      take: pageSize,
      select: { id: true }
    });

    if (subscriptions.length === 0) break;
    summary.due += subscriptions.length;

    for (const subscription of subscriptions) {
      try {
        if (dryRun) {
          const result = await previewInvoiceForSubscription(subscription.id, targetDate);
          if (result && result.skipped) {
            summary.skipped += 1;
          } else if (result && result.preview) {
            summary.created += 1;
          }
          continue;
        }

        let processed = 0;
        let currentResult = null;
        while (processed < 12) {
          currentResult = await generateInvoiceForSubscription(subscription.id, targetDate, actor);
          if (currentResult && currentResult.skipped) {
            break;
          }
          if (!currentResult || !currentResult.created) {
            break;
          }
          summary.created += 1;
          processed += 1;
        }

        if (currentResult && currentResult.skipped) {
          summary.skipped += 1;
        }
      } catch (error) {
        summary.failed.push({
          subscriptionId: subscription.id,
          error: error?.message || 'Unknown billing error'
        });
      }
    }

    if (subscriptions.length < pageSize) break;
    offset += pageSize;
  }

  return summary;
}

module.exports = {
  decimalNumber,
  dateOnly,
  endOfBillingPeriod,
  buildDiscountInput,
  makeInvoiceLine,
  previewInvoiceForSubscription,
  generateInvoiceForSubscription,
  runBillingRun
};
