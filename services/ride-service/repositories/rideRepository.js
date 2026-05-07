const Ride = require('../models/Ride');

class RideRepository {
  async create(rideData) {
    return await Ride.create(rideData);
  }

  async update(id, data) {
    const ride = await Ride.findByPk(id);
    if (ride) {
      await ride.update(data);
    }
    return ride;
  }

  async updateStatus(id, status) {
    const ride = await Ride.findByPk(id);
    if (ride) {
      ride.status = status;
      await ride.save();
    }
    return ride;
  }

  async updateStatusWithLock(id, newStatus, expectedCurrentStatus) {
    const [updatedCount] = await Ride.update(
      { status: newStatus },
      { where: { id, status: expectedCurrentStatus } }
    );
    if (updatedCount > 0) {
      return await Ride.findByPk(id);
    }
    return null;
  }

  async findById(id) {
    return await Ride.findByPk(id);
  }

  async findByBookingId(bookingId) {
    return await Ride.findOne({ where: { bookingId } });
  }

  async findAll(filter = {}) {
    // If filter is simple { userId }, convert to { where: { userId } }
    const query = filter.where ? filter : { where: filter };
    return await Ride.findAll({ ...query, order: [['createdAt', 'DESC']] });
  }

  async findOne(query) {
    return await Ride.findOne(query);
  }
}

module.exports = new RideRepository();
