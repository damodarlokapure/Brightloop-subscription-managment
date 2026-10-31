const express = require('express');
const paymentController = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/', authorize('ADMIN', 'STAFF', 'CUSTOMER'), paymentController.listPayments);
router.post('/', authorize('ADMIN', 'STAFF'), paymentController.createPayment);
router.get('/:id', authorize('ADMIN', 'STAFF', 'CUSTOMER'), paymentController.getPayment);
router.delete('/:id', authorize('ADMIN'), paymentController.voidPayment);

module.exports = router;
