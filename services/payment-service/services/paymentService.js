const paymentRepository = require('../repositories/paymentRepository');
const kafka = require('../config/kafka');
const { v4: uuidv4 } = require('uuid');

class PaymentService {
  async processPayment(rideId, amount, driverId = null, userId = null, bookingId = null, sagaId = null) {
    console.log(`[PaymentService] Processing payment for Ride ${rideId}: ${amount}`);

    try {
      // V6.2: Check for existing payment first (Idempotency)
      const existingPayment = await paymentRepository.getByRideId(rideId);
      if (existingPayment) {
        console.log(`[PaymentService] Payment already exists for Ride ${rideId}. Returning existing record.`);
        return existingPayment;
      }

      if (Number(amount) < 0) {
        console.error(`[PaymentService] Payment FAILED for Ride ${rideId}: Invalid amount`);
        // Emit PaymentFailed for Saga Compensation
        const errorEventId = uuidv4();
        kafka.producer.send({
          topic: 'PaymentFailed',
          messages: [{
            key: String(rideId),
            value: JSON.stringify({
              eventId: errorEventId,
              reason: 'Invalid amount',
              paymentId: null,
              rideId: rideId,
              bookingId: bookingId,
              sagaId: sagaId,
              amount: amount,
              driverId: driverId,
              userId: userId,
              status: 'FAILED',
              timestamp: new Date().toISOString()
            }),
            headers: { 'event-id': errorEventId }
          }]
        }).catch(err => {
          console.error('[Kafka] Delayed emission failed:', err.message);
        });
        
        throw new Error('Payment amount must be >= 0');
      }

      // Simulate payment logic
      let payment;
      try {
        payment = await paymentRepository.create({
          rideId,
          amount,
          driverId,
          userId,
          status: 'SUCCESS'
        });
      } catch (createError) {
        console.error(`[PaymentService] Failed to create payment for Ride ${rideId}:`, createError);
        throw createError;
      }

      console.log(`[PaymentService] Payment SUCCESS for Ride ${rideId}`);

      // V6.4: Fire and Forget Kafka emission to prevent API hang
      // We don't 'await' here so the API can respond immediately
      const successEventId = uuidv4();
      kafka.producer.send({
        topic: 'PaymentSuccess',
        messages: [{
          key: String(rideId),
          value: JSON.stringify({
            eventId: successEventId,
            bookingId: bookingId,
            sagaId: sagaId,
            paymentId: payment.id,
            rideId: payment.rideId,
            amount: payment.amount,
            driverId: payment.driverId,
            userId: payment.userId,
            status: payment.status,
            timestamp: new Date().toISOString()
          }),
          headers: { 'event-id': successEventId }
        }]
      }).catch(err => {
        console.error('[Kafka] Delayed emission failed:', err.message);
      });

      console.log(`[PaymentService] Emitted PaymentSuccess event for RideId: ${rideId}, Amount: ${amount}`);

      return payment;
    } catch (error) {
      console.error(`[PaymentService] Error processing payment for Ride ${rideId}:`, error);
      throw error;
    }
  }

  async getPaymentByRideId(rideId) {
    return await paymentRepository.getByRideId(rideId);
  }
}

module.exports = new PaymentService();
