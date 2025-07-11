// api/temp-markdown/[id].js - Updated to serve HTML for expired/missing content
import { Redis } from '@upstash/redis';

// HTML template for expired/missing content
const getExpiredContentHTML = () => `<!DOCTYPE html>
<html>
<head>
    <title>Content No Longer Available</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 40px 20px;
            text-align: center;
            line-height: 1.6;
            color: #333;
        }
        .header {
            margin-bottom: 40px;
        }
        .header h1 {
            color: #e74c3c;
            margin-bottom: 10px;
            font-weight: 300;
        }
        .header p {
            color: #7f8c8d;
            font-size: 1.1em;
        }
        .message {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 25px;
            margin: 30px 0;
            color: #856404;
        }
        .message .icon {
            font-size: 3em;
            margin-bottom: 15px;
        }
        .instructions {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 25px;
            margin: 30px 0;
            text-align: left;
        }
        .instructions h2 {
            margin-top: 0;
            color: #2c3e50;
            text-align: center;
        }
        .steps {
            margin: 20px 0;
        }
        .steps li {
            margin: 10px 0;
        }
        .link {
            color: #007bff;
            text-decoration: none;
            font-weight: 500;
        }
        .link:hover {
            text-decoration: underline;
        }
        .cta-button {
            display: inline-block;
            background: #007bff;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 500;
            margin: 20px 0;
            transition: background-color 0.2s;
        }
        .cta-button:hover {
            background: #0056b3;
            color: white;
            text-decoration: none;
        }
        .footer {
            margin-top: 40px;
            color: #7f8c8d;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Content No Longer Available</h1>
        <p>This temporary markdown page has expired</p>
    </div>

    <div class="message">
        <div class="icon">⏰</div>
        <h3>This content has been automatically removed</h3>
        <p>Temporary markdown files are automatically deleted after 24 hours for security and storage efficiency.</p>
    </div>

    <div class="instructions">
        <h2>📄 Generate a New Export</h2>
        <p>To view or share this content again, please create a new export:</p>
        <ol class="steps">
            <li>Visit the original page on <a href="https://docs.agora.io/en" class="link" target="_blank">docs.agora.io/en</a></li>
            <li>Look for the export dropdown menu in the top-right corner</li>
            <li>Choose from the available options:
                <ul>
                    <li><strong>View markdown</strong> - Preview the page as markdown</li>
                    <li><strong>Download markdown</strong> - Save the page as a .md file</li>
                    <li><strong>Open in ChatGPT</strong> - Ask AI questions about the page</li>
                    <li><strong>Open in Claude</strong> - Ask AI questions about the page</li>
                </ul>
            </li>
        </ol>
        
        <div style="text-align: center;">
            <a href="https://docs.agora.io/en" class="cta-button" target="_blank">
                Go to Agora Documentation
            </a>
        </div>
    </div>

    <div class="footer">
        <p><strong>Why do files expire?</strong></p>
        <p>Temporary files are automatically removed to protect your content and maintain service efficiency. Each export creates a fresh, secure link.</p>
    </div>
</body>
</html>`;

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
      // Content not found - serve friendly HTML page
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(404).send(getExpiredContentHTML());
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(data.expiresAt);
    
    if (now > expiresAt) {
      // Clean up expired entry
      await redis.del(`temp-markdown:${id}`);
      
      // Content expired - serve friendly HTML page
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(410).send(getExpiredContentHTML());
    }

    // Log the request for debugging
    const userAgent = req.headers['user-agent'] || 'Unknown';
    console.log(`Retrieved temp markdown: ${id}, User-Agent: ${userAgent}`);

    // Set headers optimized for markdown content
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    // Optional: Add filename for download
    const filename = data.title ? `${data.title.replace(/[^a-zA-Z0-9]/g, '-')}.md` : `markdown-${id}.md`;
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    // Return the markdown content
    res.status(200).send(data.content);

  } catch (error) {
    console.error('Error retrieving temporary markdown:', error);
    
    // Server error - serve friendly HTML page
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(500).send(getExpiredContentHTML());
  }
}