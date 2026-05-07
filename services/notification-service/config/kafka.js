const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

const consumer = kafka.consumer({ groupId: 'notification-group' });

const connectConsumer = async (messageHandler) => {
  try {
    await consumer.connect();
    console.log('[Kafka] Consumer connected');

    // Subscribe to all relevant topics
    await consumer.subscribe({
      topics: [
        'RideCreated',
        'RideAccepted',
        'RideArrived',
        'RideStarted',
        'RideCompleted',
        'PaymentSuccess',
        'BookingCreated'
      ]
    });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          console.log(`[Kafka] Received ${topic}:`, data);

          // Call the message handler with event type and data
          messageHandler(topic, data);
        } catch (err) {
          console.error('[Kafka] Error processing message:', err);
        }
      }
    });

  } catch (error) {
    console.error('[Kafka] Consumer connection failed:', error);
    // Retry after 5 seconds
    setTimeout(() => connectConsumer(messageHandler), 5000);
  }
};

module.exports = { kafka, consumer, connectConsumer };
