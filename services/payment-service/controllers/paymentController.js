const paymentService = require('../services/paymentService');

class PaymentController {
  async createPayment(req, res) {
    try {
      const { rideId, amount, driverId, payment_method, bookingId, sagaId } = req.body;
      const userId = req.headers['x-user-id'] ? Number(req.headers['x-user-id']) : null;
      console.log('[PaymentController] Creating payment:', { rideId, amount, driverId, userId, payment_method, bookingId, sagaId, amountType: typeof amount });

      // Validate required fields
      if (!rideId || !amount) {
        return res.status(400).json({ error: 'Missing required fields: rideId and amount' });
      }

      const allowedMethods = ['card', 'cash', 'wallet', 'paypal'];
      if (payment_method !== undefined && !allowedMethods.includes(payment_method)) {
        return res.status(400).json({ error: 'Invalid payment method' });
      }

      const payment = await paymentService.processPayment(rideId, amount, driverId, userId, bookingId, sagaId);
      res.status(201).json({ data: payment });
    } catch (error) {
      console.error('[PaymentController] Error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getPaymentByRideId(req, res) {
    try {
      const payment = await paymentService.getPaymentByRideId(req.params.rideId);
      if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
      }
      res.json(payment);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new PaymentController();
