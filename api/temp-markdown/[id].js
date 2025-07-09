// api/temp-markdown/[id].js
import { Redis } from '@upstash/redis';

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;

    // Updated validation - allow 8-20 characters (more flexible)
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

    // Check if expired (double-check since Redis should auto-expire)
    const now = new Date();
    const expiresAt = new Date(data.expiresAt);
    
    if (now > expiresAt) {
      // Clean up expired entry
      await redis.del(`temp-markdown:${id}`);
      return res.status(410).json({ 
        error: 'Gone',
        message: 'Temporary markdown file has expired'
      });
    }

    // Set appropriate headers for markdown content
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    // Optional: Add filename for download
    const filename = data.title ? `${data.title.replace(/[^a-zA-Z0-9]/g, '-')}.md` : `markdown-${id}.md`;
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    // Log access (for monitoring)
    console.log(`Retrieved temp markdown: ${id}, size: ${data.contentLength} bytes`);

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