const dotenv = require('dotenv');
dotenv.config();

const app = require('./app');
const sequelize = require('./config/database');
const { connectKafka } = require('./config/kafka');

const PORT = process.env.PORT || 3003;

const startServer = async () => {
  try {
    await connectKafka();
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    await sequelize.sync({ alter: true });
    console.log('Database synchronized with alter: true.');


    app.listen(PORT, () => {
      console.log(`Driver Service is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

startServer();
