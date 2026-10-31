const { Prisma, PrismaClient, Role, BillingPeriod, ProductType, PlanState, SubscriptionStatus, InvoiceStatus, DiscountType, DiscountScope, PaymentMethod } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = require('../src/config/prisma');

const DEMO_PASSWORD = 'Demo@12345';

const money = (value) => new Prisma.Decimal(Number(value).toFixed(2));
const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};
const addMonths = (date, months) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

async function resetDemoData() {
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.payment.deleteMany();
    await tx.invoiceDiscount.deleteMany();
    await tx.invoiceLine.deleteMany();
    await tx.invoice.deleteMany();
    await tx.discountSubscription.deleteMany();
    await tx.subscriptionStatusHistory.deleteMany();
    await tx.subscriptionLine.deleteMany();
    await tx.subscription.deleteMany();
    await tx.discountProduct.deleteMany();
    await tx.quotationTemplateLine.deleteMany();
    await tx.quotationTemplate.deleteMany();
    await tx.discount.deleteMany();
    await tx.productVariant.deleteMany();
    await tx.product.deleteMany();
    await tx.plan.deleteMany();
    await tx.tax.deleteMany();
    await tx.user.deleteMany();
    await tx.customer.deleteMany();
    await tx.counter.deleteMany();
  });
}

async function seedTaxes() {
  return Promise.all([
    prisma.tax.create({ data: { name: 'GST 5%', ratePercent: money(5), isActive: true, appliesToProductType: null } }),
    prisma.tax.create({ data: { name: 'GST 12%', ratePercent: money(12), isActive: true, appliesToProductType: null } }),
    prisma.tax.create({ data: { name: 'GST 18%', ratePercent: money(18), isActive: true, appliesToProductType: null } }),
  ]);
}

async function seedPlans() {
  return Promise.all([
    prisma.plan.create({
      data: {
        name: 'Launch',
        price: money(49),
        billingPeriod: BillingPeriod.MONTHLY,
        minQuantity: 1,
        state: PlanState.ACTIVE,
        allowPause: true,
        allowRenew: true,
        autoCloseOnEnd: false,
        allowEarlyClose: true,
      },
    }),
    prisma.plan.create({
      data: {
        name: 'Growth',
        price: money(149),
        billingPeriod: BillingPeriod.MONTHLY,
        minQuantity: 1,
        state: PlanState.ACTIVE,
        allowPause: true,
        allowRenew: true,
        autoCloseOnEnd: false,
        allowEarlyClose: true,
      },
    }),
    prisma.plan.create({
      data: {
        name: 'Scale',
        price: money(699),
        billingPeriod: BillingPeriod.YEARLY,
        minQuantity: 1,
        state: PlanState.ACTIVE,
        allowPause: true,
        allowRenew: true,
        autoCloseOnEnd: true,
        allowEarlyClose: false,
      },
    }),
    prisma.plan.create({
      data: {
        name: 'Pulse',
        price: money(29),
        billingPeriod: BillingPeriod.WEEKLY,
        minQuantity: 1,
        state: PlanState.ACTIVE,
        allowPause: false,
        allowRenew: true,
        autoCloseOnEnd: false,
        allowEarlyClose: true,
      },
    }),
  ]);
}

async function seedProducts() {
  const rows = [
    ['Brightloop ERP', ProductType.SOFTWARE, 599, 320, 'Unified operations suite'],
    ['CRM', ProductType.SOFTWARE, 299, 170, 'Sales and pipeline CRM'],
    ['Inventory Flow', ProductType.SOFTWARE, 399, 210, 'Warehouse orchestration'],
    ['Payroll Hub', ProductType.SERVICE, 229, 120, 'Payroll automation'],
    ['Support Plus', ProductType.SERVICE, 149, 70, 'Premium support plan'],
    ['eCommerce Sync', ProductType.ADDON, 189, 95, 'Marketplace connector'],
    ['Onboarding Pack', ProductType.ADDON, 120, 50, 'Implementation onboarding'],
    ['Hardware Kit', ProductType.PHYSICAL, 85, 42, 'Starter hardware pack'],
  ];

  const created = [];
  for (const [name, type, salesPrice, costPrice, notes] of rows) {
    const product = await prisma.product.create({
      data: {
        name,
        type,
        salesPrice: money(salesPrice),
        costPrice: money(costPrice),
        notes,
        isActive: true,
      },
    });

    if (name === 'Brightloop ERP') {
      await prisma.productVariant.createMany({
        data: [
          { productId: product.id, attribute: 'Edition', value: 'Starter', extraPrice: money(0) },
          { productId: product.id, attribute: 'Edition', value: 'Growth', extraPrice: money(180) },
          { productId: product.id, attribute: 'Edition', value: 'Enterprise', extraPrice: money(420) },
        ],
      });
    }

    created.push(product);
  }

  return created;
}

