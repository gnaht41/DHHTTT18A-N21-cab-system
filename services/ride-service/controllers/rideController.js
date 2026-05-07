const http = require('http');
const https = require('https');
const rideService = require('../services/rideService');

class RideController {
  async createRide(req, res) {
    try {
      const { bookingId, driverId, userId } = req.body;

      const ride = await rideService.createRide(bookingId, parseInt(driverId), parseInt(userId));
      res.status(201).json(ride);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      const ride = await rideService.updateRideStatus(id, status);
      if (!ride) {
        return res.status(404).json({ error: 'Ride not found' });
      }

      res.status(200).json({ message: 'Ride status updated', data: ride });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async accept(req, res) {
    try {
      const ride = await rideService.acceptRide(req.params.id);
      if (!ride) return res.status(404).json({ error: 'Ride not found' });
      res.json({ message: 'Ride accepted', data: ride });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async arrive(req, res) {
    try {
      const ride = await rideService.arriveRide(req.params.id);
      if (!ride) return res.status(404).json({ error: 'Ride not found' });
      res.json({ message: 'Driver arrived', data: ride });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async start(req, res) {
    try {
      const ride = await rideService.startRide(req.params.id);
      if (!ride) return res.status(404).json({ error: 'Ride not found' });
      res.json({ message: 'Ride started', data: ride });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async complete(req, res) {
    try {
      const ride = await rideService.completeRide(req.params.id);
      if (!ride) return res.status(404).json({ error: 'Ride not found' });
      res.json({ message: 'Ride completed', data: ride });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async cancel(req, res) {
    try {
      const ride = await rideService.cancelRide(req.params.id);
      if (!ride) return res.status(404).json({ error: 'Ride not found' });
      res.json({ message: 'Ride cancelled', data: ride });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getAll(req, res) {
    try {
      const userId = String(req.headers['x-user-id']);
      const role = req.headers['x-user-role'];
      const { Op } = require('sequelize');

      if (!userId || userId === 'undefined') return res.status(401).json({ error: 'Identity missing' });

      let rides;
      if (role === 'driver') {
        rides = await rideService.getAllRides({
          where: {
            [Op.or]: [
              { driverId: userId },
              { status: 'DRIVER_ASSIGNED' }
            ]
          }
        });
      } else {
        // Passenger sees only their own rides
        rides = await rideService.getAllRides({ userId });
      }
      res.json(rides);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const ride = await rideService.getRide(req.params.id);
      if (!ride) return res.status(404).json({ error: 'Ride not found' });
      res.json(ride);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getActiveRide(req, res) {
    try {
      const userId = req.headers['x-user-id'];
      const role = req.headers['x-user-role'];
      const { Op } = require('sequelize');

      if (!userId) return res.status(401).json({ error: 'Identity missing' });

      let ride;
      if (role === 'driver') {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        ride = await rideService.getOneRide({
          where: {
            driverId: String(userId),
            [Op.or]: [
              { status: { [Op.notIn]: ['CANCELLED', 'PAID'] } },
              { status: 'PAID', updatedAt: { [Op.gte]: fiveMinAgo } }
            ]
          },
          order: [['updatedAt', 'DESC']]
        });
      } else {
        ride = await rideService.getOneRide({
          where: {
            userId: String(userId),
            [Op.or]: [
              { status: { [Op.notIn]: ['CANCELLED', 'PAID'] } },
              { [Op.and]: [{ status: 'PAID' }, { isReviewed: false }] }
            ]
          }
        });
      }

      if (!ride) return res.status(200).json(null);
      res.json(ride);
    } catch (error) {
      console.error('[RideController] getActiveRide error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getLastRide(req, res) {
    try {
      const userId = String(req.headers['x-user-id']);
      const role = req.headers['x-user-role'];
      const { Op } = require('sequelize');

      if (!userId || userId === 'undefined') return res.status(401).json({ error: 'Identity missing' });

      let ride;
      if (role === 'driver') {
        ride = await rideService.getOneRide({
          where: { driverId: userId },
          order: [['updatedAt', 'DESC']]
        });
      } else {
        ride = await rideService.getOneRide({
          where: { userId: userId },
          order: [['updatedAt', 'DESC']]
        });
      }

      if (!ride) return res.status(200).json(null);
      res.json(ride);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getRideHistory(req, res) {
    try {
      const userId = String(req.headers['x-user-id']);
      const { Op } = require('sequelize');
      const history = await rideService.getAllRides({
        where: {
          [Op.or]: [{ userId }, { driverId: userId }],
          [Op.or]: [
            { status: 'CANCELLED' },
            { 
              [Op.and]: [
                { status: 'PAID' },
                { isReviewed: true }
              ]
            }
          ]
        },
        order: [['createdAt', 'DESC']],
        limit: 20
      });
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async acceptBooking(req, res) {
    const { bookingId } = req.params;
    const driverId = parseInt(req.headers['x-user-id']);
    console.log(`[acceptBooking] Driver ${driverId} accepting Booking ${bookingId}`);

    if (!driverId) return res.status(401).json({ error: 'Driver identity missing' });

    const internalRequest = (serviceUrl, path, method, headers = {}, body = null) => {
      return new Promise((resolve, reject) => {
        const target = new URL(path, serviceUrl);
        const client = target.protocol === 'https:' ? https : http;
        const options = {
          hostname: target.hostname,
          port: target.port || (target.protocol === 'https:' ? 443 : 80),
          path: `${target.pathname}${target.search}`,
          method,
          headers: { ...headers }
        };
        if (body) {
          options.headers['Content-Type'] = 'application/json';
          options.headers['Content-Length'] = Buffer.byteLength(body);
        }

        const r = client.request(options, (res2) => {
          let data = '';
          res2.on('data', (d) => data += d);
          res2.on('end', () => {
            try {
              const payload = data ? JSON.parse(data) : {};
              resolve({ statusCode: res2.statusCode || 200, payload });
            } catch (e) {
              console.warn(`[InternalRequest] Parse error from ${serviceUrl}:`, data.substring(0, 100));
              resolve({
                statusCode: res2.statusCode || 500,
                payload: data ? { raw: data } : {}
              });
            }
          });
        });
        r.on('error', (err) => {
          console.error(`[InternalRequest] Error calling ${serviceUrl}:`, err.message);
          reject(err);
        });
        if (body) r.write(body);
        r.end();
      });
    };

    const requestFirstReachable = async (serviceUrls, path, method, headers = {}, body = null) => {
      let lastError;

      for (const serviceUrl of serviceUrls) {
        try {
          return await internalRequest(serviceUrl, path, method, headers, body);
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError || new Error(`All service endpoints failed for ${path}`);
    };

    const bookingServiceUrls = [
      process.env.BOOKING_SERVICE_URL,
      'http://booking-service:3002',
      'http://localhost:3002'
    ].filter(Boolean);
    const driverServiceUrls = [
      process.env.DRIVER_SERVICE_URL,
      'http://driver-service:3003',
      'http://localhost:3003'
    ].filter(Boolean);

    try {
      // 0a. Fetch Driver Details to get internal DB ID (Numeric)
      // This is necessary because the Ride table stores internal driverId, not Auth userId
      const driverServiceUrls = [
        process.env.DRIVER_SERVICE_URL,
        'http://driver-service:3003',
        'http://localhost:3003'
      ].filter(Boolean);

      console.log(`[acceptBooking] Step 0: Resolving internal ID for User ${driverId}`);
      const driverRes = await requestFirstReachable(
        driverServiceUrls,
        '/api/drivers/me',
        'GET',
        { 'x-user-id': String(driverId) }
      ).catch(() => ({ payload: {} }));
      
      const driverData = driverRes.payload.data || driverRes.payload;
      const internalDriverId = driverData.id;

      if (!internalDriverId) {
        throw new Error('Driver profile not found. Please ensure you are logged in and online.');
      }

      // 0b. Check duplicate / Idempotency
      const existing = await rideService.getRideByBooking(bookingId);
      if (existing) {
        // If driver already accepted it, return success (Idempotent)
        // FORCE string comparison to avoid Integer vs String mismatch
        if (String(existing.driverId) === String(internalDriverId)) {
          console.log(`[acceptBooking] Driver ${internalDriverId} already accepted/assigned for booking ${bookingId}. Returning current state.`);
          return res.status(200).json({ success: true, message: 'Ride already accepted', data: existing });
        }
        
        // If someone else already took it
        return res.status(409).json({ error: 'This booking has already been accepted by another driver' });
      }

      // 1. Fetch Booking (+ Passenger ID)
      console.log(`[acceptBooking] Step 1: Fetching booking ${bookingId}`);
      const bookingResponse = await requestFirstReachable(bookingServiceUrls, `/api/bookings/${bookingId}`, 'GET');
      const bookingPayload = bookingResponse.payload || {};
      const booking = bookingPayload.data || bookingPayload;
      const passengerId = booking.userId;
      const price = booking.price;

      if (!passengerId) {
        throw new Error('Could not retrieve passenger ID for this booking');
      }

      // 2. Already fetched driver details in Step 0
      const driverName = driverData.name || `Driver ${driverId}`;
      const driverVehicle = driverData.vehicle || 'Standard Sedan';
      const driverPlate = driverData.plate || '29A-888.88';

      // 3. Create Ride
      console.log(`[acceptBooking] Step 3: Creating ride for Booking ${bookingId}`);
      
      const routingService = require('../services/routing.service');
      const routeInfo = await routingService.getRoute(booking.pickup, booking.destination);
      const routeData = routeInfo ? routeInfo.coordinates : null;

      const ride = await rideService.createRide(
        parseInt(bookingId),
        internalDriverId,
        parseInt(passengerId),
        driverName,
        driverVehicle,
        driverPlate,
        price,
        booking.pickup,
        booking.destination,
        routeData
      );

      // 4. Update Booking and Driver Status (Background tasks to prevent timeouts)
      console.log(`[acceptBooking] Step 4: Spawning async background updates for status tracking`);
      
      // Do not await these external HTTP calls to avoid request timeouts
      requestFirstReachable(
        bookingServiceUrls,
        `/api/bookings/${bookingId}/status`,
        'PATCH',
        {},
        JSON.stringify({ status: 'ACCEPTED' })
      ).catch(e => console.warn('Failed booking status update (background):', e.message));

      requestFirstReachable(
        driverServiceUrls,
        '/api/drivers/status',
        'PATCH',
        { 'x-user-id': String(driverId) },
        JSON.stringify({ status: 'BUSY' })
      ).catch(e => console.warn('Failed driver status update (background):', e.message));

      console.log(`[acceptBooking] Successfully created Ride ${ride.id}`);
      return res.status(201).json({ success: true, message: 'Ride accepted successfully', data: ride });

    } catch (error) {
      console.error('[acceptBooking] Critical failure:', error.message);
      return res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new RideController();
