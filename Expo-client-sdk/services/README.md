# Audio-to-Audio Real-time SDK

A comprehensive WebSocket SDK for real-time voice communication with AI assistants. Features real-time audio streaming, text streaming, voice recording, conversation history management, and seamless audio playback with intelligent session management.

## Features

- 🎤 **Voice Recording**: High-quality audio recording with automatic server transmission
- 🗣️ **Real-time Audio Streaming**: Sequential audio chunk playback for immediate response
- 📝 **Text Streaming**: Live text updates as the AI responds
- 💬 **Conversation History**: Automatic conversation tracking with manual override options
- ⏱️ **Smart Timeouts**: Separate transcription and response timeouts with contextual error handling
- 🔄 **Auto-reconnection**: Automatic WebSocket reconnection on connection loss
- 📱 **React Native & Expo**: Built specifically for mobile applications
- 🎯 **Event-driven**: Clean event-based architecture for easy integration
- 🔧 **TypeScript Support**: Full TypeScript definitions included
- 🛡️ **Error Handling**: Comprehensive error handling with contextual messaging
- 🔒 **Configurable**: Flexible server configuration and authentication
- 🎵 **Audio Replay**: Save and replay audio responses
- 👤 **User Context**: Personalized responses with user identification
- 🚫 **Smart Cancellation**: Audio-only cancellation that preserves text responses
- 🆔 **Session Management**: Client-side session isolation for reliable operation

## Installation

```bash
npm install ./services/AudioToAudioSDK
```

### Peer Dependencies

Make sure you have the following peer dependencies installed:

```bash
expo install expo-av expo-file-system expo-constants
```

## Quick Start

```javascript
import AudioToAudioSDK from './services/AudioToAudioSDK';

// Initialize SDK with your server configuration
const sdk = new AudioToAudioSDK({
  wsBaseUrl: 'wss://your-audio-to-audio-server.workers.dev',
  jwtToken: 'your-jwt-token'
});

// Set user context for personalized responses
sdk.setUserContext('user123', 'Alice');

// Set up event handlers
sdk.on('connected', () => console.log('Connected!'));
sdk.on('transcription', (data) => console.log('You said:', data.text));
sdk.on('textChunk', (data) => console.log('AI response:', data.accumulated));
sdk.on('audioStart', () => console.log('Audio playback started'));

// Initialize and connect
await sdk.initialize();

// Start recording with context
await sdk.startRecordingWithContext('Help me with my question');

// Stop recording (automatically sends to server with context)
await sdk.stopRecordingWithContext();
```

## Configuration

The SDK requires server configuration to connect to your audio-to-audio server.

### Required Configuration

```javascript
const sdk = new AudioToAudioSDK({
  // Required: Your deployed server URL
  wsBaseUrl: 'wss://your-audio-to-audio-server.workers.dev',
  
  // Required: JWT token for authentication
  jwtToken: 'your-jwt-token-here'
});
```

### Optional Configuration

```javascript
const sdk = new AudioToAudioSDK({
  wsBaseUrl: 'wss://your-server.workers.dev',
  jwtToken: 'your-jwt-token',
  
  // Optional settings with sensible defaults
  useStreaming: true,           // Default: true - Enable real-time audio streaming
  autoManageHistory: true,      // Default: true - Automatically track conversation history
  autoPlayAudio: true,          // Default: true - Auto-play AI responses
  autoPlayAudioChunks: true,    // Default: true - Auto-play streaming audio chunks
  debug: false,                 // Default: false - Enable debug logging
  
  // Custom audio settings (optional)
  audioOptions: {
    android: {
      extension: '.mp4',
      outputFormat: Audio.AndroidOutputFormat.MPEG_4,
      audioEncoder: Audio.AndroidAudioEncoder.AAC,
      sampleRate: 44100,
      numberOfChannels: 2,
      bitRate: 128000,
    },
    ios: {
      extension: '.mp4',
      outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
      audioQuality: Audio.IOSAudioQuality.HIGH,
      sampleRate: 44100,
      numberOfChannels: 2,
      bitRate: 128000,
    }
  }
});
```

## API Reference

### Core Methods

#### `initialize(): Promise<boolean>`
Initializes the SDK, sets up audio permissions, and connects to the WebSocket server.

