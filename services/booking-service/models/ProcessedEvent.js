const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * ProcessedEvent Model - Per-service deduplication table
 * Each service has its own processed_events table in its own database
 * No cross-service imports - complete isolation
 */
const ProcessedEvent = sequelize.define('ProcessedEvent', {
  eventId: {
    type: DataTypes.UUID,
    primaryKey: true,
    allowNull: false,
    comment: 'UUID v4 of the processed event',
  },
  eventType: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Type of event (PaymentSuccess, RideCancelled, etc.)',
  },
  aggregateId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'ID of the aggregate (bookingId, rideId, etc.)',
  },
  processedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'When the event was processed',
  },
  result: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Result of processing (success, skipped, error)',
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Additional metadata (sagaId, parentEventId, etc.)',
  },
}, {
  tableName: 'processed_events',
  timestamps: false,
  indexes: [
    { fields: ['aggregateId', 'eventType'] },
    { fields: ['processedAt'] },
    { fields: ['eventType'] },
  ],
});

module.exports = ProcessedEvent;
