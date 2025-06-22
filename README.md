# Audio-to-Audio Real-time Voice AI Platform

A high-performance, real-time audio-to-audio communication platform built on Cloudflare Workers. This implementation provides **~2000ms response times** with **negligible costs**, supporting voice transcription, LLM processing, and text-to-speech synthesis.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/your-username/audio-to-audio-cloudflare)

## 🚀 Features

- **Real-time Voice Processing**: Complete audio-to-audio pipeline in ~2000ms
- **WebSocket-based Communication**: Low-latency real-time streaming
- **Streaming Audio Responses**: Chunk-based audio playback for faster perceived response times
- **Configurable AI Models**: Support for multiple LLM and TTS providers
- **Mobile SDK**: Ready-to-use React Native/Expo SDK
- **JWT Authentication**: Secure API access
- **Cost-Effective**: Serverless architecture with negligible operational costs
- **Scalable**: Built on Cloudflare's global edge network

## 🏗️ Architecture

```
User Voice Input → Whisper (Transcription) → LLM (Groq/Llama) → TTS (OpenAI) → Audio Response
```

### Core Components

1. **Cloudflare Worker Server**: Main API handling WebSocket connections and orchestrating the pipeline
2. **OpenAI Whisper**: Speech-to-text transcription
3. **Groq (Llama)**: Large language model for intelligent responses
4. **OpenAI TTS**: Text-to-speech synthesis
5. **Client SDK**: React Native/Expo SDK for easy integration

### APIs Used

- **OpenAI Whisper API**: Audio transcription
- **Groq API**: LLM inference with Llama models
- **OpenAI Text-to-Speech API**: Audio synthesis
- **Google Custom Search API** (optional): Web search capabilities

## 📋 Quick Start

### Prerequisites

- Cloudflare Workers account
- OpenAI API key
- Groq API key
- Node.js 18+ (for development)

> 📖 **Need more details?** Check out the complete [API Documentation](./API_DOCUMENTATION.md) for detailed endpoint specifications and WebSocket message formats.

### 1. Server Deployment

#### Clone and Setup
```bash
git clone https://github.com/your-username/audio-to-audio-cloudflare
cd audio-to-audio-cloudflare/cloudflare-audio-to-audio-server
npm install
```

#### Configure Environment

**Generate JWT Secret**
First, generate a secure JWT secret:
```bash
# Generate a secure random JWT secret
node generate-jwt-secret.js
```
Copy the generated secret for the next step.

**Set up your secrets**
```bash
# Set up required secrets
npx wrangler secret put JWT_SECRET          # Use the secret generated above
npx wrangler secret put OPENAI_API_KEY      # Your OpenAI API key
npx wrangler secret put GROQ_API_KEY        # Your Groq API key  
npx wrangler secret put OPENAI_PROJECT_ID   # Your OpenAI project ID

# Optional: Configure AI models and features
npx wrangler secret put CUSTOM_PROMPT
npx wrangler secret put TRANSCRIPTION_LANGUAGE
npx wrangler secret put TTS_VOICE
npx wrangler secret put GROQ_MODEL
npx wrangler secret put GOOGLE_SEARCH_API_KEY
npx wrangler secret put GOOGLE_SEARCH_ENGINE_ID
```

#### Deploy
```bash
npm run deploy
```

### 2. Client Integration

#### Install SDK
```bash
npm install ./Expo-client-sdk/services/
```

#### Basic Usage
```javascript
import AudioToAudioSDK from './services/AudioToAudioSDK';

const sdk = new AudioToAudioSDK({
  wsBaseUrl: 'wss://your-worker-name.your-subdomain.workers.dev',
  jwtToken: 'your-jwt-token',
  useStreaming: true
});

// Initialize the SDK
await sdk.initialize();

// Set user context
sdk.setUserContext('user123', 'John Doe');

// Start recording with context
const success = await sdk.startRecordingWithContext('Help me with my question');

// Stop recording and process
const audioUri = await sdk.stopRecordingWithContext();

// Listen for events
sdk.on('groq_response_chunk', (data) => {
  console.log('AI Response:', data.output);
});

sdk.on('audio_chunk', (data) => {
  // Handle streaming audio response
});
```

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `JWT_SECRET` | ✅ | Secret for JWT token validation | - |
| `OPENAI_API_KEY` | ✅ | OpenAI API key for Whisper and TTS | - |
| `GROQ_API_KEY` | ✅ | Groq API key for LLM inference | - |
| `OPENAI_PROJECT_ID` | ✅ | OpenAI project ID | - |
| `CUSTOM_PROMPT` | ❌ | Custom system prompt for the AI | Built-in generic prompt |
| `TRANSCRIPTION_LANGUAGE` | ❌ | Language for Whisper transcription | Auto-detect |
| `TRANSCRIPTION_PROMPT` | ❌ | Prompt hint for Whisper | - |
| `TTS_VOICE` | ❌ | OpenAI TTS voice | `alloy` |
| `TTS_MODEL` | ❌ | OpenAI TTS model | `tts-1` |
| `GROQ_MODEL` | ❌ | Groq model to use | `llama-3.3-70b-versatile` |
| `GOOGLE_SEARCH_API_KEY` | ❌ | Google Custom Search API key | - |
| `GOOGLE_SEARCH_ENGINE_ID` | ❌ | Google Custom Search Engine ID | - |
| `ENABLE_GOOGLE_SEARCH` | ❌ | Enable Google Search integration | `false` |

### Customizing the AI Prompt

