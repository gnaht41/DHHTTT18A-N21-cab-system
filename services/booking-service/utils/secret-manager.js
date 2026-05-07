/**
 * SECRET MANAGER
 * Mock implementation for service JWT secret management
 * In production, replace with AWS Secrets Manager, Vault, etc.
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// Mock secret store (in production, use actual secret manager)
class MockSecretManager {
    constructor() {
        this.secrets = new Map();
        this.secretVersions = new Map();
        this.rotationCallbacks = [];
        this.rotationInterval = null;
    }

    /**
     * Initialize with default secrets
     */
    async initialize() {
        const defaultSecrets = {
            'booking-service': process.env.BOOKING_SERVICE_SECRET || this.generateSecret(),
            'user-service': process.env.USER_SERVICE_SECRET || this.generateSecret(),
            'driver-service': process.env.DRIVER_SERVICE_SECRET || this.generateSecret(),
            'ride-service': process.env.RIDE_SERVICE_SECRET || this.generateSecret(),
            'payment-service': process.env.PAYMENT_SERVICE_SECRET || this.generateSecret(),
            'pricing-service': process.env.PRICING_SERVICE_SECRET || this.generateSecret(),
            'notification-service': process.env.NOTIFICATION_SERVICE_SECRET || this.generateSecret(),
            'auth-service': process.env.AUTH_SERVICE_SECRET || this.generateSecret(),
            'api-gateway': process.env.API_GATEWAY_SECRET || this.generateSecret()
        };

        for (const [serviceId, secret] of Object.entries(defaultSecrets)) {
            await this.storeSecret(serviceId, secret);
        }

        console.log('✅ Secret Manager initialized with', this.secrets.size, 'secrets');
    }

    /**
     * Generate a secure random secret
     */
    generateSecret(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Store secret with versioning
     */
    async storeSecret(serviceId, secret, metadata = {}) {
        const version = Date.now().toString();
        const secretData = {
            secret,
            version,
            createdAt: new Date().toISOString(),
            metadata: {
                rotated: false,
                rotationReason: null,
                ...metadata
            }
        };

        this.secrets.set(serviceId, secretData);
        this.secretVersions.set(serviceId, version);

        // Notify rotation callbacks
        this.notifyRotationCallbacks(serviceId, secretData);

        return version;
    }

    /**
     * Retrieve current secret
     */
    async getSecret(serviceId) {
        const secretData = this.secrets.get(serviceId);
        if (!secretData) {
            throw new Error(`Secret not found for service: ${serviceId}`);
        }
        return secretData.secret;
    }

    /**
     * Get secret with version info
     */
    async getSecretWithMetadata(serviceId) {
        const secretData = this.secrets.get(serviceId);
        if (!secretData) {
            throw new Error(`Secret not found for service: ${serviceId}`);
        }
        return { ...secretData };
    }

    /**
     * Rotate secret for a service
     */
    async rotateSecret(serviceId, reason = 'scheduled') {
        const oldSecret = await this.getSecret(serviceId);
        const newSecret = this.generateSecret();

        await this.storeSecret(serviceId, newSecret, {
            rotated: true,
            rotationReason: reason,
            previousSecret: oldSecret
        });

        console.log(`🔄 Rotated secret for ${serviceId} (${reason})`);
        return newSecret;
    }

    /**
     * Bulk rotate all secrets
     */
    async rotateAllSecrets(reason = 'bulk') {
        const services = Array.from(this.secrets.keys());
        const results = [];

        for (const serviceId of services) {
            try {
                const newSecret = await this.rotateSecret(serviceId, reason);
                results.push({ serviceId, success: true, newSecret: newSecret.substring(0, 8) + '...' });
            } catch (error) {
                results.push({ serviceId, success: false, error: error.message });
            }
        }

        return results;
    }

    /**
     * Register rotation callback
     */
    onSecretRotation(callback) {
        this.rotationCallbacks.push(callback);
    }

    /**
     * Notify rotation callbacks
     */
    notifyRotationCallbacks(serviceId, secretData) {
        this.rotationCallbacks.forEach(callback => {
            try {
                callback(serviceId, secretData);
            } catch (error) {
                console.error('Rotation callback error:', error);
            }
        });
    }

    /**
     * Start automatic rotation
     */
    startAutoRotation(intervalHours = 24) {
        const intervalMs = intervalHours * 60 * 60 * 1000;

        this.rotationInterval = setInterval(async () => {
            console.log('🔄 Starting scheduled secret rotation...');
            await this.rotateAllSecrets('scheduled');
        }, intervalMs);

        console.log(`⏰ Auto-rotation enabled every ${intervalHours} hours`);
    }

    /**
     * Stop automatic rotation
     */
    stopAutoRotation() {
        if (this.rotationInterval) {
            clearInterval(this.rotationInterval);
            this.rotationInterval = null;
            console.log('⏹️ Auto-rotation stopped');
        }
    }

    /**
     * Export secrets for backup
     */
    async exportSecrets() {
        const exportData = {
            exportedAt: new Date().toISOString(),
            secrets: {}
        };

        for (const [serviceId, secretData] of this.secrets) {
            exportData.secrets[serviceId] = {
                ...secretData,
                secret: secretData.secret // Include full secret for backup
            };
        }

        return exportData;
    }

    /**
     * Import secrets from backup
     */
    async importSecrets(exportData) {
        for (const [serviceId, secretData] of Object.entries(exportData.secrets)) {
            await this.storeSecret(serviceId, secretData.secret, {
                ...secretData.metadata,
                imported: true,
                importedAt: new Date().toISOString()
            });
        }

        console.log(`📥 Imported ${Object.keys(exportData.secrets).length} secrets`);
    }

    /**
     * Get rotation statistics
     */
    getRotationStats() {
        const stats = {
            totalSecrets: this.secrets.size,
            rotatedSecrets: 0,
            rotationsByService: {},
            lastRotation: null
        };

        for (const [serviceId, secretData] of this.secrets) {
            if (secretData.metadata.rotated) {
                stats.rotatedSecrets++;
                stats.rotationsByService[serviceId] = (stats.rotationsByService[serviceId] || 0) + 1;

                if (!stats.lastRotation || secretData.createdAt > stats.lastRotation) {
                    stats.lastRotation = secretData.createdAt;
                }
            }
        }

        return stats;
    }
}

