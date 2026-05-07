/**
 * USER SERVICE - Auth Event Consumer
 * 
 * Listens to events from auth-service and updates local data
 * This maintains eventual consistency between auth_db and user_db
 */

const { Kafka } = require('kafkajs');
const { UserProfile } = require('../models');

// Kafka configuration
const kafka = new Kafka({
  clientId: 'user-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
});

const consumer = kafka.consumer({ groupId: 'user-service-auth-events' });

// Topics to subscribe
const TOPICS = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
};

/**
 * Connect and start consuming events
 */
const startConsumer = async () => {
  await consumer.connect();
  console.log('User Service: Kafka consumer connected');

  // Subscribe to auth events
  await consumer.subscribe({ topics: Object.values(TOPICS), fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        console.log(`Received event: ${event.eventType} from topic ${topic}`);

        // Route to appropriate handler
        switch (event.eventType) {
          case 'USER_CREATED':
            await handleUserCreated(event.payload);
            break;
          case 'USER_UPDATED':
            await handleUserUpdated(event.payload);
            break;
          case 'USER_DELETED':
            await handleUserDeleted(event.payload);
            break;
          default:
            console.warn(`Unknown event type: ${event.eventType}`);
        }
      } catch (error) {
        console.error('Error processing message:', error);
        // In production, implement dead letter queue (DLQ)
      }
    },
  });
};

/**
 * Handle USER_CREATED event
 * 
 * When auth-service creates a new user, we create a corresponding profile
 * This ensures every authenticated user has a profile record
 */
const handleUserCreated = async (payload) => {
  const { userId, email, name, role, createdAt } = payload;

  try {
    // Check if profile already exists (idempotency)
    const existingProfile = await UserProfile.findOne({ where: { userId } });
    if (existingProfile) {
      console.log(`Profile already exists for user ${userId}, skipping creation`);
      return;
    }

    // Create UserProfile
    // Note: We don't store email here, only reference userId
    const profile = await UserProfile.create({
      userId: userId,
      firstName: name,
      // Default values
      preferredLanguage: 'en',
      currency: 'VND',
      emailNotifications: true,
      smsNotifications: true,
      pushNotifications: true,
      signupSource: 'web',
    });

    console.log(`Created UserProfile for user ${userId} (role: ${role})`);
  } catch (error) {
    console.error(`Failed to create UserProfile for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Handle USER_UPDATED event
 * 
 * Handle changes to user authentication data that might affect profile
 */
const handleUserUpdated = async (payload) => {
  const { userId, changes } = payload;

  try {
    const profile = await UserProfile.findOne({ where: { userId } });
    if (!profile) {
      console.warn(`Profile not found for user ${userId}, cannot update`);
      return;
    }

    // Handle specific change types
    const updates = {};

    // If user became a driver, we might want to note that
    if (changes.role && changes.role === 'driver') {
      // Could trigger additional profile setup for drivers
      console.log(`User ${userId} role changed to driver`);
    }

    // If account was deactivated, we might update notification preferences
    if (changes.isActive === false) {
      updates.emailNotifications = false;
      updates.smsNotifications = false;
      updates.pushNotifications = false;
      console.log(`User ${userId} account deactivated, disabling notifications`);
    }

    if (Object.keys(updates).length > 0) {
      await profile.update(updates);
      console.log(`Updated profile for user ${userId}`);
    }
  } catch (error) {
    console.error(`Failed to update profile for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Handle USER_DELETED event
 * 
 * Soft delete the UserProfile when auth user is deleted
 */
const handleUserDeleted = async (payload) => {
  const { userId, reason } = payload;

  try {
    const profile = await UserProfile.findOne({ where: { userId } });
    if (!profile) {
      console.warn(`Profile not found for user ${userId}`);
      return;
    }

    // Soft delete (paranoid mode in Sequelize)
    await profile.destroy();
    console.log(`Soft deleted UserProfile for user ${userId} (reason: ${reason})`);
  } catch (error) {
    console.error(`Failed to delete profile for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Graceful shutdown
 */
const stopConsumer = async () => {
  await consumer.disconnect();
  console.log('User Service: Kafka consumer disconnected');
};

module.exports = {
  startConsumer,
  stopConsumer,
  TOPICS,
};
