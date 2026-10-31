const express = require('express');
const planController = require('../controllers/planController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/', authorize('ADMIN', 'STAFF', 'CUSTOMER'), planController.listPlans);
router.post('/', authorize('ADMIN'), planController.createPlan);
router.get('/:id', authorize('ADMIN', 'STAFF', 'CUSTOMER'), planController.getPlan);
router.patch('/:id', authorize('ADMIN'), planController.updatePlan);
router.delete('/:id', authorize('ADMIN'), planController.deletePlan);
router.post('/:id/close', authorize('ADMIN'), planController.closePlan);
router.post('/:id/pause', authorize('ADMIN'), planController.pausePlan);
router.post('/:id/resume', authorize('ADMIN'), planController.resumePlan);
router.post('/:id/renew', authorize('ADMIN'), planController.renewPlan);

module.exports = router;
