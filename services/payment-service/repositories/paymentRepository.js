const Payment = require('../models/Payment');

class PaymentRepository {
  async create(data) {
    return await Payment.create(data);
  }

  async getByRideId(rideId) {
    return await Payment.findOne({ where: { rideId } });
  }

  async updateStatus(id, status) {
    const payment = await Payment.findByPk(id);
    if (payment) {
      payment.status = status;
      await payment.save();
    }
    return payment;
  }
}

module.exports = new PaymentRepository();
