// api/health.js
import { kv } from '@vercel/kv';

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
    // Test KV connection
    const testKey = 'health-check-test';
    const testValue = Date.now().toString();
    
    await kv.set(testKey, testValue, { ex: 60 }); // 1 minute expiry
    const retrievedValue = await kv.get(testKey);
    await kv.del(testKey); // Clean up
    
    const isKvHealthy = retrievedValue === testValue;

    const health = {
      status: isKvHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        kv: isKvHealthy ? 'ok' : 'error'
      },
      uptime: process.uptime()
    };

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    
    res.status(isKvHealthy ? 200 : 503).json(health);

  } catch (error) {
    console.error('Health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      services: {
        kv: 'error'
      }
    });
  }
}