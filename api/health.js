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
    // Check if environment variables exist
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error('Missing Redis environment variables');
    }

    // Test Redis connection
    const testKey = 'health-check-test';
    const testValue = Date.now().toString();
    
    console.log('Testing Redis connection...');
    
    await redis.set(testKey, testValue, { ex: 60 }); // 1 minute expiry
    const retrievedValue = await redis.get(testKey);
    await redis.del(testKey); // Clean up
    
    const isRedisHealthy = retrievedValue === testValue;

    console.log(`Redis test result: ${isRedisHealthy ? 'SUCCESS' : 'FAILED'}`);

    const health = {
      status: isRedisHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        redis: isRedisHealthy ? 'ok' : 'error'
      },
      uptime: process.uptime(),
      // Debug info (remove after testing)
      debug: {
        hasUrl: !!process.env.UPSTASH_REDIS_REST_URL,
        hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
        urlPrefix: process.env.UPSTASH_REDIS_REST_URL?.substring(0, 30) + '...',
        tokenPrefix: process.env.UPSTASH_REDIS_REST_TOKEN?.substring(0, 10) + '...'
      }
    };

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    
    res.status(isRedisHealthy ? 200 : 503).json(health);

  } catch (error) {
    console.error('Health check failed:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      hasUrl: !!process.env.UPSTASH_REDIS_REST_URL,
      hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN
    });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message || 'Health check failed',
      services: {
        redis: 'error'
      },
      // Debug info (remove after testing)
      debug: {
        hasUrl: !!process.env.UPSTASH_REDIS_REST_URL,
        hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
        errorType: error.constructor.name
      }
    });
  }
}