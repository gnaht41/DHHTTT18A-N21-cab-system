const sequelize = require('../config/database');
const Booking = require('./Booking');
const ProcessedEvent = require('./ProcessedEvent');
const OutboxEvent = require('./OutboxEvent');

// Define associations if any

module.exports = {
  sequelize,
  Booking,
  ProcessedEvent,
  OutboxEvent,
};
