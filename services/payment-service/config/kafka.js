const { Kafka } = require('kafkajs');
// Deferred require to avoid circular dependency if service needs this config
let paymentService;

const kafka = new Kafka({
  clientId: 'payment-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
  retry: {
    initialRetryTime: 100,
    retries: 3
  }
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'payment-service-group' });

const connectKafka = async () => {
  try {
    await producer.connect();
    await consumer.connect();
    
    // Listen to RideCompleted to process payment automatically
    // await consumer.subscribe({ topic: 'RideCompleted', fromBeginning: false });
    
    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          console.log(`[Kafka] Payment Service received: ${topic}`, data);
          
          if (!paymentService) {
            paymentService = require('../services/paymentService');
          }

          /* 
          if (topic === 'RideCompleted') {
            const { rideId, amount, driverId } = data;
            console.log(`[Kafka] Ride ${rideId} completed. Processing automated payment of $${amount}...`);
            await paymentService.processPayment(rideId, amount || 15.50, driverId);
          }
          */
        } catch (err) {
          console.error('[Kafka] Payment process error:', err.message);
        }
      }
    });
    
    console.log('Payment Kafka Connected.');
  } catch (error) {
    console.error('Kafka connection error:', error.message);
  }
};

module.exports = { connectKafka, producer };
