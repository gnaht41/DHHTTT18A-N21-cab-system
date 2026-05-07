/**
 * SERVICE-TO-SERVICE AUTHENTICATION EXAMPLES
 * Demonstrates JWT-based internal service communication
 */

const { generateServiceToken, verifyServiceToken, hasServicePermission } = require('./service-jwt');

// Example 1: Generate service tokens
function tokenGenerationExample() {
    console.log('=== Service Token Generation ===');

    // Booking service calling user service
    const bookingToUserToken = generateServiceToken('booking-service', 'user-service');
    console.log('Booking → User Token:', bookingToUserToken.substring(0, 50) + '...');

    // User service calling auth service
    const userToAuthToken = generateServiceToken('user-service', 'auth-service');
    console.log('User → Auth Token:', userToAuthToken.substring(0, 50) + '...');

    // API Gateway calling any service
    const gatewayToken = generateServiceToken('api-gateway');
    console.log('Gateway Token:', gatewayToken.substring(0, 50) + '...');
}

// Example 2: Verify service tokens
function tokenVerificationExample() {
    console.log('\n=== Service Token Verification ===');

    // Generate a token
    const token = generateServiceToken('booking-service', 'user-service');

    // Verify it
    const verification = verifyServiceToken(token);
    console.log('Token valid:', verification.valid);
    console.log('Service:', verification.service);
    console.log('Permissions:', verification.permissions);

    // Try with wrong secret (should fail)
    const invalidToken = token + 'tampered';
    const invalidVerification = verifyServiceToken(invalidToken);
    console.log('Invalid token valid:', invalidVerification.valid);
    console.log('Error:', invalidVerification.error);
}

// Example 3: Permission checking
function permissionExample() {
    console.log('\n=== Permission Checking ===');

    console.log('Booking service can read users:', hasServicePermission('booking-service', 'read:users'));
    console.log('Booking service can write users:', hasServicePermission('booking-service', 'write:users'));
    console.log('User service can write users:', hasServicePermission('user-service', 'write:users'));
    console.log('Driver service can assign drivers:', hasServicePermission('driver-service', 'write:assignments'));
    console.log('API Gateway can proxy all:', hasServicePermission('api-gateway', 'proxy:all'));
}

// Example 4: Service client usage
async function serviceClientExample() {
    console.log('\n=== Service Client Usage ===');

    const { userServiceClient, driverServiceClient } = require('./serviceClient');

    try {
        // These calls now automatically include service JWT tokens
        console.log('Calling user service...');
        const user = await userServiceClient.getProfile(123);
        console.log('User profile retrieved:', !!user);

        console.log('Calling driver service...');
        const drivers = await driverServiceClient.findNearby({ latitude: 40.7128, longitude: -74.0060 });
        console.log('Drivers found:', drivers.length);

    } catch (error) {
        console.error('Service call failed:', error.message);
    }
}

// Example 5: Middleware usage (simulated)
function middlewareExample() {
    console.log('\n=== Middleware Usage Simulation ===');

    const { verifyServiceTokenMiddleware } = require('./service-jwt');

    // Simulate Express middleware
    const mockReq = {
        headers: {
            authorization: 'Service ' + generateServiceToken('booking-service')
        }
    };

    const mockRes = {
        status: (code) => ({
            json: (data) => console.log(`Response ${code}:`, data)
        })
    };

    const mockNext = () => console.log('✅ Request authorized, proceeding...');

    // Test middleware
    const middleware = verifyServiceTokenMiddleware({
        requiredPermissions: ['read:users']
    });

    middleware(mockReq, mockRes, mockNext);
}

// Example 6: Authorization header formats
function headerFormatExample() {
    console.log('\n=== Authorization Header Formats ===');

    // User authentication (external)
    console.log('User auth header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');

    // Service authentication (internal)
    const serviceToken = generateServiceToken('booking-service');
    console.log('Service auth header: Service', serviceToken.substring(0, 30) + '...');

    // API Gateway can use either
    console.log('Gateway can use both Bearer (user) and Service (internal) tokens');
}

// Example 7: Security benefits
function securityBenefitsExample() {
    console.log('\n=== Security Benefits ===');

    console.log('✅ Service isolation: Each service has unique JWT secret');
    console.log('✅ Permission-based access: Granular control over service capabilities');
    console.log('✅ Token expiration: 15-minute expiry prevents long-lived credentials');
    console.log('✅ Request tracing: X-Service-ID and X-Request-ID headers');
    console.log('✅ Gateway protection: Only authorized services can call internal APIs');
    console.log('✅ No user token leakage: Internal calls use service tokens only');
}

// Run all examples
async function runServiceAuthExamples() {
    console.log('🔐 Service-to-Service Authentication Examples\n');

    tokenGenerationExample();
    tokenVerificationExample();
    permissionExample();

    await serviceClientExample();

    middlewareExample();
    headerFormatExample();
    securityBenefitsExample();

    console.log('\n✅ All service authentication examples completed!');
}

// Run if called directly
if (require.main === module) {
    runServiceAuthExamples().catch(console.error);
}

module.exports = {
    tokenGenerationExample,
    tokenVerificationExample,
    permissionExample,
    serviceClientExample,
    middlewareExample,
    headerFormatExample,
    securityBenefitsExample,
    runServiceAuthExamples
};