async function seedTemplates(plans, products) {
  const starterTemplate = await prisma.quotationTemplate.create({
    data: {
      name: 'Launch Foundation',
      validityDays: 30,
      planId: plans[0].id,
      notes: 'Typical launch package for new customers',
    },
  });

  await prisma.quotationTemplateLine.createMany({
    data: [
      { templateId: starterTemplate.id, productId: products[0].id, quantity: 1 },
      { templateId: starterTemplate.id, productId: products[4].id, quantity: 1 },
    ],
  });

  const scaleTemplate = await prisma.quotationTemplate.create({
    data: {
      name: 'Scale Enterprise',
      validityDays: 45,
      planId: plans[2].id,
      notes: 'Growth and multi-entity deployment',
    },
  });

  await prisma.quotationTemplateLine.createMany({
    data: [
      { templateId: scaleTemplate.id, productId: products[0].id, quantity: 2 },
      { templateId: scaleTemplate.id, productId: products[2].id, quantity: 1 },
      { templateId: scaleTemplate.id, productId: products[5].id, quantity: 1 },
    ],
  });
}

async function seedUsersAndCustomers() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@brightloop.demo',
      passwordHash,
      name: 'Brightloop Admin',
      role: Role.ADMIN,
      isActive: true,
    },
  });

  const staffUsers = await Promise.all([
    prisma.user.create({ data: { email: 'staff1@brightloop.demo', passwordHash, name: 'Alicia Park', role: Role.STAFF, isActive: true } }),
    prisma.user.create({ data: { email: 'staff2@brightloop.demo', passwordHash, name: 'Noah James', role: Role.STAFF, isActive: true } }),
    prisma.user.create({ data: { email: 'staff3@brightloop.demo', passwordHash, name: 'Maya Patel', role: Role.STAFF, isActive: true } }),
  ]);

  const customers = [];
  for (let index = 1; index <= 25; index += 1) {
    const customer = await prisma.customer.create({
      data: {
        name: `Customer ${index}`,
        email: `customer${String(index).padStart(2, '0')}@brightloop.demo`,
        company: `Customer Co ${index}`,
        phone: `+1 415 555 ${String(1000 + index).slice(-4)}`,
        addressLine1: `${index} Market Street`,
        city: ['New York', 'London', 'Paris', 'Berlin', 'Toronto'][index % 5],
        country: ['USA', 'UK', 'France', 'Germany', 'Canada'][index % 5],
        taxId: `VAT-${String(index).padStart(3, '0')}`,
      },
    });

    const portalUser = await prisma.user.create({
      data: {
        email: customer.email,
        passwordHash,
        name: customer.name,
        role: Role.CUSTOMER,
        isActive: true,
        customerId: customer.id,
      },
    });

    customers.push({ ...customer, portalUser });
  }

  return { admin, staffUsers, customers };
}

