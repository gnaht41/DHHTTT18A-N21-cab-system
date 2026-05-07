/**
 * SECRET MANAGEMENT EXAMPLES
 * Demonstrates secret manager, rotation, and fallback strategies
 */

const { secretManager, secretProvider } = require('./secret-manager');
const { generateServiceToken, verifyServiceToken } = require('./service-jwt');

// Example 1: Initialize secret manager
async function initializationExample() {
    console.log('=== Secret Manager Initialization ===');

    // Initialize with default secrets
    await secretManager.initialize();

    console.log('✅ Secret manager initialized');

    // Check what secrets we have
    const stats = secretManager.getRotationStats();
    console.log('Total secrets:', stats.totalSecrets);
}

// Example 2: Secret retrieval with caching
async function cachingExample() {
    console.log('\n=== Secret Caching Example ===');

    // First call - should fetch from manager
    console.time('First call');
    const secret1 = await secretProvider.getSecret('booking-service');
    console.timeEnd('First call');
    console.log('Secret length:', secret1.length);

    // Second call - should use cache
    console.time('Cached call');
    const secret2 = await secretProvider.getSecret('booking-service');
    console.timeEnd('Cached call');
    console.log('Secrets match:', secret1 === secret2);
}

// Example 3: Secret rotation
async function rotationExample() {
    console.log('\n=== Secret Rotation Example ===');

    const serviceId = 'booking-service';

    // Get current secret
    const oldSecret = await secretProvider.getSecret(serviceId);
    console.log('Old secret:', oldSecret.substring(0, 16) + '...');

    // Rotate secret
    await secretManager.rotateSecret(serviceId, 'manual-test');
    console.log('✅ Secret rotated');

    // Get new secret (cache should be invalidated)
    const newSecret = await secretProvider.getSecret(serviceId);
    console.log('New secret:', newSecret.substring(0, 16) + '...');
    console.log('Secrets different:', oldSecret !== newSecret);

    // Test JWT with old secret (should fail)
    const oldToken = await generateServiceToken(serviceId, 'user-service');
    const oldVerification = await verifyServiceToken(oldToken);
    console.log('Old token still valid:', oldVerification.valid);

    // Test JWT with new secret (should work)
    const newToken = await generateServiceToken(serviceId, 'user-service');
    const newVerification = await verifyServiceToken(newToken);
    console.log('New token valid:', newVerification.valid);
}

// Example 4: Fallback strategies
async function fallbackExample() {
    console.log('\n=== Fallback Strategies Example ===');

    // Test with valid service
    const validSecret = await secretProvider.getSecret('user-service');
    console.log('✅ Valid service secret retrieved');

    // Test with invalid service (should use fallback)
    try {
        const invalidSecret = await secretProvider.getSecret('nonexistent-service');
        console.log('❌ Should not reach here');
    } catch (error) {
        console.log('✅ Invalid service handled:', error.message);
    }

    // Test emergency secret generation
    console.log('Testing emergency secret generation...');
    // This would normally trigger alerts
    const emergencySecret = secretProvider.generateEmergencySecret('test-service');
    console.log('Emergency secret generated:', emergencySecret.substring(0, 16) + '...');
}

// Example 5: Rotation monitoring
async function monitoringExample() {
    console.log('\n=== Rotation Monitoring Example ===');

    // Register rotation listener
    secretProvider.onSecretRotation('booking-service', (serviceId, secretData) => {
        console.log(`🔄 Rotation detected for ${serviceId}:`);
        console.log(`   Version: ${secretData.version}`);
        console.log(`   Reason: ${secretData.metadata.rotationReason}`);
        console.log(`   Rotated: ${secretData.metadata.rotated}`);
    });

    // Trigger rotation
    await secretManager.rotateSecret('booking-service', 'monitoring-test');

    // Check rotation stats
    const stats = secretManager.getRotationStats();
    console.log('Rotation stats:', stats);
}

// Example 6: Auto-rotation setup
async function autoRotationExample() {
    console.log('\n=== Auto-Rotation Setup Example ===');

    // Start auto-rotation every 2 hours (for demo)
    secretManager.startAutoRotation(2);

    console.log('⏰ Auto-rotation started (2 hours interval)');

    // In production, this would run continuously
    // For demo, stop after 5 seconds
    setTimeout(() => {
        secretManager.stopAutoRotation();
        console.log('⏹️ Auto-rotation stopped');
    }, 5000);
}

// Example 7: Backup and restore
async function backupExample() {
    console.log('\n=== Backup & Restore Example ===');

    // Export secrets
    const backup = await secretManager.exportSecrets();
    console.log('📤 Exported', Object.keys(backup.secrets).length, 'secrets');

    // Simulate disaster - clear secrets
    secretManager.secrets.clear();
    console.log('💥 Disaster simulated - secrets cleared');

    // Restore from backup
    await secretManager.importSecrets(backup);
    console.log('📥 Restored secrets from backup');

    // Verify restoration
    const restoredSecret = await secretProvider.getSecret('booking-service');
    console.log('✅ Secret restored successfully');
}

// Example 8: Health check
async function healthCheckExample() {
    console.log('\n=== Health Check Example ===');

    const health = await secretProvider.healthCheck();
    console.log('Secret health status:');

    Object.entries(health).forEach(([service, status]) => {
        console.log(`  ${service}: ${status.healthy ? '✅' : '❌'} ${status.healthy ? '' : status.error}`);
    });
}

// Example 9: Production integration
async function productionIntegrationExample() {
    console.log('\n=== Production Integration Example ===');

    console.log('🔧 Production setup steps:');
    console.log('1. Replace MockSecretManager with AWS Secrets Manager / Vault');
    console.log('2. Configure proper alerting for emergency secrets');
    console.log('3. Set up monitoring dashboards for rotation stats');
    console.log('4. Implement proper backup/restore procedures');
    console.log('5. Configure auto-rotation based on security policies');

    // Example AWS Secrets Manager integration (pseudo-code)
    console.log('\n📝 AWS Integration Example:');
    console.log(`
  const AWS = require('aws-sdk');
  const secretsManager = new AWS.SecretsManager();

  class AWSSecretManager {
    async getSecret(serviceId) {
      const response = await secretsManager.getSecretValue({
        SecretId: \`microservices/\${serviceId}/jwt-secret\`
      }).promise();
      return response.SecretString;
    }

    async rotateSecret(serviceId) {
      await secretsManager.updateSecret({
        SecretId: \`microservices/\${serviceId}/jwt-secret\`,
        SecretString: crypto.randomBytes(32).toString('hex')
      }).promise();
    }
  }
  `);
}

// Run all examples
async function runSecretManagementExamples() {
    console.log('🔐 Secret Management Examples\n');

    try {
        await initializationExample();
        await cachingExample();
        await rotationExample();
        await fallbackExample();
        await monitoringExample();
        await autoRotationExample();
        await backupExample();
        await healthCheckExample();
        productionIntegrationExample();

        console.log('\n✅ All secret management examples completed successfully!');

    } catch (error) {
        console.error('❌ Secret management example failed:', error);
    }
}

// Run if called directly
if (require.main === module) {
    runSecretManagementExamples().catch(console.error);
}

module.exports = {
    initializationExample,
    cachingExample,
    rotationExample,
    fallbackExample,
    monitoringExample,
    autoRotationExample,
    backupExample,
    healthCheckExample,
    productionIntegrationExample,
    runSecretManagementExamples
};