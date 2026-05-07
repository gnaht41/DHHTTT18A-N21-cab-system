const rideRepository = require('../repositories/rideRepository');
const kafka = require('../config/kafka');
const { getIO } = require('../config/socket');

const DRIVER_SERVICE_URL = process.env.DRIVER_SERVICE_URL || 'http://driver-service:3003';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3001';

/**
 * Fetch a user's public profile (name, rating) from user-service.
 * The user-service stores name as 'firstName'. Returns defaults on error.
 */
const fetchUserInfo = async (userId) => {
  const urls = [USER_SERVICE_URL, 'http://localhost:3001'];
  for (const base of urls) {
    try {
      // Use the profile endpoint with x-user-id header (auth userId)
      const profileRes = await fetch(`${base}/api/users/profile`, {
        headers: { 'x-user-id': String(userId) },
        signal: AbortSignal.timeout(3000)
      });
      if (profileRes.ok) {
        const body = await profileRes.json();
        const u = body.data || body;
        const name = u.firstName || u.name || u.username;
        if (name) return { name, rating: String(u.rating || '5.0') };
      }
      // Fallback: fetch by ID directly
      const idRes = await fetch(`${base}/api/users/${userId}`, { signal: AbortSignal.timeout(3000) });
      if (idRes.ok) {
        const body = await idRes.json();
        const u = body.data || body;
        const name = u.firstName || u.name || u.username;
        if (name) return { name, rating: String(u.rating || '5.0') };
      }
    } catch { /* try next */ }
  }
  return { name: 'Khách hàng', rating: '5.0' };
};

/**
 * Fetch a driver's profile (name, vehicle, plate, rating) from driver-service.
 * Returns defaults on network error.
 */
const fetchDriverInfo = async (driverId) => {
  const urls = [DRIVER_SERVICE_URL, 'http://localhost:3003'];
  for (const base of urls) {
    try {
      const res = await fetch(`${base}/api/drivers/${driverId}`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) continue;
      const body = await res.json();
      const d = body.data || body;
      return {
        name: d.name || 'Driver',
        vehicle: d.vehicle || 'Sedan',
        plate: d.plate || '---',
        rating: String(d.rating || '5.0')
      };
    } catch { /* try next */ }
  }
  return { name: 'Driver', vehicle: 'Sedan', plate: '---', rating: '5.0' };
};

const STATUS_PRIORITY = {
  'REQUESTED': 1,
  'PENDING': 1,
  'DRIVER_ASSIGNED': 2,
  'ACCEPTED': 3,
  'ARRIVED': 4,
  'STARTED': 5,
  'COMPLETED': 6,
  'PAID': 7,
  'CANCELLED': 8
};

const publishRideEvent = async (topic, data) => {
  try {
    // V6: Emit to Socket FIRST for immediate UI feedback
    const io = getIO();
    const customerRoom = `customer_${data.userId}`;
    const driverRoom = `driver_${data.driverId}`;
    const roomBooking = `ride-${data.bookingId}`;
    const roomRide = `ride-${data.rideId}`;

    console.log(`[Socket.IO] Emitting ride-status-updated to rooms: ${customerRoom}, ${driverRoom}`, data);

    if (data.userId) io.to(customerRoom).emit('ride-status-updated', data);
    if (data.driverId) io.to(driverRoom).emit('ride-status-updated', data);
    if (data.bookingId) io.to(roomBooking).emit('ride-status-updated', data);
    if (data.rideId) io.to(roomRide).emit('ride-status-updated', data);

    // Then publish to Kafka
    await kafka.producer.send({
      topic,
      messages: [{
        key: String(data.rideId || data.bookingId || data.id),
        value: JSON.stringify(data)
      }]
    });
    console.log(`[Kafka] Published to ${topic}:`, data);
  } catch (err) {
    console.error(`[Kafka/Socket] Error processing ${topic}:`, err.message);
  }
};

class RideService {
  constructor() {
    this.driverLocations = new Map(); // driverId -> { lat, lng, lastUpdate }
  }

