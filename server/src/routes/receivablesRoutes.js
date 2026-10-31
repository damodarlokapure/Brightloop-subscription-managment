const express = require('express');
const receivablesController = require('../controllers/receivablesController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/summary', authorize('ADMIN', 'STAFF'), receivablesController.summary);

module.exports = router;
