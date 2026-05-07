const { v4: uuidv4 } = require('uuid');
const ProcessedEvent = require('../models/ProcessedEvent');
const sequelize = require('../config/database');

/**
 * Generate UUID v4 for eventId
 * Collision risk: ~1 in 2^122 (negligible)
 */
const generateEventId = () => {
  return uuidv4(); // Pure UUID v4, no timestamp
};

/**
 * Transaction-safe exactly-once processing
 * Atomic: check + insert within same transaction
 */
const processEvent = async (eventId, eventType, aggregateId, handler, metadata = {}) => {
  return await sequelize.transaction(async (transaction) => {
    // Lock row to prevent race condition
    const existing = await ProcessedEvent.findByPk(eventId, {
      transaction,
      lock: transaction.LOCK.SHARE,
    });

    if (existing) {
      console.log(`[Idempotent] ${eventType} ${eventId} already processed`);
      return {
        processed: false,
        skipped: true,
        eventId,
        result: existing.result,
        processedAt: existing.processedAt
      };
    }

    // Execute handler within transaction
    const result = await handler();

    // Mark as processed (atomic with handler execution)
    await ProcessedEvent.create({
      eventId,
      eventType,
      aggregateId: String(aggregateId),
      processedAt: new Date(),
      result,
      metadata,
    }, { transaction });

    return {
      processed: true,
      skipped: false,
      eventId,
      result
    };
  });
};

/**
 * For pure check-only scenarios (not recommended, use processEvent instead)
 */
const isEventProcessed = async (eventId) => {
  const existing = await ProcessedEvent.findByPk(eventId);
  return !!existing;
};

module.exports = {
  generateEventId,
  processEvent,
  isEventProcessed,
};
