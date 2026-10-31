function toUtcDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date supplied to billingDate utility.');
  }
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds()
  ));
}

function clampDay(year, monthIndex, day) {
  const lastDayOfMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Math.min(day, lastDayOfMonth);
}

function addPeriod(date, billingPeriod) {
  const utcDate = toUtcDate(date);

  switch (billingPeriod) {
    case 'DAILY': {
      return new Date(utcDate.getTime() + 24 * 60 * 60 * 1000);
    }
    case 'WEEKLY': {
      return new Date(utcDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    case 'MONTHLY': {
      const targetMonthIndex = utcDate.getUTCMonth() + 1;
      const targetYear = utcDate.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
      const normalizedMonth = targetMonthIndex % 12;
      const day = clampDay(targetYear, normalizedMonth, utcDate.getUTCDate());
      return new Date(Date.UTC(targetYear, normalizedMonth, day));
    }
    case 'YEARLY': {
      const targetYear = utcDate.getUTCFullYear() + 1;
      const day = clampDay(targetYear, utcDate.getUTCMonth(), utcDate.getUTCDate());
      return new Date(Date.UTC(targetYear, utcDate.getUTCMonth(), day));
    }
    default:
      throw new Error(`Unsupported billing period: ${billingPeriod}`);
  }
}

function isWithinDateRange(date, startDate, endDate) {
  const target = toUtcDate(date);
  const start = startDate ? toUtcDate(startDate) : null;
  const end = endDate ? toUtcDate(endDate) : null;

  if (start && target < start) return false;
  if (end && target > end) return false;
  return true;
}

function isPlanAvailableForSubscription(plan, referenceDate = new Date()) {
  if (!plan) return false;
  if (plan.state !== 'ACTIVE') return false;
  return isWithinDateRange(referenceDate, plan.startDate, plan.endDate);
}

module.exports = {
  addPeriod,
  isWithinDateRange,
  isPlanAvailableForSubscription,
  toUtcDate
};
