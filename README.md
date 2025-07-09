# Markdown Temporary Hosting Service - Complete Deployment Guide

## 1. Create the Project

```bash
# Create new directory
mkdir markdown-temp-service
cd markdown-temp-service

# Initialize git
git init

# Create package.json
npm init -y

# Install dependencies
npm install @vercel/kv nanoid
npm install --save-dev vercel
```

## 2. Create Project Structure

```bash
# Create directories
mkdir -p api/temp-markdown
mkdir -p public
mkdir -p docs

# Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/

# Environment variables
.env*
!.env.example

# Vercel
.vercel

# Logs
*.log
npm-debug.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Build outputs
build/
dist/
EOF
```

## 3. Create API Files

### Create `api/temp-markdown/create.js`
```javascript
// api/temp-markdown/create.js
import { kv } from '@vercel/kv';
import { nanoid } from 'nanoid';

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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
    const id = nanoid(12);

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
      referrer: req.headers.referer || req.headers.referrer || 'Unknown'
    };

    // Store in Vercel KV with TTL
    await kv.set(
      `temp-markdown:${id}`,
      metadata,
      { ex: expireHours * 3600 } // TTL in seconds
    );

    // Construct the URL
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
    
    const url = `${baseUrl}/api/temp-markdown/${id}`;

    // Log creation (for monitoring)
    console.log(`Created temp markdown: ${id}, size: ${content.length} bytes, expires: ${expiresAt.toISOString()}`);

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
    
    // Don't expose internal errors to client
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to create temporary markdown file'
    });
  }
}
```

### Create `api/temp-markdown/[id].js`
```javascript
// api/temp-markdown/[id].js
import { kv } from '@vercel/kv';

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

    // Validate ID format
    if (!id || typeof id !== 'string' || id.length !== 12) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    // Retrieve from Vercel KV
    const data = await kv.get(`temp-markdown:${id}`);

    if (!data) {
      return res.status(404).json({ 
        error: 'Not found',
        message: 'Temporary markdown file not found or expired'
      });
    }

    // Check if expired (double-check since KV should auto-expire)
    const now = new Date();
    const expiresAt = new Date(data.expiresAt);
    
    if (now > expiresAt) {
      // Clean up expired entry
      await kv.del(`temp-markdown:${id}`);
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
```

### Create `api/health.js`
```javascript
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
```

## 4. Create Configuration Files

### Create `vercel.json`
```json
{
  "version": 2,
  "name": "markdown-temp-service",
  "functions": {
    "api/temp-markdown/create.js": {
      "maxDuration": 10
    },
    "api/temp-markdown/[id].js": {
      "maxDuration": 5
    },
    "api/health.js": {
      "maxDuration": 5
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, POST, OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "Content-Type, Authorization"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/",
      "destination": "/public/index.html"
    }
  ]
}
```

### Update `package.json`
```json
{
  "name": "markdown-temp-service",
  "version": "1.0.0",
  "description": "Temporary markdown file hosting service for AI chat integrations",
  "main": "index.js",
  "scripts": {
    "dev": "vercel dev",
    "build": "echo 'No build step needed for serverless functions'",
    "deploy": "vercel --prod",
    "test": "node test/api.test.js"
  },
  "dependencies": {
    "@vercel/kv": "^1.0.1",
    "nanoid": "^5.0.0"
  },
  "devDependencies": {
    "vercel": "^32.0.0"
  },
  "keywords": [
    "markdown",
    "temporary",
    "hosting",
    "ai",
    "documentation"
  ],
  "author": "Your Name",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/markdown-temp-service"
  }
}
```

## 5. Create Landing Page

