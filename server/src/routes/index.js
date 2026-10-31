const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const productRoutes = require('./productRoutes');
const planRoutes = require('./planRoutes');
const taxRoutes = require('./taxRoutes');
const discountRoutes = require('./discountRoutes');
const quotationRoutes = require('./quotationRoutes');
const subscriptionRoutes = require('./subscriptionRoutes');
const billingRoutes = require('./billingRoutes');
const invoiceRoutes = require('./invoiceRoutes');
const paymentRoutes = require('./paymentRoutes');
const receivablesRoutes = require('./receivablesRoutes');
const adminRoutes = require('./adminRoutes');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/health', asyncHandler(async (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString()
  });
}));

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/plans', planRoutes);
router.use('/taxes', taxRoutes);
router.use('/discounts', discountRoutes);
router.use('/quotation-templates', quotationRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/billing', billingRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/payments', paymentRoutes);
router.use('/receivables', receivablesRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
