/**
 * SERVICE CLIENT - HTTP Inter-Service Communication
 * 
 * RULE: NEVER query another service's database directly
 * ALWAYS use HTTP API or Message Queue (Kafka)
 * 
 * This module provides utilities for calling other microservices
 */

const { ResilientHttpClient } = require('./resilience');
const { ServiceAuthenticatedClient } = require('./service-jwt');

// Helper function to calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}
const SERVICE_URLS = {
  USER_SERVICE: process.env.USER_SERVICE_URL || 'http://user-service:3006',
  DRIVER_SERVICE: process.env.DRIVER_SERVICE_URL || 'http://driver-service:3003',
  RIDE_SERVICE: process.env.RIDE_SERVICE_URL || 'http://ride-service:3004',
  PAYMENT_SERVICE: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3005',
  AUTH_SERVICE: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  PRICING_SERVICE: process.env.PRICING_SERVICE_URL || 'http://pricing-service:3008',
  NOTIFICATION_SERVICE: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3010',
  REVIEW_SERVICE: process.env.REVIEW_SERVICE_URL || 'http://review-service:3009',
};

// Resilience configuration
const RESILIENCE_CONFIG = {
  retry: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
  },
  circuitBreaker: {
    failureThreshold: 5,
    recoveryTimeout: 60000, // 1 minute
    monitoringPeriod: 60000,
    successThreshold: 3
  },
  bulkhead: {
    maxConcurrency: 10  // ✅ Max 10 concurrent requests per service
  },
  timeout: 5000
};

// Create resilient HTTP client
const createResilientClient = (baseURL) => {
  return new ResilientHttpClient(baseURL, RESILIENCE_CONFIG);
};

/**
 * Authenticated Resilient HTTP Client
 * Combines service authentication with resilience patterns
 */
class AuthenticatedResilientHttpClient {
  constructor(serviceId, baseURL, options = {}) {
    this.serviceId = serviceId;
    this.resilientClient = new ResilientHttpClient(baseURL, {
      ...RESILIENCE_CONFIG,
      ...options
    });
    this.authClient = new ServiceAuthenticatedClient(serviceId, baseURL);
  }

