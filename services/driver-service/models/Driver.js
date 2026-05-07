const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Driver = sequelize.define('Driver', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    unique: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  vehicle: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'Standard Sedan'
  },
  plate: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: '29A-888.88'
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'AVAILABLE',
  },
  totalEarnings: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  rating: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: false,
    defaultValue: 5.00
  },
  ratingCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
}, {
  timestamps: true,
  tableName: 'drivers',
  indexes: [
    { fields: ['userId'], unique: true },
    { fields: ['status'] }
  ]
});

module.exports = Driver;
