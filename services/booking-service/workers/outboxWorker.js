const { Op } = require('sequelize');
const { Kafka } = require('kafkajs');
const { OutboxEvent } = require('../models');
const sequelize = require('../config/database');

const kafka = new Kafka({
  clientId: 'booking-outbox-worker',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
  retry: { initialRetryTime: 100, retries: 5 }
});

const producer = kafka.producer();

// Configuration
const CONFIG = {
  POLL_INTERVAL_MS: 1000,
  BATCH_SIZE: 100,
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE_MS: 1000,
  LOCK_TIMEOUT_MS: 30000, // Lock timeout for stuck events
};

class OutboxWorker {
  constructor() {
    this.isRunning = false;
    this.timer = null;
    this.workerId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.pollCount = 0;
  }

  async start() {
    await producer.connect();
    this.isRunning = true;
    console.log(`[OutboxWorker ${this.workerId}] Started`);

    // Start polling loop
    this.poll();
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
    }
    console.log(`[OutboxWorker ${this.workerId}] Stopped`);
  }

  async poll() {
    if (!this.isRunning) return;

    try {
      // Cleanup stuck events every ~30 seconds (every 30 polls)
      if (!this.pollCount || ++this.pollCount >= 30) {
        await this.cleanupStuckEvents();
        this.pollCount = 0;
      }

      await this.processBatchWithLock();
    } catch (error) {
      console.error(`[OutboxWorker ${this.workerId}] Poll error:`, error);
    }

    // Schedule next poll
    this.timer = setTimeout(() => this.poll(), CONFIG.POLL_INTERVAL_MS);
  }

  /**
   * Process batch with atomic claim using UPDATE ... RETURNING
   * Claims events atomically in a single query to prevent race conditions
   */
  async processBatchWithLock() {
    // Atomic claim: SELECT and UPDATE in one query using CTE
    const events = await sequelize.query(`
      WITH selected_events AS (
        SELECT id FROM outbox_events 
        WHERE (status = 'PENDING' OR (status = 'FAILED' AND "retryCount" < :maxRetries AND "scheduledAt" <= NOW()))
        ORDER BY "createdAt" ASC
        LIMIT :batchSize
        FOR UPDATE SKIP LOCKED
      )
      UPDATE outbox_events 
      SET status = 'PROCESSING', "workerId" = :workerId, "lockedAt" = NOW()
      WHERE id IN (SELECT id FROM selected_events)
      RETURNING id, "aggregateType", "aggregateId", "eventType", payload, headers, status, "retryCount", "scheduledAt"
    `, {
      replacements: {
        maxRetries: CONFIG.MAX_RETRIES,
        batchSize: CONFIG.BATCH_SIZE,
        workerId: this.workerId
      },
      type: sequelize.QueryTypes.SELECT,
      transaction: null, // Run in auto-commit mode for row locking
    });

    if (!events || events.length === 0) return;

    console.log(`[OutboxWorker ${this.workerId}] Claimed ${events.length} events`);

    for (const event of events) {
      await this.processEventWithTransaction(event);
    }
  }

  /**
   * Process single event within transaction
   * Event is already claimed as PROCESSING, now we process and update atomically
   */
  async processEventWithTransaction(event) {
    await sequelize.transaction(async (transaction) => {
      // Event is already locked and marked as PROCESSING
      // Re-fetch to ensure consistency
      const lockedEvent = await OutboxEvent.findByPk(event.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!lockedEvent || lockedEvent.status !== 'PROCESSING') {
        console.log(`[OutboxWorker ${this.workerId}] Event ${event.id} not in PROCESSING state or already processed`);
        return;
      }

      try {
        // Publish to Kafka
        await producer.send({
          topic: lockedEvent.eventType,
          messages: [{
            key: lockedEvent.aggregateId,
            value: JSON.stringify(lockedEvent.payload),
            headers: {
              ...lockedEvent.headers,
              'outbox-id': lockedEvent.id,
              'published-at': new Date().toISOString(),
              'worker-id': this.workerId,
            },
          }],
        });

        // Mark as published within same transaction
        await lockedEvent.update({
          status: 'PUBLISHED',
          publishedAt: new Date(),
          retryCount: lockedEvent.retryCount + 1,
          lastError: null,
        }, { transaction });

        console.log(`[OutboxWorker ${this.workerId}] Published ${lockedEvent.eventType} ${lockedEvent.id}`);

      } catch (error) {
        console.error(`[OutboxWorker ${this.workerId}] Failed to publish ${lockedEvent.id}:`, error.message);

        const retryCount = lockedEvent.retryCount + 1;
        const shouldRetry = retryCount < CONFIG.MAX_RETRIES;

        // Exponential backoff: 1s, 2s, 4s
        const delayMs = CONFIG.RETRY_DELAY_BASE_MS * Math.pow(2, retryCount - 1);
        const scheduledAt = new Date(Date.now() + delayMs);

        await lockedEvent.update({
          status: shouldRetry ? 'PENDING' : 'FAILED',
          retryCount: retryCount,
          lastError: error.message,
          scheduledAt: shouldRetry ? scheduledAt : null,
          workerId: null,
          lockedAt: null,
        }, { transaction });

        if (!shouldRetry) {
          console.error(`[OutboxWorker ${this.workerId}] Event ${lockedEvent.id} exhausted retries`);
        }

        throw error; // Rethrow to rollback transaction
      }
    });
  }

  /**
   * Cleanup stuck events (processing for too long)
   * Run periodically to reset crashed workers' events
   */
  async cleanupStuckEvents() {
    const stuckTimeout = new Date(Date.now() - CONFIG.LOCK_TIMEOUT_MS);

    const [result] = await sequelize.query(`
      UPDATE outbox_events
      SET status = 'PENDING',
          "workerId" = NULL,
          "lockedAt" = NULL,
          "lastError" = 'Reset after timeout'
      WHERE status = 'PROCESSING'
        AND "lockedAt" < :stuckTimeout
    `, {
      replacements: { stuckTimeout },
      type: sequelize.QueryTypes.UPDATE,
    });

    const count = result?.rowCount || 0;
    if (count > 0) {
      console.log(`[OutboxWorker ${this.workerId}] Reset ${count} stuck events`);
    }
    return count;
  }

  // Health check
  async getStats() {
    const stats = await OutboxEvent.findAll({
      attributes: ['status', [OutboxEvent.sequelize.fn('COUNT', '*'), 'count']],
      group: ['status'],
      raw: true,
    });

    const result = { PENDING: 0, PROCESSING: 0, PUBLISHED: 0, FAILED: 0 };
    stats.forEach(s => result[s.status] = parseInt(s.count));

    return result;
  }
}

module.exports = new OutboxWorker();
