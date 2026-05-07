/**
 * REDIS CACHE UTILITY
 * JWT token caching to reduce DB hits
 */

const redis = require('redis');
const { promisify } = require('util');

class RedisCache {
    constructor(options = {}) {
        this.client = redis.createClient({
            host: options.host || process.env.REDIS_HOST || 'localhost',
            port: options.port || process.env.REDIS_PORT || 6379,
            retry_strategy: (options) => {
                if (options.error && options.error.code === 'ECONNREFUSED') {
                    return new Error('Redis connection refused');
                }
                if (options.total_retry_time > 1000 * 60 * 60) {
                    return new Error('Redis retry time exhausted');
                }
                if (options.attempt > 10) {
                    return undefined;
                }
                return Math.min(options.attempt * 100, 3000);
            }
        });

        // Promisify Redis methods
        this.getAsync = promisify(this.client.get).bind(this.client);
        this.setAsync = promisify(this.client.set).bind(this.client);
        this.setexAsync = promisify(this.client.setex).bind(this.client);
        this.delAsync = promisify(this.client.del).bind(this.client);
        this.existsAsync = promisify(this.client.exists).bind(this.client);
        this.ttlAsync = promisify(this.client.ttl).bind(this.client);

        this.client.on('error', (err) => {
            console.error('Redis client error:', err);
        });

        this.client.on('connect', () => {
            console.log('✅ Redis client connected');
        });
    }

    /**
     * Get value from cache
     */
    async get(key) {
        try {
            const value = await this.getAsync(key);
            if (value) {
                try {
                    return JSON.parse(value);
                } catch (e) {
                    return value; // Return as string if not JSON
                }
            }
            return null;
        } catch (err) {
            console.error(`Redis GET error (${key}):`, err);
            return null; // Graceful degradation
        }
    }

    /**
     * Set value with TTL
     */
    async set(key, value, ttlSeconds = 3600) {
        try {
            const serialized = typeof value === 'string' ? value : JSON.stringify(value);
            await this.setexAsync(key, ttlSeconds, serialized);
            return true;
        } catch (err) {
            console.error(`Redis SET error (${key}):`, err);
            return false;
        }
    }

    /**
     * Delete key
     */
    async delete(key) {
        try {
            await this.delAsync(key);
            return true;
        } catch (err) {
            console.error(`Redis DEL error (${key}):`, err);
            return false;
        }
    }

    /**
     * Check if key exists
     */
    async exists(key) {
        try {
            const result = await this.existsAsync(key);
            return result === 1;
        } catch (err) {
            console.error(`Redis EXISTS error (${key}):`, err);
            return false;
        }
    }

    /**
     * Get remaining TTL
     */
    async getTTL(key) {
        try {
            const ttl = await this.ttlAsync(key);
            return ttl; // -1 if no expiry, -2 if not exists
        } catch (err) {
            console.error(`Redis TTL error (${key}):`, err);
            return -2;
        }
    }

    /**
     * Close connection
     */
    close() {
        this.client.quit(() => {
            console.log('Redis client closed');
        });
    }
}

module.exports = RedisCache;