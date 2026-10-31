const express = require('express');
const productController = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/', authorize('ADMIN', 'STAFF'), productController.listProducts);
router.post('/', authorize('ADMIN'), productController.createProduct);
router.get('/:id', authorize('ADMIN', 'STAFF'), productController.getProduct);
router.patch('/:id', authorize('ADMIN'), productController.updateProduct);
router.delete('/:id', authorize('ADMIN'), productController.deleteProduct);
router.post('/:id/variants', authorize('ADMIN'), productController.addVariant);
router.patch('/:id/variants', authorize('ADMIN'), productController.updateVariant);
router.delete('/:id/variants', authorize('ADMIN'), productController.deleteVariant);

module.exports = router;
