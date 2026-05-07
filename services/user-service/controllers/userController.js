const userService = require('../services/userService');

class UserController {
  async createUser(req, res) {
    try {
      const user = await userService.createUser(req.body);
      res.status(201).json(user);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async getUsers(req, res) {
    try {
      const users = await userService.getUsers();
      res.status(200).json(users);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async getUser(req, res) {
    try {
      const user = await userService.getUser(req.params.id);
      if (user) {
        res.status(200).json(user);
      } else {
        res.status(404).json({ message: 'User not found' });
      }
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async updateUser(req, res) {
    try {
      const [updated] = await userService.updateUser(req.params.id, req.body);
      if (updated) {
        const updatedUser = await userService.getUser(req.params.id);
        res.status(200).json(updatedUser);
      } else {
        res.status(404).json({ message: 'User not found' });
      }
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async deleteUser(req, res) {
    try {
      const deleted = await userService.deleteUser(req.params.id);
      if (deleted) {
        res.status(204).json();
      } else {
        res.status(404).json({ message: 'User not found' });
      }
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async updateProfile(req, res) {
    try {
      const userId = req.headers['x-user-id'];
      if (!userId) {
        return res.status(401).json({ message: 'User ID missing in headers' });
      }

      const { name, phone } = req.body;
      if (!name && !phone) {
        return res.status(400).json({ message: 'At least one of name or phone is required' });
      }

      const profile = await userService.updateProfileByUserId(userId, { name, phone });
      
      // Send back mapped object for frontend
      res.status(200).json({ 
        message: 'Profile updated', 
        data: {
          id: profile.id,
          name: profile.firstName || '',
          phone: profile.phone || '',
          email: profile.email || ''
        } 
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async getProfile(req, res) {
    try {
      const userId = req.headers['x-user-id'];
      if (!userId) {
        return res.status(401).json({ message: 'User ID missing in headers' });
      }

      const profile = await userService.getProfileByUserId(userId);
      
      // Send back mapped object
      res.status(200).json({ 
        data: {
          id: profile.id,
          name: profile.firstName || '',
          phone: profile.phone || '',
          email: profile.email || ''
        } 
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = new UserController();
