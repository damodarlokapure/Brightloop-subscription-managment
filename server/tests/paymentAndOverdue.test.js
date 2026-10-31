const prisma = require('../src/config/prisma');
const paymentService = require('../src/services/paymentService');
const { getInvoiceOverdueMeta, getReceivablesSummary } = require('../src/services/overdue');

describe('Payments and overdue logic', () => {
  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.invoiceDiscount.deleteMany();
    await prisma.invoiceLine.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.subscriptionStatusHistory.deleteMany();
    await prisma.subscriptionLine.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.plan.deleteMany();
  });

  it('supports partial payment then full payment', async () => {
    const customer = await prisma.customer.create({ data: { name: 'Jane', email: 'jane@example.com' } });
    const plan = await prisma.plan.create({
      data: {
        name: 'Pro',
        price: 100,
        billingPeriod: 'MONTHLY',
        minQuantity: 1,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2027-01-01T00:00:00Z'),
        state: 'ACTIVE'
      }
    });

    const invoice = await prisma.invoice.create({
      data: {
        number: 'INV-1001',
        customerId: customer.id,
        status: 'CONFIRMED',
        periodStart: new Date('2026-01-01T00:00:00Z'),
        periodEnd: new Date('2026-01-31T00:00:00Z'),
        issueDate: new Date('2026-01-01T00:00:00Z'),
        dueDate: new Date('2026-01-10T00:00:00Z'),
        subtotal: 100,
        discountTotal: 0,
        taxTotal: 0,
        total: 100,
        amountPaid: 0,
        subscriptionId: null
      }
    });

    const partial = await paymentService.createPayment({
      invoiceId: invoice.id,
      method: 'CARD',
      amount: 30,
      paymentDate: new Date('2026-01-05T00:00:00Z'),
      note: 'partial',
      recordedById: null
    });

    expect(partial.payment.amount).toBe(30);
    expect(partial.invoice.amountPaid).toBe(30);
    expect(partial.invoice.status).toBe('CONFIRMED');

    const full = await paymentService.createPayment({
      invoiceId: invoice.id,
      method: 'BANK_TRANSFER',
      amount: 70,
      paymentDate: new Date('2026-01-06T00:00:00Z'),
      note: 'balance',
      recordedById: null
    });

    expect(full.payment.amount).toBe(70);
    expect(full.invoice.amountPaid).toBe(100);
    expect(full.invoice.status).toBe('PAID');
  });

  it('rejects overpayment and a DRAFT invoice payment', async () => {
    const customer = await prisma.customer.create({ data: { name: 'John', email: 'john@example.com' } });
    const invoice = await prisma.invoice.create({
      data: {
        number: 'INV-1002',
        customerId: customer.id,
        status: 'CONFIRMED',
        periodStart: new Date('2026-02-01T00:00:00Z'),
        periodEnd: new Date('2026-02-28T00:00:00Z'),
        issueDate: new Date('2026-02-01T00:00:00Z'),
        dueDate: new Date('2026-02-10T00:00:00Z'),
        subtotal: 50,
        discountTotal: 0,
        taxTotal: 0,
        total: 50,
        amountPaid: 20
      }
    });

    await expect(paymentService.createPayment({
      invoiceId: invoice.id,
      method: 'CARD',
      amount: 31,
      paymentDate: new Date(),
      note: 'x'
    })).rejects.toMatchObject({ code: 'PAYMENT_EXCEEDS_OUTSTANDING' });

    const draftInvoice = await prisma.invoice.create({
      data: {
        number: 'INV-1003',
        customerId: customer.id,
        status: 'DRAFT',
        periodStart: new Date('2026-03-01T00:00:00Z'),
        periodEnd: new Date('2026-03-31T00:00:00Z'),
        issueDate: new Date('2026-03-01T00:00:00Z'),
        dueDate: new Date('2026-03-10T00:00:00Z'),
        subtotal: 60,
        discountTotal: 0,
        taxTotal: 0,
        total: 60,
        amountPaid: 0
      }
    });

    await expect(paymentService.createPayment({
      invoiceId: draftInvoice.id,
      method: 'CARD',
      amount: 10,
      paymentDate: new Date(),
      note: 'x'
    })).rejects.toMatchObject({ code: 'INVALID_INVOICE_STATUS' });
  });

  it('rejects concurrent overpayments with serial transaction locking', async () => {
    const customer = await prisma.customer.create({ data: { name: 'Sam', email: 'sam@example.com' } });
    const invoice = await prisma.invoice.create({
      data: {
        number: 'INV-1004',
        customerId: customer.id,
        status: 'CONFIRMED',
        periodStart: new Date('2026-04-01T00:00:00Z'),
        periodEnd: new Date('2026-04-30T00:00:00Z'),
        issueDate: new Date('2026-04-01T00:00:00Z'),
        dueDate: new Date('2026-04-10T00:00:00Z'),
        subtotal: 100,
        discountTotal: 0,
        taxTotal: 0,
        total: 100,
        amountPaid: 0
      }
    });

    const p1 = paymentService.createPayment({
      invoiceId: invoice.id,
      method: 'CARD',
      amount: 70,
      paymentDate: new Date('2026-04-05T00:00:00Z'),
      note: 'p1'
    });

    const p2 = paymentService.createPayment({
      invoiceId: invoice.id,
      method: 'CASH',
      amount: 50,
      paymentDate: new Date('2026-04-06T00:00:00Z'),
      note: 'p2'
    });

    const results = await Promise.allSettled([p1, p2]);
    const rejected = results.filter((result) => result.status === 'rejected');
    const fulfilled = results.filter((result) => result.status === 'fulfilled');

    expect(rejected.length).toBe(1);
    expect(fulfilled.length).toBe(1);

    const invoiceAfter = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(Number(invoiceAfter.amountPaid)).toBeLessThanOrEqual(100);
  });

  it('calculates overdue boundaries correctly', async () => {
    const customer = await prisma.customer.create({ data: { name: 'Alicia', email: 'alicia@example.com' } });

    const dueToday = await prisma.invoice.create({
      data: {
        number: 'INV-2001',
        customerId: customer.id,
        status: 'CONFIRMED',
        periodStart: new Date('2026-05-01T00:00:00Z'),
        periodEnd: new Date('2026-05-31T00:00:00Z'),
        issueDate: new Date('2026-05-01T00:00:00Z'),
        dueDate: new Date('2026-05-20T00:00:00Z'),
        subtotal: 100,
        discountTotal: 0,
        taxTotal: 0,
        total: 100,
        amountPaid: 0
      }
    });

    const overdue = await prisma.invoice.create({
      data: {
        number: 'INV-2002',
        customerId: customer.id,
        status: 'CONFIRMED',
        periodStart: new Date('2026-06-01T00:00:00Z'),
        periodEnd: new Date('2026-06-30T00:00:00Z'),
        issueDate: new Date('2026-06-01T00:00:00Z'),
        dueDate: new Date('2026-05-01T00:00:00Z'),
        subtotal: 100,
        discountTotal: 0,
        taxTotal: 0,
        total: 100,
        amountPaid: 0
      }
    });

    const paidInvoice = await prisma.invoice.create({
      data: {
        number: 'INV-2003',
        customerId: customer.id,
        status: 'PAID',
        periodStart: new Date('2026-07-01T00:00:00Z'),
        periodEnd: new Date('2026-07-31T00:00:00Z'),
        issueDate: new Date('2026-07-01T00:00:00Z'),
        dueDate: new Date('2026-07-15T00:00:00Z'),
        subtotal: 100,
        discountTotal: 0,
        taxTotal: 0,
        total: 100,
        amountPaid: 100
      }
    });

    const dueTodayMeta = getInvoiceOverdueMeta(dueToday, new Date('2026-05-20T00:00:00Z'));
    const overdueMeta = getInvoiceOverdueMeta(overdue, new Date('2026-06-20T00:00:00Z'));
    const paidMeta = getInvoiceOverdueMeta(paidInvoice, new Date('2026-07-20T00:00:00Z'));

    expect(dueTodayMeta.isOverdue).toBe(false);
    expect(overdueMeta.isOverdue).toBe(true);
    expect(overdueMeta.daysOverdue).toBeGreaterThan(0);
    expect(paidMeta.isOverdue).toBe(false);

    const summary = await getReceivablesSummary(new Date('2026-06-20T00:00:00Z'));
    expect(summary.outstandingTotal).toBeGreaterThan(0);
    expect(summary.overdueTotal).toBeGreaterThan(0);
  });
});
