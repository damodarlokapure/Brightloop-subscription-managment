const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const { addPeriod, isPlanAvailableForSubscription } = require('../utils/billingDates');

function decimalNumber(value) {
  if (typeof value === 'number') return Number(value.toFixed(2));
  if (value && typeof value.toNumber === 'function') return Number(value.toNumber().toFixed(2));
  return Number(Number(value || 0).toFixed(2));
}

function normalizePlan(plan) {
  if (!plan) return null;
  return {
    ...plan,
    price: decimalNumber(plan.price),
    startDate: new Date(plan.startDate),
    endDate: plan.endDate ? new Date(plan.endDate) : null,
    createdAt: new Date(plan.createdAt),
    updatedAt: new Date(plan.updatedAt)
  };
}

function ensurePlanCanTransition(plan, action) {
  if (!plan) {
    throw new AppError(404, 'PLAN_NOT_FOUND', 'Plan not found.');
  }

  if (plan.state === 'CLOSED' && action !== 'close') {
    throw new AppError(409, 'PLAN_ACTION_NOT_ALLOWED', 'This plan is closed and cannot be modified.');
  }
}

async function createPlan(input) {
  const payload = {
    name: String(input.name || '').trim(),
    price: Number(input.price),
    billingPeriod: String(input.billingPeriod || '').toUpperCase(),
    minQuantity: Number(input.minQuantity ?? 1),
    startDate: new Date(input.startDate),
    endDate: input.endDate ? new Date(input.endDate) : null,
    autoCloseOnEnd: Boolean(input.autoCloseOnEnd),
    allowEarlyClose: Boolean(input.allowEarlyClose),
    allowPause: Boolean(input.allowPause),
    allowRenew: input.allowRenew !== undefined ? Boolean(input.allowRenew) : true,
    state: 'ACTIVE'
  };

  if (!payload.name) {
    throw new AppError(400, 'INVALID_PLAN', 'Plan name is required.');
  }
  if (Number.isNaN(payload.price) || payload.price < 0) {
    throw new AppError(400, 'INVALID_PRICE', 'Plan price must be greater than or equal to zero.');
  }
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(payload.billingPeriod)) {
    throw new AppError(400, 'INVALID_BILLING_PERIOD', 'Billing period must be DAILY, WEEKLY, MONTHLY, or YEARLY.');
  }
  if (!Number.isInteger(payload.minQuantity) || payload.minQuantity < 1) {
    throw new AppError(400, 'INVALID_MIN_QUANTITY', 'minQuantity must be an integer greater than or equal to 1.');
  }
  if (Number.isNaN(payload.startDate.getTime()) || Number.isNaN(payload.endDate?.getTime?.() ?? NaN)) {
    throw new AppError(400, 'INVALID_DATE', 'Plan startDate and endDate must be valid dates.');
  }
  if (payload.endDate && payload.endDate < payload.startDate) {
    throw new AppError(400, 'INVALID_DATE_RANGE', 'Plan endDate must be on or after startDate.');
  }

  const plan = await prisma.plan.create({ data: payload });
  return normalizePlan(plan);
}

async function listPlans({ userRole, page = 1, limit = 25, state, billingPeriod, availableOn } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const skip = (safePage - 1) * safeLimit;
  const where = {};

  if (state) where.state = String(state).toUpperCase();
  if (billingPeriod) where.billingPeriod = String(billingPeriod).toUpperCase();

  if (userRole === 'CUSTOMER') {
    where.state = 'ACTIVE';
    const referenceDate = availableOn ? new Date(availableOn) : new Date();
    if (Number.isNaN(referenceDate.getTime())) {
      throw new AppError(400, 'INVALID_DATE', 'availableOn must be a valid date.');
    }
    where.startDate = { lte: referenceDate };
    where.endDate = { gte: referenceDate };
  } else if (availableOn) {
    const referenceDate = new Date(availableOn);
    if (Number.isNaN(referenceDate.getTime())) {
      throw new AppError(400, 'INVALID_DATE', 'availableOn must be a valid date.');
    }
    where.startDate = { lte: referenceDate };
    where.endDate = { gte: referenceDate };
    if (!state) where.state = 'ACTIVE';
  }

  const [rows, total] = await Promise.all([
    prisma.plan.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.plan.count({ where })
  ]);

  return {
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.ceil(total / safeLimit),
    data: rows.map(normalizePlan)
  };
}

