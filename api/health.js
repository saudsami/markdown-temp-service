// api/health.js
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

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
    // Test Redis connection
    const testKey = 'health-check-test';
    const testValue = Date.now().toString();
    
    await redis.set(testKey, testValue, { ex: 60 }); // 1 minute expiry
    const retrievedValue = await redis.get(testKey);
    await redis.del(testKey); // Clean up
    
    const isRedisHealthy = retrievedValue === testValue;

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
      error: 'Health check failed',
      services: {
        redis: 'error'
      }
    });
  }
}