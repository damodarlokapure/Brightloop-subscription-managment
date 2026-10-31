export const productCatalog = [
  { id: 'prod-1', name: 'Operations Suite', type: 'SOFTWARE', unitPrice: 149.0, taxRate: 10 },
  { id: 'prod-2', name: 'Premium Support', type: 'SERVICE', unitPrice: 89.0, taxRate: 8 },
  { id: 'prod-3', name: 'Custom Integration', type: 'ADDON', unitPrice: 299.0, taxRate: 10 },
  { id: 'prod-4', name: 'Hardware Kit', type: 'PHYSICAL', unitPrice: 119.0, taxRate: 7 },
];

export const planCatalog = [
  { id: 'plan-1', name: 'Starter', billingPeriod: 'MONTHLY', price: 49 },
  { id: 'plan-2', name: 'Growth', billingPeriod: 'MONTHLY', price: 99 },
  { id: 'plan-3', name: 'Scale', billingPeriod: 'YEARLY', price: 720 },
];

export const customerRecords = [
  { id: 'cust-1', name: 'Ava Patel', email: 'ava@lumalabs.co', company: 'Luma Labs', phone: '+1 415 555 0101', city: 'San Francisco', country: 'USA' },
  { id: 'cust-2', name: 'Marcus Chen', email: 'marcus@northstar.ai', company: 'Northstar AI', phone: '+1 212 555 0143', city: 'New York', country: 'USA' },
  { id: 'cust-3', name: 'Priya Singh', email: 'priya@solstice.io', company: 'Solstice', phone: '+44 20 7946 0123', city: 'London', country: 'UK' },
];

export const templates = [
  { id: 'tpl-1', name: 'Starter onboarding', planId: 'plan-1', validityDays: 30, notes: 'Includes onboarding and support', lines: [
    { productId: 'prod-1', quantity: 1, unitPrice: 149, taxRate: 10 },
    { productId: 'prod-2', quantity: 1, unitPrice: 89, taxRate: 8 },
  ] },
  { id: 'tpl-2', name: 'Growth expansion', planId: 'plan-2', validityDays: 45, notes: 'Recommended for scaling teams', lines: [
    { productId: 'prod-1', quantity: 2, unitPrice: 149, taxRate: 10 },
    { productId: 'prod-3', quantity: 1, unitPrice: 299, taxRate: 10 },
  ] },
];

export const subscriptionRecords = [
  {
    id: 'sub-1',
    number: 'SUB-1001',
    customerId: 'cust-1',
    planId: 'plan-1',
    status: 'ACTIVE',
    startDate: '2026-09-01',
    expiryDate: '2027-09-01',
    quotationValidUntil: '2026-10-31',
    paymentTerms: 14,
    customer: customerRecords[0],
    plan: planCatalog[0],
    lines: [
      { productId: 'prod-1', productName: 'Operations Suite', quantity: 1, unitPrice: 149, taxRate: 10, taxAmount: 14.9, amount: 163.9 },
      { productId: 'prod-2', productName: 'Premium Support', quantity: 1, unitPrice: 89, taxRate: 8, taxAmount: 7.12, amount: 96.12 },
    ],
    auditHistory: [
      { id: 'audit-1', at: '2026-08-12T11:00:00Z', action: 'Created', actor: 'Lena Adams', details: 'Subscription created in draft.' },
      { id: 'audit-2', at: '2026-08-15T12:00:00Z', action: 'Status change', actor: 'Marcus Lee', details: 'Moved from DRAFT to QUOTATION.' },
      { id: 'audit-3', at: '2026-09-01T09:00:00Z', action: 'Activated', actor: 'Lena Adams', details: 'Customer account activated.' },
    ],
  },
  {
    id: 'sub-2',
    number: 'SUB-1002',
    customerId: 'cust-2',
    planId: 'plan-2',
    status: 'QUOTATION',
    startDate: '2026-10-15',
    expiryDate: '2027-10-15',
    quotationValidUntil: '2026-11-10',
    paymentTerms: 30,
    customer: customerRecords[1],
    plan: planCatalog[1],
    lines: [
      { productId: 'prod-3', productName: 'Custom Integration', quantity: 1, unitPrice: 299, taxRate: 10, taxAmount: 29.9, amount: 328.9 },
    ],
    auditHistory: [
      { id: 'audit-4', at: '2026-10-10T16:00:00Z', action: 'Status change', actor: 'Marcus Lee', details: 'Moved from DRAFT to QUOTATION.' },
    ],
  },
  {
    id: 'sub-3',
    number: 'SUB-1003',
    customerId: 'cust-3',
    planId: 'plan-3',
    status: 'CONFIRMED',
    startDate: '2026-11-01',
    expiryDate: '2027-11-01',
    quotationValidUntil: '2026-11-20',
    paymentTerms: 21,
    customer: customerRecords[2],
    plan: planCatalog[2],
    lines: [
      { productId: 'prod-1', productName: 'Operations Suite', quantity: 3, unitPrice: 149, taxRate: 10, taxAmount: 44.7, amount: 491.7 },
    ],
    auditHistory: [
      { id: 'audit-5', at: '2026-10-18T09:30:00Z', action: 'Confirmed', actor: 'Lena Adams', details: 'Proposal confirmed and awaiting activation.' },
    ],
  },
  {
    id: 'sub-4',
    number: 'SUB-1004',
    customerId: 'cust-1',
    planId: 'plan-2',
    status: 'CLOSED',
    startDate: '2025-01-01',
    expiryDate: '2026-01-01',
    quotationValidUntil: '2025-01-15',
    paymentTerms: 0,
    customer: customerRecords[0],
    plan: planCatalog[1],
    lines: [
      { productId: 'prod-4', productName: 'Hardware Kit', quantity: 1, unitPrice: 119, taxRate: 7, taxAmount: 8.33, amount: 127.33 },
    ],
    auditHistory: [
      { id: 'audit-6', at: '2025-01-03T10:00:00Z', action: 'Closed', actor: 'Lena Adams', details: 'Subscription closed by policy.' },
    ],
  },
];

