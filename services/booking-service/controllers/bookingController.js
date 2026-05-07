const bookingService = require('../services/bookingService');

class BookingController {
  async createBooking(req, res) {
    console.log('[BookingController] Creating booking. Body:', req.body);
    try {
      // Support both field name variants to match test case spec:
      // 'drop' is alias for 'destination', 'distance_km' is alias for 'distance'
      const destination = req.body.destination || req.body.drop;
      const distance    = req.body.distance !== undefined ? req.body.distance : req.body.distance_km;
      const { pickup, price, duration, routeData } = req.body;
      const userId = req.headers['x-user-id'];
      const idempotencyKey = req.headers['x-idempotency-key'];

      if (!userId) {
        console.warn(`[BookingService] POST / -> 401 Unauthorized (Missing user id)`);
        return res.status(401).json({ error: 'User identity missing' });
      }

      // Item 11: Booking thiếu pickup -> lỗi 400
      if (!pickup) {
        return res.status(400).json({ error: 'pickup is required' });
      }
      if (!destination) {
        return res.status(400).json({ error: 'destination (or drop) is required' });
      }
      if (distance === undefined || distance === null) {
        return res.status(400).json({ error: 'distance (or distance_km) is required' });
      }

      const formatCoordinate = (value) => {
        if (typeof value === 'string') {
          const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
          if (match) {
            const lat = Number(match[1]);
            const lng = Number(match[2]);
            if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return value.trim();
          }
          return null;
        }
        if (typeof value === 'object' && value !== null) {
          const lat = Number(value.lat);
          const lng = Number(value.lng);
          if (!Number.isNaN(lat) && !Number.isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return `${lat},${lng}`;
          }
        }
        return null;
      };

      const formattedPickup = formatCoordinate(pickup);
      if (!formattedPickup) {
        return res.status(422).json({ error: 'pickup must be a valid lat,lng string or {lat,lng} object' });
      }

      const formattedDestination = formatCoordinate(destination);
      if (!formattedDestination) {
        return res.status(422).json({ error: 'destination must be a valid lat,lng string or {lat,lng} object' });
      }

      // TC 14: Validation cho payment_method
      const { payment_method } = req.body;
      const validMethods = ['cash', 'card', 'momo', 'zalo_pay'];
      if (payment_method && !validMethods.includes(payment_method)) {
        console.warn(`[BookingService] Rejected invalid payment method: ${payment_method}`);
        return res.status(400).json({ error: 'Invalid payment method' });
      }

      if (typeof distance !== 'number' || Number.isNaN(distance) || distance < 0) {
        return res.status(422).json({ error: 'distance must be a non-negative number' });
      }

      const numericUserId = Number(userId);
      if (Number.isNaN(numericUserId)) {
        return res.status(400).json({ error: 'User identity must be a numeric x-user-id header' });
      }

      // Item 19: Duplicate booking request (idempotency)
      if (idempotencyKey) {
        const existingBooking = await bookingService.getBookingByIdempotencyKey(idempotencyKey);
        if (existingBooking) {
          console.log(`[BookingService] Found existing booking for idempotency key: ${idempotencyKey}`);
          return res.status(200).json({ 
            message: 'Duplicate request - returning existing booking', 
            data: existingBooking 
          });
        }
      }

      const result = await bookingService.createBooking(
        numericUserId,
        formattedPickup,
        formattedDestination,
        price,
        distance,
        duration,
        routeData,
        idempotencyKey
      );

      if (result.error === 'No drivers available') {
        return res.status(200).json({ 
          message: 'No drivers available', 
          status: 'FAILED',
          data: null 
        });
      }

      console.log(`[BookingService] POST / -> Success, booking created: ${result.booking.id}`);
      res.status(201).json({ message: 'Booking processed successfully', data: result.booking });
    } catch (error) {
      console.error(`[BookingService] POST / -> Error:`, error.stack);
      res.status(500).json({ error: error.message });
    }
  }

  async getActiveBooking(req, res) {
    try {
      const userId = req.headers['x-user-id'];
      console.log(`[BookingService] GET /active -> getActiveBooking for user: ${userId}`);
      if (!userId) {
        console.warn(`[BookingService] GET /active -> 401 Unauthorized`);
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const booking = await bookingService.getActiveBooking(userId);
      console.log(`[BookingService] GET /active -> Found active booking:`, booking ? booking.id : 'None');
      res.json(booking);
    } catch (error) {
      console.error(`[BookingService] GET /active -> Error:`, error.stack);
      res.status(500).json({ error: error.message });
    }
  }

  async getBookings(req, res) {
    try {
      const queryUserId = req.query.user_id || req.headers['x-user-id'];
      if (!queryUserId) {
        return res.status(400).json({ error: 'user_id is required' });
      }

      const bookings = await bookingService.getBookings(queryUserId);
      res.status(200).json(bookings);
    } catch (error) {
      console.error('[BookingController] GET / -> Error fetching bookings:', error.stack);
      res.status(500).json({ error: error.message });
    }
  }

  async getPendingBookings(req, res) {
    try {
      console.log('[BookingController] Fetching pending bookings...');
      const bookings = await bookingService.getPendingBookings();
      console.log(`[BookingController] Found ${bookings.length} pending bookings.`);
      res.json(bookings);
    } catch (error) {
      console.error('[BookingController] Error fetching pending bookings:', error.message);
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const booking = await bookingService.getBookingById(req.params.id);
      if (!booking) return res.status(404).json({ error: 'Booking not found' });
      res.json({ data: booking });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateStatus(req, res) {
    try {
      const { status } = req.body;
      const booking = await bookingService.updateBookingStatus(req.params.id, status);
      res.json({ data: booking });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new BookingController();
