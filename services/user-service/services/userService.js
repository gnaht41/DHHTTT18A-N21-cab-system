const userRepository = require('../repositories/userRepository');

class UserService {
  async createUser(userData) {
    return await userRepository.create(userData);
  }

  async getUsers() {
    return await userRepository.findAll();
  }

  async getUser(id) {
    return await userRepository.findById(id);
  }

  async updateUser(id, userData) {
    return await userRepository.update(id, userData);
  }

  async updateProfileByUserId(userId, { name, phone }) {
    const UserProfile = require('../models/User');
    let profile = await UserProfile.findOne({ where: { userId } });
    if (!profile) {
      profile = await UserProfile.create({ userId });
    }
    if (name !== undefined) profile.firstName = name;
    if (phone !== undefined) profile.phone = phone;
    await profile.save();
    return profile;
  }

  async getProfileByUserId(userId) {
    const UserProfile = require('../models/User');
    let profile = await UserProfile.findOne({ where: { userId } });
    if (!profile) {
      profile = await UserProfile.create({ userId });
    }
    return profile;
  }

  async deleteUser(id) {
    return await userRepository.delete(id);
  }
}

module.exports = new UserService();
