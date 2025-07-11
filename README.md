# Markdown Temporary Hosting Service

A secure, serverless API service for temporarily hosting markdown content. Perfect for AI chat integrations, documentation sharing, and content previewing.

## 🚀 Features

- **🔒 Secure API** - API key authentication for file creation
- **⏰ Auto-expiring** - Files automatically delete after 24 hours (configurable up to 7 days)
- **🤖 AI-optimized** - Designed for ChatGPT, Claude, and other AI assistants
- **🌍 Global CDN** - Fast access worldwide via Vercel edge network
- **📊 Health monitoring** - Built-in health checks and error handling
- **💰 Cost-effective** - Uses Upstash Redis free tier (10,000 requests/day)

## 📋 API Reference

### Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| `POST` | `/api/temp-markdown/create` | ✅ | Create temporary markdown file |
| `GET` | `/api/temp-markdown/{id}` | ❌ | Retrieve markdown content |
| `GET` | `/api/health` | ❌ | Service health check |

### Create Temporary File

**Request:**
```bash
curl -X POST https://markdown-temp-service.vercel.app/api/temp-markdown/create \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "content": "# My Documentation\n\nContent here...",
    "title": "My Document",
    "expiresInHours": 24
  }'
```

**Response:**
```json
{
  "success": true,
  "id": "abc123def456",
  "url": "https://markdown-temp-service.vercel.app/api/temp-markdown/abc123def456",
  "title": "My Document",
  "expiresAt": "2025-07-10T12:00:00.000Z",
  "expiresInHours": 24,
  "contentLength": 42,
  "message": "Temporary markdown file created successfully"
}
```

### Retrieve Content

**Request:**
```bash
curl https://markdown-temp-service.vercel.app/api/temp-markdown/abc123def456
```

**Response:**
```markdown
# My Documentation

Content here...
```

## 🛠️ Setup & Deployment

### Prerequisites

- Node.js 18+
- Vercel account
- Upstash Redis account

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/markdown-temp-service
   cd markdown-temp-service
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Update `.env.local`:
   ```env
   # Upstash Redis credentials
   UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-redis-token
   
   # API security
   API_SECRET_KEY=your-secret-api-key
   
   # Service configuration
   BASE_URL=http://localhost:3000
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Test the service**
   ```bash
   curl http://localhost:3000/api/health
   ```

### Production Deployment

1. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

2. **Set up Upstash Redis**
   ```bash
   vercel kv create markdown-temp-store
   ```

3. **Configure environment variables in Vercel dashboard:**
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `API_SECRET_KEY`
   - `BASE_URL` (optional)

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `UPSTASH_REDIS_REST_URL` | ✅ | Upstash Redis REST API URL | `https://your-db.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | Upstash Redis REST API token | `AXXXaGVsbG8...` |
| `API_SECRET_KEY` | ✅ | Secret key for API authentication | `mk_live_7f9e2a8b...` |
| `BASE_URL` | ❌ | Custom base URL for file links | `https://your-domain.com` |

### File Expiration

- **Default**: 24 hours
- **Minimum**: 1 hour
- **Maximum**: 7 days (168 hours)
- **Cleanup**: Automatic via Redis TTL

## 🔗 Integration Examples

### JavaScript/Fetch

```javascript
async function createMarkdownFile(content, title = 'Document') {
  const response = await fetch('https://markdown-temp-service.vercel.app/api/temp-markdown/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'your-api-key'
    },
    body: JSON.stringify({
      content,
      title,
      expiresInHours: 24
    })
  });
  
  return response.json();
}

// Usage
const result = await createMarkdownFile('# Hello World\n\nThis is markdown content');
console.log('File URL:', result.url);
```

### Python/Requests

```python
import requests

def create_markdown_file(content, title='Document'):
    response = requests.post(
        'https://markdown-temp-service.vercel.app/api/temp-markdown/create',
        headers={
            'Content-Type': 'application/json',
            'X-API-Key': 'your-api-key'
        },
        json={
            'content': content,
            'title': title,
            'expiresInHours': 24
        }
    )
    return response.json()

# Usage
result = create_markdown_file('# Hello World\n\nThis is markdown content')
print(f"File URL: {result['url']}")
```

### Docusaurus Integration

```javascript
// Export documentation page to temporary markdown
const exportToMarkdown = async () => {
  const markdown = convertPageToMarkdown(); // Your conversion logic
  
  const response = await fetch(`${MARKDOWN_SERVICE_URL}/api/temp-markdown/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({
      content: markdown,
      title: document.title,
      expiresInHours: 24
    })
  });
  
  const { url } = await response.json();
  
  // Open with AI assistant
  const prompt = `Please read this documentation: ${url}`;
  window.open(`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`);
};
```

## 🛡️ Security

### API Key Management

- **Generation**: Use cryptographically secure random strings (88+ characters)
- **Storage**: Store in environment variables, never in code
- **Rotation**: Rotate keys every 6-12 months
- **Multiple keys**: Support comma-separated keys for different clients

### Rate Limiting

- **Built-in protection**: Content size limits (1MB max)
- **Redis TTL**: Automatic cleanup prevents storage buildup
- **Error handling**: Graceful degradation on failures

### Access Control

- **Creation**: Requires valid API key
- **Reading**: Public access (no authentication needed)
- **CORS**: Enabled for cross-origin requests

## 📊 Monitoring

### Health Check

```bash
curl https://markdown-temp-service.vercel.app/api/health
```

**Healthy Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-09T12:00:00.000Z",
  "version": "1.0.0",
  "services": {
    "redis": "ok"
  },
  "uptime": 123.456
}
```

### Logging

The service logs:
- File creation events with metadata
- Access attempts with user agents
- Error conditions and debugging info
- Health check results

### Metrics to Monitor

- **Request volume**: API calls per hour/day
- **Storage usage**: Active files and total size
- **Error rates**: Failed requests and causes
- **Expiration patterns**: File lifecycle analytics

## 🚨 Troubleshooting

### Common Issues

**Authentication Errors (401)**
- Verify API key is correct
- Check environment variables are set
- Ensure key is included in `X-API-Key` header

**Rate Limiting (429)**
- Check Upstash usage limits
- Implement client-side retry logic
- Consider upgrading Upstash plan

**Content Too Large (413)**
- Files must be under 1MB
- Compress or split large content
- Consider alternative storage for large files

**Service Unavailable (503)**
- Check service health endpoint
- Verify Upstash Redis is operational
- Review Vercel function logs

### Debug Endpoints

**Health Check:**
```bash
curl https://markdown-temp-service.vercel.app/api/health
```

**Logs:** Available in Vercel dashboard under Functions → Logs

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/markdown-temp-service/issues)
- **Documentation**: [Service Homepage](https://markdown-temp-service.vercel.app)
- **Health Status**: [Health Check](https://markdown-temp-service.vercel.app/api/health)

---

**Built with ❤️ for better AI integrations**