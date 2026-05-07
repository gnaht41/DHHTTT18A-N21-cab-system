const { Kafka } = require('kafkajs');

const kafkaInstance = new Kafka({
  clientId: 'booking-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
  retry: {
    initialRetryTime: 100,
    retries: 5
  }
});

const producer = kafkaInstance.producer();
const consumer = kafkaInstance.consumer({ groupId: 'booking-group' });

const connectProducer = async () => {
  try {
    await producer.connect();
    console.log('Kafka Producer connected successfully.');
  } catch (error) {
    console.error('Kafka Producer connection error:', error.message);
  }
};

const connectConsumer = async (onMessage) => {
  try {
    await consumer.connect();
    await consumer.subscribe({ topics: ['RideArrived', 'RideStarted', 'RideCompleted', 'PaymentSuccess'], fromBeginning: false });
    
    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        const data = JSON.parse(message.value.toString());
        onMessage(topic, data);
      },
    });
    console.log('Kafka Consumer connected and subscribed.');
  } catch (error) {
    console.error('Kafka Consumer error:', error.message);
  }
};

module.exports = { producer, connectProducer, connectConsumer };
