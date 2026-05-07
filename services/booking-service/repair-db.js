const sequelize = require('./config/database');

async function repair() {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB.');
    
    // Add idempotencyKey column if it doesn't exist
    await sequelize.getQueryInterface().addColumn('bookings', 'idempotencyKey', {
      type: require('sequelize').DataTypes.STRING,
      allowNull: true,
      unique: true
    });
    console.log('Added idempotencyKey column.');
    
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('Column already exists, skipping.');
    } else {
      console.error('Repair failed:', error.message);
    }
  } finally {
    process.exit();
  }
}

repair();
