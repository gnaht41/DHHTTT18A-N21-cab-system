const { Kafka } = require('kafkajs');
const rideRepository = require('../repositories/rideRepository');

const kafka = new Kafka({
  clientId: 'ride-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
  retry: {
    initialRetryTime: 100,
    retries: 5
  }
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'ride-service-group' });

const connectKafka = async () => {
  try {
    await producer.connect();
    await consumer.connect();
    await consumer.subscribe({ topic: 'BookingCreated', fromBeginning: false });
    // REMOVED: await consumer.subscribe({ topic: 'driver-assigned', fromBeginning: false });
    await consumer.subscribe({ topic: 'PaymentSuccess', fromBeginning: false });
    await consumer.subscribe({ topic: 'ReviewCreated', fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const retryLimit = 3;
        const retryHeader = message.headers && message.headers['retry-count'] ?
          parseInt(message.headers['retry-count'].toString()) : 0;

        try {
          const data = JSON.parse(message.value.toString());
          console.log(`[Kafka] Received event on topic ${topic} (Attempt ${retryHeader + 1}):`, data);

          const { getIO } = require('./socket');
          const io = getIO();

          if (topic === 'ReviewCreated') {
            const { rideId } = data;
            if (rideId) {
              await rideRepository.findOne({ where: { id: rideId } }).then(async (ride) => {
                if (ride) {
                  ride.isReviewed = true;
                  await ride.save();
                  console.log(`[Kafka] Ride ${rideId} marked as reviewed.`);

                  // Notify UI that history might have changed
                  io.to(`ride-${rideId}`).emit('ride-history-updated', { rideId, userId: ride.userId });
                  io.to(`ride-${ride.bookingId}`).emit('ride-history-updated', { rideId, userId: ride.userId });

                  // Broad cast review status
                  const reviewPacket = { rideId, isReviewed: true, status: ride.status };
                  io.to(`ride-${rideId}`).emit('ride-status-updated', reviewPacket);
                  io.to(`ride-${ride.bookingId}`).emit('ride-status-updated', reviewPacket);
                }
              });
            }
          }

          if (topic === 'BookingCreated') {
            const rideService = require('../services/rideService');
            console.log(`[Kafka] BookingCreated received for ${data.bookingId}. Invoking findAndAssignDriver...`);
            console.log(`[Kafka] Assignment authority: Ride Service ONLY`);

            // SINGLE SOURCE OF TRUTH: Ride Service handles all driver assignment
            await rideService.findAndAssignDriver(data);
          }

          // LEGACY REMOVED: 'driver-assigned' topic handler deleted
          // Driver assignment now happens ONLY via RideService.findAndAssignDriver()

          if (topic === 'PaymentSuccess') {
            const { rideId, paymentId, amount, status, booking } = data;

            try {
              // V6.1: Persist PAID status to database to end the active session
              const ride = await rideRepository.updateStatus(rideId, 'PAID');

              if (ride) {
                const roomRide = `ride-${rideId}`;
                const roomBooking = `ride-${ride.bookingId}`;

                console.log(`[Kafka/Socket] SUCCESS - RideId: ${rideId}, BookingId: ${ride.bookingId}`);
                console.log(`[Kafka/Socket] Emitting payment-success to rooms: ${roomRide} and ${roomBooking}`);

                const packet = { rideId, paymentId, amount, price: ride.price || amount, status, bookingId: ride.bookingId, driverId: ride.driverId, userId: ride.userId };
                const statusPacket = { ...packet, status: 'PAID' };

                // Emit to ride rooms (legacy)
                io.to(roomRide).emit('payment-success', packet);
                io.to(roomRide).emit('ride-status-updated', statusPacket);
                io.to(roomBooking).emit('payment-success', packet);
                io.to(roomBooking).emit('ride-status-updated', statusPacket);

                // Emit directly to driver and customer rooms (current architecture)
                if (ride.driverId) {
                  console.log(`[Kafka/Socket] Emitting PAID to driver_${ride.driverId}`);
                  io.to(`driver_${ride.driverId}`).emit('ride-status-updated', statusPacket);
                }
                if (ride.userId) {
                  console.log(`[Kafka/Socket] Emitting PAID to customer_${ride.userId}`);
                  io.to(`customer_${ride.userId}`).emit('ride-status-updated', statusPacket);
                }

                // Broadcast to all drivers about ride completion
                io.emit('ride-payment-completed', { rideId, bookingId: ride.bookingId, driverId: ride.driverId });
              } else {
                console.error(`[Kafka/Socket] ERROR - Could not find ride for payment update: ${rideId}`);
              }

              console.log(`[Kafka/Socket] Updated ride ${rideId} to PAID and emitted success`);
            } catch (err) {
              console.error('[Kafka/Socket] Error processing PaymentSuccess:', err.message);
            }
          }
        } catch (err) {
          console.error(`[Kafka] Error processing message (Attempt ${retryHeader + 1}):`, err.message);

          if (retryHeader < retryLimit) {
            // Push back to the same topic with incremented retry count
            await producer.send({
              topic: topic,
              messages: [{
                value: message.value,
                headers: { 'retry-count': (retryHeader + 1).toString() }
              }]
            });
            console.log(`[Kafka] Retrying message... (${retryHeader + 1}/${retryLimit})`);
          } else {
            // Send to DLQ
            await producer.send({
              topic: 'dead-letter',
              messages: [{
                value: message.value,
                headers: {
                  'original-topic': topic,
                  'error-message': err.message,
                  'retry-count': retryHeader.toString()
                }
              }]
            });
            console.error(`[Kafka] Max retries reached. Message moved to DLQ (dead-letter topic).`);
          }
        }
      }
    });

    console.log('Kafka Consumer & Producer connected successfully.');
  } catch (error) {
    console.error('Kafka connection error:', error.message);
  }
};

module.exports = { connectKafka, producer };
