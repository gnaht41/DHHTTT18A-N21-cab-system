const dotenv = require('dotenv');
dotenv.config();

const http = require('http');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = require('./app');

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Proxy Socket.IO WebSocket connections to ride-service
const rideWsProxy = createProxyMiddleware({
  target: process.env.RIDE_SERVICE_URL || 'http://localhost:3004',
  changeOrigin: true,
  ws: true,
  logLevel: 'silent'
});

app.use('/socket.io', rideWsProxy);

// Proxy Socket.IO for notification service (different path)
const notificationWsProxy = createProxyMiddleware({
  target: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3010',
  changeOrigin: true,
  ws: true,
  logLevel: 'silent'
});

app.use('/notification-socket', notificationWsProxy);

server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/notification-socket')) {
    notificationWsProxy.upgrade(req, socket, head);
  } else {
    rideWsProxy.upgrade(req, socket, head);
  }
});

server.listen(PORT, () => {
  console.log(`API Gateway is running on port ${PORT}`);
});