// Global secret manager instance
const secretManager = new MockSecretManager();

/**
 * SECRET PROVIDER
 * Handles secret caching, rotation, and fallback strategies
 */
class SecretProvider {
    constructor(secretManager) {
        this.secretManager = secretManager;
        this.cache = new Map();
        this.cacheExpiry = new Map();
        this.fallbackSecrets = new Map();
        this.rotationListeners = new Map();

        // Register for rotation notifications
        this.secretManager.onSecretRotation((serviceId, secretData) => {
            this.handleSecretRotation(serviceId, secretData);
        });
    }

    /**
     * Get secret with caching and fallback
     */
    async getSecret(serviceId, options = {}) {
        const {
            useCache = true,
            cacheTtl = 5 * 60 * 1000, // 5 minutes
            fallbackToEnv = true
        } = options;

        try {
            // Check cache first
            if (useCache && this.isCacheValid(serviceId, cacheTtl)) {
                return this.cache.get(serviceId);
            }

            // Get from secret manager
            const secret = await this.secretManager.getSecret(serviceId);

            // Cache the secret
            if (useCache) {
                this.cache.set(serviceId, secret);
                this.cacheExpiry.set(serviceId, Date.now() + cacheTtl);
            }

            return secret;

        } catch (error) {
            console.warn(`Failed to get secret for ${serviceId}:`, error.message);

            // Try fallback strategies
            return await this.getFallbackSecret(serviceId, fallbackToEnv);
        }
    }

    /**
     * Check if cache is still valid
     */
    isCacheValid(serviceId, ttl) {
        const expiry = this.cacheExpiry.get(serviceId);
        return expiry && Date.now() < expiry;
    }

