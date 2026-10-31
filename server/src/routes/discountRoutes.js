const express = require('express');
const discountController = require('../controllers/discountController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/', authorize('ADMIN', 'STAFF'), discountController.listDiscounts);
router.post('/', authorize('ADMIN'), discountController.createDiscount);
router.patch('/:id', authorize('ADMIN'), discountController.updateDiscount);
router.delete('/:id', authorize('ADMIN'), discountController.deleteDiscount);

module.exports = router;
