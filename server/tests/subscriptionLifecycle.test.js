const prisma = require('../src/config/prisma');
const subscriptionService = require('../src/services/subscriptionService');

describe('Subscription lifecycle', () => {
  beforeEach(async () => {
    await prisma.subscriptionStatusHistory.deleteMany();
    await prisma.invoiceDiscount.deleteMany();
    await prisma.invoiceLine.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.subscriptionLine.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.plan.deleteMany();
  });

  it('allows the exact required lifecycle progression', async () => {
    const customer = await prisma.customer.create({
      data: {
        name: 'Test Customer',
        email: 'customer@example.com'
      }
    });

    const plan = await prisma.plan.create({
      data: {
        name: 'Starter',
        price: 120,
        billingPeriod: 'MONTHLY',
        minQuantity: 1,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2027-01-01T00:00:00Z'),
        allowEarlyClose: true,
        allowPause: true,
        allowRenew: true,
        state: 'ACTIVE'
      }
    });

    const subscription = await prisma.subscription.create({
      data: {
        number: 'SUB-TEST-001',
        customerId: customer.id,
        planId: plan.id,
        status: 'DRAFT',
        startDate: new Date('2026-01-01T00:00:00Z'),
        nextBillingDate: new Date('2026-02-01T00:00:00Z')
      }
    });

    const movedToQuotation = await subscriptionService.transitionStatus(subscription.id, 'QUOTATION', 'quote ready');
    const movedToConfirmed = await subscriptionService.transitionStatus(movedToQuotation.id, 'CONFIRMED', 'customer approved');
    const movedToActive = await subscriptionService.transitionStatus(movedToConfirmed.id, 'ACTIVE', 'activated');
    const movedToClosed = await subscriptionService.transitionStatus(movedToActive.id, 'CLOSED', 'closed');

    expect(movedToQuotation.status).toBe('QUOTATION');
    expect(movedToConfirmed.status).toBe('CONFIRMED');
    expect(movedToActive.status).toBe('ACTIVE');
    expect(movedToClosed.status).toBe('CLOSED');
  });

  it('rejects invalid transitions with a 409', async () => {
    const customer = await prisma.customer.create({
      data: {
        name: 'Test Customer',
        email: 'invalid@example.com'
      }
    });

    const plan = await prisma.plan.create({
      data: {
        name: 'Starter',
        price: 120,
        billingPeriod: 'MONTHLY',
        minQuantity: 1,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2027-01-01T00:00:00Z'),
        allowEarlyClose: true,
        allowPause: true,
        allowRenew: true,
        state: 'ACTIVE'
      }
    });

    const subscription = await prisma.subscription.create({
      data: {
        number: 'SUB-TEST-002',
        customerId: customer.id,
        planId: plan.id,
        status: 'DRAFT',
        startDate: new Date('2026-01-01T00:00:00Z'),
        nextBillingDate: new Date('2026-02-01T00:00:00Z')
      }
    });

    await expect(subscriptionService.transitionStatus(subscription.id, 'ACTIVE', 'wrong path')).rejects.toMatchObject({
      statusCode: 409,
      code: 'INVALID_SUBSCRIPTION_STATUS'
    });
  });
});
