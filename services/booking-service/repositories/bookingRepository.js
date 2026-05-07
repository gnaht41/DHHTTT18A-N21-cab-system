const Booking = require('../models/Booking');

class BookingRepository {
  async create(bookingData) {
    return await Booking.create(bookingData);
  }

  async updateStatus(id, status) {
    const booking = await Booking.findByPk(id);
    if (booking) {
      booking.status = status;
      await booking.save();
    }
    return booking;
  }

  async findById(id) {
    return await Booking.findByPk(id);
  }

  async findOne(query) {
    return await Booking.findOne(query);
  }

  async findAll(query) {
    return await Booking.findAll(query);
  }
}

module.exports = new BookingRepository();
