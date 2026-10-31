const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const { addPeriod } = require('../utils/billingDates');

function normalizeDecimal(value) {
  if (typeof value === 'number') return Number(value.toFixed(2));
  if (value && typeof value.toNumber === 'function') return Number(value.toNumber().toFixed(2));
  return Number(Number(value || 0).toFixed(2));
}

function validTransitions() {
  return {
    DRAFT: ['QUOTATION'],
    QUOTATION: ['CONFIRMED'],
    CONFIRMED: ['ACTIVE'],
    ACTIVE: ['CLOSED'],
    CLOSED: []
  };
}

function isValidTransition(current, next) {
  return validTransitions()[current]?.includes(next);
}

function buildSubscriptionNumber() {
  const date = new Date();
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `SUB-${stamp}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function ensureCustomerAndPlan(customerId, planId) {
  const [customer, plan] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId } }),
    prisma.plan.findUnique({ where: { id: planId } })
  ]);

  if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found.');
  if (!plan) throw new AppError(404, 'PLAN_NOT_FOUND', 'Plan not found.');
  return { customer, plan };
}

async function createSubscription(input) {
  const { customerId, planId, templateId, status = 'DRAFT', createdById, lines = [] } = input;

  const { plan } = await ensureCustomerAndPlan(customerId, planId);

  const baseStartDate = new Date(input.startDate || new Date());
  const nextBillingDate = addPeriod(baseStartDate, plan.billingPeriod);

  const subscription = await prisma.$transaction(async (tx) => {
    const created = await tx.subscription.create({
      data: {
        number: buildSubscriptionNumber(),
        customerId,
        planId,
        status,
        startDate: baseStartDate,
        nextBillingDate,
        templateId: templateId || null,
        createdById: createdById || null,
        quotationValidUntil: input.quotationValidUntil ? new Date(input.quotationValidUntil) : null,
        paymentTerms: Number(input.paymentTerms || 0)
      }
    });

    if (lines.length) {
      await tx.subscriptionLine.createMany({
        data: lines.map((line) => ({
          subscriptionId: created.id,
          productId: line.productId,
          variantId: line.variantId || null,
          quantity: Number(line.quantity || 1),
          unitPrice: Number(line.unitPrice || 0),
          amount: Number(line.amount || 0),
          taxRate: line.taxRate ? Number(line.taxRate) : 0,
          taxAmount: line.taxAmount ? Number(line.taxAmount) : 0,
          discountAmount: line.discountAmount ? Number(line.discountAmount) : 0
        }))
      });
    }

    const result = await tx.subscription.findUnique({
      where: { id: created.id },
      include: {
        customer: true,
        plan: true,
        lines: true,
        template: true,
        statusHistory: true
      }
    });

    return result;
  });

  return subscription;
}

async function listSubscriptions({ page = 1, limit = 25, customerId, status } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const skip = (safePage - 1) * safeLimit;

  const where = {};
  if (customerId) where.customerId = customerId;
  if (status) where.status = String(status).toUpperCase();

  const [rows, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        plan: true,
        lines: true,
        template: true
      }
    }),
    prisma.subscription.count({ where })
  ]);

  return {
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
    data: rows.map((row) => ({
      ...row,
      lines: row.lines.map((line) => ({ ...line, unitPrice: normalizeDecimal(line.unitPrice), amount: normalizeDecimal(line.amount), taxAmount: normalizeDecimal(line.taxAmount), discountAmount: normalizeDecimal(line.discountAmount) }))
    }))
  };
}

async function getSubscriptionById(id, customerId = null) {
  const subscription = await prisma.subscription.findUnique({
    where: { id },
    include: {
      customer: true,
      plan: true,
      lines: true,
      template: true,
      statusHistory: true
    }
  });

  if (!subscription) throw new AppError(404, 'SUBSCRIPTION_NOT_FOUND', 'Subscription not found.');
  if (customerId && subscription.customerId !== customerId) {
    throw new AppError(404, 'SUBSCRIPTION_NOT_FOUND', 'Subscription not found.');
  }
  return subscription;
}

async function transitionStatus(id, nextStatus, reason = null) {
  const subscription = await prisma.subscription.findUnique({ where: { id } });
  if (!subscription) throw new AppError(404, 'SUBSCRIPTION_NOT_FOUND', 'Subscription not found.');

  const current = subscription.status;
  const next = String(nextStatus).toUpperCase();

  if (!isValidTransition(current, next)) {
    throw new AppError(409, 'INVALID_SUBSCRIPTION_STATUS', `Invalid transition from ${current} to ${next}.`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.subscription.update({
      where: { id },
      data: {
        status: next,
        pausedAt: next === 'ACTIVE' ? null : subscription.pausedAt,
        closedAt: next === 'CLOSED' ? new Date() : subscription.closedAt
      },
      include: { statusHistory: true }
    });

    await tx.subscriptionStatusHistory.create({
      data: {
        subscriptionId: id,
        fromStatus: current,
        toStatus: next,
        reason: reason || `status:${current}->${next}`
      }
    });

    return record;
  });

  return updated;
}

async function getSubscriptionStats() {
  const [draft, quotation, confirmed, active, closed] = await Promise.all([
    prisma.subscription.count({ where: { status: 'DRAFT' } }),
    prisma.subscription.count({ where: { status: 'QUOTATION' } }),
    prisma.subscription.count({ where: { status: 'CONFIRMED' } }),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.count({ where: { status: 'CLOSED' } })
  ]);

  return { draft, quotation, confirmed, active, closed };
}

module.exports = {
  createSubscription,
  listSubscriptions,
  getSubscriptionById,
  transitionStatus,
  getSubscriptionStats
};
