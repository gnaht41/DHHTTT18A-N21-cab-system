#!/usr/bin/env node

/**
 * SECRET MANAGEMENT VALIDATION SCRIPT
 * Validates the complete secret management implementation
 */

const { secretManager, secretProvider } = require('./utils/secret-manager');
const { generateServiceToken, verifyServiceToken } = require('./utils/service-jwt');

async function validateSecretManager() {
    console.log('🔍 Validating Secret Manager Implementation...\n');

    let testsPassed = 0;
    let totalTests = 0;

    function test(name, condition, details = '') {
        totalTests++;
        if (condition) {
            console.log(`✅ ${name}`);
            testsPassed++;
        } else {
            console.log(`❌ ${name}${details ? ': ' + details : ''}`);
        }
    }

    try {
        // Test 1: Initialization
        console.log('1. Testing Initialization...');
        await secretManager.initialize();
        test('Secret manager initializes successfully', true);

        // Test 2: Secret retrieval
        console.log('\n2. Testing Secret Retrieval...');
        const secret = await secretProvider.getSecret('booking-service');
        test('Can retrieve secret for booking-service', secret && typeof secret === 'string');
        test('Secret has reasonable length', secret && secret.length >= 32);

        // Test 3: Caching
        console.log('\n3. Testing Caching...');
        const secret1 = await secretProvider.getSecret('booking-service');
        const secret2 = await secretProvider.getSecret('booking-service');
        test('Caching works (secrets identical)', secret1 === secret2);

        // Test 4: Rotation
        console.log('\n4. Testing Rotation...');
        const oldSecret = await secretProvider.getSecret('booking-service');
        await secretManager.rotateSecret('booking-service', 'test-rotation');
        const newSecret = await secretProvider.getSecret('booking-service');
        test('Rotation changes secret', oldSecret !== newSecret);

        // Test 5: JWT Integration
        console.log('\n5. Testing JWT Integration...');
        const token = await generateServiceToken('booking-service', 'user-service');
        test('Can generate service token', token && typeof token === 'string');

        const verification = await verifyServiceToken(token);
        test('Token verification succeeds', verification.valid === true);
        test('Token contains correct service info', verification.fromService === 'booking-service');
        test('Token contains correct target service', verification.toService === 'user-service');

        // Test 6: Old token invalidation
        console.log('\n6. Testing Token Invalidation...');
        const oldToken = await generateServiceToken('booking-service', 'user-service');
        await secretManager.rotateSecret('booking-service', 'invalidate-test');
        const oldVerification = await verifyServiceToken(oldToken);
        test('Old token invalidated after rotation', !oldVerification.valid);

        // Test 7: Fallback strategies
        console.log('\n7. Testing Fallback Strategies...');
        const invalidSecret = await secretProvider.getSecret('nonexistent-service');
        test('Nonexistent service handled gracefully', invalidSecret && typeof invalidSecret === 'string');

        // Test 8: Emergency secret generation
        console.log('\n8. Testing Emergency Secrets...');
        const emergencySecret = secretProvider.generateEmergencySecret('emergency-test');
        test('Emergency secret generated', emergencySecret && typeof emergencySecret === 'string');
        test('Emergency secret has proper length', emergencySecret.length >= 32);

        // Test 9: Health checks
        console.log('\n9. Testing Health Checks...');
        const health = await secretProvider.healthCheck();
        test('Health check returns object', typeof health === 'object');
        test('Health check includes booking-service', 'booking-service' in health);

        // Test 10: Rotation stats
        console.log('\n10. Testing Rotation Statistics...');
        const stats = secretManager.getRotationStats();
        test('Rotation stats available', typeof stats === 'object');
        test('Stats include totalSecrets', 'totalSecrets' in stats);
        test('Stats include rotation data', 'rotationsByService' in stats);

        // Test 11: Backup/Restore
        console.log('\n11. Testing Backup/Restore...');
        const backup = await secretManager.exportSecrets();
        test('Backup export works', backup && backup.secrets);

        // Clear and restore
        secretManager.secrets.clear();
        await secretManager.importSecrets(backup);
        const restoredSecret = await secretProvider.getSecret('booking-service');
        test('Backup/restore works', restoredSecret && typeof restoredSecret === 'string');

        // Test 12: Auto-rotation
        console.log('\n12. Testing Auto-Rotation...');
        secretManager.startAutoRotation(1); // 1 hour for test
        test('Auto-rotation starts', secretManager.rotationInterval !== null);
        secretManager.stopAutoRotation();
        test('Auto-rotation stops', secretManager.rotationInterval === null);
        let callbackCalled = false;
        secretProvider.onSecretRotation('booking-service', () => {
            callbackCalled = true;
        });

        // Rotate and check callback
        await secretManager.rotateSecret('booking-service', 'callback-test');
        test('Rotation callback triggered', callbackCalled);

        console.log(`\n📊 Test Results: ${testsPassed}/${totalTests} tests passed`);

        if (testsPassed === totalTests) {
            console.log('🎉 All secret management tests passed!');
            return true;
        } else {
            console.log('⚠️ Some tests failed. Please review the implementation.');
            return false;
        }

    } catch (error) {
        console.error('❌ Validation failed with error:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Performance test
async function performanceTest() {
    console.log('\n⚡ Running Performance Tests...\n');

    const iterations = 100;
    const serviceId = 'booking-service';

    // Test secret retrieval performance
    console.time('Secret retrieval (100 iterations)');
    for (let i = 0; i < iterations; i++) {
        await secretProvider.getSecret(serviceId);
    }
    console.timeEnd('Secret retrieval (100 iterations)');

    // Test JWT generation/verification performance
    console.time('JWT operations (100 iterations)');
    for (let i = 0; i < iterations; i++) {
        const token = await generateServiceToken('booking-service', 'user-service');
        await verifyServiceToken(token);
    }
    console.timeEnd('JWT operations (100 iterations)');

    console.log('✅ Performance tests completed');
}

// Main validation
async function main() {
    console.log('🚀 Secret Management Validation Suite\n');
    console.log('='.repeat(50));

    const success = await validateSecretManager();

    if (success) {
        await performanceTest();
    }

    console.log('\n' + '='.repeat(50));
    if (success) {
        console.log('🎯 Secret Management Implementation: VALIDATED ✅');
        process.exit(0);
    } else {
        console.log('💥 Secret Management Implementation: FAILED ❌');
        process.exit(1);
    }
}

// Run validation
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Validation script failed:', error);
        process.exit(1);
    });
}

module.exports = { validateSecretManager, performanceTest };