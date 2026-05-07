const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');
const Booking = require('../models/Booking');
const { generateEventId, processEvent } = require('../utils/idempotentConsumer');
const { shouldApplyEvent, TERMINAL_STATES } = require('../utils/stateMachine');

const kafka = new Kafka({
  clientId: 'booking-service-saga',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
  retry: { initialRetryTime: 100, retries: 5 }
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'booking-saga-group' });

const connectSaga = async () => {
  await producer.connect();
  await consumer.connect();

  await consumer.subscribe({
    topics: ['PaymentSuccess', 'PaymentFailed', 'RideCancelled'],
    fromBeginning: false
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const headers = message.headers || {};
      const eventId = headers['event-id']?.toString();
      const data = JSON.parse(message.value.toString());

      // Use provided eventId or fall back to data.eventId
      const finalEventId = eventId || data.eventId;

      if (!finalEventId) {
        console.error(`[Saga] No eventId provided for ${topic}, skipping`);
        return;
      }

      try {
        // Exactly-once processing with atomic check+insert
        const handler = async () => {
          switch (topic) {
            case 'PaymentSuccess':
              return await handlePaymentSuccess(data);
            case 'PaymentFailed':
              return await handlePaymentFailed(data);
            case 'RideCancelled':
              return await handleRideCancelled(data);
          }
        };

        const result = await processEvent(
          finalEventId,
          topic,
          data.bookingId,
          handler,
          { sagaId: data.sagaId, parentEventId: headers['parent-event-id']?.toString() }
        );

        if (result.skipped) {
          console.log(`[Saga] ${topic} ${finalEventId} skipped (already processed)`);
        }

      } catch (error) {
        console.error(`[Saga] Error processing ${topic}:`, error);
        throw error;
      }
    }
  });
};

const publishBookingCreated = async (booking) => {
  const eventId = generateEventId(); // UUID v4

  await producer.send({
    topic: 'BookingCreated',
    messages: [{
      key: String(booking.id),
      value: JSON.stringify({
        eventId,
        sagaId: `saga-${booking.id}`,
        bookingId: booking.id,
        userId: booking.userId,
        pickup: booking.pickup,
        destination: booking.destination,
        price: booking.price,
        timestamp: new Date().toISOString()
      }),
      headers: {
        'event-id': eventId,
        'event-type': 'BookingCreated',
        'saga-id': `saga-${booking.id}`
      }
    }]
  });
  console.log(`[Saga] Published BookingCreated ${eventId}`);
};

const handlePaymentSuccess = async (data) => {
  const { bookingId, sagaId } = data;

  const booking = await Booking.findByPk(bookingId);
  if (!booking) {
    console.warn(`[Saga] Booking ${bookingId} not found`);
    return { skipped: true, reason: 'booking_not_found' };
  }

  // State validation: PAID is final, CANCELLED cannot become PAID
  if (!shouldApplyEvent(booking.status, 'PAID')) {
    console.log(`[State] Cannot transition ${booking.status} → PAID for booking ${bookingId}`);
    return { skipped: true, currentStatus: booking.status, attempted: 'PAID' };
  }

  await booking.update({
    status: 'PAID',
    paidAt: new Date(),
    sagaId
  });

  console.log(`[Saga] Booking ${bookingId} marked as PAID`);
  return { success: true, status: 'PAID' };
};

const handlePaymentFailed = async (data) => {
  const { bookingId, sagaId, reason } = data;

  return await cancelBooking(bookingId, sagaId, reason || 'Payment failed');
};

const handleRideCancelled = async (data) => {
  const { bookingId, sagaId, reason } = data;

  return await cancelBooking(bookingId, sagaId, reason || 'Ride cancelled');
};

const cancelBooking = async (bookingId, sagaId, reason) => {
  const booking = await Booking.findByPk(bookingId);
  if (!booking) {
    return { skipped: true, reason: 'booking_not_found' };
  }

  // State safety: PAID cannot be cancelled
  if (booking.status === 'PAID') {
    console.warn(`[State] Cannot cancel PAID booking ${bookingId}`);
    return { skipped: true, reason: 'already_paid', currentStatus: 'PAID' };
  }

  if (booking.status === 'CANCELLED') {
    console.log(`[Idempotent] Booking ${bookingId} already cancelled`);
    return { skipped: true, reason: 'already_cancelled' };
  }

  await booking.update({
    status: 'CANCELLED',
    cancelledAt: new Date(),
    cancelReason: reason,
    sagaId
  });

  // Publish BookingCancelled event
  const eventId = generateEventId(); // UUID v4
  await producer.send({
    topic: 'BookingCancelled',
    messages: [{
      key: String(bookingId),
      value: JSON.stringify({
        eventId,
        sagaId,
        bookingId,
        userId: booking.userId,
        reason,
        timestamp: new Date().toISOString()
      }),
      headers: { 'event-id': eventId }
    }]
  });

  console.log(`[Saga] Booking ${bookingId} cancelled: ${reason}`);
  return { success: true, status: 'CANCELLED' };
};

module.exports = { connectSaga, publishBookingCreated };
