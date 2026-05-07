const Driver = require('../models/Driver');

class DriverRepository {
  async create(driverData) {
    return await Driver.create(driverData);
  }

  async findAvailable() {
    const { Op } = require('sequelize');
    return await Driver.findAll({ 
      where: { 
        status: { 
          [Op.in]: ['AVAILABLE', 'ONLINE'] 
        } 
      } 
    });
  }

  async updateLocation(id, location) {
    const driver = await Driver.findByPk(id);
    if (driver) {
      driver.location = location;
      await driver.save();
    }
    return driver;
  }

  async updateStatus(id, status) {
    const driver = await Driver.findByPk(id);
    if (driver) {
      driver.status = status;
      await driver.save();
    }
    return driver;
  }
}

module.exports = new DriverRepository();
