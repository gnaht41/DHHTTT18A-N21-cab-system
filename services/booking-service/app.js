const express = require('express');
const cors = require('cors');
const bookingRoutes = require('./routes/bookingRoutes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/bookings', bookingRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

module.exports = app;