#### `startRecording(): Promise<boolean>`
Starts basic audio recording. Use `startRecordingWithContext()` for conversation-aware recording.

#### `stopRecording(options?: object): Promise<boolean>`
Stops recording and sends the audio to the server. Use `stopRecordingWithContext()` for conversation-aware recording.

#### `playAudio(base64Audio?: string): Promise<boolean>`
Plays the saved audio response. If `base64Audio` is provided, plays that audio instead.

#### `cancelAudio(): Promise<boolean>`
**Cancels only audio playback** while preserving text response generation. This allows users to stop listening to audio without interrupting the AI's text response, which continues to display normally.

```javascript
// Audio cancellation behavior:
// ✅ Stops current audio playback immediately
// ✅ Prevents future audio chunks from auto-playing
// ✅ Preserves complete text response for reading
// ✅ Allows manual audio replay later
// ❌ Does NOT interrupt text generation
await sdk.cancelAudio();
```

#### `disconnect(): Promise<boolean>`
Disconnects from the server and cleans up resources.

### Context Management Methods

#### `setUserContext(userId: string, username: string): void`
Sets user context for personalized responses and conversation tracking.

```javascript
sdk.setUserContext('user123', 'Alice');
```

#### `setConversationHistory(history: Array): void`
Sets the conversation history for context. Each message should have `role` and `content` properties.

```javascript
sdk.setConversationHistory([
  { role: 'user', content: 'Hello, I need help with something' },
  { role: 'assistant', content: 'Hi! I\'d be happy to help you.' }
]);
```

#### `addToHistory(role: string, content: string): void`
Adds a message to the conversation history. Automatically keeps only the last 10 messages.

```javascript
sdk.addToHistory('user', 'What can you help me with?');
sdk.addToHistory('assistant', 'I can help you with various questions and tasks.');
```

#### `clearHistory(): void`
Clears the conversation history.

### Context-Aware Recording Methods

#### `startRecordingWithContext(additionalPrompt?: string): Promise<boolean>`
Starts recording and automatically includes user context and conversation history when sending.

```javascript
// For new users
await sdk.startRecordingWithContext('This is a new user starting their first conversation');

// For existing users
await sdk.startRecordingWithContext('Continue the conversation based on previous context');
```

#### `stopRecordingWithContext(overrideOptions?: object): Promise<boolean>`
Stops recording and sends with all available context (user info, history, additional prompt).

```javascript
await sdk.stopRecordingWithContext();

// Or with custom options
await sdk.stopRecordingWithContext({
  additionalPrompt: 'Please provide a detailed explanation'
});
```

#### `sendAudioWithContext(uri: string, additionalPrompt?: string): Promise<void>`
Sends an audio file with conversation context included.

### Status Methods

#### `getStatus(): SDKStatus`
Returns the current status of the SDK including connection, recording, playback states, conversation context, and session information.

```javascript
const status = sdk.getStatus();
console.log('Connected:', status.connected);
console.log('Recording:', status.recording);
console.log('History length:', status.historyLength);
console.log('Current session:', status.currentSessionId);
```

## Events

The SDK uses an event-driven architecture. Register event handlers using `sdk.on(event, handler)`.

### Connection Events

#### `connected`
WebSocket connection established.
```javascript
sdk.on('connected', () => {
  console.log('Connected to server');
});
```

#### `disconnected`
WebSocket connection lost.
```javascript
sdk.on('disconnected', () => {
  console.log('Disconnected from server');
});
```

#### `initialized`
SDK fully initialized and ready.
```javascript
sdk.on('initialized', () => {
  console.log('SDK ready to use');
});
```

### Recording Events

#### `recordingStart`
Audio recording started.
```javascript
sdk.on('recordingStart', () => {
  console.log('Recording started');
});
```

#### `recordingStop`
Audio recording stopped.
```javascript
sdk.on('recordingStop', (data) => {
  console.log('Recording stopped, URI:', data.uri);
});
```

#### `audioSent`
Audio successfully sent to server.
```javascript
sdk.on('audioSent', (data) => {
  console.log('Audio sent, length:', data.audioLength);
  console.log('Has context:', data.hasContext);
  console.log('Client session:', data.clientSessionId);
});
```

