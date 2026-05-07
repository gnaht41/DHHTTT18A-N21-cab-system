const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const sequelize = require('./config/database');
const { connectProducer, connectConsumer } = require('./config/kafka');
const bookingService = require('./services/bookingService');
const { connectSaga } = require('./events/bookingSaga');
const outboxWorker = require('./workers/outboxWorker');

const PORT = process.env.PORT || 3002;

const startServer = async () => {
  try {
    // Connect Saga (Choreography pattern)
    await connectSaga();
    console.log('✓ Booking Saga connected');

    // Start Outbox Worker (publishes events to Kafka)
    await outboxWorker.start();
    console.log('✓ Outbox Worker started');

    await connectProducer();

    // Connect consumer and handle updates
    await connectConsumer(async (topic, data) => {
      console.log(`[BookingService] Received event ${topic} for rideId: ${data.rideId}, bookingId: ${data.bookingId}`);

      const bookingId = data.bookingId;
      if (!bookingId) return;

      let newStatus = null;
      switch (topic) {
        case 'RideAccepted': newStatus = 'ACCEPTED'; break;
        case 'RideArrived': newStatus = 'ARRIVED'; break;
        case 'RideStarted': newStatus = 'STARTED'; break;
        case 'RideCompleted': newStatus = 'COMPLETED'; break;
        case 'PaymentSuccess': newStatus = 'PAID'; break;
      }

      if (newStatus) {
        await bookingService.updateBookingStatus(bookingId, newStatus);
        console.log(`[BookingService] Updated booking ${bookingId} to ${newStatus}`);
      }
    });

    await sequelize.authenticate();
    console.log('Database connected successfully.');

    await sequelize.sync();
    console.log('Database synchronized.');

    // Health check endpoint with outbox stats
    app.get('/health/outbox', async (req, res) => {
      try {
        const stats = await outboxWorker.getStats();
        res.json({
          status: 'ok',
          outbox: stats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.listen(PORT, () => {
      console.log(`Booking Service is running on port ${PORT}`);
      console.log('✓ Outbox Pattern: Active (DB + Kafka atomic)');
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

startServer();
