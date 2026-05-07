const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  rideId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'PENDING'
  },
  driverId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
}, {
  timestamps: true,
  tableName: 'payments'
});

module.exports = Payment;
