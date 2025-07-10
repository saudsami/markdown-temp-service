// api/temp-markdown/create.js - Updated with API key authentication
import { Redis } from '@upstash/redis';
import { validateApiKey } from '../../lib/auth.js';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate API key
  const auth = validateApiKey(req);
  if (!auth.valid) {
    return res.status(401).json({ error: auth.error });
  }

  try {
    const { content, title, expiresInHours = 24 } = req.body;

    // Validate input
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required and must be a string' });
    }

    // Validate content length (prevent abuse)
    const maxLength = 1000000; // 1MB limit
    if (content.length > maxLength) {
      return res.status(413).json({ error: 'Content too large (max 1MB)' });
    }

    // Validate expiration (max 7 days)
    const maxHours = 168; // 7 days
    const expireHours = Math.min(Math.max(expiresInHours, 1), maxHours);

    // Generate unique ID
    const id = Math.random().toString(36).substring(2, 14);

    // Set expiration time
    const expiresAt = new Date(Date.now() + expireHours * 60 * 60 * 1000);

    // Prepare metadata
    const metadata = {
      content,
      title: title || 'Untitled',
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      contentLength: content.length,
      userAgent: req.headers['user-agent'] || 'Unknown',
      referrer: req.headers.referer || req.headers.referrer || 'Unknown',
      clientIp: req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'Unknown'
    };

    // Store in Redis with TTL
    await redis.set(
      `temp-markdown:${id}`,
      metadata,
      { ex: expireHours * 3600 }
    );

    // Log creation for monitoring
    console.log(`Created temp markdown: ${id}, size: ${content.length} bytes, IP: ${metadata.clientIp}`);

    // Construct the URL
    const baseUrl = process.env.BASE_URL || 
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                   `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`);
    
    const url = `${baseUrl}/api/temp-markdown/${id}`;

    // Return success response
    res.status(201).json({
      success: true,
      id,
      url,
      title: metadata.title,
      expiresAt: expiresAt.toISOString(),
      expiresInHours: expireHours,
      contentLength: content.length,
      message: 'Temporary markdown file created successfully'
    });

  } catch (error) {
    console.error('Error creating temporary markdown:', error);
    
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to create temporary markdown file'
    });
  }
}