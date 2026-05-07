const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'driver-service-producer',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
});

const producer = kafka.producer();
let connected = false;

async function publishEvent(topic, message) {
  if (!connected) {
    await producer.connect();
    connected = true;
  }
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(message) }]
  });
  console.log(`[Driver] Published event to ${topic}:`, message);
}

module.exports = { publishEvent };
