export function validateApiKey(req) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey) {
    return { valid: false, error: 'API key required' };
  }
  
  // Check against your secret API key
  if (apiKey !== process.env.API_SECRET_KEY) {
    return { valid: false, error: 'Invalid API key' };
  }
  
  return { valid: true };
}

// Enhanced version with multiple keys (for different clients)
export function validateApiKeyAdvanced(req) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey) {
    return { valid: false, error: 'API key required' };
  }
  
  // Support multiple API keys (comma-separated in env var)
  const validKeys = process.env.API_SECRET_KEYS?.split(',') || [];
  
  if (!validKeys.includes(apiKey)) {
    return { valid: false, error: 'Invalid API key' };
  }
  
  return { valid: true };
}