const { z } = require('zod');
const { asyncHandler } = require('../utils/asyncHandler');
const paymentService = require('../services/paymentService');

const paymentSchema = z.object({
  invoiceId: z.string().uuid('Invoice ID must be a valid UUID.'),
  method: z.string().transform((value) => value.toUpperCase()),
  amount: z.coerce.number().gt(0, 'Payment amount must be greater than 0.'),
  paymentDate: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional().nullable()
}).refine((data) => ['CASH', 'CARD', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'ONLINE'].includes(data.method), {
  message: 'Payment method is invalid.',
  path: ['method']
});

const listPaymentsSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  method: z.string().optional(),
  invoiceId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  sort: z.enum(['paymentDate', 'amount', 'createdAt']).optional(),
  order: z.enum(['asc', 'desc']).optional()
});

async function createPayment(req, res) {
  const validated = paymentSchema.parse(req.body);
  const payment = await paymentService.createPayment({
    ...validated,
    recordedById: req.user?.id || null
  });
  res.status(201).json(payment);
}

async function listPayments(req, res) {
  const validated = listPaymentsSchema.parse(req.query);
  const result = await paymentService.listPayments({
    ...validated,
    customerId: validated.customerId || (req.user?.role === 'CUSTOMER' ? req.user.customerId : undefined)
  });
  res.json(result);
}

async function getPayment(req, res) {
  const payment = await paymentService.getPaymentById(req.params.id, req.user?.role === 'CUSTOMER' ? req.user.customerId : null);
  res.json(payment);
}

async function voidPayment(req, res) {
  const result = await paymentService.voidPayment(req.params.id, req.user?.id || null);
  res.json(result);
}

module.exports = {
  createPayment: asyncHandler(createPayment),
  listPayments: asyncHandler(listPayments),
  getPayment: asyncHandler(getPayment),
  voidPayment: asyncHandler(voidPayment)
};
