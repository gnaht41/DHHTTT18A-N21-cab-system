const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * USER SERVICE - UserProfile Model
 * 
 * DOMAIN: User Profile Management
 * This model contains user profile information ONLY:
 * - Personal info: name, phone, avatar
 * - Preferences: language, notifications
 * - Metadata: account creation source
 * 
 * DOES NOT CONTAIN:
 * - email, password (belongs to auth-service)
 * - role, isActive (belongs to auth-service)
 * 
 * RELATIONSHIP:
 * - Linked to auth-service via userId (foreign concept, NOT FK constraint)
 * - userId = auth-service users.id
 * - user-service NEVER accesses auth_db directly
 * - Data synchronization via Kafka events or API calls
 * 
 * COMMUNICATION PATTERN:
 * - When auth-service creates user -> publishes UserCreated event
 * - user-service consumes event -> creates UserProfile with userId
 * - Other services request profile via HTTP API to user-service
 */

const UserProfile = sequelize.define('UserProfile', {
  // Primary key - independent from auth-service
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  // Link to auth-service (logical reference, NOT database FK)
  // This is the ONLY connection to auth domain
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    comment: 'Reference to auth-service user ID (no FK constraint)',
  },
  // Personal Information
  firstName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'User first name',
  },
  lastName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'User last name',
  },
  fullName: {
    type: DataTypes.VIRTUAL,
    get() {
      return `${this.firstName || ''} ${this.lastName || ''}`.trim();
    },
  },
  // Contact Information
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true,
    comment: 'Phone number for SMS notifications',
  },
  phoneVerified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Phone number verification status',
  },
  // Profile Media
  avatarUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Profile picture URL',
  },
  // User Preferences
  preferredLanguage: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'en',
    comment: 'Preferred language code (en, vi, etc.)',
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'VND',
    comment: 'Preferred currency',
  },
  // Notification Preferences
  emailNotifications: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Enable email notifications',
  },
  smsNotifications: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Enable SMS notifications',
  },
  pushNotifications: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Enable push notifications',
  },
  // Account Metadata
  signupSource: {
    type: DataTypes.ENUM('web', 'ios', 'android', 'api'),
    allowNull: false,
    defaultValue: 'web',
    comment: 'Platform where user signed up',
  },
  // Soft delete support
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Soft deletion timestamp',
  },
}, {
  timestamps: true,
  tableName: 'user_profiles',
  paranoid: true, // Enable soft deletes
  indexes: [
    { fields: ['userId'], unique: true },
    { fields: ['phone'] },
    { fields: ['firstName', 'lastName'] },
  ],
});

module.exports = UserProfile;