async function seedDiscounts(subscriptions, products) {
  const productMatch = products.find((product) => product.name === 'Brightloop ERP');

  const discountData = [
    {
      name: 'Expired launch promo',
      type: DiscountType.PERCENTAGE,
      value: 15,
      scope: DiscountScope.PRODUCT,
      startDate: addDays(new Date(), -120),
      endDate: addDays(new Date(), -10),
      usageLimit: null,
      usageCount: 0,
      isActive: false,
      products: productMatch ? [productMatch.id] : [],
    },
    {
      name: 'Exhausted team bundle',
      type: DiscountType.PERCENTAGE,
      value: 10,
      scope: DiscountScope.SUBSCRIPTION,
      startDate: addDays(new Date(), -45),
      endDate: addDays(new Date(), 120),
      usageLimit: 2,
      usageCount: 2,
      isActive: true,
      products: [],
    },
    {
      name: 'ERP percentage offer',
      type: DiscountType.PERCENTAGE,
      value: 12,
      scope: DiscountScope.PRODUCT,
      startDate: addDays(new Date(), -30),
      endDate: addDays(new Date(), 180),
      usageLimit: 30,
      usageCount: 0,
      isActive: true,
      products: productMatch ? [productMatch.id] : [],
    },
    {
      name: 'Growth annual fixed credit',
      type: DiscountType.FIXED,
      value: 250,
      scope: DiscountScope.SUBSCRIPTION,
      startDate: addDays(new Date(), -90),
      endDate: addDays(new Date(), 180),
      usageLimit: 25,
      usageCount: 0,
      isActive: true,
      products: [],
    },
  ];

  const created = [];
  for (const data of discountData) {
    const discount = await prisma.discount.create({
      data: {
        name: data.name,
        type: data.type,
        value: money(data.value),
        scope: data.scope,
        minPurchaseAmount: data.scope === DiscountScope.SUBSCRIPTION ? money(100) : null,
        startDate: data.startDate,
        endDate: data.endDate,
        usageLimit: data.usageLimit,
        usageCount: data.usageCount,
        isActive: data.isActive,
      },
    });

    if (data.products.length) {
      await prisma.discountProduct.createMany({
        data: data.products.map((productId) => ({ discountId: discount.id, productId })),
      });
    }

    if (data.scope === DiscountScope.SUBSCRIPTION) {
      await prisma.discountSubscription.createMany({
        data: subscriptions.slice(0, 10).map((subscription) => ({ discountId: discount.id, subscriptionId: subscription.id })),
        skipDuplicates: true,
      });
    }

    created.push(discount);
  }

  return created;
}

async function seedSubscriptions(customers, plans, products) {
  const statusFlow = [
    { status: SubscriptionStatus.DRAFT, count: 10 },
    { status: SubscriptionStatus.QUOTATION, count: 15 },
    { status: SubscriptionStatus.CONFIRMED, count: 20 },
    { status: SubscriptionStatus.ACTIVE, count: 60 },
    { status: SubscriptionStatus.CLOSED, count: 15 },
  ];

  const orderedStatuses = [];
  for (const item of statusFlow) {
    for (let index = 0; index < item.count; index += 1) {
      orderedStatuses.push(item.status);
    }
  }

  const created = [];
  for (let index = 0; index < 120; index += 1) {
    const customer = customers[index % customers.length];
    const plan = plans[index % plans.length];
    const status = orderedStatuses[index];
    const startDate = addDays(new Date(), -(index % 180) - 21);
    const nextBillingDate = addDays(new Date(), 2 + (index % 18));
    const expiryDate = addMonths(startDate, 6 + (index % 5));

    const subscription = await prisma.subscription.create({
      data: {
        number: `SUB-${String(index + 1000).padStart(5, '0')}`,
        customerId: customer.id,
        planId: plan.id,
        status,
        startDate,
        expiryDate,
        nextBillingDate,
        paymentTerms: [7, 14, 21, 30][index % 4],
        quotationValidUntil: addDays(startDate, 20),
      },
    });

    const lineCount = 1 + (index % 3);
    for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
      const product = products[(index + lineIndex) % products.length];
      const quantity = 1 + ((index + lineIndex) % 3);
      const unitPrice = Number(product.salesPrice) + ((index + lineIndex) % 5) * 15;
      const taxRate = 5 + ((index + lineIndex) % 3) * 6;
      const taxAmount = (unitPrice * quantity * taxRate) / 100;
      const amount = unitPrice * quantity + taxAmount;

      await prisma.subscriptionLine.create({
        data: {
          subscriptionId: subscription.id,
          productId: product.id,
          quantity,
          unitPrice: money(unitPrice),
          taxRate: money(taxRate),
          taxAmount: money(taxAmount),
          amount: money(amount),
        },
      });
    }

    await prisma.subscriptionStatusHistory.create({
      data: {
        subscriptionId: subscription.id,
        fromStatus: null,
        toStatus: status,
        reason: 'Seeded demo state',
      },
    });

    created.push(subscription);
  }

  return created;
}

