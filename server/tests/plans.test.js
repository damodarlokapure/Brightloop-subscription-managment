const prisma = require('../src/config/prisma');
const planService = require('../src/services/planService');

describe('Plan service', () => {
  beforeEach(async () => {
    await prisma.plan.deleteMany();
  });

  it('rejects early close when allowEarlyClose is false', async () => {
    const plan = await prisma.plan.create({
      data: {
        name: 'Standard Plan',
        price: 100,
        billingPeriod: 'MONTHLY',
        minQuantity: 1,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2030-01-01T00:00:00Z'),
        allowEarlyClose: false,
        allowPause: true,
        allowRenew: true,
        state: 'ACTIVE'
      }
    });

    await expect(planService.closePlan(plan.id)).rejects.toMatchObject({
      statusCode: 409,
      code: 'PLAN_ACTION_NOT_ALLOWED'
    });
  });

  it('rejects pause when allowPause is false', async () => {
    const plan = await prisma.plan.create({
      data: {
        name: 'Pause Disabled',
        price: 120,
        billingPeriod: 'MONTHLY',
        minQuantity: 1,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2030-01-01T00:00:00Z'),
        allowEarlyClose: true,
        allowPause: false,
        allowRenew: true,
        state: 'ACTIVE'
      }
    });

    await expect(planService.pausePlan(plan.id)).rejects.toMatchObject({
      statusCode: 409,
      code: 'PLAN_ACTION_NOT_ALLOWED'
    });
  });

  it('rejects renewal when allowRenew is false', async () => {
    const plan = await prisma.plan.create({
      data: {
        name: 'Renew Disabled',
        price: 150,
        billingPeriod: 'MONTHLY',
        minQuantity: 1,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2030-01-01T00:00:00Z'),
        allowEarlyClose: true,
        allowPause: true,
        allowRenew: false,
        state: 'ACTIVE'
      }
    });

    await expect(planService.renewPlan(plan.id)).rejects.toMatchObject({
      statusCode: 409,
      code: 'PLAN_ACTION_NOT_ALLOWED'
    });
  });
});
