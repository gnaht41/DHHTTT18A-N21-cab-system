/**
 * RESILIENCE UTILITIES
 * Provides retry logic, circuit breaker, and bulkhead for inter-service communication
 */

const axios = require('axios');

/**
 * Bulkhead Pattern - Limits concurrent requests to prevent cascading failures
 */
class Bulkhead {
    constructor(maxConcurrency = 10) {
        this.maxConcurrency = maxConcurrency;
        this.currentRequests = 0;
        this.waitingQueue = [];
        this.isShutdown = false;
    }

    /**
     * Execute function with concurrency limit
     */
    async execute(fn) {
        if (this.isShutdown) {
            throw new Error('Bulkhead is shutdown');
        }

        return new Promise((resolve, reject) => {
            const task = async () => {
                this.currentRequests++;
                try {
                    const result = await fn();
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    this.currentRequests--;
                    this.processQueue();
                }
            };

            if (this.currentRequests < this.maxConcurrency) {
                task();
            } else {
                this.waitingQueue.push({ task, resolve, reject });
            }
        });
    }

    /**
     * Process waiting queue
     */
    processQueue() {
        if (this.waitingQueue.length > 0 && this.currentRequests < this.maxConcurrency) {
            const { task } = this.waitingQueue.shift();
            task();
        }
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            maxConcurrency: this.maxConcurrency,
            currentRequests: this.currentRequests,
            waitingQueue: this.waitingQueue.length,
            utilization: this.currentRequests / this.maxConcurrency
        };
    }

    /**
     * Shutdown bulkhead - reject all waiting requests
     */
    shutdown() {
        this.isShutdown = true;
        this.waitingQueue.forEach(({ reject }) => {
            reject(new Error('Bulkhead shutdown'));
        });
        this.waitingQueue = [];
    }
}

/**
 * Retry Helper with Exponential Backoff
 */
class RetryHelper {
    constructor(options = {}) {
        this.maxRetries = options.maxRetries || 3;
        this.baseDelay = options.baseDelay || 1000; // 1 second
        this.maxDelay = options.maxDelay || 30000; // 30 seconds
        this.backoffMultiplier = options.backoffMultiplier || 2;
        this.retryableErrors = options.retryableErrors || [500, 502, 503, 504, 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'];
    }

    /**
     * Check if error is retryable
     */
    isRetryableError(error) {
        if (!error) return false;

        // Network errors
        if (error.code && this.retryableErrors.includes(error.code)) {
            return true;
        }

        // HTTP errors
        if (error.response && this.retryableErrors.includes(error.response.status)) {
            return true;
        }

        // Timeout errors
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            return true;
        }

        return false;
    }

    /**
     * Calculate delay for retry attempt
     */
    calculateDelay(attempt) {
        const delay = this.baseDelay * Math.pow(this.backoffMultiplier, attempt - 1);
        return Math.min(delay, this.maxDelay);
    }

    /**
     * Execute function with retry logic
     */
    async execute(fn, options = {}) {
        const maxRetries = options.maxRetries || this.maxRetries;
        let lastError;

        for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;

                if (attempt > maxRetries || !this.isRetryableError(error)) {
                    throw error;
                }

                const delay = this.calculateDelay(attempt);
                console.log(`[Retry] Attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms:`, error.message);

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError;
    }
}

/**
 * Circuit Breaker States
 */
const CIRCUIT_STATES = {
    CLOSED: 'CLOSED',       // Normal operation
    OPEN: 'OPEN',          // Failing, reject calls
    HALF_OPEN: 'HALF_OPEN' // Testing if service recovered
};

/**
 * Circuit Breaker Class
 */
class CircuitBreaker {
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || 5; // Fail after 5 consecutive failures
        this.recoveryTimeout = options.recoveryTimeout || 60000; // 1 minute before trying again
        this.monitoringPeriod = options.monitoringPeriod || 60000; // 1 minute window for success rate
        this.successThreshold = options.successThreshold || 3; // Need 3 successes to close circuit

        this.state = CIRCUIT_STATES.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.lastFailureTime = null;
        this.callCount = 0;
        this.failureCount = 0;
        this.lastCallTime = Date.now();

