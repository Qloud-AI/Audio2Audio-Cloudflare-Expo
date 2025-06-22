# Audio-to-Audio API Documentation

## Overview
The Audio-to-Audio API is a real-time voice AI platform deployed on Cloudflare Workers. It provides end-to-end audio processing with transcription, AI-powered responses, and text-to-speech capabilities.

**Base URL:** `https://your-worker-name.your-subdomain.workers.dev`

## Authentication
The API uses JWT (JSON Web Token) authentication. You need to include the JWT token in your WebSocket connection and HTTP requests.

### JWT Token
- **Algorithm:** HS256
- **Expiration:** Configurable (default: 24 hours)
- **Secret:** Set via `JWT_SECRET` environment variable

### Generating JWT Token

#### Using the Token Generation Script

We've provided a `tokengeneration.js` script that makes it easy to generate tokens:

**Basic Usage:**
```bash
node tokengeneration.js
```

**With Custom Parameters:**
```bash
# Custom user ID and username
node tokengeneration.js --user-id user123 --username john

# Custom expiration (48 hours)
node tokengeneration.js --hours 48

# Combination
node tokengeneration.js --user-id user123 --username john --hours 48
```

**Available Options:**
- `--user-id <id>`: Custom user ID (default: auto-generated)
- `--username <name>`: Custom username (default: "user")
- `--hours <hours>`: Token expiration in hours (default: 24)
- `--help, -h`: Show help message

**Example Output:**
```
🎵 Audio-to-Audio - JWT Token Generator

✅ Token generated successfully!

📋 Token Details:
   User ID: user123
   Username: john
   Issued: 2024-01-01T12:00:00.000Z
   Expires: 2024-01-02T12:00:00.000Z
   Valid for: 24 hours

🔑 JWT Token:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyMTIzIiwidXNlcm5hbWUiOiJqb2huIiwiaWF0IjoxNzA0MTA0NDAwLCJleHAiOjE3MDQxOTA4MDB9.signature

📱 WebSocket URL:
wss://your-worker-name.your-subdomain.workers.dev/ws?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

💡 Copy the token above and use it in your client application!
```

#### Manual JWT Generation (JavaScript)
```javascript
// Example JWT payload
const payload = {
  userId: "user123",
  username: "testuser",
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
};

// Use any JWT library to sign with the secret
const token = jwt.sign(payload, "your_jwt_secret_key_here");
```

#### Using as a Module
You can also import the token generation functions in your own Node.js code:

```javascript
const { generateJWT, decodeJWT, isTokenExpired } = require('./tokengeneration.js');

// Generate a token
const token = generateJWT({
  userId: 'custom_user_123',
  username: 'alice'
}, 'your_jwt_secret_key_here', 48); // 48 hours

// Decode a token
const decoded = decodeJWT(token);
console.log(decoded.payload);

// Check if token is expired
const expired = isTokenExpired(token);
console.log('Token expired:', expired);
```

## WebSocket Connection

### Connection URL
```
wss://your-worker-name.your-subdomain.workers.dev/ws?token=YOUR_JWT_TOKEN
```

### Connection Example
```javascript
const token = "YOUR_JWT_TOKEN_HERE";
const ws = new WebSocket(`wss://your-worker-name.your-subdomain.workers.dev/ws?token=${token}`);

ws.onopen = function(event) {
    console.log('Connected to Audio-to-Audio server');
};

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    handleMessage(data);
};

