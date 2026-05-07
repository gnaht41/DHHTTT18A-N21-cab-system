/**
 * SERVICE AUTHENTICATION MIDDLEWARE
 * For user-service - verifies service-to-service JWT tokens
 */

const { verifyServiceTokenMiddleware } = require('../utils/service-jwt');

/**
 * User Service Authentication Middleware
 * Protects user-service endpoints from unauthorized access
 */

// General service authentication for all user endpoints
const requireServiceAuth = verifyServiceTokenMiddleware({
    allowGateway: true,  // Allow API gateway
    requiredPermissions: []  // No specific permissions required for basic access
});

// Strict authentication for sensitive user operations
const requireUserWriteAuth = verifyServiceTokenMiddleware({
    allowGateway: false,  // Only internal services, no gateway
    requiredPermissions: ['write:users']
});

// Profile access authentication
const requireProfileAuth = verifyServiceTokenMiddleware({
    allowGateway: true,
    requiredPermissions: ['read:users']  // Allow services that can read users
});

// Preferences access authentication
const requirePreferencesAuth = verifyServiceTokenMiddleware({
    allowGateway: true,
    requiredPermissions: ['read:users']
});

module.exports = {
    requireServiceAuth,
    requireUserWriteAuth,
    requireProfileAuth,
    requirePreferencesAuth
};