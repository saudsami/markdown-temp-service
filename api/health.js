// api/redis-test.js (temporary - remove after debugging)
import { Redis } from '@upstash/redis';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Test basic ping
    console.log('Testing Redis ping...');
    const pingResult = await redis.ping();
    console.log('Ping result:', pingResult);

    // Test set/get
    console.log('Testing Redis set/get...');
    const testKey = 'test-key-' + Date.now();
    const testValue = 'test-value-' + Date.now();
    
    await redis.set(testKey, testValue);
    const retrievedValue = await redis.get(testKey);
    await redis.del(testKey);

    const result = {
      success: true,
      ping: pingResult,
      setGetTest: {
        testKey,
        testValue,
        retrievedValue,
        match: testValue === retrievedValue
      },
      timestamp: new Date().toISOString()
    };

    res.status(200).json(result);

  } catch (error) {
    console.error('Redis test failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      name: error.name,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}