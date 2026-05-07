const { Kafka } = require('kafkajs');
const driverService = require('../services/driverService');

const kafka = new Kafka({
  clientId: 'driver-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
  retry: {
    initialRetryTime: 100,
    retries: 5
  }
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'driver-service-group' });

const connectKafka = async () => {
  try {
    await producer.connect();
    await consumer.connect();
    
    await consumer.subscribe({ topic: 'BookingCreated', fromBeginning: false });
    await consumer.subscribe({ topic: 'RideCompleted', fromBeginning: false });
    await consumer.subscribe({ topic: 'RideCancelled', fromBeginning: false });
    await consumer.subscribe({ topic: 'USER_CREATED', fromBeginning: false });
    await consumer.subscribe({ topic: 'ReviewCreated', fromBeginning: false });
    
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const retryLimit = 3;
        const retryHeader = message.headers && message.headers['retry-count'] ? 
                            parseInt(message.headers['retry-count'].toString()) : 0;

        try {
          const data = JSON.parse(message.value.toString());
          console.log(`[Kafka] Received event on topic ${topic} (Attempt ${retryHeader + 1}):`, data);
          
          if (topic === 'BookingCreated') {
            // DEPRECATED: Assignment is now handled in real-time by ride-service 
            // because it has access to live GPS streaming from sockets.
            /*
            const { bookingId, pickup, destination, price, userId } = data;
            console.log(`[Kafka] BookingCreated received for booking ${bookingId}. Finding best driver...`);
            
            const assignedData = await driverService.assignNearestDriver(bookingId, pickup);
            ... 
            */
            console.log(`[Kafka] BookingCreated ignored in driver-service (Handled by ride-service)`);
          }

          if (topic === 'RideCompleted' || topic === 'RideCancelled') {
            const { driverId } = data;
            if (driverId) {
              await driverService.updateDriverStatus(driverId, 'AVAILABLE');
              console.log(`[Kafka] Driver ${driverId} marked AVAILABLE after ${topic}`);
            }
          }

          if (topic === 'USER_CREATED') {
            if (data.role === 'driver') {
              console.log(`[Kafka] USER_CREATED received for driver. Creating profile for userId: ${data.id}`);
              await driverService.getDriverByUserId(data.id, data.name);
            }
          }

          if (topic === 'PaymentSuccess') {
            if (data.driverId) {
              await driverService.addEarnings(data.driverId, data.amount);
            }
          }

          if (topic === 'ReviewCreated') {
            if (data.driverId && data.rating) {
              await driverService.updateRating(data.driverId, data.rating);
              console.log(`[Kafka] Processed ReviewCreated for driver ${data.driverId}`);
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
