const { Server } = require('socket.io');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] New connection: ${socket.id}`);

    socket.on('join-ride', (rideId) => {
      socket.join(`ride-${rideId}`);
      console.log(`[Socket.IO] Client ${socket.id} joined room: ride-${rideId}`);
    });

    socket.on('join-drivers', () => {
      socket.join('drivers');
      console.log(`[Socket.IO] Client ${socket.id} joined drivers room`);
    });

    socket.on('join-customer', (customerId) => {
      socket.join(`customer_${customerId}`);
      console.log(`[Socket.IO] Client ${socket.id} joined room: customer_${customerId}`);
    });

    socket.on('join-driver', (driverId) => {
      socket.join(`driver_${driverId}`);
      console.log(`[Socket.IO] Client ${socket.id} joined room: driver_${driverId}`);
    });

    socket.on('driver-location-update', (data) => {
      console.log(`[Socket.IO] Received driver-location-update:`, data);
      if (data && data.driverId && data.lat && data.lng) {
        const rideService = require('../services/rideService');
        // Pass isAvailable status if provided, default to true
        const isAvailable = data.isAvailable !== undefined ? data.isAvailable : true;
        rideService.updateDriverLocation(data.driverId, data.lat, data.lng, isAvailable);
        console.log(`[Socket.IO] Updated driver ${data.driverId} location: ${data.lat}, ${data.lng}`);

        // Notify anyone in the ride room about the movement
        if (data.rideId) {
          socket.to(`ride-${data.rideId}`).emit('driver-location-updated', {
            rideId: data.rideId,
            location: [data.lat, data.lng]
          });
        }
      } else {
        console.log(`[Socket.IO] Invalid driver-location-update data:`, data);
      }
    });

    socket.on('driverLocationUpdate', (data) => {
      if (data && data.rideId && data.location) {
        socket.to(`ride-${data.rideId}`).emit('driverLocationUpdate', data.location);
      }
    });

    // Relay passenger pickup pin position to all drivers (for simulation sync)
    socket.on('passenger-location-preview', (coords) => {
      socket.to('drivers').emit('passenger-location-preview', coords);
    });

    // Relay driver route to passenger ride room for real-time sync
    socket.on('driver-route-update', (data) => {
      if (data && data.rideId) {
        socket.to(`ride-${data.rideId}`).emit('driver-route-update', data);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

module.exports = { initSocket, getIO };