### Processing Events

#### `processingStart`
Server started processing audio.
```javascript
sdk.on('processingStart', () => {
  console.log('Server processing audio');
});
```

#### `processingEnd`
Server finished processing.
```javascript
sdk.on('processingEnd', () => {
  console.log('Processing complete');
});
```

#### `transcription`
Speech-to-text result received.
```javascript
sdk.on('transcription', (data) => {
  console.log('You said:', data.text);
});
```

### Text Streaming Events

#### `textChunk`
AI response chunk received (real-time streaming).
```javascript
sdk.on('textChunk', (data) => {
  console.log('AI response chunk:', data.chunk);
  console.log('Accumulated response:', data.accumulated);
  console.log('Is typing:', data.isTyping);
});
```

#### `textComplete`
AI response fully received.
```javascript
sdk.on('textComplete', (data) => {
  console.log('Complete AI response:', data.text);
});
```

### Audio Events

#### `audioStart`
Audio playback started.
```javascript
sdk.on('audioStart', (data) => {
  console.log('Audio playback started');
  console.log('Is streaming:', data.streaming);
});
```

#### `audioChunk`
Audio chunk received from server (real-time streaming).
```javascript
sdk.on('audioChunk', (data) => {
  console.log('Audio chunk received:', data.chunkIndex);
});
```

#### `chunkPlaybackStart`
Individual chunk playback started.
```javascript
sdk.on('chunkPlaybackStart', (data) => {
  console.log('Playing chunk:', data.chunkIndex);
});
```

#### `chunkPlaybackEnd`
Individual chunk playback finished.
```javascript
sdk.on('chunkPlaybackEnd', (data) => {
  console.log('Finished chunk:', data.chunkIndex);
});
```

#### `audioStreamEnd`
All audio chunks received from server.
```javascript
sdk.on('audioStreamEnd', (data) => {
  console.log('Audio stream complete, total chunks:', data.totalChunks);
});
```

#### `audioComplete`
All audio playback finished.
```javascript
sdk.on('audioComplete', (data) => {
  console.log('Audio playback complete');
  console.log('Total chunks played:', data.totalChunks);
  console.log('Was cancelled:', data.cancelled);
});
```

### Manual Playback Events

#### `playbackStart`
Manual audio playback started (replay).
```javascript
sdk.on('playbackStart', (data) => {
  console.log('Manual playback started');
  console.log('Is replay:', data.isReplay);
});
```

#### `playbackEnd`
Manual audio playback finished.
```javascript
sdk.on('playbackEnd', (data) => {
  console.log('Manual playback ended');
});
```

#### `playbackCancelled`
Audio playback cancelled (audio only - text responses continue).
```javascript
sdk.on('playbackCancelled', (data) => {
  console.log('Audio playback cancelled');
  console.log('Text response preserved:', !data.textInterrupted);
  console.log('Had error:', !!data.error);
});
```

### Error Events

#### `error`
SDK or client-side error occurred.
```javascript
sdk.on('error', (data) => {
  console.error('SDK Error:', data.message);
  
  switch (data.type) {
    case 'transcription_error':
    case 'audio_processing':
      // Show user-friendly transcription error message
      showTranscriptionHelp();
      break;
    case 'permission':
      // Show permission dialog
      requestPermissions();
      break;
    default:
      // Log other errors without interrupting conversation
      console.error('General error:', data.message);
  }
});
```

#### `serverError`
Server-side error occurred.
```javascript
sdk.on('serverError', (data) => {
  console.error('Server Error:', data.message);
  
  // Only show transcription help for speech-related server errors
  if (data.message.includes('transcription') || 
      data.message.includes('speech recognition') ||
      data.message.includes('audio processing')) {
    showTranscriptionHelp();
  } else {
    // Handle other server errors without interrupting conversation
    handleServerError(data.message);
  }
});
```

#### `timeout`
Request timeout occurred.
```javascript
sdk.on('timeout', (data) => {
  console.warn('Timeout:', data.type, 'Duration:', data.duration);
  
  if (data.type === 'transcription_timeout') {
    // Show transcription-specific help
    showTranscriptionHelp();
  } else if (data.type === 'response_timeout') {
    // Handle general response timeout
    showMessage("Server is taking longer than expected. Please try again.");
  }
});
```

