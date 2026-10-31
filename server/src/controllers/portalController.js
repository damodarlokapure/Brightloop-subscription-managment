const { z } = require('zod');
const { asyncHandler } = require('../utils/asyncHandler');
const subscriptionService = require('../services/subscriptionService');
const invoiceService = require('../services/invoiceService');
const paymentService = require('../services/paymentService');
const prisma = require('../config/prisma');
const bcrypt = require('bcrypt');
const { AppError } = require('../middleware/errorHandler');

const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  phone: z.string().trim().max(50).optional().nullable(),
  company: z.string().trim().max(100).optional().nullable(),
  addressLine1: z.string().trim().max(200).optional().nullable(),
  addressLine2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  postalCode: z.string().trim().max(30).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  taxId: z.string().trim().max(100).optional().nullable()
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(9)
});

async function dashboard(req, res) {
  const customerId = req.user.customerId;
  const [subscriptions, invoices, payments] = await Promise.all([
    prisma.subscription.count({ where: { customerId } }),
    prisma.invoice.count({ where: { customerId } }),
    prisma.payment.count({ where: { invoice: { customerId } } })
  ]);

  res.json({
    customerId,
    subscriptions,
    invoices,
    payments,
    summary: {
      activeSubscriptions: await prisma.subscription.count({ where: { customerId, status: 'ACTIVE' } }),
      outstandingInvoices: await prisma.invoice.count({ where: { customerId, status: 'CONFIRMED', dueDate: { lt: new Date() } } })
    }
  });
}

async function listSubscriptions(req, res) {
  const data = await subscriptionService.listSubscriptions({
    customerId: req.user.customerId,
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status
  });
  res.json(data);
}

async function getSubscription(req, res) {
  const data = await subscriptionService.getSubscriptionById(req.params.id, req.user.customerId);
  res.json(data);
}

async function listInvoices(req, res) {
  const data = await invoiceService.listInvoices({
    customerId: req.user.customerId,
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
    overdue: req.query.overdue,
    sort: req.query.sort,
    order: req.query.order
  });
  res.json(data);
}

async function getInvoice(req, res) {
  const data = await invoiceService.getInvoiceById(req.params.id, req.user.customerId);
  res.json(data);
}

async function listPayments(req, res) {
  const data = await paymentService.listPayments({
    customerId: req.user.customerId,
    page: req.query.page,
    limit: req.query.limit,
    method: req.query.method,
    invoiceId: req.query.invoiceId,
    fromDate: req.query.fromDate,
    toDate: req.query.toDate,
    sort: req.query.sort,
    order: req.query.order
  });
  res.json(data);
}

async function getPayment(req, res) {
  const data = await paymentService.getPaymentById(req.params.id, req.user.customerId);
  res.json(data);
}

async function updateProfile(req, res) {
  const validated = profileUpdateSchema.parse(req.body);
  const customer = await prisma.customer.update({
    where: { id: req.user.customerId },
    data: validated
  });
  res.json(customer);
}

async function changePassword(req, res) {
  const validated = passwordChangeSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const matches = await bcrypt.compare(validated.currentPassword, user.passwordHash);
  if (!matches) {
    throw new AppError(401, 'INVALID_PASSWORD', 'Current password is incorrect.');
  }
  const passwordHash = await bcrypt.hash(validated.newPassword, 10);
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
  res.json({ success: true });
}

module.exports = {
  dashboard: asyncHandler(dashboard),
  listSubscriptions: asyncHandler(listSubscriptions),
  getSubscription: asyncHandler(getSubscription),
  listInvoices: asyncHandler(listInvoices),
  getInvoice: asyncHandler(getInvoice),
  listPayments: asyncHandler(listPayments),
  getPayment: asyncHandler(getPayment),
  updateProfile: asyncHandler(updateProfile),
  changePassword: asyncHandler(changePassword)
};
