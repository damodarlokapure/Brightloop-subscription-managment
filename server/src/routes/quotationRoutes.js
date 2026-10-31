const express = require('express');
const quotationController = require('../controllers/quotationController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/', authorize('ADMIN', 'STAFF'), quotationController.listTemplates);
router.post('/', authorize('ADMIN', 'STAFF'), quotationController.createTemplate);
router.get('/:id', authorize('ADMIN', 'STAFF'), quotationController.getTemplate);
router.patch('/:id', authorize('ADMIN', 'STAFF'), quotationController.updateTemplate);
router.delete('/:id', authorize('ADMIN'), quotationController.deleteTemplate);

module.exports = router;