async function getPlanById(id) {
  const plan = await prisma.plan.findUnique({ where: { id } });
  if (!plan) {
    throw new AppError(404, 'PLAN_NOT_FOUND', 'Plan not found.');
  }
  return normalizePlan(plan);
}

async function updatePlan(id, input) {
  const existing = await prisma.plan.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'PLAN_NOT_FOUND', 'Plan not found.');
  }

  const payload = {};
  if (input.name !== undefined) payload.name = String(input.name || '').trim();
  if (input.price !== undefined) payload.price = Number(input.price);
  if (input.billingPeriod !== undefined) payload.billingPeriod = String(input.billingPeriod).toUpperCase();
  if (input.minQuantity !== undefined) payload.minQuantity = Number(input.minQuantity);
  if (input.startDate !== undefined) payload.startDate = new Date(input.startDate);
  if (input.endDate !== undefined) payload.endDate = input.endDate ? new Date(input.endDate) : null;
  if (input.autoCloseOnEnd !== undefined) payload.autoCloseOnEnd = Boolean(input.autoCloseOnEnd);
  if (input.allowEarlyClose !== undefined) payload.allowEarlyClose = Boolean(input.allowEarlyClose);
  if (input.allowPause !== undefined) payload.allowPause = Boolean(input.allowPause);
  if (input.allowRenew !== undefined) payload.allowRenew = Boolean(input.allowRenew);
  if (input.state !== undefined) payload.state = String(input.state).toUpperCase();

  if (payload.name !== undefined && !payload.name) {
    throw new AppError(400, 'INVALID_PLAN', 'Plan name is required.');
  }
  if (payload.price !== undefined && (Number.isNaN(payload.price) || payload.price < 0)) {
    throw new AppError(400, 'INVALID_PRICE', 'Plan price must be greater than or equal to zero.');
  }
  if (payload.billingPeriod && !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(payload.billingPeriod)) {
    throw new AppError(400, 'INVALID_BILLING_PERIOD', 'Billing period must be DAILY, WEEKLY, MONTHLY, or YEARLY.');
  }
  if (payload.minQuantity !== undefined && (!Number.isInteger(payload.minQuantity) || payload.minQuantity < 1)) {
    throw new AppError(400, 'INVALID_MIN_QUANTITY', 'minQuantity must be an integer greater than or equal to 1.');
  }
  if (payload.state && !['ACTIVE', 'PAUSED', 'CLOSED'].includes(payload.state)) {
    throw new AppError(400, 'INVALID_STATE', 'Plan state must be ACTIVE, PAUSED, or CLOSED.');
  }

  const finalStartDate = payload.startDate ?? existing.startDate;
  const finalEndDate = payload.endDate ?? existing.endDate;
  if (finalEndDate && finalEndDate < finalStartDate) {
    throw new AppError(400, 'INVALID_DATE_RANGE', 'Plan endDate must be on or after startDate.');
  }

  const plan = await prisma.plan.update({
    where: { id },
    data: payload
  });

  return normalizePlan(plan);
}

async function deletePlan(id) {
  const plan = await prisma.plan.findUnique({ where: { id } });
  if (!plan) {
    throw new AppError(404, 'PLAN_NOT_FOUND', 'Plan not found.');
  }

  const subscription = await prisma.subscription.findFirst({ where: { planId: id } });
  if (subscription) {
    throw new AppError(409, 'PLAN_IN_USE', 'This plan is in use by a subscription and cannot be deleted.');
  }

  await prisma.plan.delete({ where: { id } });
  return { deleted: true, id };
}

