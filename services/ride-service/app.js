const express = require('express');
const cors = require('cors');
const rideRoutes = require('./routes/rideRoutes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/rides', rideRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

module.exports = app;
