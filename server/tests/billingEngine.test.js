const prisma = require('../src/config/prisma');
const { runBillingRun, generateInvoiceForSubscription } = require('../src/services/billing');

describe('Recurring billing engine', () => {
  beforeEach(async () => {
    await prisma.invoiceDiscount.deleteMany();
    await prisma.invoiceLine.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.discountSubscription.deleteMany();
    await prisma.discountProduct.deleteMany();
    await prisma.discount.deleteMany();
    await prisma.subscriptionStatusHistory.deleteMany();
    await prisma.subscriptionLine.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.product.deleteMany();
    await prisma.tax.deleteMany();
  });

  it('runs twice and never duplicates invoices', async () => {
    const tax = await prisma.tax.create({
      data: { name: 'VAT', ratePercent: 10, isActive: true }
    });
    const product = await prisma.product.create({
      data: { name: 'Workspace', type: 'SERVICE', salesPrice: 100, costPrice: 50, taxId: tax.id }
    });
    const customer = await prisma.customer.create({ data: { name: 'A', email: 'a@example.com' } });
    const plan = await prisma.plan.create({
      data: {
        name: 'Pro',
        price: 100,
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
        number: 'SUB-001',
        customerId: customer.id,
        planId: plan.id,
        status: 'ACTIVE',
        startDate: new Date('2026-01-01T00:00:00Z'),
        nextBillingDate: new Date('2026-01-01T00:00:00Z'),
        paymentTerms: 10,
        expiryDate: new Date('2027-01-01T00:00:00Z')
      }
    });

    await prisma.subscriptionLine.create({
      data: {
        subscriptionId: subscription.id,
        productId: product.id,
        quantity: 1,
        unitPrice: 100,
        taxRate: 10,
        taxAmount: 10,
        discountAmount: 0,
        amount: 100
      }
    });

    const firstRun = await runBillingRun(new Date('2026-01-15T00:00:00Z'));
    const secondRun = await runBillingRun(new Date('2026-01-15T00:00:00Z'));

    const invoices = await prisma.invoice.findMany({ where: { subscriptionId: subscription.id } });
    expect(firstRun.created).toBe(1);
    expect(secondRun.created).toBe(0);
    expect(invoices).toHaveLength(1);
  });

  it('respects discount usage limits and tax after discount', async () => {
    const tax = await prisma.tax.create({
      data: { name: 'VAT', ratePercent: 10, isActive: true }
    });
    const product = await prisma.product.create({
      data: { name: 'Workspace', type: 'SERVICE', salesPrice: 100, costPrice: 50, taxId: tax.id }
    });
    const customer = await prisma.customer.create({ data: { name: 'B', email: 'b@example.com' } });
    const plan = await prisma.plan.create({
      data: {
        name: 'Pro',
        price: 100,
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

    const discount = await prisma.discount.create({
      data: {
        name: '10% off',
        type: 'PERCENTAGE',
        value: 10,
        scope: 'PRODUCT',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-12-31T00:00:00Z'),
        usageLimit: 1,
        usageCount: 0,
        isActive: true
      }
    });

    await prisma.discountProduct.create({
      data: { discountId: discount.id, productId: product.id }
    });

    const subscription = await prisma.subscription.create({
      data: {
        number: 'SUB-002',
        customerId: customer.id,
        planId: plan.id,
        status: 'ACTIVE',
        startDate: new Date('2026-01-01T00:00:00Z'),
        nextBillingDate: new Date('2026-01-01T00:00:00Z'),
        paymentTerms: 10,
        expiryDate: new Date('2027-01-01T00:00:00Z')
      }
    });

    await prisma.discountSubscription.create({
      data: { discountId: discount.id, subscriptionId: subscription.id }
    });

    await prisma.subscriptionLine.create({
      data: {
        subscriptionId: subscription.id,
        productId: product.id,
        quantity: 1,
        unitPrice: 100,
        taxRate: 10,
        taxAmount: 10,
        discountAmount: 0,
        amount: 100
      }
    });

    const result = await generateInvoiceForSubscription(subscription.id, new Date('2026-01-15T00:00:00Z'));
    expect(result.created).toBe(true);

    const invoice = await prisma.invoice.findUnique({ where: { id: result.invoice.id }, include: { lines: true, discounts: true } });
    expect(invoice.discountTotal.toNumber()).toBeCloseTo(10, 2);
    expect(invoice.taxTotal.toNumber()).toBeCloseTo(9, 2);
    expect(invoice.total.toNumber()).toBeCloseTo(99, 2);
  });

  it('catch-up billing works for 3 missed months and concurrency still creates one invoice per period', async () => {
    const tax = await prisma.tax.create({
      data: { name: 'VAT', ratePercent: 10, isActive: true }
    });
    const product = await prisma.product.create({
      data: { name: 'Workspace', type: 'SERVICE', salesPrice: 100, costPrice: 50, taxId: tax.id }
    });
    const customer = await prisma.customer.create({ data: { name: 'C', email: 'c@example.com' } });
    const plan = await prisma.plan.create({
      data: {
        name: 'Pro',
        price: 100,
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
        number: 'SUB-003',
        customerId: customer.id,
        planId: plan.id,
        status: 'ACTIVE',
        startDate: new Date('2026-01-01T00:00:00Z'),
        nextBillingDate: new Date('2026-01-01T00:00:00Z'),
        paymentTerms: 10,
        expiryDate: new Date('2027-01-01T00:00:00Z')
      }
    });

    await prisma.subscriptionLine.create({
      data: {
        subscriptionId: subscription.id,
        productId: product.id,
        quantity: 1,
        unitPrice: 100,
        taxRate: 10,
        taxAmount: 10,
        discountAmount: 0,
        amount: 100
      }
    });

    const result = await runBillingRun(new Date('2026-04-01T00:00:00Z'));
    expect(result.created).toBeGreaterThanOrEqual(3);
    const invoiceCount = await prisma.invoice.count({ where: { subscriptionId: subscription.id } });
    expect(invoiceCount).toBeGreaterThanOrEqual(3);
  });
});
