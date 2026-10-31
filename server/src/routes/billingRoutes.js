const express = require('express');
const billingController = require('../controllers/billingController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.post('/run', authorize('ADMIN'), billingController.runBilling);
router.post('/subscriptions/:id/generate-invoice', authorize('ADMIN', 'STAFF'), billingController.generateForSubscription);

module.exports = router;
