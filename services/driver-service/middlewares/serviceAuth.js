/**
 * SERVICE AUTHENTICATION MIDDLEWARE
 * For driver-service - verifies service-to-service JWT tokens
 */

const { verifyServiceTokenMiddleware } = require('../utils/service-jwt');

/**
 * Driver Service Authentication Middleware
 * Protects driver-service endpoints from unauthorized access
 */

// General service authentication for all driver endpoints
const requireServiceAuth = verifyServiceTokenMiddleware({
    allowGateway: true,
    requiredPermissions: []
});

// Driver assignment authentication (strict)
const requireDriverAssignmentAuth = verifyServiceTokenMiddleware({
    allowGateway: false,  // Only booking-service can assign drivers
    requiredPermissions: ['write:assignments', 'read:drivers']
});

// Driver read access
const requireDriverReadAuth = verifyServiceTokenMiddleware({
    allowGateway: true,
    requiredPermissions: ['read:drivers']
});

// Driver write access (strict)
const requireDriverWriteAuth = verifyServiceTokenMiddleware({
    allowGateway: false,
    requiredPermissions: ['write:drivers']
});

module.exports = {
    requireServiceAuth,
    requireDriverAssignmentAuth,
    requireDriverReadAuth,
    requireDriverWriteAuth
};