const { z } = require('zod');
const { asyncHandler } = require('../utils/asyncHandler');
const {
  listInvoices,
  getInvoiceById,
  confirmInvoice,
  cancelInvoice,
  sendInvoice,
  printInvoice,
  bulkConfirmInvoice,
  bulkSendInvoices
} = require('../services/invoiceService');
const { sendInvoiceReminder } = require('../services/overdue');

const listInvoicesSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'PAID', 'CANCELLED']).optional(),
  customerId: z.string().uuid().optional(),
  subscriptionId: z.string().uuid().optional(),
  overdue: z.coerce.boolean().optional(),
  dateRange: z.string().optional(),
  dueRange: z.string().optional(),
  search: z.string().trim().optional(),
  sort: z.enum(['createdAt', 'total', 'dueDate', 'status']).optional(),
  order: z.enum(['asc', 'desc']).optional()
});

const invoiceActionSchema = z.object({
  ids: z.array(z.string().uuid()).optional().default([])
});

async function listInvoicesController(req, res) {
  const validated = listInvoicesSchema.parse(req.query);
  const result = await listInvoices({
    ...validated,
    customerId: validated.customerId || (req.user?.role === 'CUSTOMER' ? req.user.customerId : undefined)
  });
  res.json(result);
}

async function getInvoice(req, res) {
  const invoice = await getInvoiceById(req.params.id, req.user?.role === 'CUSTOMER' ? req.user.customerId : undefined);
  res.json(invoice);
}

async function confirmInvoiceById(req, res) {
  const invoice = await confirmInvoice(req.params.id);
  res.json(invoice);
}

async function cancelInvoiceById(req, res) {
  const invoice = await cancelInvoice(req.params.id);
  res.json(invoice);
}

async function sendInvoiceById(req, res) {
  const invoice = await sendInvoice(req.params.id);
  res.json(invoice);
}

async function printInvoiceById(req, res) {
  const html = await printInvoice(req.params.id, req.user?.role === 'CUSTOMER' ? req.user.customerId : undefined);
  res.type('html').send(html);
}

async function bulkConfirm(req, res) {
  const body = invoiceActionSchema.parse(req.body || {});
  const result = await bulkConfirmInvoice(body.ids);
  res.json({ data: result });
}

async function bulkSend(req, res) {
  const body = invoiceActionSchema.parse(req.body || {});
  const result = await bulkSendInvoices(body.ids);
  res.json({ data: result });
}

async function remindInvoice(req, res) {
  const payload = await sendInvoiceReminder(req.params.id, req.user?.id || null);
  res.json(payload);
}

module.exports = {
  listInvoices: asyncHandler(listInvoicesController),
  getInvoice: asyncHandler(getInvoice),
  confirmInvoice: asyncHandler(confirmInvoiceById),
  cancelInvoice: asyncHandler(cancelInvoiceById),
  sendInvoice: asyncHandler(sendInvoiceById),
  printInvoice: asyncHandler(printInvoiceById),
  bulkConfirm: asyncHandler(bulkConfirm),
  bulkSend: asyncHandler(bulkSend),
  remindInvoice: asyncHandler(remindInvoice)
};
