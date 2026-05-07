const { Kafka } = require('kafkajs');
const Notification = require('../models/Notification');

const kafka = new Kafka({
  clientId: 'notification-service-saga',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
  retry: { initialRetryTime: 100, retries: 5 }
});

const consumer = kafka.consumer({ groupId: 'notification-saga-group' });

const connectSaga = async () => {
  await consumer.connect();
  
  await consumer.subscribe({
    topics: [
      'PaymentSuccess',
      'PaymentFailed',
      'BookingCancelled',
      'RideCancelled'
    ],
    fromBeginning: false
  });
  
  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const data = JSON.parse(message.value.toString());
      await handleNotification(topic, data);
    }
  });
};

const handleNotification = async (topic, data) => {
  const { sagaId, userId, bookingId, rideId, amount, reason } = data;
  
  let notification = null;
  
  switch(topic) {
    case 'PaymentSuccess':
      notification = {
        userId,
        type: 'PAYMENT_SUCCESS',
        title: 'Payment Successful',
        message: `Your payment of $${amount} has been processed.`,
        data: { sagaId, bookingId, rideId, amount }
      };
      break;
      
    case 'PaymentFailed':
      notification = {
        userId,
        type: 'PAYMENT_FAILED',
        title: 'Payment Failed',
        message: `Payment failed: ${reason}. Your booking has been cancelled.`,
        data: { sagaId, bookingId, rideId, reason }
      };
      break;
      
    case 'BookingCancelled':
      notification = {
        userId,
        type: 'BOOKING_CANCELLED',
        title: 'Booking Cancelled',
        message: `Your booking has been cancelled${reason ? ': ' + reason : ''}.`,
        data: { sagaId, bookingId, reason }
      };
      break;
      
    case 'RideCancelled':
      notification = {
        userId,
        type: 'RIDE_CANCELLED',
        title: 'Ride Cancelled',
        message: 'Your ride has been cancelled due to payment issues.',
        data: { sagaId, rideId, bookingId }
      };
      break;
  }
  
  if (notification) {
    await Notification.create(notification);
    console.log(`[Saga] Notification created for user ${userId}: ${notification.type}`);
  }
};

module.exports = { connectSaga };