## Session Management

The SDK implements client-side session management to ensure reliable operation:

### How It Works

1. **Session Generation**: Each recording session gets a unique client session ID
2. **Message Filtering**: Messages from cancelled sessions are automatically filtered out
3. **Audio Isolation**: Cancelled audio doesn't interfere with new recordings
4. **Text Preservation**: Text responses continue even after audio cancellation

### Session Events

```javascript
sdk.on('audioSent', (data) => {
  console.log('Client session ID:', data.clientSessionId);
});

// Session status in getStatus()
const status = sdk.getStatus();
console.log('Current session:', status.currentSessionId);
console.log('Session counter:', status.sessionCounter);
```

## Smart Cancellation System

The SDK implements a sophisticated cancellation system that separates audio and text processing:

### Audio-Only Cancellation

When users cancel audio playback:
- ✅ **Audio stops immediately** - No more audio chunks play
- ✅ **Text continues generating** - AI response text keeps appearing
- ✅ **Audio preserved for replay** - Users can replay the audio later
- ✅ **UI remains clean** - No broken or incomplete messages

### Simplified UI Implementation (Recommended)

The easiest approach is to disable cancellation during text generation:

```javascript
// In your UI component
const [isProcessing, setIsProcessing] = useState(false);
const [isTyping, setIsTyping] = useState(false);
const [isPlaying, setIsPlaying] = useState(false);
const [isRecording, setIsRecording] = useState(false);

// Simple press handler that disables cancellation during text generation
const handlePressIn = async () => {
  // Disable cancellation during text generation
  if (isProcessing || isTyping) {
    console.log('Cannot cancel during text generation');
    return;
  }

  if (isPlaying) {
    // Only cancel audio playback (text preserved)
    await sdk.cancelAudio();
    return;
  }

  // Start recording
  await sdk.startRecordingWithContext('Help me with my question');
};

const handlePressOut = async () => {
  if (isRecording) {
    await sdk.stopRecordingWithContext();
  }
};

// Update button text and style based on state
const getButtonText = () => {
  if (isProcessing || isTyping) return "Generating...";
  if (isPlaying) return "Cancel Audio";
  if (isRecording) return "Release to Send";
  return "Hold to Talk";
};

const isButtonDisabled = isProcessing || isTyping;

// Button component
<TouchableOpacity
  onPressIn={handlePressIn}
  onPressOut={handlePressOut}
  disabled={isButtonDisabled}
  style={[
    styles.voiceButton,
    isRecording && styles.recordingButton,
    isButtonDisabled && styles.disabledButton
  ]}
>
  <Text style={styles.buttonText}>
    {getButtonText()}
  </Text>
</TouchableOpacity>

// Set up event handlers
sdk.on('processingStart', () => setIsProcessing(true));
sdk.on('processingEnd', () => setIsProcessing(false));
sdk.on('textChunk', () => setIsTyping(true));
sdk.on('textComplete', () => setIsTyping(false));
sdk.on('recordingStart', () => setIsRecording(true));
sdk.on('recordingStop', () => setIsRecording(false));
sdk.on('audioStart', () => setIsPlaying(true));
sdk.on('audioComplete', () => setIsPlaying(false));
sdk.on('playbackCancelled', () => setIsPlaying(false));
```

### Advanced Implementation

For more complex scenarios, you can implement selective cancellation:

```javascript
// Advanced cancellation with user confirmation
const handleCancelPress = async () => {
  if (isProcessing || isTyping) {
    // Show user that text is still generating
    showMessage("AI is still generating response. Please wait...");
    return;
  }
  
  if (isPlaying) {
    // Cancel audio only (text preserved)
    await sdk.cancelAudio();
  }
};
```

## Real-time Audio Streaming

The SDK provides seamless real-time audio streaming with enhanced features:

### Features
1. **Immediate Playback**: Audio starts playing as soon as the first chunk arrives
2. **Sequential Processing**: Chunks are played in order without overlap
3. **Smooth Transitions**: No gaps between audio chunks
4. **Memory Efficient**: Temporary chunk files are automatically cleaned up
5. **Replay Support**: Complete audio is saved for replay functionality
6. **Smart Cancellation**: Can cancel streaming without affecting text responses
7. **Progress Tracking**: Track chunk playback progress with events
8. **Session Isolation**: Cancelled sessions don't interfere with new recordings

