const express = require('express');
const taxController = require('../controllers/taxController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/', authorize('ADMIN', 'STAFF'), taxController.listTaxes);
router.post('/', authorize('ADMIN'), taxController.createTax);
router.get('/:id', authorize('ADMIN', 'STAFF'), taxController.getTax);
router.patch('/:id', authorize('ADMIN'), taxController.updateTax);
router.delete('/:id', authorize('ADMIN'), taxController.deleteTax);

module.exports = router;