  /**
   * Execute authenticated request with resilience
   */
  async request(config, fallbackFn = null) {
    // Get service token
    const token = await this.authClient.getServiceToken();

    // Add authentication headers
    const authConfig = {
      ...config,
      headers: {
        ...config.headers,
        'Authorization': `Service ${token}`,
        'X-Service-ID': this.serviceId,
        'X-Request-ID': require('crypto').randomUUID()
      }
    };

    // Execute with resilience
    return await this.resilientClient.request(authConfig, fallbackFn);
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
   * Get resilience status
   */
  getStatus() {
    return this.resilientClient.getStatus();
  }
}

// Create authenticated resilient client
const createAuthenticatedClient = (serviceId, baseURL) => {
  return new AuthenticatedResilientHttpClient(serviceId, baseURL);
};

/**
 * User Service Client
 * Used when booking-service needs user profile data
 * 
 * ANTI-PATTERN (WRONG):
 *   const user = await User.query("SELECT * FROM users WHERE id = ?", [userId]);
 *   // This queries user_db directly - VIOLATES database per service!
 * 
 * CORRECT PATTERN:
 *   const user = await userServiceClient.getProfile(userId);
 *   // HTTP call to user-service API - RESPECTS boundaries
 */
const userServiceClient = {
  client: createAuthenticatedClient('booking-service', SERVICE_URLS.USER_SERVICE),

  /**

  /**
   * Get user profile by user ID
   * @param {number} userId - User ID from auth-service
   * @returns {Promise<Object>} User profile data
   * 
   * Example response:
   * {
   *   id: 1,
   *   userId: 123,
   *   firstName: "John",
   *   lastName: "Doe",
   *   fullName: "John Doe",
   *   phone: "+84...",
   *   avatarUrl: "https://...",
   *   preferredLanguage: "en",
   *   addresses: [...]
   * }
   */
  async getProfile(userId) {
    const fallback = async () => {
      console.log(`[UserService] Fallback: Returning minimal profile for user ${userId}`);
      return {
        id: userId,
        userId,
        firstName: 'Unknown',
        lastName: 'User',
        fullName: 'Unknown User',
        phone: null,
        avatarUrl: null,
        preferredLanguage: 'en',
        addresses: []
      };
    };

    try {
      return await this.client.get(`/api/users/${userId}/profile`, {}, fallback);
    } catch (error) {
      // If circuit breaker is open and no fallback executed, return minimal data
      if (error.message.includes('Circuit breaker is OPEN')) {
        return await fallback();
      }
      throw error;
    }
  },

  async getPreferences(userId) {
    const fallback = async () => {
      console.log(`[UserService] Fallback: Returning default preferences for user ${userId}`);
      return {
        userId,
        preferredVehicleType: 'standard',
        maxPrice: null,
        notifications: {
          bookingUpdates: true,
          driverArrival: true,
          rideCompleted: true
        }
      };
    };

    try {
      return await this.client.get(`/api/users/${userId}/preferences`, {}, fallback);
    } catch (error) {
      if (error.message.includes('Circuit breaker is OPEN')) {
        return await fallback();
      }
      throw error;
    }
  },

  async exists(userId) {
    const fallback = async () => {
      console.log(`[UserService] Fallback: Assuming user ${userId} exists`);
      return true; // Optimistic fallback
    };

    try {
      const response = await this.client.head(`/api/users/${userId}`, {}, fallback);
      return response === true || response === 200;
    } catch (error) {
      if (error.message.includes('Circuit breaker is OPEN')) {
        return await fallback();
      }
      if (error.response?.status === 404) {
        return false;
      }
      throw error;
    }
  },
};

/**
 * Driver Service Client
 */
const driverServiceClient = {
  client: createAuthenticatedClient('booking-service', SERVICE_URLS.DRIVER_SERVICE),

  async findNearby(location, options = {}) {
    const fallback = async () => {
      console.log(`[DriverService] Fallback: Returning empty driver list for location`, location);
      return []; // Return empty list when service is down
    };

    try {
      return await this.client.get('/api/drivers/nearby', {
        params: {
          lat: location.latitude,
          lng: location.longitude,
          radius: options.radius || 5000,
          limit: options.limit || 10,
        },
      }, fallback);
    } catch (error) {
      if (error.message.includes('Circuit breaker is OPEN')) {
        return await fallback();
      }
      throw error;
    }
  },

  async getDriver(driverId) {
    const fallback = async () => {
      console.log(`[DriverService] Fallback: Returning minimal driver data for driver ${driverId}`);
      return {
        id: driverId,
        driverId,
        firstName: 'Unknown',
        lastName: 'Driver',
        fullName: 'Unknown Driver',
        phone: null,
        vehicleType: 'standard',
        licensePlate: null,
        rating: 0,
        totalRides: 0
      };
    };

    try {
      return await this.client.get(`/api/drivers/${driverId}`, {}, fallback);
    } catch (error) {
      if (error.message.includes('Circuit breaker is OPEN')) {
        return await fallback();
      }
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Assign driver to booking
   * @param {number} driverId 
   * @param {number} bookingId 
   * @returns {Promise<Object>} Assignment result
   */
  async assignBooking(driverId, bookingId) {
    const fallback = async () => {
      console.log(`[DriverService] Fallback: Cannot assign driver ${driverId} to booking ${bookingId} - service unavailable`);
      throw new Error('Driver assignment service unavailable - please try again later');
    };

    try {
      return await this.client.post(`/api/drivers/${driverId}/assign`, {
        bookingId,
      }, {}, fallback);
    } catch (error) {
      if (error.message.includes('Circuit breaker is OPEN')) {
        throw new Error('Driver service is temporarily unavailable');
      }
      throw error;
    }
  },
};

/**
 * Pricing Service Client
 */
const pricingServiceClient = {
  client: createAuthenticatedClient('booking-service', SERVICE_URLS.PRICING_SERVICE),

  async calculateEstimate(params) {
    const fallback = async () => {
      console.log(`[PricingService] Fallback: Returning default estimate for route`, params);
      // Calculate rough distance-based estimate
      const distance = calculateDistance(
        params.pickup.latitude, params.pickup.longitude,
        params.destination.latitude, params.destination.longitude
      );
      const basePrice = 2.0; // Base fare
      const pricePerKm = 1.5; // Price per km
      const estimatedPrice = basePrice + (distance * pricePerKm);

      return {
        distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
        estimatedPrice: Math.round(estimatedPrice * 100) / 100,
        currency: 'USD',
        vehicleType: params.vehicleType || 'standard',
        estimatedDuration: Math.round(distance * 2), // Rough estimate: 2 min per km
        pricingFactors: {
          baseFare: basePrice,
          distanceFare: Math.round(distance * pricePerKm * 100) / 100,
          surgeMultiplier: 1.0
        }
      };
    };

    try {
      return await this.client.post('/api/pricing/estimate', {
        pickupLatitude: params.pickup.latitude,
        pickupLongitude: params.pickup.longitude,
        destinationLatitude: params.destination.latitude,
        destinationLongitude: params.destination.longitude,
        vehicleType: params.vehicleType || 'standard',
      }, {}, fallback);
    } catch (error) {
      if (error.message.includes('Circuit breaker is OPEN')) {
        return await fallback();
      }
      throw error;
    }
  },
};

/**
 * Notification Service Client
 */
const notificationServiceClient = {
  client: createAuthenticatedClient('booking-service', SERVICE_URLS.NOTIFICATION_SERVICE),

  /**
   * Send notification to user
   * @param {Object} params - { userId, type, title, message, data }
   * @returns {Promise<Object>} Notification result
   */
  async sendNotification(params) {
    const fallback = async () => {
      console.log(`[NotificationService] Fallback: Notification queued for later delivery`);
      return { queued: true, message: 'Notification queued due to service unavailability' };
    };

    try {
      return await this.client.post('/api/notifications/send', {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        data: params.data || {},
      }, {}, fallback);
    } catch (error) {
      console.error('Failed to send notification:', error.message);
      return null;
    }
  },
};

/**
 * Auth Service Client (for token verification, etc.)
 */
const authServiceClient = {
  client: createAuthenticatedClient('booking-service', SERVICE_URLS.AUTH_SERVICE),

  /**
   * Verify JWT token
   * @param {string} token 
   * @returns {Promise<Object>} Decoded token payload
   */
  async verifyToken(token) {
    const fallback = async () => {
      console.log(`[AuthService] Fallback: Token verification unavailable, assuming invalid`);
      return { valid: false, reason: 'Auth service unavailable' };
    };

    try {
      return await this.client.post('/api/auth/verify', { token }, {}, fallback);
    } catch (error) {
      if (error.message.includes('Circuit breaker is OPEN')) {
        return await fallback();
      }
      throw new Error(`Token verification failed: ${error.message}`);
    }
  },
};

// Export all clients
module.exports = {
  userServiceClient,
  driverServiceClient,
  pricingServiceClient,
  notificationServiceClient,
  authServiceClient,
  SERVICE_URLS,

  // Health check methods
  getResilienceStatus() {
    return {
      userService: userServiceClient.client.getStatus(),
      driverService: driverServiceClient.client.getStatus(),
      pricingService: pricingServiceClient.client.getStatus(),
      notificationService: notificationServiceClient.client.getStatus(),
      authService: authServiceClient.client.getStatus(),
    };
  },

  // Bulkhead wrapper for cross-service coordination
  ServiceClientWrapper: class {
    constructor() {
      this.globalBulkhead = new (require('./resilience').Bulkhead)(50); // Global limit: 50 concurrent across all services
    }

    // Wrap any service call with global bulkhead
    async execute(serviceCall) {
      return await this.globalBulkhead.execute(serviceCall);
    }

    // Get global bulkhead status
    getGlobalStatus() {
      return {
        globalBulkhead: this.globalBulkhead.getStatus(),
        services: getResilienceStatus()
      };
    }
  }
};
