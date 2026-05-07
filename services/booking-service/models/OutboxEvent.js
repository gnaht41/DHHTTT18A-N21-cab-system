const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OutboxEvent = sequelize.define('OutboxEvent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  aggregateType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Type of aggregate: Booking, Ride, etc.',
  },
  aggregateId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'ID of the aggregate instance',
  },
  eventType: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Type of event: BookingCreated, BookingCancelled, etc.',
  },
  payload: {
    type: DataTypes.JSONB,
    allowNull: false,
    comment: 'Event payload as JSON',
  },
  headers: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
    comment: 'Additional headers for Kafka',
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED'),
    allowNull: false,
    defaultValue: 'PENDING',
    comment: 'Publication status: PENDING -> PROCESSING -> PUBLISHED/FAILED',
  },
  workerId: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Worker ID currently processing this event',
  },
  lockedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When event was locked by worker',
  },
  retryCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Number of retry attempts',
  },
  lastError: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Last error message if failed',
  },
  publishedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When event was published to Kafka',
  },
  scheduledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When to retry next (for exponential backoff)',
  },
}, {
  tableName: 'outbox_events',
  timestamps: true,
  indexes: [
    { fields: ['status', 'createdAt'] },
    { fields: ['status', 'scheduledAt'] },
    { fields: ['aggregateType', 'aggregateId'] },
    { fields: ['retryCount'] },
  ],
});

module.exports = OutboxEvent;
