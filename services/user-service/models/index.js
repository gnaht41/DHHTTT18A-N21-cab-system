/**
 * USER SERVICE - Models Index
 * 
 * All models in user_db:
 * - user_profiles: Core user profile data
 * - user_addresses: Saved addresses
 */

const sequelize = require('../config/database');
const UserProfile = require('./User');
const Address = require('./Address');

// Define associations
UserProfile.hasMany(Address, {
  foreignKey: 'userId',
  sourceKey: 'userId',
  as: 'addresses',
});

Address.belongsTo(UserProfile, {
  foreignKey: 'userId',
  targetKey: 'userId',
  as: 'user',
});

module.exports = {
  sequelize,
  UserProfile,
  Address,
};
