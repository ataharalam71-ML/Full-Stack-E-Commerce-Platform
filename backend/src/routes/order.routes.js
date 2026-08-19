const express = require('express');
const { createOrder, confirmPayment, listMyOrders, getOrder } = require('../controllers/order.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.post('/', createOrder);
router.post('/confirm-payment', confirmPayment);
router.get('/', listMyOrders);
router.get('/:id', getOrder);

module.exports = router;