async function seedInvoices(subscriptions) {
  const invoicesToCreate = [];

  for (let index = 0; index < 300; index += 1) {
    const subscription = subscriptions[index % subscriptions.length];
    const lines = await prisma.subscriptionLine.findMany({ where: { subscriptionId: subscription.id } });
    const subtotalBase = lines.reduce((sum, line) => sum + Number(line.amount), 0);
    const taxBase = subtotalBase * 0.12;
    const total = subtotalBase + taxBase;
    const issueDate = addDays(new Date(), -(index % 150) - 2);
    const periodStart = addMonths(issueDate, -1);
    const periodEnd = issueDate;
    const status = index % 5 === 0 ? InvoiceStatus.DRAFT : index % 5 === 1 || index % 5 === 2 ? InvoiceStatus.CONFIRMED : InvoiceStatus.PAID;
    const dueDate = addDays(issueDate, 10 + (index % 20));

    const invoice = await prisma.invoice.create({
      data: {
        number: `INV-${String(index + 1000).padStart(5, '0')}`,
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        status,
        periodStart,
        periodEnd,
        issueDate,
        dueDate,
        subtotal: money(subtotalBase),
        discountTotal: money(0),
        taxTotal: money(taxBase),
        total: money(total),
        amountPaid: status === InvoiceStatus.PAID ? money(total) : money(0),
      },
    });

    for (const line of lines) {
      await prisma.invoiceLine.create({
        data: {
          invoiceId: invoice.id,
          productId: line.productId,
          description: line.productId ? 'Subscription product' : 'Subscription service',
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxRate: line.taxRate,
          taxAmount: line.taxAmount,
          discountAmount: money(0),
          amount: line.amount,
        },
      });
    }

    if (status === InvoiceStatus.PAID) {
      await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          method: Object.values(PaymentMethod)[index % Object.values(PaymentMethod).length],
          amount: money(total),
          paymentDate: addDays(issueDate, 3),
          note: 'Auto-collected settlement',
        },
      });
    }

    invoicesToCreate.push(invoice);
  }

  for (let overdueIndex = 0; overdueIndex < 20; overdueIndex += 1) {
    const subscription = subscriptions[(overdueIndex * 7) % subscriptions.length];
    const overdueIssue = addDays(new Date(), -(overdueIndex + 45));
    const overdueDue = addDays(overdueIssue, -5);
    const overdueAmount = 210 + overdueIndex * 28;
    const invoice = await prisma.invoice.create({
      data: {
        number: `INV-${String(1000 + 300 + overdueIndex).padStart(5, '0')}`,
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        status: InvoiceStatus.CONFIRMED,
        periodStart: addDays(overdueIssue, -30),
        periodEnd: overdueIssue,
        issueDate: overdueIssue,
        dueDate: overdueDue,
        subtotal: money(overdueAmount),
        discountTotal: money(0),
        taxTotal: money(0),
        total: money(overdueAmount),
        amountPaid: money(0),
      },
    });

    const product = await prisma.product.findFirst();
    await prisma.invoiceLine.create({
      data: {
        invoiceId: invoice.id,
        productId: product?.id ?? null,
        description: product ? product.name : 'Overdue renewal',
        quantity: 1,
        unitPrice: money(overdueAmount),
        taxRate: money(0),
        taxAmount: money(0),
        discountAmount: money(0),
        amount: money(overdueAmount),
      },
    });

    invoicesToCreate.push(invoice);
  }

  return invoicesToCreate;
}

async function main() {
  await resetDemoData();

  const taxes = await seedTaxes();
  const plans = await seedPlans();
  const products = await seedProducts();
  const { admin, staffUsers, customers } = await seedUsersAndCustomers();
  await seedTemplates(plans, products);
  const subscriptions = await seedSubscriptions(customers, plans, products);
  const discounts = await seedDiscounts(subscriptions, products);
  const invoices = await seedInvoices(subscriptions);

  await prisma.counter.upsert({
    where: { key: 'demo_seed' },
    update: { value: 1 },
    create: { key: 'demo_seed', value: 1 },
  });

  console.log(JSON.stringify({
    admin: admin.email,
    staff: staffUsers.length,
    customers: customers.length,
    products: products.length,
    plans: plans.length,
    taxes: taxes.length,
    discounts: discounts.length,
    subscriptions: subscriptions.length,
    invoices: invoices.length,
    password: DEMO_PASSWORD,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