        // Reset counters periodically
        setInterval(() => this.resetCounters(), this.monitoringPeriod);
    }

    /**
     * Reset failure/success counters
     */
    resetCounters() {
        this.callCount = 0;
        this.failureCount = 0;
        this.lastCallTime = Date.now();
    }

    /**
     * Check if circuit should attempt call
     */
    canExecute() {
        switch (this.state) {
            case CIRCUIT_STATES.CLOSED:
                return true;

            case CIRCUIT_STATES.OPEN:
                if (Date.now() - this.lastFailureTime >= this.recoveryTimeout) {
                    this.state = CIRCUIT_STATES.HALF_OPEN;
                    this.successes = 0;
                    console.log('[CircuitBreaker] Moving to HALF_OPEN state');
                    return true;
                }
                return false;

            case CIRCUIT_STATES.HALF_OPEN:
                return true;

            default:
                return false;
        }
    }

    /**
     * Record successful call
     */
    recordSuccess() {
        this.callCount++;
        this.failures = 0;

        if (this.state === CIRCUIT_STATES.HALF_OPEN) {
            this.successes++;
            if (this.successes >= this.successThreshold) {
                this.state = CIRCUIT_STATES.CLOSED;
                console.log('[CircuitBreaker] Circuit CLOSED - service recovered');
            }
        }
    }

    /**
     * Record failed call
     */
    recordFailure() {
        this.callCount++;
        this.failureCount++;
        this.failures++;
        this.lastFailureTime = Date.now();

        if (this.state === CIRCUIT_STATES.HALF_OPEN) {
            this.state = CIRCUIT_STATES.OPEN;
            console.log('[CircuitBreaker] Circuit OPEN - service still failing');
        } else if (this.failures >= this.failureThreshold) {
            this.state = CIRCUIT_STATES.OPEN;
            console.log(`[CircuitBreaker] Circuit OPEN - ${this.failures} consecutive failures`);
        }
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            callCount: this.callCount,
            failureCount: this.failureCount,
            failureRate: this.callCount > 0 ? (this.failureCount / this.callCount) * 100 : 0
        };
    }

    /**
     * Execute function with circuit breaker protection
     */
    async execute(fn, fallbackFn = null) {
        if (!this.canExecute()) {
            console.log('[CircuitBreaker] Circuit OPEN - call rejected');
            if (fallbackFn) {
                return await fallbackFn();
            }
            throw new Error('Circuit breaker is OPEN');
        }

        try {
            const result = await fn();
            this.recordSuccess();
            return result;
        } catch (error) {
            this.recordFailure();
            if (fallbackFn) {
                console.log('[CircuitBreaker] Executing fallback due to failure');
                return await fallbackFn();
            }
            throw error;
        }
    }
}

/**
 * Resilient HTTP Client with Retry, Circuit Breaker, and Bulkhead
 */
class ResilientHttpClient {
    constructor(baseURL, options = {}) {
        this.baseURL = baseURL;
        this.client = axios.create({
            baseURL,
            timeout: options.timeout || 5000,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
        });

        this.retryHelper = new RetryHelper(options.retry);
        this.circuitBreaker = new CircuitBreaker(options.circuitBreaker);
        this.bulkhead = new Bulkhead(options.bulkhead?.maxConcurrency || 10);
    }

    /**
     * Execute HTTP request with resilience (Bulkhead → Circuit Breaker → Retry)
     */
    async request(config, fallbackFn = null) {
        const executeRequest = async () => {
            const response = await this.client.request(config);
            return response.data;
        };

        // Bulkhead limits concurrency, then Circuit Breaker + Retry
        return await this.bulkhead.execute(async () => {
            return await this.circuitBreaker.execute(
                () => this.retryHelper.execute(executeRequest),
                fallbackFn
            );
        });
    }

    /**
     * GET request
     */
    async get(url, config = {}, fallbackFn = null) {
        return this.request({ ...config, method: 'get', url }, fallbackFn);
    }

    /**
     * POST request
     */
    async post(url, data = null, config = {}, fallbackFn = null) {
        return this.request({ ...config, method: 'post', url, data }, fallbackFn);
    }

    /**
     * PUT request
     */
    async put(url, data = null, config = {}, fallbackFn = null) {
        return this.request({ ...config, method: 'put', url, data }, fallbackFn);
    }

    /**
     * DELETE request
     */
    async delete(url, config = {}, fallbackFn = null) {
        return this.request({ ...config, method: 'delete', url }, fallbackFn);
    }

    /**
     * HEAD request
     */
    async head(url, config = {}, fallbackFn = null) {
        return this.request({ ...config, method: 'head', url }, fallbackFn);
    }

    /**
     * Get resilience status (Circuit Breaker + Bulkhead)
     */
    getStatus() {
        return {
            circuitBreaker: this.circuitBreaker.getStatus(),
            bulkhead: this.bulkhead.getStatus()
        };
    }
}

module.exports = {
    RetryHelper,
    CircuitBreaker,
    Bulkhead,
    ResilientHttpClient,
    CIRCUIT_STATES
};