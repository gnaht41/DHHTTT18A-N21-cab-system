const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { DataTypes } = require('sequelize');
const sequelize = require('./config/database');
const { Kafka } = require('kafkajs');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const kafkaInstance = new Kafka({
  clientId: 'review-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092']
});
const producer = kafkaInstance.producer();

const Review = sequelize.define('Review', {
  rideId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  driverId: { type: DataTypes.INTEGER, allowNull: true },
  rating: { type: DataTypes.INTEGER, allowNull: false },
  comment: { type: DataTypes.TEXT }
});

app.post('/api/reviews', async (req, res) => {
  try {
    const { rideId, rating, comment, driverId } = req.body;
    const userId = req.headers['x-user-id'] ? Number(req.headers['x-user-id']) : null;

    if (!rideId || !rating || !userId) {
      return res.status(400).json({ error: 'Missing required fields: rideId, rating, or userId' });
    }

    const review = await Review.create({ 
      rideId: Number(rideId), 
      userId, 
      driverId: driverId ? Number(driverId) : null,
      rating: Number(rating), 
      comment 
    });

    // Notify others via Kafka
    try {
      await producer.send({
        topic: 'ReviewCreated',
        messages: [{
          value: JSON.stringify({
            reviewId: review.id,
            rideId: review.rideId,
            userId: review.userId,
            driverId: review.driverId,
            rating: review.rating
          })
        }]
      });
      console.log(`[ReviewService] Emitted ReviewCreated for ride ${rideId}, driver ${review.driverId}`);
    } catch (kafkaErr) {
      console.error('[ReviewService] Kafka emit failed:', kafkaErr.message);
    }

    res.status(201).json({ data: review });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

const PORT = process.env.PORT || 3009;

const start = async () => {
  try {
    await producer.connect();
    console.log('Review Service Kafka Producer connected.');
    
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    console.log('Review Service DB connected and synced.');

    app.listen(PORT, () => console.log(`Review Service running on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start Review Service:', err.message);
    process.exit(1);
  }
};

start();
