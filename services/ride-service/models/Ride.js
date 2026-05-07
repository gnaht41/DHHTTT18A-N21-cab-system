const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Ride = sequelize.define('Ride', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  bookingId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  driverId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  driverName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  driverVehicle: {
    type: DataTypes.STRING,
    allowNull: true
  },
  driverPlate: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  userName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('DRIVER_ASSIGNED', 'ACCEPTED', 'ARRIVED', 'STARTED', 'COMPLETED', 'PAID', 'CANCELLED'),
    allowNull: false,
    defaultValue: 'DRIVER_ASSIGNED',
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  pickup: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  destination: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isReviewed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  routeData: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'rides',
  indexes: [
    { fields: ['bookingId'] },
    { fields: ['driverId'] },
    { fields: ['userId'] },
    { fields: ['status'] }
  ]
});

module.exports = Ride;