export const invoiceRecords = [
  {
    id: 'inv-1',
    number: 'INV-1001',
    customerId: 'cust-1',
    customer: customerRecords[0],
    subscriptionId: 'sub-1',
    status: 'PAID',
    issueDate: '2026-09-01',
    dueDate: '2026-09-15',
    total: 260.02,
    paid: 260.02,
    outstanding: 0,
    tax: 22.02,
    subtotal: 238,
    lines: [
      { description: 'Operations Suite', quantity: 1, unitPrice: 149, taxRate: 10, taxAmount: 14.9, amount: 163.9 },
      { description: 'Premium Support', quantity: 1, unitPrice: 89, taxRate: 8, taxAmount: 7.12, amount: 96.12 },
    ],
    payments: [
      { id: 'pay-1', method: 'CARD', amount: 260.02, paymentDate: '2026-09-12' },
    ],
  },
  {
    id: 'inv-2',
    number: 'INV-1002',
    customerId: 'cust-2',
    customer: customerRecords[1],
    subscriptionId: 'sub-2',
    status: 'CONFIRMED',
    issueDate: '2026-10-15',
    dueDate: '2026-10-30',
    total: 328.9,
    paid: 0,
    outstanding: 328.9,
    tax: 29.9,
    subtotal: 299,
    lines: [
      { description: 'Custom Integration', quantity: 1, unitPrice: 299, taxRate: 10, taxAmount: 29.9, amount: 328.9 },
    ],
    payments: [],
  },
  {
    id: 'inv-3',
    number: 'INV-1003',
    customerId: 'cust-3',
    customer: customerRecords[2],
    subscriptionId: 'sub-3',
    status: 'CONFIRMED',
    issueDate: '2026-11-01',
    dueDate: '2026-11-10',
    total: 491.7,
    paid: 200,
    outstanding: 291.7,
    tax: 44.7,
    subtotal: 447,
    lines: [
      { description: 'Operations Suite', quantity: 3, unitPrice: 149, taxRate: 10, taxAmount: 44.7, amount: 491.7 },
    ],
    payments: [
      { id: 'pay-2', method: 'BANK_TRANSFER', amount: 200, paymentDate: '2026-11-04' },
    ],
  },
  {
    id: 'inv-4',
    number: 'INV-1004',
    customerId: 'cust-1',
    customer: customerRecords[0],
    subscriptionId: 'sub-4',
    status: 'CANCELLED',
    issueDate: '2025-01-04',
    dueDate: '2025-01-15',
    total: 127.33,
    paid: 0,
    outstanding: 127.33,
    tax: 8.33,
    subtotal: 119,
    lines: [
      { description: 'Hardware Kit', quantity: 1, unitPrice: 119, taxRate: 7, taxAmount: 8.33, amount: 127.33 },
    ],
    payments: [],
  },
];

export const paymentRecords = [
  { id: 'pay-1', invoiceId: 'inv-1', invoice: invoiceRecords[0], method: 'CARD', amount: 260.02, paymentDate: '2026-09-12', note: 'Auto-settled' },
  { id: 'pay-2', invoiceId: 'inv-3', invoice: invoiceRecords[2], method: 'BANK_TRANSFER', amount: 200, paymentDate: '2026-11-04', note: 'Deposit' },
  { id: 'pay-3', invoiceId: 'inv-2', invoice: invoiceRecords[1], method: 'ONLINE', amount: 100, paymentDate: '2026-10-22', note: 'Partial payment' },
];

export const auditEvents = [
  { id: 'evt-1', action: 'Created subscription', entity: 'Subscription', entityId: 'sub-1', createdAt: '2026-08-12T11:00:00Z', user: 'Lena Adams' },
  { id: 'evt-2', action: 'Status updated', entity: 'Subscription', entityId: 'sub-1', createdAt: '2026-08-15T12:00:00Z', user: 'Marcus Lee' },
  { id: 'evt-3', action: 'Invoice confirmed', entity: 'Invoice', entityId: 'inv-1', createdAt: '2026-09-02T01:00:00Z', user: 'Lena Adams' },
];

export const overviewStats = {
  draft: 1,
  quotation: 2,
  confirmed: 3,
  active: 1,
  closed: 1,
};
