const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const sequelize = require('./config/database');
const { connectConsumer } = require('./config/kafka');
const Notification = require('./models/Notification');
const { connectSaga } = require('./events/notificationSaga');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  path: '/notification-socket',
  cors: {
    origin: process.env.ALLOWED_ORIGINS || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Store user socket mappings
const userSockets = new Map(); // userId -> socketId

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`[Notification] Client connected: ${socket.id}`);

  // User joins with their userId
  socket.on('join-user', (userId) => {
    if (userId) {
      userSockets.set(String(userId), socket.id);
      console.log(`[Notification] User ${userId} joined with socket ${socket.id}`);
    }
  });

  socket.on('disconnect', () => {
    // Remove user from mapping
    for (const [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        console.log(`[Notification] User ${userId} disconnected`);
        break;
      }
    }
  });
});

// Global function to send notification
const sendNotification = async (userId, notification) => {
  if (!userId) {
    console.log('[Notification] Skipped send because userId is missing:', notification.type);
    return;
  }

  // Persist to database
  try {
    await Notification.create({
      userId: Number(userId),
      type: notification.type,
      title: notification.title,
      message: notification.message,
      rideId: notification.rideId || null,
      read: false
    });
    console.log(`[Notification] Persisted for user ${userId}:`, notification.type);
  } catch (err) {
    console.error('[Notification] Persistence failed:', err.message);
  }

  const socketId = userSockets.get(String(userId));
  if (socketId) {
    io.to(socketId).emit('notification', notification);
    console.log(`[Notification] Sent to user ${userId}:`, notification);
  } else {
    console.log(`[Notification] User ${userId} not online`);
  }
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Notification Service is UP' });
});

// Get user notifications
app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.params.userId },
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark notification as read
app.patch('/api/notifications/:id/read', async (req, res) => {
  try {
    await Notification.update({ read: true }, { where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark all notifications as read
app.patch('/api/notifications/user/:userId/read-all', async (req, res) => {
  try {
    await Notification.update({ read: true }, { where: { userId: req.params.userId } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TC 9: Manual notification send endpoint
// Accepts { user_id, message } and persists + emits the notification
app.post('/api/notifications/send', async (req, res) => {
  try {
    const { user_id, message } = req.body;
    if (!user_id || !message) {
      return res.status(400).json({ error: 'user_id and message are required' });
    }

    await sendNotification(user_id, {
      type: 'MANUAL',
      title: 'Notification',
      message,
      timestamp: new Date().toISOString()
    });

    console.log(`[Notification] Manual send to user ${user_id}: ${message}`);
    res.status(200).json({
      success: true,
      user_id,
      message,
      queued: true,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Get online users count
app.get('/stats', (req, res) => {
  res.json({
    onlineUsers: userSockets.size,
    users: Array.from(userSockets.keys())
  });
});

// Start server
const PORT = process.env.PORT || 3010;

const startServer = async () => {
  try {
    // Connect Saga
    await connectSaga();
    console.log('✓ Notification Saga connected');

    // Connect to database
    await sequelize.authenticate();
    console.log('Notification Service DB connected.');

    await sequelize.sync({ alter: true });
    console.log('Notification Service DB synchronized.');

    // Connect to Kafka and consume events
    await connectConsumer(async (eventType, data) => {
      console.log(`[Notification] Processing event: ${eventType}`, data);

      switch (eventType) {
        case 'RideCreated':
          // 1. Notify passenger that driver is assigned
          sendNotification(data.userId, {
            type: 'DRIVER_ASSIGNED',
            title: 'Driver Assigned! 🚗',
            message: `${data.driverName} is on the way with ${data.driverVehicle}`,
            rideId: data.rideId,
            timestamp: new Date().toISOString()
          });

          // 2. Notify driver that they have a new assignment
          if (data.driverId) {
            sendNotification(data.driverId, {
              type: 'NEW_RIDE_ASSIGNED',
              title: 'New Ride Assigned! 🚕',
              message: `You have a new ride request from ${data.passengerName || 'a passenger'}. Please check your app.`,
              rideId: data.rideId,
              timestamp: new Date().toISOString()
            });
          }
          break;
        case 'RideAccepted':
          // Notify passenger that ride is accepted
          sendNotification(data.userId, {
            type: 'RIDE_ACCEPTED',
            title: 'Ride Accepted! ✅',
            message: `${data.driverName || 'A driver'} has accepted your ride request`,
            rideId: data.rideId,
            timestamp: new Date().toISOString()
          });
          break;

        case 'RideArrived':
          // Notify passenger driver has arrived
          sendNotification(data.userId, {
            type: 'DRIVER_ARRIVED',
            title: 'Driver Arrived! 📍',
            message: 'Your driver has arrived at the pickup location',
            rideId: data.rideId,
            timestamp: new Date().toISOString()
          });
          break;

        case 'RideStarted':
          // Notify passenger ride has started
          sendNotification(data.userId, {
            type: 'RIDE_STARTED',
            title: 'Trip Started! 🚀',
            message: 'Your trip has started. Enjoy your ride!',
            rideId: data.rideId,
            timestamp: new Date().toISOString()
          });
          break;

        case 'RideCompleted':
          // Notify passenger ride completed
          sendNotification(data.userId, {
            type: 'RIDE_COMPLETED',
            title: 'Trip Completed! 🎉',
            message: `Your trip is complete. Please pay $${data.amount}`,
            rideId: data.rideId,
            amount: data.amount,
            timestamp: new Date().toISOString()
          });
          // Notify driver
          if (data.driverId) {
            sendNotification(data.driverId, {
              type: 'RIDE_COMPLETED',
              title: 'Trip Completed! ✅',
              message: 'Waiting for passenger to complete payment',
              rideId: data.rideId,
              timestamp: new Date().toISOString()
            });
          }
          break;

        case 'PaymentSuccess':
          // Notify driver payment received
          if (data.driverId) {
            sendNotification(data.driverId, {
              type: 'PAYMENT_RECEIVED',
              title: 'Payment Received! 💰',
              message: `You received $${data.amount}`,
              rideId: data.rideId,
              amount: data.amount,
              timestamp: new Date().toISOString()
            });
          }

          // Notify passenger
          let passengerId = data.userId;
          if (!passengerId && data.rideId) {
            // Fallback: try to find the passengerId from the database for this ride
            try {
              const prevNotif = await Notification.findOne({
                where: { rideId: data.rideId, type: 'DRIVER_ASSIGNED' }
              });
              if (prevNotif) {
                passengerId = prevNotif.userId;
                console.log(`[Notification] Found fallback userId ${passengerId} for ride ${data.rideId}`);
              }
            } catch (err) {
              console.error('[Notification] Fallback lookup failed:', err.message);
            }
          }

          if (passengerId) {
            sendNotification(passengerId, {
              type: 'PAYMENT_SUCCESS',
              title: 'Payment Successful! ✨',
              message: 'Thank you for riding with us!',
              rideId: data.rideId,
              timestamp: new Date().toISOString()
            });
          } else {
            console.log('[Notification] Could not find passengerId for PaymentSuccess:', data.rideId);
          }
          break;

        case 'BookingCreated':
          // Notify nearby drivers
          // This is handled by driver-service polling
          break;
      }
    });

    server.listen(PORT, () => {
      console.log(`Notification Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start Notification Service:', error);
    process.exit(1);
  }
};

startServer();

module.exports = { sendNotification };
