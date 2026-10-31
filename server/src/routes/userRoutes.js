const express = require('express');
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.post('/staff', authorize('ADMIN'), userController.createStaff);
router.get('/staff', authorize('ADMIN'), userController.listStaff);
router.patch('/staff/:id', authorize('ADMIN'), userController.updateStaff);

module.exports = router;