### Streaming Events Flow
```
audioStart → audioChunk → chunkPlaybackStart → chunkPlaybackEnd → audioStreamEnd → audioComplete
```

### Cancellation Behavior
```javascript
// Cancel only audio playback (text continues)
await sdk.cancelAudio();

// Events emitted:
// - playbackCancelled (audio only)
// - Text streaming continues normally
// - audioComplete (with cancelled: true)
```

## Conversation History Management

The SDK provides flexible conversation history management with automatic session tracking:

### Automatic History Management (Default)
```javascript
const sdk = new AudioToAudioSDK({
  wsBaseUrl: 'wss://your-server.workers.dev',
  jwtToken: 'your-jwt-token',
  autoManageHistory: true // Default
});

// SDK automatically tracks all messages
// - User messages added when transcription received
// - AI messages added when text response complete
// - Automatically keeps last 10 messages (5 exchanges)
// - Session-aware tracking prevents message mix-ups
```

### Manual History Management
```javascript
const sdk = new AudioToAudioSDK({
  wsBaseUrl: 'wss://your-server.workers.dev',
  jwtToken: 'your-jwt-token',
  autoManageHistory: false
});

// You control the history
sdk.setConversationHistory(existingHistory);
sdk.addToHistory('user', 'Hello');
sdk.addToHistory('assistant', 'Hi there!');
```

### Hybrid Approach (Recommended)
```javascript
const sdk = new AudioToAudioSDK({
  wsBaseUrl: 'wss://your-server.workers.dev',
  jwtToken: 'your-jwt-token',
  autoManageHistory: true // Auto-track messages
});

// Override with specific history before recording
const lastSixMessages = await getLastMessagesFromStorage();
sdk.setConversationHistory(lastSixMessages);
await sdk.startRecordingWithContext('Continue conversation');
```

## TypeScript Support

The SDK includes comprehensive TypeScript definitions:

```typescript
import AudioToAudioSDK, { SDKConfig, SDKStatus, EventData } from './services/AudioToAudioSDK';

// Type-safe configuration
const config: SDKConfig = {
  wsBaseUrl: 'wss://your-server.workers.dev',
  jwtToken: 'your-jwt-token',
  useStreaming: true,
  autoManageHistory: true
};

const sdk = new AudioToAudioSDK(config);

// Type-safe event handlers
sdk.on('textChunk', (data: EventData['textChunk']) => {
  console.log('Chunk:', data.chunk);
  console.log('Accumulated:', data.accumulated);
  console.log('Is typing:', data.isTyping);
});

sdk.on('audioStart', (data: EventData['audioStart']) => {
  console.log('Audio started, streaming:', data.streaming);
});

sdk.on('error', (data: EventData['error']) => {
  console.error('Error type:', data.type);
  console.error('Error message:', data.message);
});

// Type-safe status checking
const status: SDKStatus = sdk.getStatus();
console.log('Connected:', status.connected);
console.log('Recording:', status.recording);
console.log('History length:', status.historyLength);
console.log('Session ID:', status.currentSessionId);
```

## Best Practices

1. **Server Configuration**: Always provide your server URL and JWT token
2. **Set User Context**: Call `setUserContext()` for personalized responses
3. **Use Context-Aware Recording**: Prefer `startRecordingWithContext()` over basic `startRecording()`
4. **Handle All Events**: Set up event handlers before initializing
5. **Proper Cleanup**: Call `disconnect()` when unmounting components
6. **Contextual Error Handling**: Handle different error types appropriately
7. **Simplified Cancellation**: Disable cancellation during text generation for reliable UX
8. **Conversation Management**: Choose between auto or manual history management based on your needs
9. **Audio Replay**: Utilize the replay functionality for better user experience
10. **Session Awareness**: Trust the SDK's session management for reliable operation
11. **UI State Management**: Use `isProcessing || isTyping` checks to control user interactions
12. **Button States**: Provide clear visual feedback for different interaction states
13. **Error Messages**: Show contextual error messages only for relevant error types
14. **Security**: Store JWT tokens securely and rotate them regularly