ws.onerror = function(error) {
    console.error('WebSocket error:', error);
};
```

### Message Types

#### 1. Welcome Message (Server → Client)
```json
{
  "type": "welcome",
  "message": "WebSocket connection established successfully!",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### 2. Audio Message (Client → Server)
```json
{
  "type": "audio",
  "audio": "base64_encoded_audio_data",
  "userId": "user123",
  "username": "john_doe",
  "history": [
    {"role": "user", "content": "Previous user message"},
    {"role": "assistant", "content": "Previous AI response"},
    {"role": "user", "content": "Another user message"}
  ],
  "additionalPrompt": "Additional context for the AI",
  "useStreaming": true
}
```

**Audio Message Parameters:**
- `type` (required): Must be "audio"
- `audio` (required): Base64-encoded audio data
- `userId` (optional): Unique identifier for the user
- `username` (optional): Display name for the user
- `history` (optional): Array of previous conversation messages
- `additionalPrompt` (optional): Additional context or instructions for the AI
- `useStreaming` (optional): Enable audio response streaming (default: false)

**History Message Format:**
Each message in the history array should have:
- `role`: Either "user" or "assistant"
- `content`: The message content/text

#### 3. Caption Response (Server → Client)
```json
{
  "type": "caption",
  "output": "\"Transcribed text from your audio\""
}
```

#### 4. AI Response Chunk (Server → Client)
```json
{
  "type": "groq_response_chunk",
  "output": "Partial AI response text"
}
```

#### 5. AI Response End (Server → Client)
```json
{
  "type": "groq_response_end",
  "output": "Complete AI response text"
}
```

#### 6. Audio Response (Server → Client)
```json
{
  "type": "audio_response",
  "audio": "base64_encoded_audio_data"
}
```

#### 7. Audio Chunk (Server → Client) - Real-time Streaming
```json
{
  "type": "audio_chunk",
  "chunkIndex": 0,
  "audio": "base64_encoded_audio_chunk",
  "text": "Text that was converted to this audio chunk"
}
```

#### 8. Audio Stream End (Server → Client)
```json
{
  "type": "audio_stream_end",
  "totalChunks": 5
}
```

#### 9. Processing End (Server → Client)
```json
{
  "type": "processing_end"
}
```

#### 10. Cancelled (Server → Client)
```json
{
  "type": "cancelled"
}
```

#### 11. Error Message (Server → Client)
```json
{
  "type": "error",
  "errorType": "transcription_error",
  "message": "Could not transcribe audio. Please try speaking more clearly."
}
```

**Error Types:**
- `transcription_error`: Issues with audio transcription
- `service_error`: Audio processing service unavailable
- `ai_error`: AI response service unavailable
- `general_error`: Generic error

#### 12. Cancel Message (Client → Server)
```json
{
  "type": "cancel"
}
```

## HTTP Endpoints

### 1. Health Check
- **URL:** `GET /`
- **Description:** Basic health check and welcome page
- **Response:** HTML welcome page

### 2. Health Status
- **URL:** `GET /health`
- **Description:** API health status
- **Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 3. WebSocket Upgrade
- **URL:** `GET /ws`
- **Description:** WebSocket connection endpoint
- **Query Parameters:**
  - `token` (required): JWT authentication token
- **Headers:**
  - `Upgrade: websocket`
  - `Connection: Upgrade`

## Conversation History

### How History Works
The server processes conversation history by formatting it along with the current user message and additional context into a single prompt. This allows Nik to maintain context across conversations and provide personalized German tutoring.

### Sending History
Include the `history` array in your audio message to provide conversation context:

```javascript
const message = {
  type: 'audio',
  audio: base64AudioData,
  userId: 'user123',
  username: 'alice',
  history: [
    { role: 'user', content: 'Hello, I want to learn German greetings' },
    { role: 'assistant', content: 'Guten Tag! Let\'s start with basic greetings. Say "Hallo"' },
    { role: 'user', content: 'Hallo' },
    { role: 'assistant', content: 'Excellent! Now try "Guten Morgen" for good morning' }
  ],
  additionalPrompt: 'This is a returning user, continue the greetings lesson',
  useStreaming: true
};

ws.send(JSON.stringify(message));
```

### History Processing
The server:
1. Formats the history as: `"User: [message]\nNik: [response]"`
2. Combines it with the current transcribed message
3. Includes any additional prompt context
4. Sends this formatted prompt to the AI tutor as a single message

### Best Practices
- Keep history to the last 5-10 exchanges to avoid token limits
- Use descriptive `additionalPrompt` for context like "returning user" or "new lesson"
- Include `userId` and `username` for personalized responses

## Real-Time Audio Streaming

### How Audio Streaming Works
When `useStreaming` is enabled, the server streams audio in real-time as text is being generated:

1. **Text Buffering**: Server buffers text chunks as they arrive from the AI
2. **Audio Generation**: When buffer reaches 50 characters, generates audio for that segment  
3. **Audio Streaming**: Sends audio chunks immediately via `audio_chunk` messages
4. **Sequential Playback**: Client plays audio chunks in order for real-time experience

### Audio Streaming vs Complete Audio

**Streaming Mode** (`useStreaming: true`):
- Audio chunks sent as `audio_chunk` messages
- Real-time playback starts immediately
- Lower latency, better user experience
- Requires chunk management in client

**Complete Mode** (`useStreaming: false`):
- Single complete audio sent as `audio_response`
- Simpler client implementation
- Higher latency (wait for complete response)

### Example Audio Streaming Flow

```javascript
// 1. Client sends audio with streaming enabled
{
  "type": "audio",
  "audio": "base64_data",
  "useStreaming": true
}

// 2. Server responds with text chunks
{ "type": "groq_response_chunk", "output": "Guten Tag! " }
{ "type": "groq_response_chunk", "output": "Wie geht " }
{ "type": "groq_response_chunk", "output": "es Ihnen?" }

// 3. Server sends audio chunks in parallel
{ "type": "audio_chunk", "chunkIndex": 0, "audio": "...", "text": "Guten Tag! Wie geht " }
{ "type": "audio_chunk", "chunkIndex": 1, "audio": "...", "text": "es Ihnen?" }

// 4. Server signals end of audio stream
{ "type": "audio_stream_end", "totalChunks": 2 }
```

## Audio Processing

### Audio Format Requirements
- **Format:** WAV or WebM
- **Encoding:** Base64 string
- **Sample Rate:** 16kHz (recommended)
- **Channels:** Mono (recommended)

### Audio Recording Example
```javascript
let mediaRecorder;
let audioChunks = [];

async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true
        }
    });
    
    mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
    });
    
    mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
    };
    
    mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const base64Audio = await blobToBase64(audioBlob);
        
        // Send to WebSocket
        ws.send(JSON.stringify({
            type: 'audio',
            audio: base64Audio
        }));
        
        audioChunks = [];
    };
    
    mediaRecorder.start();
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
```

## Complete Integration Example

```html
<!DOCTYPE html>
<html>
<head>
    <title>German with Nik - Client</title>
</head>
<body>
    <button id="startBtn">Start Recording</button>
    <button id="stopBtn" disabled>Stop Recording</button>
    <div id="status">Ready</div>
    <div id="transcription"></div>
    <div id="response"></div>
    <audio id="responseAudio" controls style="display:none;"></audio>

    <script>
        const token = "YOUR_JWT_TOKEN_HERE";
        let ws;
        let mediaRecorder;
        let audioChunks = [];

        // Initialize WebSocket connection
        function initWebSocket() {
            ws = new WebSocket(`wss://cloudflare-german-tutor.angshu-gupta789.workers.dev/ws?token=${token}`);
            
            ws.onopen = () => {
                document.getElementById('status').textContent = 'Connected to Nik';
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                handleMessage(data);
            };
            
            ws.onerror = (error) => {
                document.getElementById('status').textContent = 'Connection error';
                console.error('WebSocket error:', error);
            };
        }

        function handleMessage(data) {
            switch(data.type) {
                case 'welcome':
                    document.getElementById('status').textContent = data.message;
                    break;
                case 'caption':
                    const transcribedText = JSON.parse(data.output);
                    document.getElementById('transcription').textContent = `You said: ${transcribedText}`;
                    break;
                case 'groq_response_chunk':
                    const responseDiv = document.getElementById('response');
                    responseDiv.textContent += data.output;
                    break;
                case 'groq_response_end':
                    // Response is complete
                    break;
                case 'audio_response':
                    playAudioResponse(data.audio);
                    break;
                case 'processing_end':
                    document.getElementById('status').textContent = 'Ready';
                    break;
                case 'cancelled':
                    document.getElementById('status').textContent = 'Cancelled';
                    break;
                case 'error':
                    document.getElementById('status').textContent = `Error: ${data.message}`;
                    break;
            }
        }

        function playAudioResponse(base64Audio) {
            const audioElement = document.getElementById('responseAudio');
            audioElement.src = `data:audio/mp3;base64,${base64Audio}`;
            audioElement.style.display = 'block';
            audioElement.play();
        }

        async function startRecording() {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            
            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };
            
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64Audio = reader.result.split(',')[1];
                    
                    // Example with conversation history
                    const message = {
                        type: 'audio',
                        audio: base64Audio,
                        userId: 'user123',
                        username: 'demo_user',
                        history: [
                            { role: 'user', content: 'Hello Nik' },
                            { role: 'assistant', content: 'Guten Tag! How can I help you learn German today?' }
                        ],
                        additionalPrompt: 'Continue helping this user learn German',
                        useStreaming: true
                    };
                    
                    ws.send(JSON.stringify(message));
                };
                reader.readAsDataURL(audioBlob);
                audioChunks = [];
            };
            
            mediaRecorder.start();
            document.getElementById('startBtn').disabled = true;
            document.getElementById('stopBtn').disabled = false;
            document.getElementById('status').textContent = 'Recording...';
        }

        function stopRecording() {
            mediaRecorder.stop();
            document.getElementById('startBtn').disabled = false;
            document.getElementById('stopBtn').disabled = true;
            document.getElementById('status').textContent = 'Processing...';
        }

        // Event listeners
        document.getElementById('startBtn').addEventListener('click', startRecording);
        document.getElementById('stopBtn').addEventListener('click', stopRecording);

        // Initialize
        initWebSocket();
    </script>
</body>
</html>
```

## Environment Variables (For Deployment)

If you're deploying your own instance, you'll need these environment variables:

```bash
# JWT Secret
JWT_SECRET=your_jwt_secret_key_here

# OpenAI API Key (for Whisper and TTS)
OPENAI_API_KEY=your_openai_api_key

# Groq API Key (for LLaMA chat)
GROQ_API_KEY=your_groq_api_key
```

## Error Handling

### Common Error Codes
- **1006:** WebSocket connection closed abnormally (usually authentication issues)
- **401:** Unauthorized (invalid JWT token)
- **400:** Bad request (malformed message)
- **500:** Internal server error

### Error Response Format
```json
{
  "type": "error",
  "message": "Detailed error description",
  "code": "ERROR_CODE"
}
```

## Rate Limits
- **Cloudflare Workers Free Tier:** 100,000 requests per day
- **WebSocket Connections:** No specific limit, but subject to Cloudflare's fair use policy
- **Audio Processing:** Limited by OpenAI and Groq API quotas

## Support
For issues or questions about the API, please refer to the project repository or contact the development team.

---

**Last Updated:** January 2024  
**API Version:** 1.0  
**Deployment:** Cloudflare Workers 