### Create `public/index.html`
```html
<!DOCTYPE html>
<html>
<head>
    <title>Markdown Temp Service</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>Markdown Temporary Hosting Service</h1>
    <p>This service provides temporary markdown file hosting for AI chat integrations.</p>
    
    <h2>API Endpoints</h2>
    <ul>
        <li><code>POST /api/temp-markdown/create</code> - Create temporary markdown file</li>
        <li><code>GET /api/temp-markdown/{id}</code> - Retrieve markdown file</li>
        <li><code>GET /api/health</code> - Health check</li>
    </ul>
    
    <h2>Example Usage</h2>
    <pre><code>// Create temporary markdown
fetch('/api/temp-markdown/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: '# My Markdown\n\nContent here...',
    title: 'My Document',
    expiresInHours: 24
  })
})
.then(r => r.json())
.then(data => console.log('URL:', data.url));</code></pre>
</body>
</html>
```

## 6. Create GitHub Repository

```bash
# Create repository
gh repo create markdown-temp-service --public --description "Temporary markdown hosting service for AI integrations"

# Add remote
git remote add origin https://github.com/yourusername/markdown-temp-service.git

# Initial commit
git add .
git commit -m "Initial commit: Markdown temporary hosting service"
git push -u origin main
```

## 7. Deploy to Vercel

```bash
# Login to Vercel
vercel login

# Link project
vercel link

# Create KV database
vercel kv create markdown-temp-store

# Pull environment variables
vercel env pull .env.local

# Deploy to production
vercel --prod
```

## 8. Test Your Service

```bash
# Test health check
curl https://your-service.vercel.app/api/health

# Test create endpoint
curl -X POST https://your-service.vercel.app/api/temp-markdown/create \
  -H "Content-Type: application/json" \
  -d '{
    "content": "# Test Document\n\nThis is a test markdown file.",
    "title": "Test Document",
    "expiresInHours": 1
  }'

# Test retrieve endpoint (use ID from create response)
curl https://your-service.vercel.app/api/temp-markdown/YOUR_ID_HERE
```

## 9. Integration with Your Docusaurus Site

Add this to your existing Docusaurus `MarkdownExport/index.js`:

```javascript
// Configuration for your markdown service
const MARKDOWN_SERVICE_URL = 'https://your-markdown-service.vercel.app';

// Modified openInChatGPT function
const openInChatGPT = async () => {
  setIsProcessing(true);
  
  try {
    // 1. Convert to markdown
    const markdown = getCurrentPageMarkdown();
    
    // 2. Get page title
    const pageTitle = document.querySelector('h1')?.textContent || 'Documentation';
    
    // 3. Create temporary markdown file
    const response = await fetch(`${MARKDOWN_SERVICE_URL}/api/temp-markdown/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: markdown,
        title: pageTitle,
        expiresInHours: 24
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const { url } = await response.json();
    
    // 4. Create prompt with markdown URL
    const { productName } = extractFilenameComponents();
    const displayProductName = productName || 'this documentation';
    
    const prompt = CHATGPT_PROMPT_TEMPLATE
      .replace('{productName}', displayProductName)
      .replace('{pageUrl}', url);
    
    // 5. Open ChatGPT
    const chatgptUrl = `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
    window.open(chatgptUrl, '_blank', 'noopener,noreferrer');
    
  } catch (error) {
    console.error('Failed to create temporary markdown:', error);
    
    // Fallback to original URL approach
    const currentUrl = window.location.href;
    const fallbackPrompt = `Can you read this documentation page ${currentUrl} so I can ask you questions about it?`;
    const fallbackUrl = `https://chatgpt.com/?q=${encodeURIComponent(fallbackPrompt)}`;
    window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
  } finally {
    setIsProcessing(false);
  }
};

// Similar modification for openInClaude function
```

## 10. Your Service is Ready! 🎉

Your service URL: `https://your-service.vercel.app`

API endpoints:
- `POST /api/temp-markdown/create` - Create temporary markdown
- `GET /api/temp-markdown/{id}` - Retrieve markdown  
- `GET /api/health` - Health check

The service will:
- ✅ Host temporary markdown files for 24 hours (configurable)
- ✅ Provide clean URLs for AI chat integrations
- ✅ Handle CORS for cross-origin requests
- ✅ Auto-cleanup expired files
- ✅ Scale automatically with Vercel serverless functions

Now your AI integrations will get properly formatted markdown instead of trying to parse HTML!