const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const sequelize = require('./config/database');
const { connectKafka } = require('./config/kafka');
const { connectSaga } = require('./events/paymentSaga');

const PORT = process.env.PORT || 3005;

const startServer = async () => {
  try {
    await connectSaga();
    console.log('✓ Payment Saga connected');

    await connectKafka();
    await sequelize.authenticate();
    console.log('Payment Database connected.');

    await sequelize.sync({ alter: true });
    console.log('Payment Database synchronized.');

    app.listen(PORT, () => {
      console.log(`Payment Service is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Payment Service startup failed:', error);
    process.exit(1);
  }
};

startServer();
