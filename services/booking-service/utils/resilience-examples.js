/**
 * RESILIENCE LAYER USAGE EXAMPLES
 * Demonstrates how to use retry, circuit breaker, and fallback patterns
 */

const { userServiceClient, driverServiceClient, pricingServiceClient, getResilienceStatus } = require('./serviceClient');

// Example 1: Basic usage with automatic resilience
async function createBooking(userId, pickup, destination) {
    try {
        // Get user profile - has fallback to minimal data
        const user = await userServiceClient.getProfile(userId);
        console.log('User profile:', user.fullName);

        // Calculate price - has fallback to distance-based estimate
        const priceEstimate = await pricingServiceClient.calculateEstimate({
            pickup,
            destination,
            vehicleType: 'standard'
        });
        console.log('Price estimate:', priceEstimate.estimatedPrice);

        // Find drivers - has fallback to empty array
        const drivers = await driverServiceClient.findNearby(pickup, { radius: 5000, limit: 5 });
        console.log(`Found ${drivers.length} nearby drivers`);

        return {
            user,
            priceEstimate,
            availableDrivers: drivers
        };

    } catch (error) {
        console.error('Booking creation failed:', error.message);
        throw error;
    }
}

// Example 2: Manual circuit breaker control
async function healthCheck() {
    const status = getResilienceStatus();
    console.log('Circuit Breaker Status:');
    console.log('- User Service:', status.userService.state);
    console.log('- Driver Service:', status.driverService.state);
    console.log('- Pricing Service:', status.pricingService.state);

    // Check if any service is degraded
    const degradedServices = Object.entries(status)
        .filter(([service, stats]) => stats.state === 'OPEN')
        .map(([service]) => service);

    if (degradedServices.length > 0) {
        console.warn('Degraded services:', degradedServices);
        // Could trigger alerts or switch to maintenance mode
    }

    return status;
}

// Example 3: Custom retry configuration for critical operations
const { RetryHelper, CircuitBreaker } = require('./resilience');

async function criticalDriverAssignment(driverId, bookingId) {
    // Custom retry with more aggressive settings
    const customRetry = new RetryHelper({
        maxRetries: 5,
        baseDelay: 500,
        maxDelay: 5000,
        backoffMultiplier: 1.5
    });

    // Custom circuit breaker for this operation
    const customCircuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        recoveryTimeout: 30000,
        successThreshold: 2
    });

    const assignWithCustomResilience = async () => {
        return await customCircuitBreaker.execute(
            () => customRetry.execute(
                async () => {
                    return await driverServiceClient.assignBooking(driverId, bookingId);
                }
            ),
            async () => {
                console.log('Custom fallback: Queue assignment for later');
                // Could queue the assignment or use alternative logic
                throw new Error('Assignment queued for retry');
            }
        );
    };

    try {
        const result = await assignWithCustomResilience();
        console.log('Driver assigned successfully:', result);
        return result;
    } catch (error) {
        console.error('Critical assignment failed:', error.message);
        // Could escalate to human intervention
        throw error;
    }
}

// Example 4: Graceful degradation pattern
async function getBookingSummary(bookingId) {
    const summary = {
        bookingId,
        status: 'UNKNOWN',
        user: null,
        driver: null,
        pricing: null
    };

    try {
        // Try to get user info (non-blocking)
        userServiceClient.getProfile(bookingId).then(user => {
            summary.user = user;
        }).catch(err => {
            console.log('User info unavailable:', err.message);
        });

        // Try to get driver info (non-blocking)
        driverServiceClient.getDriver(bookingId).then(driver => {
            summary.driver = driver;
        }).catch(err => {
            console.log('Driver info unavailable:', err.message);
        });

        // Try to get pricing (blocking, with fallback)
        summary.pricing = await pricingServiceClient.calculateEstimate({
            pickup: { latitude: 0, longitude: 0 },
            destination: { latitude: 0, longitude: 0 }
        });

        summary.status = 'COMPLETE';

    } catch (error) {
        console.error('Error building booking summary:', error.message);
        summary.status = 'PARTIAL';
    }

    return summary;
}

// Example 5: Monitoring and alerting
async function monitorServiceHealth() {
    setInterval(async () => {
        const status = getResilienceStatus();

        // Alert if any circuit breaker is OPEN
        Object.entries(status).forEach(([service, stats]) => {
            if (stats.state === 'OPEN') {
                console.error(`🚨 ALERT: ${service} circuit breaker is OPEN!`);
                console.error(`   Failures: ${stats.failures}`);
                console.error(`   Failure Rate: ${stats.failureRate.toFixed(1)}%`);

                // Could send alerts to monitoring system
                // sendAlert(`${service} service degraded`, stats);
            }
        });

        // Log health metrics
        console.log('Service Health Check:');
        Object.entries(status).forEach(([service, stats]) => {
            console.log(`  ${service}: ${stats.state} (${stats.callCount} calls, ${stats.failureCount} failures)`);
        });

    }, 30000); // Check every 30 seconds
}

// Export examples for testing
module.exports = {
    createBooking,
    healthCheck,
    criticalDriverAssignment,
    getBookingSummary,
    monitorServiceHealth
};

// Run examples if called directly
if (require.main === module) {
    console.log('Running resilience examples...');

    // Example usage
    healthCheck().then(status => {
        console.log('Initial status:', status);
    }).catch(console.error);

    // Simulate a booking creation
    createBooking(123, { latitude: 40.7128, longitude: -74.0060 }, { latitude: 40.7589, longitude: -73.9851 })
        .then(result => {
            console.log('Booking created:', result);
        }).catch(console.error);
}