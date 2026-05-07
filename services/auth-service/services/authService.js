const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const { publishUserCreated } = require('../events/authEvents');

const jwtSecret = process.env.JWT_SECRET || 'super_secret_jwt_key_here';

class AuthService {
  generateToken(payload) {
    return jwt.sign(payload, jwtSecret, { expiresIn: '1d' });
  }

  async register(name, email, password, role) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // DB ENUM chỉ chấp nhận: 'user' | 'driver' | 'admin'. 'user' = passenger mặc định.
    const normalizedRole = role === 'driver' ? 'driver' : 'user';

    const newUser = await userRepository.create({
      email,
      password: hashedPassword,
      role: normalizedRole,
    });

    // Publish event for user-service to create profile
    try {
      const eventPayload = {
        ...newUser.toJSON(),
        name: name || (email.split('@')[0]) // Pass name explicitly
      };
      await publishUserCreated(eventPayload);
    } catch (eventErr) {
      console.error('[AuthService Register] Failed to publish USER_CREATED event:', eventErr.message);
    }

    const payload = {
      sub: newUser.id,
      id: newUser.id,
      name: name || (email.split('@')[0]), // Return name from parameter, not DB
      email: newUser.email,
      role: newUser.role,
    };

    const token = this.generateToken(payload);
    return { token, user: payload };
  }

  async login(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    const payload = {
      sub: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const token = this.generateToken(payload);
    return { token, user: payload };
  }
}

module.exports = new AuthService();