  updateDriverLocation(driverId, lat, lng, isAvailable = true) {
    const oldLoc = this.driverLocations.get(driverId);
    this.driverLocations.set(driverId, {
      lat,
      lng,
      isAvailable,
      lastUpdate: Date.now()
    });
    if (!oldLoc || oldLoc.isAvailable !== isAvailable) {
      console.log(`[RideService] Updated location for driver ${driverId}: ${lat}, ${lng}, available=${isAvailable}`);
    }
  }

  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async isDriverAvailable(driverId) {
    try {
      // First check in-memory cache
      const loc = this.driverLocations.get(driverId);
      if (loc && loc.isAvailable === false) {
        console.log(`[RideService] Driver ${driverId} marked unavailable in cache`);
        return false;
      }

      // Verify with driver-service using the driverId as userId
      const response = await fetch(`${DRIVER_SERVICE_URL}/api/drivers/${driverId}/status`);
      if (!response.ok) {
        console.warn(`[RideService] Failed to fetch driver ${driverId} status: ${response.status}`);
        return true; // Default to available if can't verify
      }
      const data = await response.json();
      // Driver can be ONLINE or AVAILABLE to be considered available
      const isAvailable = data.status === 'ONLINE' || data.status === 'AVAILABLE';

      // Update cache
      if (loc) {
        loc.isAvailable = isAvailable;
        this.driverLocations.set(driverId, loc);
      }

      return isAvailable;
    } catch (err) {
      console.error(`[RideService] Error checking driver ${driverId} availability:`, err.message);
      return true; // Default to available on error
    }
  }

  async findNearestDriver(pickupCoords, excludedDriverIds = []) {
    console.log(`[RideService] === findNearestDriver START ===`);
    console.log(`[RideService] Pickup: ${pickupCoords}`);
    console.log(`[RideService] Excluded drivers: ${excludedDriverIds}`);

    let nearestDriverId = null;
    let minDistance = Infinity;

    const [pLat, pLng] = pickupCoords.split(',').map(Number);
    const now = Date.now();

    // Sync from driver-service to augment cache
    try {
      const response = await fetch(`${DRIVER_SERVICE_URL}/api/drivers/available`);
      if (response.ok) {
        const { data } = await response.json();
        if (Array.isArray(data)) {
          data.forEach(d => {
            const dId = d.id.toString();
            // IMPORTANT: Use the actual DB timestamp to avoid making stale drivers look fresh
            const dbUpdateTime = d.updatedAt ? new Date(d.updatedAt).getTime() : 0;
            
            // If we don't have this driver or the DB record is newer than our cache
            const existing = this.driverLocations.get(dId);
            if (!existing || dbUpdateTime > existing.lastUpdate) {
              if (d.location) {
                const [lat, lng] = d.location.split(',').map(Number);
                this.driverLocations.set(dId, {
                  lat, lng, isAvailable: true, lastUpdate: dbUpdateTime
                });
              }
            }
          });
        }
      }
    } catch(err) {
      console.warn('[RideService] Could not fetch available drivers to sync cache:', err.message);
    }

    // DEBUG: Log all drivers in memory
    const allDrivers = Array.from(this.driverLocations.entries()).map(([id, loc]) => ({
      driverId: id,
      lat: loc.lat,
      lng: loc.lng,
      isAvailable: loc.isAvailable,
      lastUpdate: loc.lastUpdate,
      ageMs: now - loc.lastUpdate
    }));
    console.log(`[RideService] All drivers in memory (${allDrivers.length}):`, allDrivers);

    const availableDrivers = [];

    for (const [driverId, loc] of this.driverLocations.entries()) {
      if (excludedDriverIds.includes(driverId)) {
        console.log(`[RideService] Driver ${driverId} excluded from matching`);
        continue;
      }

      if (now - loc.lastUpdate > 3600000) {
        console.log(`[RideService] Driver ${driverId} location stale (${now - loc.lastUpdate}ms old)`);
        continue;
      }

      // Check availability (both in-memory and via driver-service)
      if (!loc.isAvailable) {
        console.log(`[RideService] Skipping driver ${driverId}: marked unavailable in socket update`);
        continue;
      }

      const isAvailable = await this.isDriverAvailable(driverId);
      if (!isAvailable) {
        console.log(`[RideService] Skipping driver ${driverId}: not available in driver-service check`);
        continue;
      }

      let dist = this.haversineDistance(pLat, pLng, loc.lat, loc.lng);
      
      // PRIORITY BOOST: Give a 500m "Socket Bonus" to drivers with fresh updates (<30s old)
      // This ensures real online drivers beat mock drivers at the same spot.
      const ageMs = now - loc.lastUpdate;
      if (ageMs < 30000) {
        dist = Math.max(0, dist - 0.5); 
        console.log(`[RideService] Driver ${driverId} gets Socket Bonus! New Effective Distance: ${dist.toFixed(2)}km`);
      }

      availableDrivers.push({ driverId, distance: dist, lat: loc.lat, lng: loc.lng });

      if (dist < minDistance) {
        minDistance = dist;
        nearestDriverId = driverId;
      }
    }

    console.log(`[RideService] Available drivers after filtering (${availableDrivers.length}):`, availableDrivers);
    console.log(`[RideService] Selected driver: ${nearestDriverId}, distance: ${minDistance === Infinity ? 'N/A' : minDistance.toFixed(2) + 'km'}`);
    console.log(`[RideService] === findNearestDriver END ===`);

    return nearestDriverId ? { driverId: nearestDriverId, distance: minDistance } : null;
  }

