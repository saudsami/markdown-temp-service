// api/health.js
import { Redis } from '@upstash/redis';

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if environment variables exist
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error('Missing Redis environment variables');
    }

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Test Redis connection with ping first
    console.log('Testing Redis ping...');
    const pingResult = await redis.ping();
    console.log('Ping result:', pingResult);

    // Test set/get operations  
    console.log('Testing Redis set/get operations...');
    const testKey = 'health-check-' + Date.now();
    const testValue = 'health-value-' + Date.now();
    
    await redis.set(testKey, testValue, { ex: 60 }); // 1 minute expiry
    const retrievedValue = await redis.get(testKey);
    await redis.del(testKey); // Clean up
    
    const isRedisHealthy = (pingResult === 'PONG') && (retrievedValue === testValue);

    console.log(`Health check result: ${isRedisHealthy ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Ping: ${pingResult}, Expected value: ${testValue}, Got: ${retrievedValue}`);

    const health = {
      status: isRedisHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        redis: isRedisHealthy ? 'ok' : 'error'
      },
      uptime: process.uptime()
    };

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    
    res.status(isRedisHealthy ? 200 : 503).json(health);

  } catch (error) {
    console.error('Health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message || 'Health check failed',
      services: {
        redis: 'error'
      }
    });
  }
}