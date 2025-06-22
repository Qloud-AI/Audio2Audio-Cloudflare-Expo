# Audio-to-Audio Server

Real-time voice AI server built on Cloudflare Workers. Provides ~2000ms response times with WebSocket-based audio processing pipeline.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Generate JWT Secret
```bash
# From project root
node ../generate-jwt-secret.js
```

### 3. Configure Environment
```bash
# Set required secrets
npx wrangler secret put JWT_SECRET          # Use generated secret
npx wrangler secret put OPENAI_API_KEY      # Your OpenAI API key
npx wrangler secret put GROQ_API_KEY        # Your Groq API key
npx wrangler secret put OPENAI_PROJECT_ID   # Your OpenAI project ID

# Optional configurations
npx wrangler secret put CUSTOM_PROMPT       # Custom AI system prompt
npx wrangler secret put TTS_VOICE           # alloy, echo, fable, onyx, nova, shimmer
npx wrangler secret put GROQ_MODEL          # llama-3.3-70b-versatile (default)
```

### 4. Deploy
```bash
npm run deploy
```

### 5. Development
```bash
npm run dev  # Local development server
```

## 📡 API Endpoints

- **WebSocket**: `/ws?token=JWT_TOKEN` - Main audio processing
- **Health**: `/health` - Server status check
- **Audio Generation**: `/api/generate-audio` - Direct TTS endpoint
- **Landing Page**: `/` - Server information

## 🔑 Authentication

Generate JWT tokens for client access:
```bash
# From project root
node ../tokengeneration.js --user-id user123 --username "John Doe" --hours 24
```

## 📚 Documentation

- **[Complete Setup Guide](../README.md)** - Full platform documentation
- **[API Documentation](../API_DOCUMENTATION.md)** - WebSocket message formats and endpoints
- **[Deployment Guide](./DEPLOYMENT.md)** - Detailed deployment instructions
- **[Client SDK](../Expo-client-sdk/services/README.md)** - React Native/Expo SDK

## 🏗️ Architecture

```
Audio Input → Whisper (Transcription) → Groq/LLaMA (AI) → OpenAI TTS → Audio Output
```

**Performance**: ~2000ms end-to-end response time
**Cost**: ~$0.02 per minute of conversation

## 🛠️ Configuration Options

| Variable | Description | Default |
|----------|-------------|---------|
| `CUSTOM_PROMPT` | AI system prompt | Built-in generic prompt |
| `TTS_VOICE` | OpenAI TTS voice | `alloy` |
| `GROQ_MODEL` | LLM model | `llama-3.3-70b-versatile` |
| `TRANSCRIPTION_LANGUAGE` | Whisper language | Auto-detect |
| `ENABLE_GOOGLE_SEARCH` | Web search capability | `false` |

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run deploy` - Deploy to Cloudflare Workers
- `npm run start` - Alias for dev
- `npx wrangler cf-typegen` - Generate TypeScript types

## 📞 Support

- 🐛 [Issues](https://github.com/your-username/audio-to-audio-cloudflare/issues)
- 📖 [Full Documentation](../README.md)
- 🚀 [Deployment Help](./DEPLOYMENT.md)

---

**Built for Cloudflare Workers** | **Powered by OpenAI, Groq & Whisper** 