## Advanced Usage Examples

### Complete Integration Example
```javascript
import React, { useState, useEffect, useRef } from 'react';
import AudioToAudioSDK from './services/AudioToAudioSDK';

function VoiceChat() {
  const sdkRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [userMessage, setUserMessage] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    initializeSDK();
    return () => cleanup();
  }, []);

  const initializeSDK = async () => {
    try {
      // Initialize with your server configuration
      sdkRef.current = new AudioToAudioSDK({
        wsBaseUrl: 'wss://your-audio-to-audio-server.workers.dev',
        jwtToken: 'your-jwt-token-here',
        autoManageHistory: true
      });

      // Set user context
      sdkRef.current.setUserContext('user123', 'Alice');

      // Set up comprehensive event handlers
      setupEventHandlers();

      // Initialize
      const success = await sdkRef.current.initialize();
      if (success) {
        setStatus('Ready');
      } else {
        setStatus('Connection failed');
      }
    } catch (error) {
      console.error('SDK initialization error:', error);
      setStatus('Error');
    }
  };

  const setupEventHandlers = () => {
    const sdk = sdkRef.current;

    // Connection events
    sdk.on('connected', () => setStatus('Connected'));
    sdk.on('disconnected', () => setStatus('Disconnected'));

    // Recording events
    sdk.on('recordingStart', () => {
      setIsRecording(true);
      setStatus('Recording...');
    });

    sdk.on('recordingStop', () => {
      setIsRecording(false);
      setStatus('Processing...');
    });

    // Transcription
    sdk.on('transcription', (data) => {
      setUserMessage(data.text);
    });

    // Processing events
    sdk.on('processingStart', () => {
      setIsProcessing(true);
      setStatus('Processing...');
    });

    sdk.on('processingEnd', () => {
      setIsProcessing(false);
    });

    // Text streaming
    sdk.on('textChunk', (data) => {
      setIsTyping(true);
      setAiResponse(data.accumulated);
      setStatus('AI is responding...');
    });

    sdk.on('textComplete', (data) => {
      setIsTyping(false);
      setAiResponse(data.text);
      setStatus('Ready');
    });

    // Audio events
    sdk.on('audioStart', () => {
      setIsPlaying(true);
      setStatus('Playing audio...');
    });

    sdk.on('audioComplete', (data) => {
      setIsPlaying(false);
      setStatus('Ready');
    });

    sdk.on('playbackCancelled', () => {
      setIsPlaying(false);
      setStatus('Ready');
      // Note: Text response is preserved
    });

    // Error handling
    sdk.on('error', (data) => {
      if (data.type === 'transcription_error') {
        setAiResponse("I'm sorry, I couldn't understand that. Please try again by holding the 'Talk' button and speaking clearly.");
      }
      setStatus('Error occurred');
    });

    sdk.on('timeout', (data) => {
      if (data.type === 'transcription_timeout') {
        setAiResponse("I'm sorry, I couldn't understand that. Please try again by holding the 'Talk' button and speaking clearly.");
      }
      setStatus('Timeout occurred');
    });
  };

  const handlePressIn = async () => {
    // Disable cancellation during text generation
    if (isProcessing || isTyping) {
      console.log('Cannot interact during text generation');
      return;
    }

    if (isPlaying) {
      // Cancel audio only (text preserved)
      await sdkRef.current.cancelAudio();
      return;
    }

    // Start recording with context
    await sdkRef.current.startRecordingWithContext(
      'Help me with my question'
    );
  };

  const handlePressOut = async () => {
    if (isRecording) {
      await sdkRef.current.stopRecordingWithContext();
    }
  };

  const replayAudio = async () => {
    await sdkRef.current.playAudio();
  };

  const cleanup = () => {
    if (sdkRef.current) {
      sdkRef.current.disconnect();
    }
  };

  const getButtonText = () => {
    if (isProcessing || isTyping) return "Generating...";
    if (isPlaying) return "Cancel Audio";
    if (isRecording) return "Release to Send";
    return "Hold to Talk";
  };

  const isButtonDisabled = isProcessing || isTyping;

  return (
    <div>
      <div>Status: {status}</div>
      
      {userMessage && (
        <div>You: {userMessage}</div>
      )}
      
      {aiResponse && (
        <div>
          AI: {aiResponse}
          {!isTyping && (
            <button onClick={replayAudio}>🔊 Replay</button>
          )}
        </div>
      )}
      
      <button
        onMouseDown={handlePressIn}
        onMouseUp={handlePressOut}
        onTouchStart={handlePressIn}
        onTouchEnd={handlePressOut}
        disabled={isButtonDisabled}
        style={{
          backgroundColor: isButtonDisabled ? '#ccc' : 
                          isRecording ? '#ff4444' : '#4444ff',
          opacity: isButtonDisabled ? 0.6 : 1
        }}
      >
        {getButtonText()}
      </button>
    </div>
  );
}
```

