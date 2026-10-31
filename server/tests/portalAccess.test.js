const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');
const bcrypt = require('bcrypt');

describe('Customer portal access control', () => {
  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.invoiceDiscount.deleteMany();
    await prisma.invoiceLine.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.subscriptionStatusHistory.deleteMany();
    await prisma.subscriptionLine.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.user.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.plan.deleteMany();
  });

  it('prevents customer A from reading customer B subscription, invoice, and payment', async () => {
    const plan = await prisma.plan.create({
      data: {
        name: 'Starter',
        price: 50,
        billingPeriod: 'MONTHLY',
        minQuantity: 1,
        state: 'ACTIVE',
        startDate: new Date('2025-01-01T00:00:00Z'),
        endDate: new Date('2027-01-01T00:00:00Z')
      }
    });

    const customerA = await prisma.customer.create({
      data: { name: 'Alice A', email: 'alice@example.com' }
    });
    const customerB = await prisma.customer.create({
      data: { name: 'Bob B', email: 'bob@example.com' }
    });

    const passwordHashA = await bcrypt.hash('StrongPass!123', 10);
    const passwordHashB = await bcrypt.hash('StrongPass!123', 10);

    const userA = await prisma.user.create({
      data: {
        name: 'Alice A',
        email: 'alice@example.com',
        passwordHash: passwordHashA,
        role: 'CUSTOMER',
        customerId: customerA.id,
        isActive: true
      }
    });
    const userB = await prisma.user.create({
      data: {
        name: 'Bob B',
        email: 'bob@example.com',
        passwordHash: passwordHashB,
        role: 'CUSTOMER',
        customerId: customerB.id,
        isActive: true
      }
    });

    const subscriptionB = await prisma.subscription.create({
      data: {
        number: 'SUB-B-001',
        customerId: customerB.id,
        planId: plan.id,
        status: 'ACTIVE',
        startDate: new Date('2025-02-01T00:00:00Z'),
        nextBillingDate: new Date('2025-03-01T00:00:00Z')
      }
    });

    const invoiceB = await prisma.invoice.create({
      data: {
        number: 'INV-B-001',
        customerId: customerB.id,
        status: 'CONFIRMED',
        periodStart: new Date('2025-02-01T00:00:00Z'),
        periodEnd: new Date('2025-02-28T00:00:00Z'),
        issueDate: new Date('2025-02-01T00:00:00Z'),
        dueDate: new Date('2025-02-10T00:00:00Z'),
        subtotal: 50,
        discountTotal: 0,
        taxTotal: 0,
        total: 50,
        amountPaid: 0,
        subscriptionId: subscriptionB.id
      }
    });

    const paymentB = await prisma.payment.create({
      data: {
        invoiceId: invoiceB.id,
        method: 'CARD',
        amount: 25,
        paymentDate: new Date('2025-02-05T00:00:00Z'),
        note: 'partial',
        recordedById: userA.id
      }
    });

    const loginA = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'StrongPass!123'
    });
    const tokenA = loginA.body.token;

    const loginB = await request(app).post('/api/auth/login').send({
      email: 'bob@example.com',
      password: 'StrongPass!123'
    });
    const tokenB = loginB.body.token;

    const subscriptionRes = await request(app)
      .get(`/api/portal/subscriptions/${subscriptionB.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(subscriptionRes.status).toBe(404);

    const invoiceRes = await request(app)
      .get(`/api/portal/invoices/${invoiceB.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(invoiceRes.status).toBe(403);

    const paymentRes = await request(app)
      .get(`/api/portal/payments/${paymentB.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(paymentRes.status).toBe(403);

    const ownList = await request(app)
      .get('/api/portal/subscriptions')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(ownList.status).toBe(200);
    expect(ownList.body.data).toEqual([]);

    const customerBProfile = await request(app)
      .get('/api/portal/subscriptions')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(customerBProfile.status).toBe(200);
    expect(customerBProfile.body.data.some((item) => item.id === subscriptionB.id)).toBe(true);
  });
});
