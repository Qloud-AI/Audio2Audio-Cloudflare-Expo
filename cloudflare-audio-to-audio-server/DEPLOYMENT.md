# Audio-to-Audio Server Deployment Guide

This guide will walk you through deploying the Audio-to-Audio server on Cloudflare Workers.

## Prerequisites

Before you begin, make sure you have:

- **Cloudflare account** (free tier works)
- **OpenAI API key** with access to:
  - Whisper API (speech-to-text)
  - Text-to-Speech API
- **Groq API key** with access to Llama models
- **Node.js 18+** installed locally
- **Git** installed

## Step 1: Get Your API Keys

### OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign in or create an account
3. Navigate to API Keys section
4. Create a new API key
5. **Important**: Add billing information to your OpenAI account
6. Note your **Project ID** from the dashboard

### Groq API Key
1. Go to [Groq Console](https://console.groq.com/)
2. Sign in or create an account
3. Navigate to API Keys section
4. Create a new API key

### Optional: Google Search API (for enhanced AI responses)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Custom Search API
4. Create credentials (API key)
5. Set up a Custom Search Engine at [Google CSE](https://cse.google.com/)

## Step 2: Clone and Setup

```bash
# Clone the repository
git clone https://github.com/your-username/audio-to-audio-cloudflare
cd audio-to-audio-cloudflare/cloudflare-audio-to-audio-server

# Install dependencies
npm install
```

## Step 3: Configure Wrangler

### Install Wrangler CLI
```bash
npm install -g wrangler
```

### Login to Cloudflare
```bash
wrangler login
```

### Update Configuration
Edit `wrangler.jsonc` to customize your deployment:

```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "your-audio-to-audio-server",
  "main": "src/index.ts",
  "compatibility_date": "2025-01-15",
  "compatibility_flags": [
    "global_fetch_strictly_public"
  ],
  "assets": {
    "directory": "./public"
  },
  "observability": {
    "enabled": true
  },
  "vars": {
    "NODE_ENV": "production"
  }
}
```

Change the `name` field to your preferred worker name (this will be part of your URL).

## Step 4: Set Environment Variables

### Required Secrets
Set up the required secrets using Wrangler:

```bash
# JWT Secret (generate a strong random string)
wrangler secret put JWT_SECRET
# Enter a strong secret like: myVerySecureJWTSecret123!@#

# OpenAI API Key
wrangler secret put OPENAI_API_KEY
# Enter your OpenAI API key

# Groq API Key  
wrangler secret put GROQ_API_KEY
# Enter your Groq API key

# OpenAI Project ID
wrangler secret put OPENAI_PROJECT_ID
# Enter your OpenAI project ID
```

### Optional Configuration
Configure optional features:

```bash
# Custom AI Prompt
wrangler secret put CUSTOM_PROMPT
# Enter your custom system prompt (or skip for default)

# Transcription Language (e.g., 'en', 'es', 'fr', 'de')
wrangler secret put TRANSCRIPTION_LANGUAGE
# Enter language code or skip for auto-detection

# Transcription Prompt Hint
wrangler secret put TRANSCRIPTION_PROMPT
# Enter a prompt hint for better transcription

# TTS Voice (alloy, echo, fable, onyx, nova, shimmer)
wrangler secret put TTS_VOICE
# Enter preferred voice or skip for default (alloy)

# TTS Model (tts-1, tts-1-hd)
wrangler secret put TTS_MODEL
# Enter TTS model or skip for default (tts-1)

# Groq Model
wrangler secret put GROQ_MODEL
# Enter Groq model or skip for default (llama-3.3-70b-versatile)

# Google Search (optional)
wrangler secret put GOOGLE_SEARCH_API_KEY
# Enter Google Search API key (optional)

wrangler secret put GOOGLE_SEARCH_ENGINE_ID
# Enter Google Search Engine ID (optional)

wrangler secret put ENABLE_GOOGLE_SEARCH
# Enter 'true' to enable Google Search (optional)
```

## Step 5: Deploy

### Development Deployment
For testing:
```bash
npm run dev
```
This will start a local development server.

### Production Deployment
```bash
npm run deploy
```

After successful deployment, you'll see output like:
```
✨ Success! Deployed to https://your-audio-to-audio-server.your-subdomain.workers.dev
```

## Step 6: Test Your Deployment

### Health Check
Visit your worker URL in a browser:
```
https://your-audio-to-audio-server.your-subdomain.workers.dev/health
```

You should see:
```json
{
  "status": "OK",
  "message": "Server is running"
}
```

### Generate Test JWT Token
```bash
cd .. # Go back to project root
node tokengeneration.js --user-id test-user --username "Test User"
```

Copy the generated token for client testing.

### WebSocket Test
You can test the WebSocket connection using the provided test client:
```
https://your-audio-to-audio-server.your-subdomain.workers.dev
```

## Step 7: Client Integration

Update your client applications to use your deployed server:

### React Native/Expo SDK
```javascript
import AudioToAudioSDK from './services/AudioToAudioSDK';

const sdk = new AudioToAudioSDK({
  wsBaseUrl: 'wss://your-audio-to-audio-server.your-subdomain.workers.dev',
  jwtToken: 'your-generated-jwt-token',
  useStreaming: true
});
```

### Web Client
```javascript
const ws = new WebSocket('wss://your-audio-to-audio-server.your-subdomain.workers.dev/ws?token=your-jwt-token');
```

## Monitoring and Maintenance

### View Logs
```bash
wrangler tail
```

### Monitor Usage
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to Workers & Pages
3. Click on your worker
4. View analytics and logs

### Update Deployment
```bash
# Make your changes, then redeploy
npm run deploy
```

## Troubleshooting

### Common Issues

#### 1. "Module not found" errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### 2. API key not working
- Verify your API keys are correct
- Check if your OpenAI account has billing enabled
- Ensure Groq API key has proper permissions

#### 3. WebSocket connection fails
- Check if JWT token is valid and not expired
- Verify the JWT_SECRET matches between server and token generation
- Test with a freshly generated token

#### 4. Audio transcription fails
- Ensure audio format is supported (MP4 recommended)
- Check if OPENAI_API_KEY has Whisper API access
- Verify audio file size is reasonable (< 25MB)

#### 5. TTS generation fails
- Check if OpenAI account has TTS API access
- Verify OPENAI_PROJECT_ID is correct
- Ensure billing is enabled on OpenAI account

### Debugging Steps

1. **Check deployment status:**
   ```bash
   wrangler deployments list
   ```

2. **View real-time logs:**
   ```bash
   wrangler tail --format pretty
   ```

3. **Test individual components:**
   ```bash
   # Test JWT generation
   node tokengeneration.js --help
   
   # Test API endpoints
   curl https://your-worker.workers.dev/health
   ```

4. **Verify secrets:**
   ```bash
   wrangler secret list
   ```

## Performance Optimization

### Recommended Settings

For production use, consider these optimizations:

1. **Use TTS-1-HD model** for better audio quality:
   ```bash
   wrangler secret put TTS_MODEL
   # Enter: tts-1-hd
   ```

2. **Set specific transcription language** if you know your users' primary language:
   ```bash
   wrangler secret put TRANSCRIPTION_LANGUAGE
   # Enter: en (or your target language)
   ```

3. **Optimize Groq model** based on your needs:
   - `llama-3.1-8b-instant`: Fastest, lower quality
   - `llama-3.3-70b-versatile`: Balanced (default)
   - `mixtral-8x7b-32768`: Good for longer contexts

### Cost Optimization

Monitor your usage and costs:

- **OpenAI Whisper**: ~$0.006 per minute
- **OpenAI TTS**: ~$0.015 per 1000 characters
- **Groq**: Very low cost, varies by model
- **Cloudflare Workers**: Free tier covers significant usage

## Security Considerations

1. **Use strong JWT secrets**
2. **Regularly rotate API keys**
3. **Monitor for unusual usage patterns**
4. **Consider implementing rate limiting**
5. **Use HTTPS/WSS only**

## Scaling Considerations

Cloudflare Workers automatically scale, but consider:

1. **API rate limits** from OpenAI and Groq
2. **Concurrent WebSocket connections**
3. **Geographic distribution** (Cloudflare handles this)
4. **Cost monitoring** as usage grows

## Support

If you encounter issues:

1. Check this guide first
2. Review the [API Documentation](../API_DOCUMENTATION.md)
3. Check the [main README](../README.md)
4. Open an issue on GitHub

## Next Steps

After successful deployment:

1. **Integrate with your client application**
2. **Customize the AI prompt** for your use case
3. **Set up monitoring and alerts**
4. **Consider implementing user authentication**
5. **Plan for scaling and cost optimization**

---

**Congratulations! Your Audio-to-Audio server is now deployed and ready to use! 🚀** 