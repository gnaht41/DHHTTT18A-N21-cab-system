/**
 * SERVICE-TO-SERVICE AUTHENTICATION UTILITIES
 * JWT tokens for internal service communication
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { secretProvider } = require('./secret-manager');

// Service identity configuration (without secrets)
const SERVICE_IDENTITIES = {
    'booking-service': {
        id: 'booking-service',
        permissions: ['read:users', 'write:bookings', 'read:drivers', 'write:notifications']
    },
    'user-service': {
        id: 'user-service',
        permissions: ['read:users', 'write:users', 'read:profiles']
    },
    'driver-service': {
        id: 'driver-service',
        permissions: ['read:drivers', 'write:drivers', 'write:assignments']
    },
    'ride-service': {
        id: 'ride-service',
        permissions: ['read:rides', 'write:rides', 'read:bookings']
    },
    'payment-service': {
        id: 'payment-service',
        permissions: ['read:payments', 'write:payments', 'read:rides']
    },
    'pricing-service': {
        id: 'pricing-service',
        permissions: ['read:pricing', 'write:estimates']
    },
    'notification-service': {
        id: 'notification-service',
        permissions: ['write:notifications']
    },
    'auth-service': {
        id: 'auth-service',
        permissions: ['read:auth', 'write:auth', 'verify:tokens']
    },
    'api-gateway': {
        id: 'api-gateway',
        permissions: ['proxy:all', 'read:all']
    }
};

/**
 * Generate service JWT token
 */
async function generateServiceToken(serviceId, targetService = null, additionalClaims = {}) {
    const service = SERVICE_IDENTITIES[serviceId];
    if (!service) {
        throw new Error(`Unknown service: ${serviceId}`);
    }

    // Get secret from secret provider with fallback
    const secret = await secretProvider.getSecret(serviceId);

    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: service.id,                    // Issuer
        sub: service.id,                    // Subject
        aud: targetService || 'internal',   // Audience
        iat: now,                          // Issued at
        exp: now + (15 * 60),              // Expires in 15 minutes
        jti: crypto.randomUUID(),          // JWT ID
        type: 'service',                   // Token type
        permissions: service.permissions,  // Service permissions
        ...additionalClaims
    };

    return jwt.sign(payload, secret, { algorithm: 'HS256' });
}

/**
 * Verify service JWT token
 */
async function verifyServiceToken(token, expectedIssuer = null) {
    try {
        // Decode without verification first to get issuer
        const decoded = jwt.decode(token, { complete: true });
        if (!decoded || !decoded.payload.iss) {
            throw new Error('Invalid token structure');
        }

        const issuer = decoded.payload.iss;
        const service = SERVICE_IDENTITIES[issuer];

        if (!service) {
            throw new Error(`Unknown service issuer: ${issuer}`);
        }

        // Get secret from secret provider
        const secret = await secretProvider.getSecret(issuer);

        // Verify with service secret
        const verified = jwt.verify(token, secret, {
            algorithms: ['HS256'],
            issuer: expectedIssuer || issuer,
            audience: decoded.payload.aud || 'internal'
        });

        // Additional validation
        if (verified.type !== 'service') {
            throw new Error('Not a service token');
        }

        return {
            valid: true,
            fromService: issuer,
            toService: verified.aud,
            permissions: verified.permissions,
            payload: verified
        };

    } catch (error) {
        return {
            valid: false,
            error: error.message,
            fromService: null,
            toService: null,
            permissions: []
        };
    }
}

/**
 * Check if service has permission
 */
function hasServicePermission(serviceId, permission) {
    const service = SERVICE_IDENTITIES[serviceId];
    if (!service) return false;

    return service.permissions.includes(permission);
}

/**
 * Middleware to verify service tokens
 */
function verifyServiceTokenMiddleware(options = {}) {
    const {
        requiredPermissions = [],
        allowGateway = true,
        headerName = 'authorization'
    } = options;

    return async (req, res, next) => {
        try {
            const authHeader = req.headers[headerName.toLowerCase()];

            if (!authHeader) {
                return res.status(401).json({
                    error: 'Missing authorization header',
                    code: 'AUTH_MISSING'
                });
            }

            // Check for Service token (internal calls)
            let token;
            if (authHeader.startsWith('Service ')) {
                token = authHeader.substring(7); // Remove 'Service ' prefix
            } else if (authHeader.startsWith('Bearer ')) {
                // Allow Bearer tokens for backward compatibility (user tokens)
                // But mark as external call
                req.isExternalCall = true;
                return next();
            } else {
                return res.status(401).json({
                    error: 'Invalid authorization format. Use "Service <token>" for internal calls',
                    code: 'AUTH_INVALID_FORMAT'
                });
            }

            // Verify service token
            const verification = await verifyServiceToken(token);

            if (!verification.valid) {
                return res.status(401).json({
                    error: 'Invalid service token',
                    details: verification.error,
                    code: 'SERVICE_TOKEN_INVALID'
                });
            }

            // Check permissions if required
            if (requiredPermissions.length > 0) {
                const hasPermission = requiredPermissions.every(perm =>
                    verification.permissions.includes(perm)
                );

                if (!hasPermission) {
                    return res.status(403).json({
                        error: 'Insufficient service permissions',
                        required: requiredPermissions,
                        available: verification.permissions,
                        code: 'SERVICE_PERMISSION_DENIED'
                    });
                }
            }

            // Allow gateway if configured
            if (!allowGateway && verification.fromService === 'api-gateway') {
                return res.status(403).json({
                    error: 'Gateway access not allowed for this endpoint',
                    code: 'GATEWAY_ACCESS_DENIED'
                });
            }

            // Attach service info to request
            req.serviceIdentity = {
                id: verification.fromService,
                permissions: verification.permissions,
                isInternal: true
            };

            next();

        } catch (error) {
            console.error('Service auth middleware error:', error);
            res.status(500).json({
                error: 'Authentication service error',
                code: 'AUTH_SERVICE_ERROR'
            });
        }
    };
}

module.exports = {
    generateServiceToken,
    verifyServiceToken,
    hasServicePermission,
    verifyServiceTokenMiddleware,
    SERVICE_IDENTITIES
};