const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const sequelize = require('./config/database');
const { connectProducer } = require('./events/authEvents');

const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    // 1. Connect to database
    await sequelize.authenticate();
    console.log('✓ Database connected successfully (auth_db).');

    // 2. Sync models
    await sequelize.sync();
    console.log('✓ Database synchronized.');

    // 3. Connect Kafka producer
    // Enables publishing USER_CREATED, USER_UPDATED events to other services
    await connectProducer();
    console.log('✓ Kafka producer connected.');

    // 4. Start HTTP server
    app.listen(PORT, () => {
      console.log(`✓ Auth Service is running on port ${PORT}`);
      console.log('');
      console.log('========================================');
      console.log('DATABASE: auth_db (isolated)');
      console.log('MODELS: User (auth data only)');
      console.log('EVENTS: Publishing user.* topics');
      console.log('========================================');
    });
  } catch (error) {
    console.error('✗ Failed to start Auth Service:', error);
    process.exit(1);
  }
};

startServer();
