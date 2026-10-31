const { addPeriod, isWithinDateRange, isPlanAvailableForSubscription } = require('../src/utils/billingDates');

describe('billingDates utility', () => {
  it('adds one month across month-end boundaries in UTC', () => {
    const start = new Date('2024-01-31T00:00:00Z');
    const next = addPeriod(start, 'MONTHLY');
    expect(next.toISOString()).toBe('2024-02-29T00:00:00.000Z');
  });

  it('handles leap years for yearly periods', () => {
    const start = new Date('2024-02-29T00:00:00Z');
    const next = addPeriod(start, 'YEARLY');
    expect(next.toISOString()).toBe('2025-02-28T00:00:00.000Z');
  });

  it('handles weekly periods correctly', () => {
    const start = new Date('2024-01-01T00:00:00Z');
    const next = addPeriod(start, 'WEEKLY');
    expect(next.toISOString()).toBe('2024-01-08T00:00:00.000Z');
  });

  it('handles daily periods correctly', () => {
    const start = new Date('2024-01-01T00:00:00Z');
    const next = addPeriod(start, 'DAILY');
    expect(next.toISOString()).toBe('2024-01-02T00:00:00.000Z');
  });

  it('keeps the date range inclusive of start and end', () => {
    const start = new Date('2024-01-01T00:00:00Z');
    const end = new Date('2024-01-31T00:00:00Z');
    expect(isWithinDateRange(new Date('2024-01-01T00:00:00Z'), start, end)).toBe(true);
    expect(isWithinDateRange(new Date('2024-01-31T00:00:00Z'), start, end)).toBe(true);
    expect(isWithinDateRange(new Date('2024-02-01T00:00:00Z'), start, end)).toBe(false);
  });

  it('only allows plans in the ACTIVE state and within the active window', () => {
    const plan = {
      state: 'ACTIVE',
      startDate: new Date('2024-01-01T00:00:00Z'),
      endDate: new Date('2024-12-31T00:00:00Z')
    };

    expect(isPlanAvailableForSubscription(plan, new Date('2024-06-01T00:00:00Z'))).toBe(true);
    expect(isPlanAvailableForSubscription({ ...plan, state: 'PAUSED' }, new Date('2024-06-01T00:00:00Z'))).toBe(false);
    expect(isPlanAvailableForSubscription({ ...plan, endDate: new Date('2024-01-15T00:00:00Z') }, new Date('2024-06-01T00:00:00Z'))).toBe(false);
  });
});