    /**
     * Get fallback secret
     */
    async getFallbackSecret(serviceId, fallbackToEnv) {
        // Try cached fallback first
        if (this.fallbackSecrets.has(serviceId)) {
            console.log(`Using cached fallback secret for ${serviceId}`);
            return this.fallbackSecrets.get(serviceId);
        }

        // Try environment variable
        if (fallbackToEnv) {
            const envSecret = this.getEnvFallback(serviceId);
            if (envSecret) {
                console.log(`Using environment fallback for ${serviceId}`);
                this.fallbackSecrets.set(serviceId, envSecret);
                return envSecret;
            }
        }

        // Generate emergency secret
        const emergencySecret = this.generateEmergencySecret(serviceId);
        console.warn(`Using emergency secret for ${serviceId}`);
        this.fallbackSecrets.set(serviceId, emergencySecret);
        return emergencySecret;
    }

    /**
     * Get environment variable fallback
     */
    getEnvFallback(serviceId) {
        const envKey = `${serviceId.toUpperCase().replace('-', '_')}_SECRET`;
        return process.env[envKey];
    }

    /**
     * Generate emergency secret (last resort)
     */
    generateEmergencySecret(serviceId) {
        const crypto = require('crypto');
        const emergency = crypto.randomBytes(32).toString('hex');
        console.error(`🚨 EMERGENCY: Generated temporary secret for ${serviceId}`);
        console.error(`   This should be replaced with proper secret ASAP`);

        // In production, this should trigger alerts
        this.triggerEmergencyAlert(serviceId, emergency);

        return emergency;
    }

    /**
     * Handle secret rotation
     */
    handleSecretRotation(serviceId, secretData) {
        console.log(`🔄 Secret rotated for ${serviceId}, invalidating cache`);

        // Clear cache to force refresh
        this.cache.delete(serviceId);
        this.cacheExpiry.delete(serviceId);

        // Notify listeners
        const listeners = this.rotationListeners.get(serviceId) || [];
        listeners.forEach(callback => {
            try {
                callback(serviceId, secretData);
            } catch (error) {
                console.error('Rotation listener error:', error);
            }
        });
    }

    /**
     * Register rotation listener
     */
    onSecretRotation(serviceId, callback) {
        if (!this.rotationListeners.has(serviceId)) {
            this.rotationListeners.set(serviceId, []);
        }
        this.rotationListeners.get(serviceId).push(callback);
    }

    /**
     * Force refresh secret cache
     */
    async refreshSecret(serviceId) {
        this.cache.delete(serviceId);
        this.cacheExpiry.delete(serviceId);
        return await this.getSecret(serviceId, { useCache: false });
    }

    /**
     * Get secret metadata
     */
    async getSecretMetadata(serviceId) {
        try {
            return await this.secretManager.getSecretWithMetadata(serviceId);
        } catch (error) {
            return {
                error: error.message,
                fallback: true,
                source: 'emergency'
            };
        }
    }

    /**
     * Trigger emergency alert (mock)
     */
    triggerEmergencyAlert(serviceId, secret) {
        // In production, send alerts to monitoring system
        console.error(`🚨 CRITICAL: Emergency secret generated for ${serviceId}`);
        console.error(`   Immediate action required to set proper secret`);

        // Could send email, Slack, PagerDuty, etc.
        // sendAlert('emergency-secret-generated', { serviceId, secret: secret.substring(0, 8) });
    }

    /**
     * Health check
     */
    async healthCheck() {
        const services = ['booking-service', 'user-service', 'driver-service'];
        const results = {};

        for (const serviceId of services) {
            try {
                const secret = await this.getSecret(serviceId, { useCache: false });
                const metadata = await this.getSecretMetadata(serviceId);

                results[serviceId] = {
                    healthy: true,
                    hasSecret: !!secret,
                    cached: this.cache.has(serviceId),
                    metadata
                };
            } catch (error) {
                results[serviceId] = {
                    healthy: false,
                    error: error.message
                };
            }
        }

        return results;
    }
}

// Global secret provider instance
const secretProvider = new SecretProvider(secretManager);

module.exports = {
    MockSecretManager,
    SecretProvider,
    secretManager,
    secretProvider
};