## Troubleshooting

### Common Issues

**"Couldn't understand" messages appearing frequently**
- Check microphone permissions and device settings
- Ensure users are speaking clearly and holding the button while talking
- Verify network connectivity for audio transmission
- Check for background noise interference

**Audio not playing**
- Ensure audio permissions are granted and device volume is up
- Check that `autoPlayAudio` is not disabled
- Verify network connectivity for audio streaming
- Test manual replay functionality

**Connection issues**
- Check server URL and JWT token configuration
- Verify network connectivity and firewall settings
- Ensure your server is deployed and running
- Monitor connection events for debugging

**Conversation history not working**
- Ensure `setUserContext()` is called before recording
- Check that conversation history is properly formatted
- Verify `autoManageHistory` setting matches your usage
- Monitor session management in debug logs

**Text responses getting cut off**
- **Solution**: Disable cancellation during text generation in your UI
- Use `isProcessing || isTyping` checks before allowing cancellation
- Implement the simplified UI approach shown in the documentation
- Ensure proper event handler setup for processing states

**Authentication errors**
- Verify your JWT token is valid and not expired
- Check that the token was generated with the correct secret
- Ensure the server's JWT_SECRET matches your token generation
- Generate a fresh token using the token generation script

## Migration Guide

### Setting Up Your Server

Before using the SDK, deploy your audio-to-audio server:

1. **Deploy the server** following the [Deployment Guide](../../cloudflare-audio-to-audio-server/DEPLOYMENT.md)
2. **Generate JWT tokens** using the token generation script
3. **Configure the SDK** with your server URL and JWT token

### From Other Voice SDKs

**Update import statement:**
```javascript
// New
import AudioToAudioSDK from './services/AudioToAudioSDK';

// Initialize with server configuration
const sdk = new AudioToAudioSDK({
  wsBaseUrl: 'wss://your-server.workers.dev',
  jwtToken: 'your-jwt-token'
});
```

**Set up user context:**
```javascript
// Set user context for personalized responses
sdk.setUserContext('user123', 'Alice');
```

**Use context-aware recording:**
```javascript
// Context-aware recording for better AI responses
await sdk.startRecordingWithContext('Help me with my question');
await sdk.stopRecordingWithContext();
```

## Architecture Benefits

- **Configurable**: Connect to any compatible audio-to-audio server
- **Production Ready**: Built-in error handling, reconnection, and resource management
- **Conversation Aware**: Automatic conversation tracking with context management
- **Smart Error Handling**: Contextual error messages based on failure type
- **Flexible History Management**: Support for both automatic and manual conversation tracking
- **Real-time Streaming**: Immediate audio and text response streaming
- **Session Isolation**: Client-side session management prevents message mix-ups
- **Smart Cancellation**: Audio-only cancellation preserves text responses
- **Memory Efficient**: Automatic cleanup of temporary files and resources
- **Type Safe**: Full TypeScript support for better development experience

## Support

For issues, questions, or feature requests:

1. Check the [main documentation](../../README.md)
2. Review the [API Documentation](../../API_DOCUMENTATION.md)  
3. Follow the [Deployment Guide](../../cloudflare-audio-to-audio-server/DEPLOYMENT.md)
4. Open an issue on GitHub

---

**Audio-to-Audio SDK** - Empowering seamless voice-based AI applications with real-time streaming and intelligent conversation management. 