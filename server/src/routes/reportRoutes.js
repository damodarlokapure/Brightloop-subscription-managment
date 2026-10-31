const express = require('express');
const reportController = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/summary', authorize('ADMIN', 'STAFF'), reportController.summary);
router.get('/revenue-trend', authorize('ADMIN', 'STAFF'), reportController.revenueTrend);
router.get('/subscriptions-by-status', authorize('ADMIN', 'STAFF'), reportController.byStatus);
router.get('/subscriptions-by-plan', authorize('ADMIN', 'STAFF'), reportController.byPlan);
router.get('/payments-by-method', authorize('ADMIN', 'STAFF'), reportController.byMethod);
router.get('/overdue-invoices', authorize('ADMIN', 'STAFF'), reportController.overdueInvoices);
router.get('/top-customers', authorize('ADMIN', 'STAFF'), reportController.topCustomers);
router.get('/export/:type', authorize('ADMIN', 'STAFF'), reportController.exportReport);

module.exports = router;
