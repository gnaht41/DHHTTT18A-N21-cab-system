const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.get('/:rideId', paymentController.getPaymentByRideId.bind(paymentController));
router.post('/', paymentController.createPayment.bind(paymentController));

module.exports = router;