  async findAndAssignDriver(bookingData) {
    const { bookingId, pickup, destination, price, userId } = bookingData;
    const { getIO } = require('../config/socket');
    const io = getIO();

    console.log(`[RideService] === findAndAssignDriver START for booking ${bookingId} ===`);

    const triedDrivers = [];
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      console.log(`[RideService] Attempt ${attempts + 1}/${maxAttempts}`);

      const nearest = await this.findNearestDriver(pickup, triedDrivers);

      if (nearest) {
        const { driverId } = nearest;
        console.log(`[RideService] Found driver ${driverId} for booking ${bookingId} (Attempt ${attempts + 1})`);

        // Enrich notification with real user/driver details in parallel
        const [passengerInfo, driverInfo] = await Promise.all([
          fetchUserInfo(userId),
          fetchDriverInfo(driverId)
        ]);

        // Atomic creation of ride
        console.log(`[RideService] Creating ride record: bookingId=${bookingId}, driverId=${driverId}, userId=${userId}, userName=${passengerInfo.name}`);
        const ride = await rideRepository.create({
          bookingId,
          driverId,
          userId,
          userName: passengerInfo.name, // SAVE THE NAME IN DB
          status: 'DRIVER_ASSIGNED',
          price: price || 15.0,
          pickup,
          destination
        });
        console.log(`[RideService] Ride created successfully: rideId=${ride.id}`);

        // Calculate distance between pickup and destination for driver display
        let distanceKm = 0;
        try {
          const [pLat2, pLng2] = pickup.split(',').map(Number);
          const [dLat2, dLng2] = destination.split(',').map(Number);
          distanceKm = Math.round(this.haversineDistance(pLat2, pLng2, dLat2, dLng2) * 10) / 10;
        } catch { /* ignore parse errors */ }

        const notificationData = {
          rideId: ride.id,
          bookingId,
          userId,
          driverId,
          status: 'DRIVER_ASSIGNED',
          price: ride.price,
          pickup,
          destination,
          // Real passenger info for driver app
          passengerName: passengerInfo.name,
          passengerRating: passengerInfo.rating,
          // Real driver info for passenger app
          driverName: driverInfo.name,
          driverVehicle: driverInfo.vehicle,
          driverPlate: driverInfo.plate,
          driverRating: driverInfo.rating,
          distanceKm
        };
        console.log(`[RideService] Emitting enriched notificationData:`, notificationData);

        console.log(`[RideService] Emitting to customer_${userId} and driver_${driverId}`);
        io.to(`customer_${userId}`).emit('ride-status-updated', notificationData);
        io.to(`driver_${driverId}`).emit('ride-status-updated', notificationData);
        console.log(`[RideService] Socket emissions completed for booking ${bookingId}`);

        // FIX: Publish RideCreated event to Kafka so Payment Service can proceed
        await publishRideEvent('RideCreated', notificationData);
        console.log(`[RideService] Published RideCreated event for booking ${bookingId}`);

        // Set Timeout for Acceptance (30 seconds)
        setTimeout(async () => {
          const currentRide = await rideRepository.findById(ride.id);
          if (currentRide && currentRide.status === 'DRIVER_ASSIGNED') {
            console.log(`[RideService] Timeout: Driver ${driverId} did not accept ride ${ride.id}. Retrying...`);
            // Cancel this assignment and retry matching
            await rideRepository.updateStatus(ride.id, 'CANCELLED');
            triedDrivers.push(driverId);
            this.findAndAssignDriver(bookingData); // Recursive retry or handle better
          }
        }, 30000);

        console.log(`[RideService] === findAndAssignDriver SUCCESS for booking ${bookingId} ===`);
        return ride;
      }

      console.log(`[RideService] No driver found for booking ${bookingId}. Retrying in 2s... (${attempts + 1}/${maxAttempts})`);
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // CRITICAL FIX: Don't emit NO_DRIVER_FOUND if we have drivers but they're busy
    // Check one more time with detailed logging
    console.log(`[RideService] === FINAL CHECK before NO_DRIVER_FOUND ===`);
    const finalCheck = await this.findNearestDriver(pickup, triedDrivers);

    if (finalCheck) {
      console.log(`[RideService] CRITICAL: Driver found on final check! Driver: ${finalCheck.driverId}`);
      // Retry one more time immediately
      return this.findAndAssignDriver({ ...bookingData, _isRetry: true });
    }

    console.log(`[RideService] Failed to find driver for booking ${bookingId} after ${maxAttempts} attempts.`);
    console.log(`[RideService] Total drivers in memory: ${this.driverLocations.size}`);
    console.log(`[RideService] Drivers excluded: ${triedDrivers}`);

    // Log all driver statuses for debugging
    const allDrivers = Array.from(this.driverLocations.entries()).map(([id, loc]) => ({
      driverId: id,
      isAvailable: loc.isAvailable,
      lastUpdateAge: Date.now() - loc.lastUpdate
    }));
    console.log(`[RideService] All driver statuses:`, allDrivers);

    io.to(`customer_${userId}`).emit('ride-status-updated', { bookingId, status: 'NO_DRIVER_FOUND' });
    console.log(`[RideService] === findAndAssignDriver FAILED for booking ${bookingId} ===`);
    return null;
  }

