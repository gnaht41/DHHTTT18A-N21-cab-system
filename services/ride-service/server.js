const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const sequelize = require('./config/database');
const { connectKafka } = require('./config/kafka');
const { connectSaga } = require('./events/rideSaga');

const PORT = process.env.PORT || 3004;

const startServer = async () => {
  try {
    const http = require('http');
    const server = http.createServer(app);
    const { initSocket } = require('./config/socket');

    // Initialize Socket.io BEFORE Kafka starts consuming
    initSocket(server);

    await connectSaga();
    console.log('✓ Ride Saga connected');

    await connectKafka();
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    await sequelize.sync({ alter: true });
    console.log('Database synchronized.');

    server.listen(PORT, () => {
      console.log(`Ride Service (with Socket.IO) is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

startServer();
