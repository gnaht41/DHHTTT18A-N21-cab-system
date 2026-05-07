/**
 * DEAD LETTER QUEUE (DLQ) CONSUMER
 * Handles failed Kafka messages from Outbox failures
 */

const { Kafka } = require('kafkajs');

class DLQConsumer {
    constructor(brokers = [process.env.KAFKA_BROKER || 'kafka:9092']) {
        this.kafka = new Kafka({
            clientId: 'dlq-consumer',
            brokers: brokers.split(','),
            retry: {
                initialRetryTime: 100,
                retries: 5
            }
        });

        this.consumer = this.kafka.consumer({ groupId: 'dlq-consumer-group' });
        this.dlqTopic = 'outbox-dlq';
        this.handlers = new Map();
    }

    /**
     * Register handler for specific event type
     */
    registerHandler(eventType, handler) {
        this.handlers.set(eventType, handler);
    }

    /**
     * Start consuming from DLQ
     */
    async start() {
        try {
            await this.consumer.connect();
            console.log('✅ DLQ Consumer connected');

            await this.consumer.subscribe({ topic: this.dlqTopic });
            console.log(`✅ Subscribed to ${this.dlqTopic}`);

            await this.consumer.run({
                eachMessage: async ({ topic, partition, message }) => {
                    await this.handleDLQMessage(message);
                }
            });

            console.log('✅ DLQ Consumer started');

        } catch (err) {
            console.error('❌ DLQ Consumer error:', err);
            process.exit(1);
        }
    }

    /**
     * Process individual DLQ message
     */
    async handleDLQMessage(message) {
        try {
            const dlqEvent = JSON.parse(message.value.toString());

            console.warn(`📋 DLQ Event Received:`, {
                eventId: dlqEvent.id,
                eventType: dlqEvent.eventType,
                aggregateId: dlqEvent.aggregateId,
                error: dlqEvent.originalError,
                failedAt: dlqEvent.failedAt,
                retryCount: dlqEvent.retryCount
            });

            // Log to monitoring system
            await this.logToMonitoring(dlqEvent);

            // Alert ops team
            await this.alertOps(dlqEvent);

            // Attempt manual recovery
            const handler = this.handlers.get(dlqEvent.eventType);
            if (handler) {
                try {
                    const result = await handler(dlqEvent);
                    console.log(`✅ Manual recovery succeeded for ${dlqEvent.id}`, result);
                } catch (recoveryErr) {
                    console.error(`❌ Manual recovery failed for ${dlqEvent.id}:`, recoveryErr.message);
                    // Keep in DLQ for ops to handle manually
                }
            }

        } catch (err) {
            console.error('Error processing DLQ message:', err);
        }
    }

    /**
     * Log to monitoring/logging system
     */
    async logToMonitoring(dlqEvent) {
        const logEntry = {
            timestamp: new Date(),
            type: 'DLQ_EVENT',
            eventId: dlqEvent.id,
            eventType: dlqEvent.eventType,
            aggregateId: dlqEvent.aggregateId,
            aggregateType: dlqEvent.aggregateType,
            error: dlqEvent.originalError,
            retryCount: dlqEvent.retryCount,
            payload: dlqEvent.payload,
            metadata: {
                dlqReceivedAt: new Date(),
                manualAction: 'PENDING'
            }
        };

        // TODO: Send to ELK, Splunk, or persistent storage
        console.log('📊 Logging DLQ event:', JSON.stringify(logEntry, null, 2));
    }

    /**
     * Alert operations team
     */
    async alertOps(dlqEvent) {
        const alertMessage = {
            severity: 'CRITICAL',
            title: `Outbox DLQ: ${dlqEvent.eventType} failed`,
            description: `Event ${dlqEvent.id} failed after ${dlqEvent.retryCount} retries`,
            error: dlqEvent.originalError,
            timestamp: new Date(),
            action: 'MANUAL_REVIEW_REQUIRED'
        };

        // TODO: Send to Slack, PagerDuty, or email
        console.error('🚨 ALERT:', JSON.stringify(alertMessage, null, 2));

        // For now, just log
        // In production: 
        // - Send to Slack webhook
        // - Trigger PagerDuty incident
        // - Send email to ops team
    }

    /**
     * Get DLQ stats
     */
    async getStats() {
        const stats = {
            topic: this.dlqTopic,
            status: 'running',
            handlers: Array.from(this.handlers.keys()),
            timestamp: new Date()
        };
        return stats;
    }

    /**
     * Gracefully stop consumer
     */
    async stop() {
        await this.consumer.disconnect();
        console.log('✅ DLQ Consumer stopped');
    }
}

// Export singleton instance
module.exports = DLQConsumer;