const express = require('express');
const invoiceController = require('../controllers/invoiceController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/', authorize('ADMIN', 'STAFF', 'CUSTOMER'), invoiceController.listInvoices);
router.post('/bulk/confirm', authorize('ADMIN', 'STAFF'), invoiceController.bulkConfirm);
router.post('/bulk/send', authorize('ADMIN', 'STAFF'), invoiceController.bulkSend);
router.get('/:id/print', authorize('ADMIN', 'STAFF', 'CUSTOMER'), invoiceController.printInvoice);
router.post('/:id/confirm', authorize('ADMIN', 'STAFF'), invoiceController.confirmInvoice);
router.post('/:id/cancel', authorize('ADMIN', 'STAFF'), invoiceController.cancelInvoice);
router.post('/:id/send', authorize('ADMIN', 'STAFF'), invoiceController.sendInvoice);
router.post('/:id/remind', authorize('ADMIN', 'STAFF'), invoiceController.remindInvoice);
router.get('/:id', authorize('ADMIN', 'STAFF', 'CUSTOMER'), invoiceController.getInvoice);

module.exports = router;
