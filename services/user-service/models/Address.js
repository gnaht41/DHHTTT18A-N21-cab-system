const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * USER SERVICE - Address Model
 * 
 * DOMAIN: User Address Management
 * Stores user addresses (home, work, saved locations)
 * 
 * RELATIONSHIP:
 * - Belongs to UserProfile via userId
 * - One user can have multiple addresses
 */

const Address = sequelize.define('Address', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'user_profiles',
      key: 'userId',
    },
    onDelete: 'CASCADE',
    comment: 'Reference to user_profiles.userId',
  },
  // Address Type
  type: {
    type: DataTypes.ENUM('home', 'work', 'other'),
    allowNull: false,
    defaultValue: 'other',
    comment: 'Address category',
  },
  // Address Details
  label: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Custom label (e.g., "Mom\'s house")',
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Full street address',
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  district: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  ward: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  country: {
    type: DataTypes.STRING(2),
    allowNull: false,
    defaultValue: 'VN',
    comment: 'ISO country code',
  },
  postalCode: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  // Geographic coordinates for mapping
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
    comment: 'GPS latitude',
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
    comment: 'GPS longitude',
  },
  // Default address flag
  isDefault: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Is this the default address for user',
  },
}, {
  timestamps: true,
  tableName: 'user_addresses',
  indexes: [
    { fields: ['userId'] },
    { fields: ['type'] },
    { fields: ['latitude', 'longitude'] },
    { fields: ['city', 'district'] },
  ],
});

module.exports = Address;
