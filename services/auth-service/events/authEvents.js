/**
 * AUTH SERVICE - Event Publishers
 * 
 * When auth events occur, publish to Kafka for other services to consume
 * This enables eventual consistency across services without direct DB access
 */

const { Kafka } = require('kafkajs');

// Kafka configuration
const kafka = new Kafka({
  clientId: 'auth-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
});

const producer = kafka.producer();

// Topic definitions
const TOPICS = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_LOGGED_IN: 'user.logged-in',
  USER_PASSWORD_CHANGED: 'user.password-changed',
  USER_ROLE_CHANGED: 'user.role-changed',
};

/**
 * Connect producer (call once at startup)
 */
const connectProducer = async () => {
  await producer.connect();
  console.log('Auth Service: Kafka producer connected');
};

/**
 * Publish User Created Event
 * 
 * Consumed by:
 * - user-service: Creates UserProfile with the userId
 * - notification-service: Sends welcome email
 * - analytics-service: Tracks signup metrics
 */
const publishUserCreated = async (user) => {
  const event = {
    eventType: 'USER_CREATED',
    timestamp: new Date().toISOString(),
    service: 'auth-service',
    payload: {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    },
  };

  await producer.send({
    topic: TOPICS.USER_CREATED,
    messages: [
      {
        key: String(user.id),
        value: JSON.stringify(event),
        headers: {
          'correlation-id': generateCorrelationId(),
          'event-version': '1.0',
        },
      },
    ],
  });

  console.log(`Published USER_CREATED event for user ${user.id}`);
};

/**
 * Publish User Updated Event
 * 
 * Consumed by:
 * - user-service: May update cache or related data
 * - other services: Sync user state
 */
const publishUserUpdated = async (user, changes) => {
  const event = {
    eventType: 'USER_UPDATED',
    timestamp: new Date().toISOString(),
    service: 'auth-service',
    payload: {
      userId: user.id,
      changes: {
        email: changes.email,
        role: changes.role,
        isActive: changes.isActive,
        isEmailVerified: changes.isEmailVerified,
      },
      updatedAt: user.updatedAt,
    },
  };

  await producer.send({
    topic: TOPICS.USER_UPDATED,
    messages: [
      {
        key: String(user.id),
        value: JSON.stringify(event),
      },
    ],
  });

  console.log(`Published USER_UPDATED event for user ${user.id}`);
};

/**
 * Publish User Deleted Event (Soft Delete)
 * 
 * Consumed by:
 * - user-service: Soft deletes UserProfile
 * - all services: Clean up user-related data
 */
const publishUserDeleted = async (userId, reason) => {
  const event = {
    eventType: 'USER_DELETED',
    timestamp: new Date().toISOString(),
    service: 'auth-service',
    payload: {
      userId: userId,
      reason: reason || 'user_request',
      deletedAt: new Date().toISOString(),
    },
  };

  await producer.send({
    topic: TOPICS.USER_DELETED,
    messages: [
      {
        key: String(userId),
        value: JSON.stringify(event),
      },
    ],
  });

  console.log(`Published USER_DELETED event for user ${userId}`);
};

/**
 * Publish User Logged In Event
 * 
 * Consumed by:
 * - notification-service: Detect suspicious logins
 * - analytics-service: Track active sessions
 */
const publishUserLoggedIn = async (userId, loginInfo) => {
  const event = {
    eventType: 'USER_LOGGED_IN',
    timestamp: new Date().toISOString(),
    service: 'auth-service',
    payload: {
      userId: userId,
      timestamp: loginInfo.timestamp,
      ipAddress: loginInfo.ipAddress,
      userAgent: loginInfo.userAgent,
      deviceType: loginInfo.deviceType,
    },
  };

  await producer.send({
    topic: TOPICS.USER_LOGGED_IN,
    messages: [
      {
        key: String(userId),
        value: JSON.stringify(event),
      },
    ],
  });
};

/**
 * Publish Role Changed Event
 * 
 * Consumed by:
 * - All services: Update RBAC caches
 * - admin-service: Audit log
 */
const publishRoleChanged = async (userId, oldRole, newRole, changedBy) => {
  const event = {
    eventType: 'USER_ROLE_CHANGED',
    timestamp: new Date().toISOString(),
    service: 'auth-service',
    payload: {
      userId: userId,
      oldRole: oldRole,
      newRole: newRole,
      changedBy: changedBy, // Admin user ID who made the change
      changedAt: new Date().toISOString(),
    },
  };

  await producer.send({
    topic: TOPICS.USER_ROLE_CHANGED,
    messages: [
      {
        key: String(userId),
        value: JSON.stringify(event),
      },
    ],
  });
};

// Helper function
const generateCorrelationId = () => {
  return `auth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

module.exports = {
  connectProducer,
  publishUserCreated,
  publishUserUpdated,
  publishUserDeleted,
  publishUserLoggedIn,
  publishRoleChanged,
  TOPICS,
};
