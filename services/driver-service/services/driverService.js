const Driver = require('../models/Driver');
const driverRepository = require('../repositories/driverRepository');

class DriverService {
  async createDriver(name, location) {
    return await driverRepository.create({
      name,
      location,
      status: 'AVAILABLE'
    });
  }

  async getAvailableDrivers() {
    return await driverRepository.findAvailable();
  }

  async updateLocation(driverId, location) {
    return await driverRepository.updateLocation(driverId, location);
  }

  async updateDriverStatus(userId, status) {
    // V4: Use findOrCreate to ensure a driver record exists for the user
    const [driver, created] = await Driver.findOrCreate({
      where: { userId },
      defaults: {
        name: `Driver ${userId}`,
        status: status,
        location: '10.762,106.660' // Default HCM location
      }
    });

    if (!created) {
      driver.status = status;
      await driver.save();
    }

    return driver;
  }

  haversineDistance(loc1, loc2) {
    if (!loc1 || !loc2) return 999;
    try {
      const [lat1, lon1] = loc1.split(',').map(Number);
      const [lat2, lon2] = loc2.split(',').map(Number);

      const R = 6371; // km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    } catch (e) {
      return 999;
    }
  }

  async assignNearestDriver(bookingId, pickupLocation) {
    // 1. Get all available drivers
    let availableDrivers = await driverRepository.findAvailable();

    if (!availableDrivers || availableDrivers.length === 0) {
      console.log(`[DriverService] No available drivers for booking ${bookingId}`);
      return null;
    }

    // 2. Score each driver based on Distance (70%) and Rating (30%)
    // Score = (Distance * 0.7) + ((5 - Rating) * 2 * 0.3) 
    // We multiply (5-Rating) by 2 to give it more weight relative to distance in km
    const scoredDrivers = availableDrivers.map(driver => {
      const distance = this.haversineDistance(driver.location, pickupLocation);
      const rating = parseFloat(driver.rating || 5.0);
      const score = (distance * 0.7) + ((5 - rating) * 0.6);
      return { ...driver.get({ plain: true }), distance, score };
    });

    // 3. Sort by score ascending
    scoredDrivers.sort((a, b) => a.score - b.score);
    const bestDriver = scoredDrivers[0];

    console.log(`[DriverService] Best driver for ${bookingId}: ${bestDriver.name} (Dist: ${bestDriver.distance.toFixed(2)}km, Rating: ${bestDriver.rating}, Score: ${bestDriver.score.toFixed(2)})`);

    // 4. Mark the driver as BUSY
    await driverRepository.updateStatus(bestDriver.id, 'BUSY');

    // 5. Calculate ETA (Assume 30 km/h average)
    const etaMinutes = Math.max(2, Math.round((bestDriver.distance / 30) * 60));

    return {
      driverId: bestDriver.userId,
      name: bestDriver.name,
      vehicle: bestDriver.vehicle || 'Standard Sedan',
      location: bestDriver.location,
      status: 'BUSY',
      assignedBookingId: bookingId,
      distance: bestDriver.distance,
      rating: bestDriver.rating,
      eta: etaMinutes
    };
  }

  async getDriverByUserId(userId, name) {
    const [driver, created] = await Driver.findOrCreate({
      where: { userId },
      defaults: {
        name: name || `Driver ${userId}`,
        status: 'AVAILABLE',
        location: '10.762,106.660'
      }
    });
    return driver;
  }

  async getDriverStatus(userIdOrId) {
    const { Op } = require('sequelize');
    const numericId = parseInt(userIdOrId);
    let whereClause;
    
    if (!isNaN(numericId)) {
        whereClause = { [Op.or]: [{ userId: numericId }, { id: numericId }] };
    } else {
        whereClause = { userId: userIdOrId };
    }

    const driver = await Driver.findOne({ where: whereClause });
    if (!driver) {
      return { status: 'OFFLINE', message: 'Driver not found' };
    }
    return {
      status: driver.status,
      driverId: driver.id,
      userId: driver.userId,
      name: driver.name,
      location: driver.location
    };
  }

  async updateProfile(driverId, { name, vehicle, plate }) {
    const driver = await Driver.findByPk(driverId);
    if (!driver) return null;
    if (name !== undefined) driver.name = name;
    if (vehicle !== undefined) driver.vehicle = vehicle;
    if (plate !== undefined) driver.plate = plate;
    await driver.save();
    return driver;
  }

  async addEarnings(userId, amount) {
    const driver = await Driver.findOne({ where: { userId } });
    if (driver) {
      const current = parseFloat(driver.totalEarnings || 0);
      const additional = parseFloat(amount || 0);
      // Use rounding to nearest integer for VND to avoid floating point 'strange numbers' (like 0.300000004)
      driver.totalEarnings = Math.round(current + additional);
      await driver.save();
      console.log(`[DriverService] Added ${amount} to Driver user ${userId}. New balance: ${driver.totalEarnings}`);
    }
    return driver;
  }

  async updateRating(userIdOrId, newStar) {
    const { Op } = require('sequelize');
    const numericId = parseInt(userIdOrId);
    let whereClause;
    if (!isNaN(numericId)) {
        whereClause = { [Op.or]: [{ userId: numericId }, { id: numericId }] };
    } else {
        whereClause = { userId: userIdOrId };
    }

    const driver = await Driver.findOne({ where: whereClause });
    if (driver) {
      const currentRating = parseFloat(driver.rating || 5.0);
      const currentCount = parseInt(driver.ratingCount || 0);
      
      const newCount = currentCount + 1;
      // Formula: ((avg * count) + new) / newCount
      const newRating = ((currentRating * currentCount) + parseFloat(newStar)) / newCount;
      
      driver.rating = Math.round(newRating * 100) / 100; // Round to 2 decimal places
      driver.ratingCount = newCount;
      await driver.save();
      
      console.log(`[DriverService] Updated rating for driver ${driver.userId}. New Rating: ${driver.rating} (Count: ${newCount})`);
      return driver;
    }
    return null;
  }
}

module.exports = new DriverService();
