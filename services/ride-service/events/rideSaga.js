const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');
const rideRepository = require('../repositories/rideRepository');
const { generateEventId, processEvent } = require('../utils/idempotentConsumer');
const { shouldApplyEvent, TERMINAL_STATES } = require('../utils/stateMachine');

const kafka = new Kafka({
  clientId: 'ride-service-saga',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
  retry: { initialRetryTime: 100, retries: 5 }
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'ride-saga-group' });

const connectSaga = async () => {
  await producer.connect();
  await consumer.connect();

  await consumer.subscribe({
    topics: ['BookingCreated', 'PaymentFailed', 'BookingCancelled'],
    fromBeginning: false
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const headers = message.headers || {};
      const eventId = headers['event-id']?.toString();
      const data = JSON.parse(message.value.toString());

      const finalEventId = eventId || data.eventId;

      if (!finalEventId) {
        console.error(`[Saga] No eventId provided for ${topic}, skipping`);
        return;
      }

      try {
        // Exactly-once processing with atomic check+insert
        const handler = async () => {
          switch (topic) {
            case 'BookingCreated':
              return await handleBookingCreated(data, headers);
            case 'PaymentFailed':
            case 'BookingCancelled':
              return await handleRideCompensation(data, headers);
          }
        };

        const result = await processEvent(
          finalEventId,
          topic,
          data.rideId || data.bookingId,
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

const handleBookingCreated = async (data, headers) => {
  const { sagaId, bookingId, userId, pickup, destination, price } = data;
  const parentEventId = headers['event-id']?.toString();

  console.log(`[Saga] Creating ride for booking ${bookingId}`);

  try {
    // Idempotency: Check if ride already exists for this booking
    const existingRide = await rideRepository.findOne({ where: { bookingId } });
    if (existingRide) {
      console.log(`[Idempotent] Ride already exists for booking ${bookingId}`);
      return { skipped: true, reason: 'ride_exists', rideId: existingRide.id };
    }

    // Create ride
    const ride = await rideRepository.create({
      bookingId,
      userId,
      pickup,
      destination,
      price,
      status: 'PENDING',
      sagaId
    });

    // Publish RideCreated to trigger payment
    const eventId = generateEventId();
    await producer.send({
      topic: 'RideCreated',
      messages: [{
        key: String(ride.id),
        value: JSON.stringify({
          eventId,
          sagaId,
          rideId: ride.id,
          bookingId,
          userId,
          price,
          timestamp: new Date().toISOString()
        }),
        headers: {
          'event-id': eventId,
          'parent-event-id': parentEventId
        }
      }]
    });

    console.log(`[Saga] Ride ${ride.id} created for booking ${bookingId}`);
    return { success: true, rideId: ride.id };

  } catch (error) {
    console.error(`[Saga] Failed to create ride:`, error);

    // Publish compensation to cancel booking
    const failEventId = generateEventId();
    await producer.send({
      topic: 'RideCreationFailed',
      messages: [{
        key: String(bookingId),
        value: JSON.stringify({
          eventId: failEventId,
          sagaId,
          bookingId,
          reason: 'Ride creation failed: ' + error.message,
          timestamp: new Date().toISOString()
        }),
        headers: { 'event-id': failEventId }
      }]
    });

    return { success: false, error: error.message };
  }
};

const handleRideCompensation = async (data, headers) => {
  const { bookingId, sagaId, reason } = data;
  const parentEventId = headers['event-id']?.toString();

  const ride = await rideRepository.findOne({ where: { bookingId } });
  if (!ride) {
    return { skipped: true, reason: 'ride_not_found' };
  }

  // State safety: Cannot cancel PAID or COMPLETED rides
  if (TERMINAL_STATES.includes(ride.status)) {
    console.warn(`[State] Cannot cancel ${ride.status} ride ${ride.id}`);
    return { skipped: true, reason: 'terminal_state', currentStatus: ride.status };
  }

  if (ride.status === 'CANCELLED') {
    console.log(`[Idempotent] Ride ${ride.id} already cancelled`);
    return { skipped: true, reason: 'already_cancelled' };
  }

  // State validation
  if (!shouldApplyEvent(ride.status, 'CANCELLED')) {
    console.log(`[State] Cannot transition ${ride.status} → CANCELLED for ride ${ride.id}`);
    return { skipped: true, currentStatus: ride.status, attempted: 'CANCELLED' };
  }

  await rideRepository.updateStatus(ride.id, 'CANCELLED');

  const eventId = generateEventId(); // UUID v4
  await producer.send({
    topic: 'RideCancelled',
    messages: [{
      key: String(ride.id),
      value: JSON.stringify({
        eventId,
        sagaId,
        rideId: ride.id,
        bookingId,
        reason: reason || 'Payment failed',
        timestamp: new Date().toISOString()
      }),
      headers: {
        'event-id': eventId,
        'parent-event-id': parentEventId
      }
    }]
  });

  console.log(`[Saga] Ride ${ride.id} cancelled`);
  return { success: true, status: 'CANCELLED' };
};

module.exports = { connectSaga };