  async createRide(bookingId, driverId, userId, driverName, driverVehicle, driverPlate, price, pickup, destination, routeData = null) {
    const passengerInfo = await fetchUserInfo(userId);
    const ride = await rideRepository.create({
      bookingId,
      driverId,
      userId,
      userName: passengerInfo.name,
      driverName,
      driverVehicle,
      driverPlate,
      price,
      pickup,
      destination,
      routeData,
      status: 'DRIVER_ASSIGNED'
    });
 
    await publishRideEvent('RideCreated', {
      rideId: ride.id,
      bookingId: ride.bookingId,
      driverId: ride.driverId,
      driverName: ride.driverName,
      driverVehicle: ride.driverVehicle,
      driverPlate: ride.driverPlate,
      userId: ride.userId,
      status: ride.status
    });
 
    // Notify passenger via Socket on their booking room
    try {
      const { getIO } = require('../config/socket');
      const io = getIO();
      if (io) {
        io.to(`ride-${bookingId}`).emit('ride-status-updated', {
          rideId: ride.id,
          bookingId,
          status: 'DRIVER_ASSIGNED',
          driverId,
          driverName,
          driverVehicle,
          driverPlate,
          plate: driverPlate, // keep legacy field
          price: ride.price
        });
      }
    } catch (e) {
      console.warn('[rideService] Could not emit ride-status-updated:', e.message);
    }

    return ride;
  }

  async acceptRide(rideId) {
    const ride = await rideRepository.updateStatus(rideId, 'ACCEPTED');
    if (ride) {
      await publishRideEvent('RideAccepted', {
        rideId: ride.id,
        bookingId: ride.bookingId,
        driverId: ride.driverId,
        driverName: ride.driverName,
        driverVehicle: ride.driverVehicle,
        plate: ride.driverPlate,
        userId: ride.userId,
        status: ride.status
      });
    }
    return ride;
  }

  async arriveRide(rideId) {
    const ride = await rideRepository.updateStatus(rideId, 'ARRIVED');
    if (ride) {
      await publishRideEvent('RideArrived', {
        rideId: ride.id,
        bookingId: ride.bookingId,
        driverId: ride.driverId,
        userId: ride.userId,
        status: ride.status
      });
    }
    return ride;
  }

