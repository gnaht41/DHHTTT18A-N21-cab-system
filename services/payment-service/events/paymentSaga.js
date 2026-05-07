const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');
const paymentRepository = require('../repositories/paymentRepository');

const kafka = new Kafka({
  clientId: 'payment-service-saga',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
  retry: { initialRetryTime: 100, retries: 5 }
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'payment-saga-group' });

const connectSaga = async () => {
  await producer.connect();
  await consumer.connect();

  await consumer.subscribe({ topics: ['RideCreated'], fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const eventId = message.headers?.['event-id']?.toString();

      if (topic === 'RideCreated') {
        await processPayment(JSON.parse(message.value.toString()), eventId);
      }
    }
  });
};

const processPayment = async (data, parentEventId) => {
  const { sagaId, rideId, bookingId, userId, price } = data;

  console.log(`[Saga] Processing payment for ride ${rideId}, amount: ${price}`);

  try {
    // Check existing payment (idempotency)
    const existing = await paymentRepository.getByRideId(rideId);
    if (existing) {
      console.log(`[Saga] Payment already exists for ride ${rideId}`);

      // Re-publish event if needed
      if (existing.status === 'SUCCESS') {
        const eventId = uuidv4(); // UUID v4
        await producer.send({
          topic: 'PaymentSuccess',
          messages: [{
            key: String(rideId),
            value: JSON.stringify({
              eventId,
              sagaId: existing.sagaId,
              paymentId: existing.id,
              rideId,
              bookingId,
              userId,
              amount: existing.amount,
              status: 'SUCCESS',
              timestamp: new Date().toISOString()
            }),
            headers: { 'event-id': eventId }
          }]
        });
      }
      return { skipped: true, reason: 'payment_exists', paymentId: existing.id };
    }

    // Simulate payment processing (100% success rate for testing)
    const success = true;

    if (!success) {
      throw new Error('Payment gateway declined transaction');
    }

    // Create payment record
    const payment = await paymentRepository.create({
      rideId,
      bookingId,
      userId,
      amount: price,
      status: 'SUCCESS',
      sagaId
    });

    // Publish success with eventId
    const eventId = uuidv4(); // UUID v4
    const successHeaders = { 'event-id': eventId };
    if (parentEventId) successHeaders['parent-event-id'] = String(parentEventId);

    await producer.send({
      topic: 'PaymentSuccess',
      messages: [{
        key: String(rideId),
        value: JSON.stringify({
          eventId,
          sagaId,
          paymentId: payment.id,
          rideId,
          bookingId,
          userId,
          amount: price,
          status: 'SUCCESS',
          timestamp: new Date().toISOString()
        }),
        headers: successHeaders
      }]
    });

    console.log(`[Saga] Payment SUCCESS for ride ${rideId}, event ${eventId}`);
    return { success: true, paymentId: payment.id };

  } catch (error) {
    console.error(`[Saga] Payment FAILED for ride ${rideId}:`, error.message);

    // Publish failure with eventId
    const eventId = uuidv4(); // UUID v4
    const failureHeaders = { 'event-id': eventId };
    if (parentEventId) failureHeaders['parent-event-id'] = String(parentEventId);

    await producer.send({
      topic: 'PaymentFailed',
      messages: [{
        key: String(rideId),
        value: JSON.stringify({
          eventId,
          sagaId,
          rideId,
          bookingId,
          userId,
          amount: price,
          reason: error.message,
          timestamp: new Date().toISOString()
        }),
        headers: failureHeaders
      }]
    });

    return { success: false, error: error.message };
  }
};

module.exports = { connectSaga };