async function closePlan(id) {
  const plan = await prisma.plan.findUnique({ where: { id } });
  ensurePlanCanTransition(plan, 'close');

  if (plan.state === 'CLOSED') {
    throw new AppError(409, 'PLAN_ACTION_NOT_ALLOWED', 'This plan is already closed.');
  }

  if (!plan.allowEarlyClose && plan.endDate && plan.endDate > new Date()) {
    throw new AppError(409, 'PLAN_ACTION_NOT_ALLOWED', 'Early closure is disabled for this plan.');
  }

  const updated = await prisma.plan.update({
    where: { id },
    data: { state: 'CLOSED', endDate: plan.endDate ?? new Date() }
  });

  return normalizePlan(updated);
}

async function pausePlan(id) {
  const plan = await prisma.plan.findUnique({ where: { id } });
  ensurePlanCanTransition(plan, 'pause');

  if (plan.state === 'PAUSED') {
    throw new AppError(409, 'PLAN_ACTION_NOT_ALLOWED', 'This plan is already paused.');
  }
  if (!plan.allowPause) {
    throw new AppError(409, 'PLAN_ACTION_NOT_ALLOWED', 'Pausing is disabled for this plan.');
  }

  const updated = await prisma.plan.update({
    where: { id },
    data: { state: 'PAUSED' }
  });

  return normalizePlan(updated);
}

async function resumePlan(id) {
  const plan = await prisma.plan.findUnique({ where: { id } });
  ensurePlanCanTransition(plan, 'resume');

  if (plan.state !== 'PAUSED') {
    throw new AppError(409, 'PLAN_ACTION_NOT_ALLOWED', 'Only paused plans can be resumed.');
  }
  if (!plan.allowPause) {
    throw new AppError(409, 'PLAN_ACTION_NOT_ALLOWED', 'Resuming is not permitted for this plan.');
  }

  const updated = await prisma.plan.update({
    where: { id },
    data: { state: 'ACTIVE' }
  });

  return normalizePlan(updated);
}

async function renewPlan(id, payload = {}) {
  const plan = await prisma.plan.findUnique({ where: { id } });
  ensurePlanCanTransition(plan, 'renew');

  if (!plan.allowRenew) {
    throw new AppError(409, 'PLAN_ACTION_NOT_ALLOWED', 'Renewal is disabled for this plan.');
  }

  if (plan.state === 'CLOSED') {
    throw new AppError(409, 'PLAN_ACTION_NOT_ALLOWED', 'Closed plans cannot be renewed.');
  }

  const nextEndDate = payload.endDate
    ? new Date(payload.endDate)
    : addPeriod(plan.endDate || plan.startDate, plan.billingPeriod);

  if (Number.isNaN(nextEndDate.getTime())) {
    throw new AppError(400, 'INVALID_DATE', 'Renewal endDate must be valid.');
  }

  const updated = await prisma.plan.update({
    where: { id },
    data: {
      state: 'ACTIVE',
      endDate: nextEndDate,
      startDate: plan.startDate
    }
  });

  return normalizePlan(updated);
}

async function closeExpiredPlans() {
  const today = new Date();
  const expiredPlans = await prisma.plan.findMany({
    where: {
      autoCloseOnEnd: true,
      state: { not: 'CLOSED' },
      endDate: { lt: today }
    }
  });

  for (const plan of expiredPlans) {
    await prisma.plan.update({
      where: { id: plan.id },
      data: { state: 'CLOSED' }
    });
  }

  return {
    closedCount: expiredPlans.length,
    plans: expiredPlans.map(normalizePlan)
  };
}

module.exports = {
  createPlan,
  listPlans,
  getPlanById,
  updatePlan,
  deletePlan,
  closePlan,
  pausePlan,
  resumePlan,
  renewPlan,
  closeExpiredPlans,
  isPlanAvailableForSubscription
};
