/**
 * Audio-to-Audio Real-time Communication SDK
 */
import { Audio } from 'expo-av';

export interface SDKConfig {
  // Required configuration
  wsBaseUrl: string;                // Required: WebSocket server URL
  jwtToken: string;                 // Required: JWT authentication token
  
  // Optional configuration
  useStreaming?: boolean;           // Default: true - Enable real-time audio streaming
  autoManageHistory?: boolean;      // Default: true - Automatically track conversation history
  autoPlayAudio?: boolean;          // Default: true - Auto-play AI responses
  autoPlayAudioChunks?: boolean;    // Default: true - Auto-play streaming audio chunks
  debug?: boolean;                  // Default: false - Enable debug logging
  transcriptionTimeout?: number;    // Default: 10000 - Transcription timeout in milliseconds
  responseTimeout?: number;         // Default: 15000 - General response timeout in milliseconds
  
  audioOptions?: {
    android?: {
      extension: string;
      outputFormat: Audio.AndroidOutputFormat;
      audioEncoder: Audio.AndroidAudioEncoder;
      sampleRate: number;
      numberOfChannels: number;
      bitRate: number;
    };
    ios?: {
      extension: string;
      outputFormat: Audio.IOSOutputFormat;
      audioQuality: Audio.IOSAudioQuality;
      sampleRate: number;
      numberOfChannels: number;
      bitRate: number;
    };
  };
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface AudioMessageOptions {
  userId?: string;
  username?: string;
  history?: ConversationMessage[];
  additionalPrompt?: string;
}

export interface SDKStatus {
  connected: boolean;
  recording: boolean;
  playing: boolean;
  streaming: boolean;
  typing: boolean;
  processing: boolean;
  audioLoading: boolean;
  audioChunks: number;
  currentAudioIndex: number;
  accumulatedResponse: string;
  hasUserContext: boolean;
  historyLength: number;
  userId: string | null;
  username: string | null;
  currentSessionId: string | null;
  sessionCounter: number;
}

export interface EventData {
  // Connection events
  connected: { connected: boolean };
  disconnected: { connected: boolean };
  initialized: { success: boolean };
  welcome: { message: string };

  // Recording events
  recordingStart: { recording: boolean };
  recordingStop: { recording: boolean; uri: string };
  audioSent: { 
    sent: boolean; 
    audioLength: number; 
    hasContext: boolean;
    clientSessionId: string;
  };

  // Processing events
  processingStart: { processing: boolean };
  processingEnd: { processing: boolean };
  transcription: { text: string };

  // Text streaming events
  textChunk: { 
    chunk: string; 
    accumulated: string; 
    isTyping: boolean;
  };
  textComplete: { 
    text: string; 
    isTyping: boolean;
  };

  // Audio streaming events
  audioStart: { 
    streaming?: boolean; 
    playing: boolean;
  };
  audioChunk: { 
    chunkIndex: number; 
    audio?: string;
    text?: string;
  };
  chunkPlaybackStart: { 
    chunkIndex: number; 
    playing: boolean;
  };
  chunkPlaybackEnd: { 
    chunkIndex: number;
  };
  audioStreamEnd: { 
    totalChunks: number;
  };
  audioComplete: { 
    playing: boolean; 
    totalChunks?: number;
    cancelled?: boolean;
  };

  // Manual playback events
  playbackStart: { 
    playing: boolean; 
    isReplay?: boolean;
  };
  playbackEnd: { 
    playing: boolean; 
    isReplay?: boolean;
  };
  playbackCancelled: { 
    cancelled?: boolean;
    error?: string;
    textInterrupted?: boolean;
  };

  // Audio processing events
  audioReceived: {
    audioLength: number;
  };

  // Error events
  error: { 
    type: string; 
    message: string;
  };
  serverError: { 
    message: string; 
    originalMessage: string;
    errorType?: string;
    fullErrorData?: any;
  };
  timeout: { 
    type: 'transcription_timeout' | 'response_timeout' | string;
    duration: number;
    message: string;
  };

  // Other events
  cancelled: { cancelled: boolean };
  unknownMessage: { type: string; data: any };
}

export type EventName = keyof EventData;
export type EventHandler<T extends EventName> = (data: EventData[T]) => void;

declare class AudioToAudioSDK {
  constructor(config: SDKConfig);

  // Event management
  on<T extends EventName>(event: T, handler: EventHandler<T>): void;
  off<T extends EventName>(event: T, handler: EventHandler<T>): void;
  emit<T extends EventName>(event: T, data: EventData[T]): void;

  // Initialization and connection
  initialize(): Promise<boolean>;
  connect(): Promise<void>;
  disconnect(): Promise<boolean>;

  // Audio setup
  setupAudio(): Promise<void>;

  // Basic recording methods
  startRecording(): Promise<boolean>;
  stopRecording(options?: AudioMessageOptions): Promise<boolean>;

  // Context-aware recording methods (recommended)
  startRecordingWithContext(additionalPrompt?: string): Promise<boolean>;
  stopRecordingWithContext(overrideOptions?: AudioMessageOptions): Promise<boolean>;

  // Audio playback methods
  playAudio(base64Audio?: string): Promise<boolean>;
  cancelAudio(): Promise<boolean>;

  // User context management
  setUserContext(userId: string, username: string): void;

  // Conversation history management
  setConversationHistory(history: ConversationMessage[]): void;
  addToHistory(role: 'user' | 'assistant', content: string): void;
  clearHistory(): void;

  // Audio transmission methods
  sendAudioToServer(uri: string, options?: AudioMessageOptions): Promise<void>;
  sendAudioWithContext(uri: string, additionalPrompt?: string): Promise<void>;

  // State management
  resetStates(): void;
  clearStoredAudio(): void;
  getStatus(): SDKStatus;

  // Internal methods (for type completion)
  private handleMessage(data: any): Promise<void>;
  private startChunkPlayback(): Promise<void>;
  private playNextQueuedChunk(): Promise<void>;
  private finishChunkPlayback(): void;
  private handleCancellation(): void;
}

export default AudioToAudioSDK; 