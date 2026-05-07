/**
 * BULKHEAD PATTERN EXAMPLES
 * Demonstrates concurrency limiting and service isolation
 */

const { userServiceClient, driverServiceClient, pricingServiceClient, ServiceClientWrapper } = require('./serviceClient');

// Example 1: Basic bulkhead usage
async function basicBulkheadExample() {
    console.log('=== Basic Bulkhead Example ===');

    const wrapper = new ServiceClientWrapper();

    // Execute service calls through global bulkhead
    const result = await wrapper.execute(async () => {
        return await userServiceClient.getProfile(123);
    });

    console.log('Result:', result);
}

// Example 2: High concurrency scenario
async function highConcurrencyExample() {
    console.log('=== High Concurrency Example ===');

    const wrapper = new ServiceClientWrapper();

    // Simulate 20 concurrent requests to user service
    // Bulkhead will limit to max 10 concurrent + queue the rest
    const promises = [];
    for (let i = 0; i < 20; i++) {
        promises.push(
            wrapper.execute(async () => {
                try {
                    const start = Date.now();
                    const result = await userServiceClient.getProfile(123 + i);
                    const duration = Date.now() - start;
                    return { success: true, duration, userId: 123 + i };
                } catch (error) {
                    return { success: false, error: error.message, userId: 123 + i };
                }
            })
        );
    }

    const results = await Promise.all(promises);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Processed ${results.length} requests: ${successful} success, ${failed} failed`);

    // Check bulkhead status after processing
    const status = wrapper.getGlobalStatus();
    console.log('Global Bulkhead Status:', status.globalBulkhead);
    console.log('User Service Bulkhead:', status.services.userService.bulkhead);
}

// Example 3: Service isolation demonstration
async function serviceIsolationExample() {
    console.log('=== Service Isolation Example ===');

    // Each service has its own bulkhead (max 10 concurrent)
    // If one service is slow/overloaded, others are not affected

    const startTime = Date.now();

    // Fire requests to all services simultaneously
    const [userResult, driverResult, pricingResult] = await Promise.allSettled([
        userServiceClient.getProfile(123),
        driverServiceClient.findNearby({ latitude: 40.7128, longitude: -74.0060 }),
        pricingServiceClient.calculateEstimate({
            pickup: { latitude: 40.7128, longitude: -74.0060 },
            destination: { latitude: 40.7589, longitude: -73.9851 }
        })
    ]);

    const duration = Date.now() - startTime;
    console.log(`All services completed in ${duration}ms`);

    console.log('User Service:', userResult.status === 'fulfilled' ? '✅ Success' : '❌ Failed');
    console.log('Driver Service:', driverResult.status === 'fulfilled' ? '✅ Success' : '❌ Failed');
    console.log('Pricing Service:', pricingResult.status === 'fulfilled' ? '✅ Success' : '❌ Failed');
}

// Example 4: Bulkhead status monitoring
async function monitoringExample() {
    console.log('=== Bulkhead Monitoring Example ===');

    const wrapper = new ServiceClientWrapper();

    // Monitor bulkhead status in real-time
    const monitorInterval = setInterval(() => {
        const status = wrapper.getGlobalStatus();
        console.log('Bulkhead Status:');
        console.log(`  Global: ${status.globalBulkhead.currentRequests}/${status.globalBulkhead.maxConcurrency} active, ${status.globalBulkhead.waitingQueue} waiting`);
        console.log(`  User Service: ${status.services.userService.bulkhead.currentRequests}/${status.services.userService.bulkhead.maxConcurrency} active`);
        console.log(`  Driver Service: ${status.services.driverService.bulkhead.currentRequests}/${status.services.driverService.bulkhead.maxConcurrency} active`);
        console.log(`  Pricing Service: ${status.services.pricingService.bulkhead.currentRequests}/${status.services.pricingService.bulkhead.maxConcurrency} active`);
    }, 1000);

    // Generate some load
    const promises = [];
    for (let i = 0; i < 15; i++) {
        promises.push(
            wrapper.execute(async () => {
                await new Promise(resolve => setTimeout(resolve, Math.random() * 3000)); // Random delay 0-3s
                return await userServiceClient.getProfile(123);
            })
        );
    }

    await Promise.all(promises);
    clearInterval(monitorInterval);
    console.log('Load test completed');
}

// Example 5: Custom bulkhead configuration
async function customBulkheadExample() {
    console.log('=== Custom Bulkhead Example ===');

    const { Bulkhead, ResilientHttpClient } = require('./resilience');

    // Create custom bulkhead with different concurrency limits
    const highPriorityBulkhead = new Bulkhead(5);  // Only 5 concurrent for critical operations
    const lowPriorityBulkhead = new Bulkhead(20); // 20 concurrent for background tasks

    // Create custom client with different bulkhead
    const customClient = new ResilientHttpClient('http://user-service:3006', {
        bulkhead: { maxConcurrency: 3 }, // Override default 10
        timeout: 3000
    });

    // Use different bulkheads for different priority levels
    const [highPriorityResult, lowPriorityResult] = await Promise.all([
        highPriorityBulkhead.execute(async () => {
            console.log('High priority request starting...');
            return await customClient.get('/api/users/123/profile');
        }),
        lowPriorityBulkhead.execute(async () => {
            console.log('Low priority request starting...');
            return await userServiceClient.getProfile(456); // Uses default bulkhead
        })
    ]);

    console.log('Both requests completed with different bulkhead limits');
}

// Run examples
async function runBulkheadExamples() {
    try {
        console.log('🚀 Running Bulkhead Pattern Examples\n');

        await basicBulkheadExample();
        console.log('\n' + '='.repeat(50) + '\n');

        await highConcurrencyExample();
        console.log('\n' + '='.repeat(50) + '\n');

        await serviceIsolationExample();
        console.log('\n' + '='.repeat(50) + '\n');

        await monitoringExample();
        console.log('\n' + '='.repeat(50) + '\n');

        await customBulkheadExample();
        console.log('\n' + '='.repeat(50) + '\n');

        console.log('✅ All bulkhead examples completed successfully!');

    } catch (error) {
        console.error('❌ Bulkhead example failed:', error);
    }
}

// Run if called directly
if (require.main === module) {
    runBulkheadExamples();
}

module.exports = {
    basicBulkheadExample,
    highConcurrencyExample,
    serviceIsolationExample,
    monitoringExample,
    customBulkheadExample,
    runBulkheadExamples
};