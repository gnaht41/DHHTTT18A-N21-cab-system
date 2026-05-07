const jwt = require('jsonwebtoken');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Check blacklist in Redis
    const Redis = require('redis');
    const { promisify } = require('util');
    const client = Redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      retry_strategy: () => undefined // Don't retry indefinitely for middleware
    });
    
    // Simple client error handling
    client.on('error', () => {}); 

    const existsAsync = promisify(client.exists).bind(client);
    const isBlacklisted = await existsAsync(`blacklist:${token}`).catch(() => 0);
    client.quit();

    if (isBlacklisted) {
      return res.status(401).json({ error: 'Token has been invalidated (logged out)' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_here');
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = authenticate;
