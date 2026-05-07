const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  pickup: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  destination: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'PENDING',
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  distance: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  duration: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  routeData: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  idempotencyKey: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
}, {
  timestamps: true,
  tableName: 'bookings',
});

module.exports = Booking;
