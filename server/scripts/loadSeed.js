const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BATCH = 1000;

function randBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

async function createCustomerBatch(count) {
  const customers = Array.from({ length: count }, (_, index) => ({
    id: undefined,
    name: `Customer ${index + 1}`,
    email: `customer${index + 1}@brightloop.test`,
    company: index % 3 === 0 ? `Company ${index + 1}` : null,
    phone: `+1${String(index + 1000000000).slice(0, 10)}`
  }));

  const result = await prisma.customer.createMany({
    data: customers,
    skipDuplicates: true
  });

  return result.count;
}

async function createPlanIfMissing() {
  const plan = await prisma.plan.findFirst({
    where: { name: 'Seed Enterprise Plan' }
  });

  if (plan) return plan;

  return prisma.plan.create({
    data: {
      name: 'Seed Enterprise Plan',
      price: 99,
      billingPeriod: 'MONTHLY',
      minQuantity: 1,
      state: 'ACTIVE',
      startDate: new Date('2025-01-01T00:00:00Z')
    }
  });
}

async function createSubscriptions() {
  const customers = await prisma.customer.findMany({
    select: { id: true },
    take: 10000
  });

  const plan = await createPlanIfMissing();

  const rows = [];
  for (let i = 0; i < 10000; i++) {
    const customer = customers[i % customers.length];
    rows.push({
      number: `SUB-${String(i + 1).padStart(6, '0')}`,
      customerId: customer.id,
      planId: plan.id,
      status: ['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED'][i % 5],
      startDate: new Date(Date.now() - i * 86400000),
      nextBillingDate: new Date(Date.now() + (i % 30) * 86400000),
      paymentTerms: i % 3
    });
  }

  for (let i = 0; i < rows.length; i += BATCH) {
    await prisma.subscription.createMany({
      data: rows.slice(i, i + BATCH),
      skipDuplicates: true
    });
  }

  return rows.length;
}

async function createInvoices() {
  const subscriptions = await prisma.subscription.findMany({ select: { id: true, customerId: true }, take: 10000 });
  const invoices = [];

  for (let i = 0; i < 50000; i++) {
    const subscription = subscriptions[i % subscriptions.length];
    const total = Number((randBetween(25, 500)).toFixed(2));
    const amountPaid = Number((randBetween(0, total)).toFixed(2));
    const status = i % 5 === 0 ? 'PAID' : i % 5 === 1 ? 'CONFIRMED' : 'DRAFT';
    const issueDate = new Date(Date.now() - (i % 365) * 86400000);
    invoices.push({
      number: `INV-${String(i + 1).padStart(7, '0')}`,
      subscriptionId: subscription.id,
      customerId: subscription.customerId,
      status,
      periodStart: issueDate,
      periodEnd: new Date(issueDate.getTime() + 30 * 86400000),
      issueDate,
      dueDate: new Date(issueDate.getTime() + 10 * 86400000),
      subtotal: total,
      discountTotal: 0,
      taxTotal: 0,
      total,
      amountPaid,
      sentAt: status === 'PAID' || status === 'CONFIRMED' ? issueDate : null,
      notes: 'seed data'
    });
  }

  for (let i = 0; i < invoices.length; i += BATCH) {
    await prisma.invoice.createMany({
      data: invoices.slice(i, i + BATCH),
      skipDuplicates: true
    });
  }

  return invoices.length;
}

async function createPayments() {
  const invoices = await prisma.invoice.findMany({
    select: { id: true, amountPaid: true, total: true },
    take: 50000
  });

  const data = [];
  let counter = 1;

  for (const invoice of invoices) {
    const outstanding = Number(Number(invoice.total) - Number(invoice.amountPaid));
    if (outstanding <= 0) continue;
    const paymentCount = Math.min(2, Math.max(1, Math.floor((outstanding / 50))));
    for (let j = 0; j < paymentCount; j++) {
      const amount = j === paymentCount - 1 ? Number(outstanding.toFixed(2)) : Number((randBetween(5, outstanding / Math.max(1, paymentCount - 1))).toFixed(2));
      data.push({
        id: undefined,
        invoiceId: invoice.id,
        method: ['CARD', 'CASH', 'BANK_TRANSFER', 'UPI'][counter % 4],
        amount,
        paymentDate: new Date(Date.now() - (counter % 180) * 86400000),
        note: `seed ${counter}`
      });
      counter += 1;
    }
    if (data.length >= 40000) break;
  }

  for (let i = 0; i < data.length; i += BATCH) {
    await prisma.payment.createMany({
      data: data.slice(i, i + BATCH),
      skipDuplicates: true
    });
  }

  return data.length;
}

async function main() {
  await createCustomerBatch(10000);
  const subCount = await createSubscriptions();
  const invoiceCount = await createInvoices();
  const paymentCount = await createPayments();

  console.log({ subCount, invoiceCount, paymentCount });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
