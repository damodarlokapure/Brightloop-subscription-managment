const express = require('express');
const portalController = require('../controllers/portalController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(authorize('CUSTOMER'));

router.get('/dashboard', portalController.dashboard);
router.get('/subscriptions', portalController.listSubscriptions);
router.get('/subscriptions/:id', portalController.getSubscription);
router.get('/invoices', portalController.listInvoices);
router.get('/invoices/:id', portalController.getInvoice);
router.get('/payments', portalController.listPayments);
router.get('/payments/:id', portalController.getPayment);
router.patch('/profile', portalController.updateProfile);
router.post('/change-password', portalController.changePassword);

module.exports = router;