You can customize the AI behavior by setting the `CUSTOM_PROMPT` environment variable:

```bash
npx wrangler secret put CUSTOM_PROMPT
# Enter your custom system prompt when prompted
```

The prompt supports template variables:
- `{$username}` - User's name
- `{$CONVERSATION_HISTORY}` - Previous conversation context
- `{$USER_MESSAGE}` - Current user input
- `{$ADDITIONAL_PROMPT}` - Additional context from client

### Available TTS Voices

OpenAI TTS supports these voices:
- `alloy` (default)
- `echo`
- `fable`
- `onyx`
- `nova`
- `shimmer`

### Available Groq Models

- `llama-3.3-70b-versatile` (default)
- `llama-3.1-8b-instant`
- `llama-3.1-70b-versatile`
- `mixtral-8x7b-32768`

## 🔐 Security & Authentication

### JWT Secret Generation

Before deploying, you need to generate a secure JWT secret for token signing:

```bash
# Generate a cryptographically secure JWT secret
node generate-jwt-secret.js
```

This will output a secure random string that you should use as your `JWT_SECRET` environment variable.

### JWT Token Generation

Generate JWT tokens for client authentication:

```bash
node tokengeneration.js --user-id user123 --username "John Doe" --hours 24
```

Available options:
- `--user-id`: Custom user ID
- `--username`: Custom username  
- `--hours`: Token expiration in hours
- `--help`: Show help

> ⚠️ **Security Note**: Keep your JWT_SECRET secure and never expose it in client-side code. Generate a new secret for each deployment environment.

## 📱 Mobile SDK Usage

### SDK Configuration

```javascript
const config = {
  wsBaseUrl: 'wss://your-worker.workers.dev',
  jwtToken: 'your-jwt-token',
  useStreaming: true,           // Enable streaming responses
  autoManageHistory: true,      // Automatically manage conversation history
  autoPlayAudio: true,          // Auto-play AI responses
  autoPlayAudioChunks: true,    // Auto-play streaming audio chunks
  debug: false                  // Enable debug logging
};

const sdk = new AudioToAudioSDK(config);
```

### Event Handling

```javascript
// Connection events
sdk.on('connected', () => console.log('Connected to server'));
sdk.on('disconnected', () => console.log('Disconnected from server'));

// Processing events
sdk.on('processing_start', () => console.log('Processing started'));
sdk.on('processing_end', () => console.log('Processing completed'));

// Transcription events
sdk.on('caption', (data) => console.log('Transcription:', data.output));

// AI response events
sdk.on('groq_response_chunk', (data) => console.log('AI chunk:', data.output));
sdk.on('groq_response_end', (data) => console.log('AI complete:', data.output));

// Audio events
sdk.on('audio_response', (data) => console.log('Audio received'));
sdk.on('audio_chunk', (data) => console.log('Audio chunk:', data.chunkIndex));

// Error events
sdk.on('error', (data) => console.error('Error:', data.message));
```

### Conversation Management

```javascript
// Set user context
sdk.setUserContext('user123', 'John Doe');

// Load previous conversation
const history = [
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi there! How can I help you?' }
];
sdk.setConversationHistory(history);

// Add to conversation history
sdk.addToHistory('user', 'What is the weather like?');

// Clear conversation history
sdk.clearHistory();
```

## 🚀 Performance

This implementation is optimized for speed and cost-efficiency:

- **Response Time**: ~2000ms end-to-end
- **Transcription**: ~300-500ms (Whisper)
- **LLM Processing**: ~800-1200ms (Groq/Llama)  
- **Text-to-Speech**: ~400-600ms (OpenAI TTS)
- **Network Overhead**: ~200-300ms

**Cost Breakdown** (approximate):
- Cloudflare Workers: ~$0.0001 per request
- OpenAI Whisper: ~$0.006 per minute
- Groq LLM: ~$0.0002 per request
- OpenAI TTS: ~$0.015 per 1000 characters

## 🔧 Development

### Local Development

```bash
cd cloudflare-audio-to-audio-server
npm run dev
```



### Project Structure

```
audio-to-audio-cloudflare/
├── cloudflare-audio-to-audio-server/    # Main server code
│   ├── src/
│   │   ├── index.ts                     # Main Worker entry point
│   │   └── lib/
│   │       ├── whisper.ts               # Whisper integration
│   │       ├── groq.ts                  # Groq/LLM integration  
│   │       ├── openai-speech.ts         # OpenAI TTS integration
│   │       ├── prompt.ts                # Configurable prompts
│   │       └── auth.ts                  # JWT authentication
│   ├── wrangler.jsonc                   # Cloudflare Worker config
│   └── package.json
├── Expo-client-sdk/                     # React Native/Expo SDK
│   └── services/
│       ├── AudioToAudioSDK.js           # Main SDK
│       └── AudioToAudioSDK.d.ts         # TypeScript definitions
├── tokengeneration.js                   # JWT token generator
└── README.md
```

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable  
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- OpenAI for Whisper and TTS APIs
- Groq for fast LLM inference
- Cloudflare for Workers platform
- The open-source community

## 📞 Support

- 📖 [API Documentation](./API_DOCUMENTATION.md)
- 🚀 [Deployment Guide](./cloudflare-audio-to-audio-server/DEPLOYMENT.md)
- 🐛 [Issues](https://github.com/your-username/audio-to-audio-cloudflare/issues)
- 💬 [Discussions](https://github.com/your-username/audio-to-audio-cloudflare/discussions)

---

**Built with ❤️ for the developer community** 