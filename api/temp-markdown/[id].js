// api/temp-markdown/[id].js - Updated for better ChatGPT compatibility
import { Redis } from '@upstash/redis';

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, User-Agent');
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;

    // Validate ID format
    if (!id || typeof id !== 'string' || id.length < 8 || id.length > 20) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    // Check for valid characters (alphanumeric)
    if (!/^[a-zA-Z0-9]+$/.test(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Retrieve from Redis
    const data = await redis.get(`temp-markdown:${id}`);

    if (!data) {
      return res.status(404).json({ 
        error: 'Not found',
        message: 'Temporary markdown file not found or expired'
      });
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(data.expiresAt);
    
    if (now > expiresAt) {
      await redis.del(`temp-markdown:${id}`);
      return res.status(410).json({ 
        error: 'Gone',
        message: 'Temporary markdown file has expired'
      });
    }

    // Log the request for debugging
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const isBot = userAgent.includes('bot') || userAgent.includes('crawler') || userAgent.includes('spider');
    console.log(`Retrieved temp markdown: ${id}, User-Agent: ${userAgent}, Bot: ${isBot}`);

    // Set headers optimized for AI assistants and web crawlers
    res.setHeader('Content-Type', 'text/plain; charset=utf-8'); // Changed to text/plain
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Allow 1 hour caching
    res.setHeader('X-Robots-Tag', 'noindex, nofollow'); // Don't index but allow reading
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    // Add headers that help with AI assistant access
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    
    // Optional: Add filename for download
    const filename = data.title ? `${data.title.replace(/[^a-zA-Z0-9]/g, '-')}.md` : `markdown-${id}.md`;
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    // Return the markdown content
    res.status(200).send(data.content);

  } catch (error) {
    console.error('Error retrieving temporary markdown:', error);
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to retrieve temporary markdown file'
    });
  }
}