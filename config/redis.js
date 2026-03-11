const { createClient } = require('redis');
require('dotenv').config();
// Initialize the Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL,
  pingInterval: 10000,
  socket: {
    tls: true,
    rejectUnauthorized: false
  }
});

// Catch any connection errors
redisClient.on('error', (err) => console.error('❌ Redis Client Error:', err));

const connectRedis = async () => {
  await redisClient.connect();
  console.log('⚡ Connected to cloud Redis (In-Memory Cache) successfully!');
};

module.exports = { redisClient, connectRedis };
