const driverService = require('../services/driverService');

class DriverController {
  async createDriver(req, res) {
    try {
      const { name, location } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required' });
      const driver = await driverService.createDriver(name, location);
      res.status(201).json({ message: 'Driver created', data: driver });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getAvailableDrivers(req, res) {
    try {
      const drivers = await driverService.getAvailableDrivers();
      res.status(200).json({ data: drivers });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getAllDrivers(req, res) {
    try {
      const Driver = require('../models/Driver');
      const drivers = await Driver.findAll();
      res.status(200).json({ data: drivers });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateLocation(req, res) {
    try {
      const { id } = req.params;
      const { location } = req.body;

      if (!location) {
        return res.status(400).json({ error: 'Location is required' });
      }

      const driver = await driverService.updateLocation(id, location);
      if (!driver) {
        return res.status(404).json({ error: 'Driver not found' });
      }

      res.status(200).json({ message: 'Location updated', data: driver });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async assignNearestDriver(req, res) {
    try {
      const { bookingId, pickup } = req.body;

      if (!bookingId) {
        return res.status(400).json({ error: 'Booking ID is required' });
      }

      const assignment = await driverService.assignNearestDriver(bookingId, pickup);
      res.status(200).json({ message: 'Driver assigned', ...assignment });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateStatus(req, res) {
    try {
      const { status } = req.body;
      const userId = req.headers['x-user-id'];
      const userRole = req.headers['x-user-role']; // Role được API Gateway trích xuất từ JWT và gắn vào

      if (!userId) {
        return res.status(401).json({ error: 'User ID missing in headers' });
      }

      // RBAC: Chỉ cho phép tài khoản có role 'driver' mới được cập nhật trạng thái
      if (userRole !== 'driver') {
        console.warn(`[DriverService] Unauthorized status update by user ${userId} with role '${userRole}'`);
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Tài khoản của bạn là Passenger, không có quyền cập nhật trạng thái tài xế.'
        });
      }

      const driver = await driverService.updateDriverStatus(userId, status);
      res.status(200).json({ message: 'Driver status updated', data: driver });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getStatus(req, res) {
    try {
      const { id } = req.params;
      const status = await driverService.getDriverStatus(id);
      res.status(200).json(status);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getMe(req, res) {
    try {
      const userId = req.headers['x-user-id'];

      let name = null;
      if (req.headers['x-user-name']) {
        name = decodeURIComponent(req.headers['x-user-name']);
      }

      if (!userId) return res.status(401).json({ error: 'User ID missing' });

      const d = await driverService.getDriverByUserId(userId, name);
      res.status(200).json({ data: d });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getDriverById(req, res) {
    try {
      const { id } = req.params;
      const driver = await require('../models/Driver').findByPk(id);
      if (!driver) return res.status(404).json({ error: 'Driver not found' });
      res.status(200).json({ data: driver });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateProfile(req, res) {
    try {
      const { id } = req.params;
      const { name, vehicle, plate } = req.body;
 
      const driver = await driverService.updateProfile(id, { name, vehicle, plate });
      if (!driver) {
        return res.status(404).json({ error: 'Driver not found' });
      }

      res.status(200).json({ message: 'Profile updated', data: driver });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async addEarnings(req, res) {
    try {
      const { id } = req.params;
      const { amount } = req.body;
      if (!amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({ error: 'Invalid amount' });
      }
      const driver = await driverService.addEarnings(id, parseFloat(amount));
      if (!driver) return res.status(404).json({ error: 'Driver not found' });
      res.status(200).json({ message: 'Earnings updated', totalEarnings: driver.totalEarnings });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}


module.exports = new DriverController();
