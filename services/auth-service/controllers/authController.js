const authService = require('../services/authService');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class AuthController {
  async register(req, res) {
    try {
      const { name, email, password, role } = req.body;
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      const normalizedName = typeof name === 'string' && name.trim() !== '' ? name.trim() : normalizedEmail.split('@')[0] || 'user';

      if (!normalizedEmail || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      if (!EMAIL_REGEX.test(normalizedEmail)) {
        return res.status(422).json({ error: 'Email format is invalid' });
      }

      if (typeof password !== 'string' || password.length < 6) {
        return res.status(422).json({ error: 'Password must be at least 6 characters' });
      }

      const result = await authService.register(normalizedName, normalizedEmail, password, role);
      res.status(201).json({ message: 'User registered successfully', ...result });
    } catch (error) {
      console.error('[AuthController Register Error]:', error.message);
      if (error.message.includes('already exists') || error.message.includes('User already exists')) {
        return res.status(400).json({ error: 'Email already registered. Please login instead.' });
      }
      res.status(500).json({ error: error.message });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

      if (!normalizedEmail || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const result = await authService.login(normalizedEmail, password);
      res.status(200).json(result);
    } catch (error) {
      console.error('[AuthController Login Error]:', error.message);
      if (error.message.includes('Invalid email or password')) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      res.status(500).json({ error: error.message });
    }
  }

  async logout(req, res) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(200).json({ message: 'Already logged out' });
      }
      const token = authHeader.split(' ')[1];
      
      try {
        const RedisCache = require('../utils/redisCache');
        const cache = new RedisCache();
        await cache.set(`blacklist:${token}`, 'true', 86400); 
      } catch (redisErr) {
        console.error('[AuthController Logout] Redis error:', redisErr.message);
      }
      
      res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('[AuthController Logout Error]:', error.message);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new AuthController();
