const express = require('express');
const subscriptionController = require('../controllers/subscriptionController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/stats', authorize('ADMIN', 'STAFF'), subscriptionController.stats);
router.get('/', authorize('ADMIN', 'STAFF', 'CUSTOMER'), subscriptionController.listSubscriptions);
router.post('/', authorize('ADMIN', 'STAFF'), subscriptionController.createSubscription);
router.get('/:id', authorize('ADMIN', 'STAFF', 'CUSTOMER'), subscriptionController.getSubscription);
router.post('/:id/transition', authorize('ADMIN', 'STAFF'), subscriptionController.transitionStatus);

module.exports = router;
