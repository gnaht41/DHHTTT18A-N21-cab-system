const express = require('express');
const cors = require('cors');
const driverRoutes = require('./routes/driverRoutes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/drivers', driverRoutes);
app.use('/api/drivers/', driverRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

module.exports = app;
