const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const sequelize = require('./config/database');
const { startConsumer, stopConsumer } = require('./events/authEventConsumer');

const PORT = process.env.PORT || 3006;

const startServer = async () => {
  try {
    // 1. Connect to database
    await sequelize.authenticate();
    console.log('✓ Database connected successfully (user_db).');

    // Sync models - use plain sync (safe for fresh DB; alter: true causes PG syntax errors with UNIQUE columns)
    try {
      await sequelize.sync({ alter: true });
    } catch (syncErr) {
      console.warn('⚠ alter sync failed, falling back to safe sync:', syncErr.message);
      await sequelize.sync();
    }
    console.log('✓ Database synchronized.');

    // 3. Start Kafka consumer for auth events
    // This listens to USER_CREATED, USER_UPDATED, USER_DELETED from auth-service
    // and maintains eventual consistency between auth_db and user_db
    await startConsumer();
    console.log('✓ Kafka consumer started (listening for auth events).');

    // 4. Start HTTP server
    app.listen(PORT, () => {
      console.log(`✓ User Service is running on port ${PORT}`);
      console.log('');
      console.log('========================================');
      console.log('DATABASE: user_db (isolated)');
      console.log('MODELS: UserProfile, Address');
      console.log('EVENTS: Consuming auth.* topics');
      console.log('========================================');
    });
  } catch (error) {
    console.error('✗ Failed to start User Service:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await stopConsumer();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await stopConsumer();
  process.exit(0);
});

startServer();
