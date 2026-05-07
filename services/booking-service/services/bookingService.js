const { v4: uuidv4 } = require('uuid');
const bookingRepository = require('../repositories/bookingRepository');
const { Booking, OutboxEvent, sequelize } = require('../models');

class BookingService {
  async createBooking(userId, pickup, destination, price, distance, duration, routeData, idempotencyKey) {
    // Item 13 check: Kiểm tra tài xế Online with Retry & Fallback for Level 8 Resilience
    let isPending = false;
    try {
      const axios = require('axios');
      const driverServiceUrl = process.env.DRIVER_SERVICE_URL || 'http://driver-service:3003';
      
      let attempts = 0;
      let success = false;
      let driversRes;

      while (attempts < 3 && !success) {
        attempts++;
        try {
          console.log(`[BookingService] Driver check attempt ${attempts} at: ${driverServiceUrl}/api/drivers/available`);
          // Gán timeout ngắn để test retry nhanh hơn
          driversRes = await axios.get(`${driverServiceUrl}/api/drivers/available`, { timeout: 2000 });
          success = true;
        } catch (error) {
          console.warn(`[BookingService] Attempt ${attempts} failed: ${error.message}`);
          if (attempts < 3) {
            console.log(`[BookingService] Waiting 1s before retry...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      if (!success) {
        console.error(`[BookingService] All 3 attempts failed. Activating Fallback to PENDING.`);
        isPending = true;
      } else if (!driversRes.data.data || driversRes.data.data.length === 0) {
        console.warn(`[BookingService] Driver service UP but no drivers available for userId ${userId}`);
        return { error: 'No drivers available', status: 'FAILED' };
      } else {
        console.log(`[BookingService] Found ${driversRes.data.data.length} available drivers.`);
      }
    } catch (err) {
      console.error(`[BookingService] Critical resilience failure: ${err.message}`);
      isPending = true; 
    }

    // AI Service Call for ETA
    let finalDuration = duration || 0;
    try {
      const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://ai-service:3007';
      console.log(`[BookingService] Calling AI Service at ${aiServiceUrl} with distance: ${distance}`);
      const aiRes = await axios.post(`${aiServiceUrl}/api/ai/eta`, { distance_km: Number(distance) });
      if (aiRes.data && aiRes.data.eta !== undefined) {
        finalDuration = aiRes.data.eta;
        console.log(`[BookingService] Fetched ETA: ${finalDuration} mins`);
      }
    } catch (err) {
      console.error(`[BookingService] AI Service (ETA) call failed: ${err.message}`);
      finalDuration = finalDuration || Math.ceil(Number(distance) * 2.5); // Fallback logic
    }

    // Pricing Service Call for Price with Circuit Breaker & Fallback
    let finalPrice = price;
    try {
      const { pricingServiceClient } = require('../utils/serviceClient');
      
      // Sử dụng Resilient Client (Bulkhead -> Circuit Breaker -> Retry)
      const pricingRes = await pricingServiceClient.post('/api/pricing', { 
        distance_km: Number(distance),
        demand_index: 1.0 
      }, { timeout: 2000 }, async () => {
        // Fallback nội bộ khi Circuit Breaker OPEN hoặc lỗi
        const fbPrice = price || (Math.random() * (25 - 8) + 8).toFixed(2);
        console.log(`[CircuitBreaker] Fallback active: Using price ${fbPrice}`);
        return { price: fbPrice };
      });

      finalPrice = pricingRes.price;
      console.log(`[BookingService] Fetched Price: ${finalPrice}`);
    } catch (err) {
      console.error(`[BookingService] Pricing failure (handled by CB): ${err.message}`);
      finalPrice = finalPrice || (Math.random() * (25 - 8) + 8).toFixed(2);
    }

    // ATOMIC TRANSACTION: Booking + Outbox
    const result = await sequelize.transaction(async (transaction) => {
      // 1. Create booking
      const booking = await Booking.create({
        userId,
        pickup,
        destination,
        status: isPending ? 'PENDING' : 'REQUESTED',
        price: Number(finalPrice),
        distance,
        duration: finalDuration,
        routeData: typeof routeData === 'string' ? routeData : JSON.stringify(routeData),
        idempotencyKey
      }, { transaction });

      // 2. Simulate error in transaction for Level 4 ACID Testing
      if (idempotencyKey === 'ROLLBACK_TEST_v2') {
        throw new Error('Simulated DB Error midway for transaction rollback test');
      }

      // 3. Create outbox event (same transaction = atomic)
      const eventId = uuidv4();
      const sagaId = `saga-${booking.id}`;

      await OutboxEvent.create({
        id: eventId,
        aggregateType: 'Booking',
        aggregateId: String(booking.id),
        eventType: 'BookingCreated',
        payload: {
          eventId,
          sagaId,
          bookingId: booking.id,
          userId: booking.userId,
          pickup: booking.pickup,
          destination: booking.destination,
          price: booking.price,
          distance: booking.distance,
          duration: booking.duration,
          routeData: booking.routeData,
          timestamp: new Date().toISOString()
        },
        headers: {
          'event-type': 'BookingCreated',
          'saga-id': sagaId,
        },
        status: 'PENDING',
        retryCount: 0,
      }, { transaction });

      console.log(`[Outbox] Created outbox event ${eventId} for booking ${booking.id}`);

      return { booking, outboxEventId: eventId, sagaId };
    });

    console.log(`[Outbox] Booking ${result.booking.id} created, saga ${result.sagaId} started`);
    return { booking: result.booking };
  }

  async getActiveBooking(userId) {
    const { Op } = require('sequelize');
    return await bookingRepository.findOne({
      where: {
        userId,
        status: { [Op.in]: ['REQUESTED', 'ACCEPTED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'] }
      },
      order: [['createdAt', 'DESC']]
    });
  }

  async getBookings(userId) {
    if (!userId) {
      return [];
    }

    return await bookingRepository.findAll({
      where: { userId: Number(userId) },
      order: [['createdAt', 'DESC']]
    });
  }

  async getPendingBookings() {
    const bookings = await bookingRepository.findAll({ where: { status: 'REQUESTED' } });
    // Normalize to use bookingId instead of id for consistency with Kafka events
    return bookings.map(b => ({
      id: b.id,
      bookingId: b.id,
      userId: b.userId,
      pickup: b.pickup,
      destination: b.destination,
      price: b.price,
      status: b.status,
      createdAt: b.createdAt
    }));
  }

  async getBookingById(id) {
    return await bookingRepository.findById(id);
  }

  async updateBookingStatus(id, status) {
    return await bookingRepository.updateStatus(id, status);
  }

  async getBookingByIdempotencyKey(key) {
    return await Booking.findOne({ where: { idempotencyKey: key } });
  }
}

module.exports = new BookingService();
