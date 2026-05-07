const sequelize = require('../config/database');
const Ride = require('./Ride');
const ProcessedEvent = require('./ProcessedEvent');

// Define associations if any

module.exports = {
  sequelize,
  Ride,
  ProcessedEvent,
};
