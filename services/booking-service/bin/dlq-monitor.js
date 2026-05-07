#!/usr/bin/env node

/**
 * DLQ MONITOR SCRIPT
 * Monitors Dead Letter Queue and reports on failed Kafka messages
 * 
 * Usage: node dlq-monitor.js
 */

const DLQConsumer = require('./consumers/dlqConsumer');

class DLQMonitor {
    constructor() {
        this.dlqConsumer = new DLQConsumer();
        this.failedEvents = [];
    }

    async start() {
        console.log('🚀 Starting DLQ Monitor...\n');

        // Register handlers for different event types
        this.dlqConsumer.registerHandler('BookingCreated', this.handleBookingFailure.bind(this));
        this.dlqConsumer.registerHandler('RideCreated', this.handleRideFailure.bind(this));
        this.dlqConsumer.registerHandler('PaymentSuccess', this.handlePaymentFailure.bind(this));

        // Start consuming from DLQ
        await this.dlqConsumer.start();

        // Print metrics every 30 seconds
        setInterval(() => {
            this.printMetrics();
        }, 30000);

        // Graceful shutdown
        process.on('SIGINT', () => {
            this.shutdown();
        });
    }

    /**
     * Handle BookingCreated failures
     */
    async handleBookingFailure(dlqEvent) {
        console.error('\n📊 BookingCreated Failure:');
        console.error(`   Booking ID: ${dlqEvent.payload.bookingId}`);
        console.error(`   User ID: ${dlqEvent.payload.userId}`);
        console.error(`   Error: ${dlqEvent.originalError}`);
        console.error(`   Retry Count: ${dlqEvent.retryCount}`);

        // TODO: Trigger booking compensation logic
        // - Refund user if already charged
        // - Send notification to user about booking failure
        // - Log to audit trail
    }

    /**
     * Handle RideCreated failures
     */
    async handleRideFailure(dlqEvent) {
        console.error('\n📊 RideCreated Failure:');
        console.error(`   Ride ID: ${dlqEvent.payload.rideId}`);
        console.error(`   Booking ID: ${dlqEvent.payload.bookingId}`);
        console.error(`   Error: ${dlqEvent.originalError}`);

        // TODO: Handle ride creation failure
        // - Cancel booking
        // - Notify driver
        // - Refund customer
    }

    /**
     * Handle PaymentSuccess failures
     */
    async handlePaymentFailure(dlqEvent) {
        console.error('\n📊 PaymentSuccess Failure:');
        console.error(`   Payment ID: ${dlqEvent.payload.paymentId}`);
        console.error(`   Amount: ${dlqEvent.payload.amount}`);
        console.error(`   Error: ${dlqEvent.originalError}`);

        // TODO: Handle payment failure
        // - Retry payment with exponential backoff
        // - Ask customer for alternative payment method
        // - Cancel ride if payment can't be collected
    }

    /**
     * Print monitoring metrics
     */
    printMetrics() {
        console.log('\n📈 DLQ Monitor Metrics:');
        console.log(`   Total failed events: ${this.failedEvents.length}`);
        console.log(`   Timestamp: ${new Date().toISOString()}`);

        // Group by event type
        const byType = {};
        this.failedEvents.forEach(event => {
            byType[event.eventType] = (byType[event.eventType] || 0) + 1;
        });

        Object.entries(byType).forEach(([type, count]) => {
            console.log(`   - ${type}: ${count} failures`);
        });
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        console.log('\n🛑 Shutting down DLQ Monitor...');
        await this.dlqConsumer.stop();
        process.exit(0);
    }
}

// Start monitor if run as script
if (require.main === module) {
    const monitor = new DLQMonitor();
    monitor.start().catch(err => {
        console.error('Failed to start DLQ Monitor:', err);
        process.exit(1);
    });
}

module.exports = DLQMonitor;