  async startRide(rideId) {
    const ride = await rideRepository.updateStatus(rideId, 'STARTED');
    if (ride) {
      await publishRideEvent('RideStarted', {
        rideId: ride.id,
        bookingId: ride.bookingId,
        driverId: ride.driverId,
        userId: ride.userId,
        status: ride.status
      });
    }
    return ride;
  }

  async completeRide(rideId) {
    const ride = await rideRepository.updateStatus(rideId, 'COMPLETED');
    if (ride) {
      await publishRideEvent('RideCompleted', {
        rideId: ride.id,
        bookingId: ride.bookingId,
        driverId: ride.driverId,
        userId: ride.userId,
        status: ride.status,
        amount: ride.price || 15.50
      });

      // Directly update driver earnings in driver-service
      if (ride.driverId) {
        try {
          await fetch(`${DRIVER_SERVICE_URL}/api/drivers/${ride.driverId}/earnings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: parseFloat(ride.price || 0) }),
            signal: AbortSignal.timeout(3000)
          });
          console.log(`[RideService] Added ${ride.price} earnings for driver ${ride.driverId}`);
        } catch (err) {
          console.error(`[RideService] Failed to update driver earnings:`, err.message);
        }
      }
    }
    return ride;
  }


  async cancelRide(rideId) {
    const ride = await rideRepository.updateStatus(rideId, 'CANCELLED');
    if (ride) {
      await publishRideEvent('RideCancelled', {
        rideId: ride.id,
        bookingId: ride.bookingId,
        driverId: ride.driverId,
        userId: ride.userId,
        status: ride.status
      });
    }
    return ride;
  }

  async updateRideStatus(rideId, status) {
    const ride = await rideRepository.updateStatus(rideId, status);
    if (!ride) return null;

    console.log(`[RideService] updateRideStatus: ride ${rideId} -> ${status}`);

    // Emit socket events to both driver and customer
    try {
      const { getIO } = require('../config/socket');
      const io = getIO();
      const statusPacket = {
        rideId: ride.id,
        bookingId: ride.bookingId,
        driverId: ride.driverId,
        userId: ride.userId,
        status: status,
        price: ride.price
      };

      // Emit to driver room
      if (ride.driverId) {
        io.to(`driver_${ride.driverId}`).emit('ride-status-updated', statusPacket);
        console.log(`[RideService] Emitted ${status} to driver_${ride.driverId}`);
      }
      // Emit to customer room
      if (ride.userId) {
        io.to(`customer_${ride.userId}`).emit('ride-status-updated', statusPacket);
        console.log(`[RideService] Emitted ${status} to customer_${ride.userId}`);
      }
    } catch (err) {
      console.error('[RideService] Socket emit error:', err.message);
    }

    return ride;
  }

  async simulateMovement(ride) {
    if (!ride.routeData || ride.routeData.length === 0) return;
    const { getIO } = require('../config/socket');
    const io = getIO();
    const route = ride.routeData;
    let currentIndex = 0;
    const totalPoints = route.length;

    // Calculate milestones
    const pickupIdx = Math.floor(totalPoints * 0.1) || 1; // driver arrives at pickup
    const startIdx = Math.floor(totalPoints * 0.2) || 2; // trip starts
    const endIdx = totalPoints - 1; // trip completes

    console.log(`[Simulation] Starting for Ride ${ride.id} with ${totalPoints} points.`);

    const interval = setInterval(async () => {
      if (currentIndex > endIdx) {
        clearInterval(interval);
        return;
      }

      const location = route[currentIndex];

      // Emit location to both the specific ride ID room and the booking ID room, 
      // depending on which one the client joined.
      io.to(`ride-${ride.bookingId}`).emit('driverLocationUpdate', location);
      io.to(`ride-${ride.id}`).emit('driverLocationUpdate', location);

      // Check milestones
      if (currentIndex === pickupIdx) {
        console.log(`[Simulation] Ride ${ride.id} REACHED PICKUP (Waiting for driver to click Arrived)`);
      } else if (currentIndex === startIdx) {
        console.log(`[Simulation] Ride ${ride.id} REACHED START (Trip in progress)`);
      } else if (currentIndex === endIdx) {
        console.log(`[Simulation] Ride ${ride.id} REACHED DESTINATION (Waiting for driver to click Complete)`);
        clearInterval(interval);
      }

      currentIndex++;
    }, 2000); // 2 second intervals for simulation
  }

  async updateRideStatus(rideId, status) {
    const ride = await rideRepository.findById(rideId);
    if (!ride) {
      console.error(`[RideService] updateRideStatus - Ride not found: ${rideId}`);
      return null;
    }

    const currentPriority = STATUS_PRIORITY[ride.status] || 0;
    const newPriority = STATUS_PRIORITY[status] || 0;

    // Idempotency: skip if already in this status
    if (ride.status === status) {
      console.log(`[RideService] Idempotent update: Ride ${rideId} is already ${status}`);
      return ride;
    }

    // Guard: ignore backward or invalid priority transitions (unless it's a cancellation)
    if (newPriority <= currentPriority && status !== 'CANCELLED') {
      console.warn(`[RideService] Invalid transition: Ride ${rideId} (${ride.status}: ${currentPriority}) -> ${status} (${newPriority}) - Ignored.`);
      return ride;
    }

    console.log(`[RideService] Transitioning Ride ${rideId}: ${ride.status} -> ${status} (Driver: ${ride.driverId})`);

    const updatedRide = await rideRepository.updateStatus(rideId, status);
    if (!updatedRide) return null;

    // Map status to Kafka topic
    let topic = null;
    switch (status) {
      case 'ACCEPTED': topic = 'RideAccepted'; break;
      case 'ARRIVED': topic = 'RideArrived'; break;
      case 'STARTED': topic = 'RideStarted'; break;
      case 'COMPLETED': topic = 'RideCompleted'; break;
      case 'CANCELLED': topic = 'RideCancelled'; break;
      case 'PAID': topic = 'RidePaid'; break;
    }

    if (topic) {
      const eventData = {
        rideId: ride.id,
        bookingId: ride.bookingId,
        driverId: ride.driverId,
        driverName: updatedRide.driverName || ride.driverName,
        driverVehicle: updatedRide.driverVehicle || ride.driverVehicle,
        driverPlate: updatedRide.driverPlate || ride.driverPlate,
        plate: updatedRide.driverPlate || ride.driverPlate,
        userId: ride.userId,
        status,
        price: ride.price,
      };

      if (status === 'COMPLETED') {
        eventData.amount = ride.price || 15.50;
      }

      await publishRideEvent(topic, eventData);

      // Emit socket update to both rooms
      const { getIO } = require('../config/socket');
      const io = getIO();
      const socketPayload = { ...eventData, status };
      console.log(`[RideService] Emitting socket update for ride ${rideId}:`, status);
      io.to(`customer_${ride.userId}`).emit('ride-status-updated', socketPayload);
      io.to(`driver_${ride.driverId}`).emit('ride-status-updated', socketPayload);

      if (status === 'ACCEPTED') {
        this.simulateMovement(ride);
      }
    }

    return updatedRide;
  }

  async emitDriverLocationToRide(rideId, location) {
    const { getIO } = require('../config/socket');
    const io = getIO();
    io.to(`ride-${rideId}`).emit('driver-location-updated', { rideId, location });
    console.log(`[Socket.IO] Emitted location for ride ${rideId}:`, location);
    return { success: true };
  }

  async getRide(id) {
    return await rideRepository.findById(id);
  }

  async getOneRide(query) {
    return await rideRepository.findOne(query);
  }

  async getRideByBooking(bookingId) {
    return await rideRepository.findByBookingId(bookingId);
  }

  async getAllRides(filter = {}) {
    const rides = await rideRepository.findAll(filter);
    
    // For each ride missing a userName, try to fetch it from user-service (lazy patch)
    // We only do this for the dashboard/history views
    return await Promise.all(rides.map(async (r) => {
      const ride = r.get ? r.get({ plain: true }) : r;
      if (!ride.userName && ride.userId) {
         try {
           const info = await fetchUserInfo(ride.userId);
           ride.userName = info.name;
           // Optionally update DB in background so we don't fetch again next time
           rideRepository.update(ride.id, { userName: info.name }).catch(() => {});
         } catch (e) {
           ride.userName = 'Khách hàng';
         }
      }
      return ride;
    }));
  }
}

module.exports = new RideService();
