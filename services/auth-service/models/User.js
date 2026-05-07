const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * AUTH SERVICE - User Model
 * 
 * DOMAIN: Authentication only
 * This model ONLY contains data needed for authentication:
 * - email (for login identification)
 * - password_hash (for credential verification)
 * - role (for authorization)
 * - isActive (account status)
 * 
 * DOES NOT CONTAIN:
 * - name, phone, avatar (belongs to user-service)
 * - addresses (belongs to user-service)
 * - preferences (belongs to user-service)
 * 
 * RELATIONSHIP:
 * - auth-service owns authentication domain
 * - user-service owns profile domain
 * - Linked by userId (auth.id = user_profile.userId)
 * - Communication via API/Kafka events, NOT direct DB access
 */

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  // Email is the login identifier
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
    comment: 'Used for login identification',
  },
  // Hashed password only - NEVER store plain text
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Bcrypt hashed password',
  },
  // Role for authorization (RBAC)
  role: {
    type: DataTypes.ENUM('user', 'driver', 'admin'),
    allowNull: false,
    defaultValue: 'user',
    comment: 'Authorization role',
  },
  // Account status
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Account activation status',
  },
  // Email verification status
  isEmailVerified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Email verification status',
  },
  // Last login timestamp
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Last successful login time',
  },
}, {
  timestamps: true,
  tableName: 'users',
  indexes: [
    { fields: ['email'], unique: true },
    { fields: ['role'] },
    { fields: ['isActive'] },
  ],
});

module.exports = User;
