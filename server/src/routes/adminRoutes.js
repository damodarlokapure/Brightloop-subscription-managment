const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const planController = require('../controllers/planController');

const router = express.Router();

router.use(authenticate);
router.post('/jobs/close-expired-plans', authorize('ADMIN'), planController.runJob);

module.exports = router;
