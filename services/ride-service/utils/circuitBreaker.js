/**
 * CIRCUIT BREAKER PATTERN
 * Prevents cascading failures in distributed systems
 */

const axios = require('axios');

class CircuitBreaker {
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || 5;
        this.resetTimeout = options.resetTimeout || 60000; // 60 seconds
        this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds

        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;

        this.metrics = {
            totalCalls: 0,
            successfulCalls: 0,
            failedCalls: 0,
            rejectedCalls: 0,
            stateChanges: []
        };
    }

    /**
     * Execute function with circuit breaker protection
     */
    async call(fn, fallback = null) {
        this.metrics.totalCalls++;

        // Check if circuit should be reset
        if (this.state === 'OPEN') {
            if (Date.now() >= this.nextAttemptTime) {
                this.setState('HALF_OPEN');
            } else {
                this.metrics.rejectedCalls++;
                if (fallback) {
                    console.warn('⚠️ Circuit OPEN: using fallback');
                    return fallback();
                }
                throw new Error(`Circuit breaker is OPEN (next attempt in ${Math.ceil((this.nextAttemptTime - Date.now()) / 1000)}s)`);
            }
        }

        try {
            const result = await fn();

            // Success in HALF_OPEN state => close circuit
            if (this.state === 'HALF_OPEN') {
                this.successCount++;
                if (this.successCount >= 2) {
                    this.setState('CLOSED');
                    this.failureCount = 0;
                    this.successCount = 0;
                }
            } else {
                // Success in CLOSED state => reset counter
                this.failureCount = 0;
            }

            this.metrics.successfulCalls++;
            return result;

        } catch (error) {
            this.failureCount++;
            this.lastFailureTime = Date.now();
            this.metrics.failedCalls++;

            // Move to OPEN if threshold exceeded
            if (this.failureCount >= this.failureThreshold) {
                this.setState('OPEN');
                this.nextAttemptTime = Date.now() + this.resetTimeout;
            }

            // Use fallback if available
            if (fallback && this.state === 'OPEN') {
                console.warn(`⚠️ Circuit OPEN: using fallback after ${this.failureCount} failures`);
                return fallback();
            }

            throw error;
        }
    }

    /**
     * Change state and log
     */
    setState(newState) {
        if (this.state !== newState) {
            console.log(`🔄 Circuit Breaker: ${this.state} → ${newState}`);
            this.state = newState;
            this.metrics.stateChanges.push({
                from: this.state,
                to: newState,
                timestamp: new Date(),
                reason: this.failureCount >= this.failureThreshold ? 'failure threshold exceeded' : 'recovery'
            });
        }
    }

    /**
     * Get current metrics
     */
    getMetrics() {
        return {
            state: this.state,
            ...this.metrics,
            failureCount: this.failureCount,
            successCount: this.successCount,
            successRate: this.metrics.totalCalls > 0
                ? ((this.metrics.successfulCalls / this.metrics.totalCalls) * 100).toFixed(2) + '%'
                : 'N/A'
        };
    }

    /**
     * Reset circuit breaker
     */
    reset() {
        this.setState('CLOSED');
        this.failureCount = 0;
        this.successCount = 0;
        console.log('🔄 Circuit breaker reset');
    }
}

/**
 * HTTP Client with Circuit Breaker & Retry
 */
class ResilientHttpClient {
    constructor(baseURL, options = {}) {
        this.baseURL = baseURL;
        this.breaker = new CircuitBreaker({
            failureThreshold: options.failureThreshold || 5,
            resetTimeout: options.resetTimeout || 60000
        });
        this.maxRetries = options.maxRetries || 3;
        this.timeout = options.timeout || 5000;
    }

    async request(config, fallback = null) {
        const axiosConfig = {
            ...config,
            baseURL: this.baseURL,
            timeout: this.timeout
        };

        let lastError;
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                return await this.breaker.call(
                    async () => {
                        const response = await axios(axiosConfig);
                        return response.data;
                    },
                    fallback
                );
            } catch (error) {
                lastError = error;
                if (attempt < this.maxRetries) {
                    const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                    console.warn(`⚠️ Attempt ${attempt} failed, retrying in ${backoffMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                }
            }
        }

        throw lastError;
    }

    async get(path, config = {}) {
        return this.request({ ...config, method: 'GET', url: path });
    }

    async post(path, data, config = {}) {
        return this.request({ ...config, method: 'POST', url: path, data });
    }

    async put(path, data, config = {}) {
        return this.request({ ...config, method: 'PUT', url: path, data });
    }

    async delete(path, config = {}) {
        return this.request({ ...config, method: 'DELETE', url: path });
    }

    getMetrics() {
        return this.breaker.getMetrics();
    }
}

module.exports = {
    CircuitBreaker,
    ResilientHttpClient
};