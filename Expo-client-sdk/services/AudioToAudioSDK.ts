import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';

// Type definitions
export interface SDKConfig {
  // Required configuration
  wsBaseUrl: string;
  jwtToken: string;
  
  // Optional configuration
  useStreaming?: boolean;
  autoManageHistory?: boolean;
  autoPlayAudio?: boolean;
  autoPlayAudioChunks?: boolean;
  debug?: boolean;
  transcriptionTimeout?: number;
  responseTimeout?: number;
  
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
  connected: { connected: boolean };
  disconnected: { connected: boolean; code?: number; reason?: string };
  initialized: { success: boolean };
  welcome: { message: string };
  recordingStart: { recording: boolean };
  recordingStop: { recording: boolean; uri: string };
  audioSent: { sent: boolean; audioLength: number; hasContext: boolean; clientSessionId: string };
  processingStart: { processing: boolean };
  processingEnd: { processing: boolean };
  transcription: { text: string };
  textChunk: { chunk: string; accumulated: string; isTyping: boolean };
  textComplete: { text: string; isTyping: boolean };
  audioStart: { streaming?: boolean; playing: boolean };
  audioChunk: { chunkIndex: number; audio?: string; text?: string };
  chunkPlaybackStart: { chunkIndex: number; playing: boolean };
  chunkPlaybackEnd: { chunkIndex: number };
  audioStreamEnd: { totalChunks: number };
  audioComplete: { playing: boolean; totalChunks?: number; cancelled?: boolean };
  playbackStart: { playing: boolean; isReplay?: boolean };
  playbackEnd: { playing: boolean; isReplay?: boolean };
  playbackCancelled: { cancelled?: boolean; error?: string; textInterrupted?: boolean };
  audioReceived: { audioLength: number };
  error: { type: string; message: string };
  serverError: { message: string; originalMessage: string; errorType?: string; fullErrorData?: any };
  timeout: { type: 'transcription_timeout' | 'response_timeout' | string; duration: number; message: string };
  cancelled: { cancelled: boolean };
  unknownMessage: { type: string; data: any };
}

export type EventName = keyof EventData;
export type EventHandler<T extends EventName> = (data: EventData[T]) => void;

interface AudioChunk {
  audio: string;
  chunkIndex: number;
  text?: string;
}

interface WebSocketMessage {
  type: string;
  audio?: string;
  useStreaming?: boolean;
  userId?: string;
  username?: string;
  history?: ConversationMessage[];
  additionalPrompt?: string;
  output?: string;
  message?: string;
  chunkIndex?: number;
  text?: string;
  totalChunks?: number;
  errorType?: string;
}

/**
 * Audio-to-Audio Real-time Communication SDK
 * Handles WebSocket connections, audio streaming, text streaming, and voice processing
 * Generic implementation for voice-based AI applications
 */
class AudioToAudioSDK {
  private config: Required<Omit<SDKConfig, 'audioOptions'>> & { audioOptions: SDKConfig['audioOptions'] };
  
  // WebSocket connection
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  
  // Session management
  private currentSessionId: string | null = null;
  private sessionCounter: number = 0;
  
  // Audio management
  private soundRef: Audio.Sound;
  private recordingRef: Audio.Recording | null = null;
  private isPlaying: boolean = false;
  private isRecording: boolean = false;
  
  // Audio chunk streaming
  private audioChunkQueue: AudioChunk[] = [];
  private isPlayingChunks: boolean = false;
  private currentChunkIndex: number = 0;
  private chunkPlaybackCancelled: boolean = false;
  private userCancelledPlayback: boolean = false;
  private audioStreamComplete: boolean = false;
  
  // Audio storage
  private storedAudioForReplay: string | null = null;
  private replayAudioFilePath: string;
  
  // Text streaming
  private accumulatedResponse: string = '';
  private isTyping: boolean = false;
  private isProcessing: boolean = false;
  
  // Conversation context
  private userId: string | null = null;
  private username: string | null = null;
  private conversationHistory: ConversationMessage[] = [];
  private pendingAdditionalPrompt: string | null = null;
  
  // Event handlers
  private eventHandlers: { [K in EventName]?: EventHandler<K>[] } = {};
  
  // Timeouts
  private responseTimeout: NodeJS.Timeout | null = null;
  private transcriptionTimeout: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  
  // File paths
  private audioFilePath: string;

  constructor(config: SDKConfig) {
    // Validate required configuration
    if (!config.wsBaseUrl) {
      throw new Error('wsBaseUrl is required');
    }
    if (!config.jwtToken) {
      throw new Error('jwtToken is required');
    }

    // Configuration with default values
    this.config = {
      wsBaseUrl: config.wsBaseUrl,
      jwtToken: config.jwtToken,
      useStreaming: config.useStreaming !== false,
      autoManageHistory: config.autoManageHistory !== false,
      autoPlayAudio: config.autoPlayAudio !== false,
      autoPlayAudioChunks: config.autoPlayAudioChunks !== false,
      debug: config.debug || false,
      transcriptionTimeout: config.transcriptionTimeout || 10000,
      responseTimeout: config.responseTimeout || 15000,
      audioOptions: config.audioOptions || {
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
        },
      }
    };

    // Initialize audio and file paths
    this.soundRef = new Audio.Sound();
    this.replayAudioFilePath = `${FileSystem.documentDirectory}replay_audio.mp3`;
    this.audioFilePath = `${FileSystem.documentDirectory}tts.mp3`;
  }

  /**
   * Event handler registration
   */
  on<T extends EventName>(event: T, handler: EventHandler<T>): void {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    (this.eventHandlers[event] as EventHandler<T>[]).push(handler);
  }

  off<T extends EventName>(event: T, handler: EventHandler<T>): void {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event] = (this.eventHandlers[event] as EventHandler<T>[]).filter(h => h !== handler);
    }
  }

  emit<T extends EventName>(event: T, data: EventData[T]): void {
    if (this.eventHandlers[event]) {
      (this.eventHandlers[event] as EventHandler<T>[]).forEach(handler => {
        try {
          handler(data);
        } catch (error: any) {
          console.error(`[SDK] Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Initialize the SDK and connect to WebSocket
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('[SDK] Initializing Audio-to-Audio SDK...');
      
      await this.setupAudio();
      await this.connect();
      
      this.emit('initialized', { success: true });
      console.log('[SDK] SDK initialized successfully');
      return true;
    } catch (error: any) {
      console.error('[SDK] Initialization failed:', error);
      this.emit('error', { type: 'initialization', message: error.message });
      return false;
    }
  }

  /**
   * Setup audio permissions and configuration
   */
  async setupAudio(): Promise<void> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Microphone permission required');
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,                    // ✨ NEW
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,    // ✨ NEW
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,  // ✨ NEW
      });

      console.log('[SDK] Audio setup completed');
    } catch (error: any) {
      throw new Error(`Audio setup failed: ${error.message}`);
    }
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    try {
      console.log('[SDK] Connecting to Audio-to-Audio server...');
      
      const wsUrl = `${this.config.wsBaseUrl}/ws?token=${this.config.jwtToken}`;
      
      return new Promise((resolve, reject) => {
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
          console.log('[SDK] WebSocket connected to Audio-to-Audio server');
          this.isConnected = true;
          this.emit('connected', { connected: true });
          
          if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
          }
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error: any) {
            console.error('[SDK] Message parsing error:', error);
            this.emit('error', { type: 'message_parse', message: error.message });
          }
        };

        this.ws.onerror = (error) => {
          console.error('[SDK] WebSocket error:', error);
          this.emit('error', { type: 'websocket', message: 'Connection error occurred' });
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('[SDK] WebSocket closed:', event.code, event.reason);
          this.isConnected = false;
          this.emit('disconnected', { connected: false, code: event.code, reason: event.reason });
          
          if (event.code === 1006) {
            this.reconnectTimeout = setTimeout(() => {
              console.log('[SDK] Attempting to reconnect...');
              this.connect().catch(err => {
                console.error('[SDK] Reconnection failed:', err);
              });
            }, 3000);
          }
        };
      });
    } catch (error: any) {
      console.error('[SDK] Connection failed:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private async handleMessage(data: WebSocketMessage): Promise<void> {
    try {
      if (this.config.debug) {
        console.log('[SDK DEBUG] Message received:', data);
      }

      // Session filtering logic
      const audioOnlyMessageTypes = ['audio_response', 'audio_chunk', 'audio_stream_end'];
      const isAudioMessage = audioOnlyMessageTypes.includes(data.type);
      
      if (!this.currentSessionId && isAudioMessage) {
        console.log('[SDK] 🚫 Ignoring audio message - no active session:', data.type);
        return;
      }

      // Clear timeouts
      if (this.responseTimeout) {
        clearTimeout(this.responseTimeout);
        this.responseTimeout = null;
      }

      switch (data.type) {
        case 'welcome':
          console.log('[SDK] Welcome message received');
          this.emit('welcome', { message: data.message || 'Welcome' });
          break;

        case 'caption':
          console.log('[SDK] Transcription received');
          
          if (this.transcriptionTimeout) {
            clearTimeout(this.transcriptionTimeout);
            this.transcriptionTimeout = null;
          }
          
          let transcription: string;
          try {
            transcription = typeof data.output === 'string' ? 
              (data.output.startsWith('{') || data.output.startsWith('[') ? JSON.parse(data.output) : data.output) : 
              data.output || '';
          } catch (parseError) {
            transcription = data.output || '';
          }
          
          if (this.config.autoManageHistory && transcription) {
            this.addToHistory('user', transcription);
          }
          this.emit('transcription', { text: transcription });
          break;

        case 'groq_response_chunk':
          console.log('[SDK] AI response chunk received');
          this.isTyping = true;
          this.isProcessing = false;
          this.accumulatedResponse += data.output || '';
          this.emit('textChunk', { 
            chunk: data.output || '', 
            accumulated: this.accumulatedResponse,
            isTyping: true 
          });
          break;

        case 'groq_response_end':
          console.log('[SDK] AI response complete');
          this.isTyping = false;
          this.isProcessing = false;
          if (this.config.autoManageHistory && this.accumulatedResponse) {
            this.addToHistory('assistant', this.accumulatedResponse);
          }
          this.emit('textComplete', { 
            text: this.accumulatedResponse,
            isTyping: false 
          });
          this.accumulatedResponse = '';
          break;

        case 'processing_end':
          console.log('[SDK] Processing completed');
          this.isProcessing = false;
          this.emit('processingEnd', { processing: false });
          break;

        case 'audio_response':
          await this.handleAudioResponse(data.audio);
          break;

        case 'audio_chunk':
          await this.handleAudioChunk(data);
          break;

        case 'audio_stream_end':
          await this.handleAudioStreamEnd(data.totalChunks || 0);
          break;

        case 'error':
          this.handleServerError(data);
          break;

        case 'cancelled':
          console.log('[SDK] Processing cancelled');
          this.handleCancellation();
          break;

        default:
          console.warn('[SDK] Unknown message type:', data.type);
          this.emit('unknownMessage', { type: data.type, data });
          break;
      }
    } catch (error: any) {
      console.error('[SDK] Error handling message:', error);
      this.emit('error', { type: 'message_handle', message: error.message });
    }
  }

  private async handleAudioResponse(audio?: string): Promise<void> {
    if (!audio) return;

    try {
      this.storedAudioForReplay = audio;
      
      await FileSystem.writeAsStringAsync(this.audioFilePath, audio, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      await FileSystem.writeAsStringAsync(this.replayAudioFilePath, audio, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      this.emit('audioReceived', { audioLength: audio.length });
      
      if (this.config.autoPlayAudio) {
        await this.playAudio();
      }
    } catch (error: any) {
      console.error('[SDK] Error handling audio response:', error);
      this.emit('error', { type: 'audio_response', message: error.message });
    }
  }

  private async handleAudioChunk(data: WebSocketMessage): Promise<void> {
    if (!data.audio) return;

    // Store for replay
    if (!this.storedAudioForReplay) {
      this.storedAudioForReplay = data.audio;
    } else {
      this.storedAudioForReplay += data.audio;
    }

    // Add to playback queue if not cancelled
    if (!this.userCancelledPlayback) {
      this.audioChunkQueue.push({
        audio: data.audio,
        chunkIndex: data.chunkIndex || 0,
        text: data.text
      });
    }

    this.emit('audioChunk', { 
      chunkIndex: data.chunkIndex || 0,
      audio: data.audio,
      text: data.text
    });

    // Start playback if needed
    if (this.config.autoPlayAudioChunks && !this.isPlayingChunks && !this.userCancelledPlayback) {
      await this.startChunkPlayback();
    }
  }

  private async handleAudioStreamEnd(totalChunks: number): Promise<void> {
    if (this.storedAudioForReplay) {
      try {
        await FileSystem.writeAsStringAsync(this.replayAudioFilePath, this.storedAudioForReplay, {
          encoding: FileSystem.EncodingType.Base64
        });
      } catch (error: any) {
        console.error('[SDK] Error saving concatenated audio:', error);
      }
    }
    
    this.emit('audioStreamEnd', { totalChunks });
    this.audioStreamComplete = true;
  }

  private handleServerError(data: WebSocketMessage): void {
    console.error('[SDK] Server error received:', data.message);
    
    let errorMessage = data.message || 'Unknown server error';
    if (errorMessage.toLowerCase().includes('rate limit') || 
        errorMessage.toLowerCase().includes('429') ||
        errorMessage.toLowerCase().includes('heavy load')) {
      errorMessage = "The server is experiencing heavy load right now. Please try again in a few minutes. Thank you for your patience! 🙏";
    }
    
    this.isProcessing = false;
    this.emit('serverError', { 
      message: errorMessage, 
      originalMessage: data.message || '',
      errorType: data.errorType || 'general_error',
      fullErrorData: data
    });
  }

  /**
   * Start audio recording
   */
  async startRecording(): Promise<boolean> {
    try {
      console.log('[SDK] Starting recording...');
      
      if (!this.isConnected) {
        throw new Error('Not connected to server');
      }

      if (this.recordingRef) {
        try {
          await this.recordingRef.stopAndUnloadAsync();
        } catch (cleanupError) {
          console.log('[SDK] Cleanup warning:', cleanupError);
        }
        this.recordingRef = null;
      }

      this.resetStates();
      this.invalidateCurrentSession();
      this.generateSessionId();

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(this.config.audioOptions);
      await recording.startAsync();
      this.recordingRef = recording;
      this.isRecording = true;

      this.emit('recordingStart', { recording: true });
      console.log('[SDK] Recording started successfully');
      return true;
    } catch (error: any) {
      console.error('[SDK] Recording error:', error);
      if (this.recordingRef) {
        try {
          await this.recordingRef.stopAndUnloadAsync();
        } catch (cleanupError) {
          console.log('[SDK] Error cleanup failed:', cleanupError);
        }
        this.recordingRef = null;
      }
      this.isRecording = false;
      this.emit('error', { type: 'recording_start', message: error.message });
      throw error;
    }
  }

  /**
   * Stop recording and send to server
   */
  async stopRecording(options: AudioMessageOptions = {}): Promise<boolean> {
    try {
      if (!this.isRecording || !this.recordingRef) {
        console.warn('[SDK] Stop recording called but not recording');
        return false;
      }

      console.log('[SDK] Stopping recording...');
      this.isRecording = false;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      await this.recordingRef.stopAndUnloadAsync();
      const uri = this.recordingRef.getURI();
      
      if (!uri) {
        throw new Error('Failed to get recording URI');
      }

      this.emit('recordingStop', { recording: false, uri });

      if (this.isConnected) {
        await this.sendAudioToServer(uri, options);
      } else {
        throw new Error('Cannot send audio - not connected');
      }

      this.recordingRef = null;
      return true;
    } catch (error: any) {
      console.error('[SDK] Stop recording error:', error);
      this.emit('error', { type: 'recording_stop', message: error.message });
      throw error;
    }
  }

  /**
   * Send audio to server
   */
  async sendAudioToServer(uri: string, options: AudioMessageOptions = {}): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('Audio file does not exist');
      }
      
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
      });

      if (!base64Audio || base64Audio.length < 100) {
        throw new Error('Audio file is too small or empty');
      }

      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket not connected');
      }

      if (!this.currentSessionId) {
        this.generateSessionId();
      }

      const message: any = {
        type: 'audio',
        audio: base64Audio,
        useStreaming: this.config.useStreaming
      };

      // Add optional parameters with validation
      if (options.userId && typeof options.userId === 'string') {
        message.userId = options.userId;
      }
      
      if (options.username && typeof options.username === 'string') {
        message.username = options.username;
      }
      
      if (options.history && Array.isArray(options.history)) {
        const cleanHistory = options.history.filter(msg => 
          msg && 
          typeof msg === 'object' &&
          msg.role && 
          msg.content &&
          (msg.role === 'user' || msg.role === 'assistant') &&
          typeof msg.content === 'string'
        );
        
        if (cleanHistory.length > 0) {
          message.history = cleanHistory;
        }
      }
      
      if (options.additionalPrompt && typeof options.additionalPrompt === 'string') {
        message.additionalPrompt = options.additionalPrompt;
      }

      this.ws.send(JSON.stringify(message));
      
      this.emit('audioSent', { 
        sent: true, 
        audioLength: base64Audio.length,
        hasContext: !!(message.history || message.additionalPrompt),
        clientSessionId: this.currentSessionId!
      });
      
      // Set timeouts
      this.transcriptionTimeout = setTimeout(() => {
        if (this.transcriptionTimeout) {
          clearTimeout(this.transcriptionTimeout);
          this.transcriptionTimeout = null;
        }
        
        this.emit('timeout', { 
          type: 'transcription_timeout', 
          duration: this.config.transcriptionTimeout,
          message: 'No transcription received within timeout period'
        });
      }, this.config.transcriptionTimeout);
      
      this.responseTimeout = setTimeout(() => {
        this.isProcessing = false;
        this.isPlaying = false;
        
        this.cancelAudio().catch(err => console.log('[SDK] Error cancelling audio after timeout:', err));
        
        if (this.responseTimeout) {
          clearTimeout(this.responseTimeout);
          this.responseTimeout = null;
        }
        
        this.emit('timeout', { 
          type: 'response_timeout', 
          duration: this.config.responseTimeout,
          message: 'No response received from server within timeout period'
        });
      }, this.config.responseTimeout);

    } catch (error: any) {
      console.error('[SDK] Error sending audio:', error);
      this.emit('error', { type: 'audio_send', message: error.message });
      throw error;
    }
  }

  /**
   * Play audio for replay
   */
  async playAudio(base64Audio?: string): Promise<boolean> {
    try {
      this.userCancelledPlayback = false;
      
      let fileUri: string;

      if (base64Audio) {
        fileUri = `${FileSystem.documentDirectory}temp_replay_${Date.now()}.mp3`;
        await FileSystem.writeAsStringAsync(fileUri, base64Audio, { 
          encoding: FileSystem.EncodingType.Base64 
        });
      } else {
        if (this.storedAudioForReplay) {
          fileUri = this.replayAudioFilePath;
          await FileSystem.writeAsStringAsync(fileUri, this.storedAudioForReplay, {
            encoding: FileSystem.EncodingType.Base64
          });
        } else {
          fileUri = this.audioFilePath;
          const fileInfo = await FileSystem.getInfoAsync(fileUri);
          if (!fileInfo.exists) {
            throw new Error('No audio available for replay');
          }
        }
      }

      await this.soundRef.unloadAsync().catch(() => {});
      await this.soundRef.loadAsync({ uri: fileUri });
      this.isPlaying = true;
      
      this.emit('playbackStart', { playing: true, isReplay: true });
      await this.soundRef.playAsync();

      this.soundRef.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          this.isPlaying = false;
          this.emit('playbackEnd', { playing: false, isReplay: true });
          
          if (base64Audio && fileUri.includes('temp_replay_')) {
            FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
          }
        }
        if (status.error) {
          this.isPlaying = false;
          this.emit('error', { type: 'playback', message: status.error });
        }
      });
      
      return true;
    } catch (error: any) {
      console.error('[SDK] Error playing audio:', error);
      this.emit('error', { type: 'audio_play', message: error.message });
      throw error;
    }
  }

  /**
   * Start chunk playback
   */
  private async startChunkPlayback(): Promise<void> {
    if (this.isPlayingChunks) {
      return;
    }
    
    this.isPlayingChunks = true;
    this.currentChunkIndex = 0;
    this.audioStreamComplete = false;
    this.chunkPlaybackCancelled = false;
    
    this.isPlaying = true;
    this.emit('audioStart', { streaming: true, playing: true });
    
    await this.playNextQueuedChunk();
  }

  /**
   * Play next chunk in queue
   */
  private async playNextQueuedChunk(): Promise<void> {
    try {
      while (this.currentChunkIndex < this.audioChunkQueue.length && this.isPlayingChunks && !this.chunkPlaybackCancelled) {
        
        if (!this.isPlayingChunks || this.chunkPlaybackCancelled) {
          this.finishChunkPlayback();
          return;
        }
        
        const chunk = this.audioChunkQueue[this.currentChunkIndex];
        const chunkPath = `${FileSystem.documentDirectory}chunk_${chunk.chunkIndex}_${Date.now()}.mp3`;
        
        await FileSystem.writeAsStringAsync(chunkPath, chunk.audio, {
          encoding: FileSystem.EncodingType.Base64
        });

        try {
          await this.soundRef.stopAsync();
          await this.soundRef.unloadAsync();
        } catch (e) {
          // Ignore cleanup errors
        }

        await this.soundRef.loadAsync({ uri: chunkPath });
        
        this.emit('chunkPlaybackStart', { 
          chunkIndex: chunk.chunkIndex,
          playing: true 
        });
        
        await new Promise<void>(async (resolve, reject) => {
          let isResolved = false;
          let checkCancellationInterval: NodeJS.Timeout;
          
          const resolveOnce = (reason = 'finished') => {
            if (!isResolved) {
              isResolved = true;
              if (checkCancellationInterval) {
                clearInterval(checkCancellationInterval);
              }
              resolve();
            }
          };
          
          this.soundRef.setOnPlaybackStatusUpdate(async (status) => {
            if (status.didJustFinish && !isResolved) {
              this.emit('chunkPlaybackEnd', { chunkIndex: chunk.chunkIndex });
              FileSystem.deleteAsync(chunkPath, { idempotent: true }).catch(() => {});
              resolveOnce('natural_finish');
            }
            if (status.error && !isResolved) {
              this.emit('error', { type: 'chunk_playback', message: status.error });
              reject(new Error(status.error));
            }
          });
          
          if (!this.isPlayingChunks || this.chunkPlaybackCancelled) {
            FileSystem.deleteAsync(chunkPath, { idempotent: true }).catch(() => {});
            resolveOnce('cancelled_before_start');
            return;
          }
          
          checkCancellationInterval = setInterval(() => {
            if (!this.isPlayingChunks || this.chunkPlaybackCancelled) {
              this.soundRef.stopAsync().catch(() => {});
              FileSystem.deleteAsync(chunkPath, { idempotent: true }).catch(() => {});
              this.emit('chunkPlaybackEnd', { chunkIndex: chunk.chunkIndex });
              resolveOnce('cancelled_during_playback');
            }
          }, 10);
          
          try {
            await this.soundRef.playAsync();
            
            if (!this.isPlayingChunks || this.chunkPlaybackCancelled) {
              this.soundRef.stopAsync().catch(() => {});
              FileSystem.deleteAsync(chunkPath, { idempotent: true }).catch(() => {});
              resolveOnce('cancelled_after_start');
            }
          } catch (error) {
            if (!isResolved) {
              reject(error);
            }
          }
        });
        
        this.currentChunkIndex++;
        
        if (!this.isPlayingChunks || this.chunkPlaybackCancelled) {
          this.finishChunkPlayback();
          return;
        }
      }
      
      if (!this.isPlayingChunks || this.chunkPlaybackCancelled) {
        this.finishChunkPlayback();
        return;
      }
      
      if (!this.audioStreamComplete && this.currentChunkIndex >= this.audioChunkQueue.length && this.isPlayingChunks && !this.chunkPlaybackCancelled) {
        setTimeout(() => {
          if (this.isPlayingChunks && !this.chunkPlaybackCancelled) {
            this.playNextQueuedChunk();
          } else {
            this.finishChunkPlayback();
          }
        }, 50);
      } else {
        this.finishChunkPlayback();
      }
      
    } catch (error: any) {
      console.error('[SDK] Error in chunk playback:', error);
      this.emit('error', { type: 'chunk_playback_sequence', message: error.message });
      this.finishChunkPlayback();
    }
  }

  /**
   * Finish chunk playback
   */
  private finishChunkPlayback(): void {
    const totalChunks = this.audioChunkQueue.length;
    const wasCancelled = this.chunkPlaybackCancelled;
    
    this.isPlayingChunks = false;
    this.isPlaying = false;
    this.currentChunkIndex = 0;
    this.audioChunkQueue = [];
    this.audioStreamComplete = false;
    this.chunkPlaybackCancelled = false;
    
    this.emit('audioComplete', { 
      playing: false, 
      cancelled: wasCancelled,
      totalChunks: totalChunks 
    });
  }

  /**
   * Cancel audio playback only
   */
  async cancelAudio(): Promise<boolean> {
    try {
      this.isPlaying = false;
      this.isPlayingChunks = false;
      this.chunkPlaybackCancelled = true;
      this.userCancelledPlayback = true;
      
      if (this.soundRef) {
        try {
          this.soundRef.stopAsync().catch(() => {});
          this.soundRef.unloadAsync().catch(() => {});
        } catch (error) {
          console.log('[SDK] Sound already stopped:', error);
        }
      }
      
      if (this.audioChunkQueue.length > 0) {
        this.emit('audioComplete', { 
          playing: false, 
          cancelled: true,
          totalChunks: this.audioChunkQueue.length 
        });
        
        // Backup events for UI reset
        setTimeout(() => {
          this.emit('audioComplete', { 
            playing: false, 
            cancelled: true,
            totalChunks: this.audioChunkQueue.length 
          });
        }, 50);
      }
      
      this.emit('playbackCancelled', { playing: false, cancelled: true });
      
      setTimeout(() => {
        this.emit('playbackEnd', { playing: false, cancelled: true });
      }, 10);
      
      return true;
    } catch (error: any) {
      console.error('[SDK] Error during audio cancellation:', error);
      this.isPlaying = false;
      this.isPlayingChunks = false;
      this.chunkPlaybackCancelled = true;
      this.emit('playbackCancelled', { playing: false, cancelled: true, error: error.message });
      return false;
    }
  }

  /**
   * Handle server cancellation
   */
  private handleCancellation(): void {
    this.isProcessing = false;
    this.cancelAudio();
    this.emit('cancelled', { cancelled: true });
  }

  /**
   * Clear stored audio
   */
  clearStoredAudio(): void {
    this.storedAudioForReplay = null;
    FileSystem.deleteAsync(this.replayAudioFilePath, { idempotent: true }).catch(() => {});
  }

  /**
   * Reset states
   */
  resetStates(): void {
    this.accumulatedResponse = '';
    this.isPlaying = false;
    this.isTyping = false;
    this.isProcessing = false;
    
    this.audioChunkQueue = [];
    this.isPlayingChunks = false;
    this.currentChunkIndex = 0;
    this.audioStreamComplete = false;
    this.chunkPlaybackCancelled = false;
    this.userCancelledPlayback = false;
    
    this.clearStoredAudio();
    this.currentSessionId = null;
    
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
    }
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<boolean> {
    try {
      // Clear timeouts
      if (this.responseTimeout) {
        clearTimeout(this.responseTimeout);
        this.responseTimeout = null;
      }
      if (this.transcriptionTimeout) {
        clearTimeout(this.transcriptionTimeout);
        this.transcriptionTimeout = null;
      }
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      
      // Stop recording
      if (this.recordingRef) {
        await this.recordingRef.stopAndUnloadAsync().catch(() => {});
        this.recordingRef = null;
      }

      // Cancel audio
      await this.cancelAudio();
      
      // Close WebSocket
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      
      this.isConnected = false;
      this.resetStates();
      
      this.emit('disconnected', { connected: false });
      return true;
    } catch (error: any) {
      console.error('[SDK] Error during disconnect:', error);
      return false;
    }
  }

  /**
   * Set user context
   */
  setUserContext(userId: string, username: string): void {
    this.userId = userId;
    this.username = username;
  }

  /**
   * Set conversation history
   */
  setConversationHistory(history: ConversationMessage[]): void {
    this.conversationHistory = history;
  }

  /**
   * Add message to history
   */
  addToHistory(role: 'user' | 'assistant', content: string): void {
    if (!this.conversationHistory) {
      this.conversationHistory = [];
    }
    
    const newMessage: ConversationMessage = { 
      role, 
      content, 
      timestamp: new Date().toISOString() 
    };
    
    this.conversationHistory.push(newMessage);
    
    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(-10);
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Session management
   */
  private invalidateCurrentSession(): void {
    const oldSessionId = this.currentSessionId;
    this.currentSessionId = null;
    console.log('[SDK] Invalidated session:', oldSessionId);
  }

  private generateSessionId(): string {
    this.sessionCounter++;
    this.currentSessionId = `client_session_${Date.now()}_${this.sessionCounter}`;
    console.log('[SDK] Generated session ID:', this.currentSessionId);
    return this.currentSessionId;
  }

  /**
   * Context-aware recording methods
   */
  async startRecordingWithContext(additionalPrompt?: string): Promise<boolean> {
    this.invalidateCurrentSession();
    this.generateSessionId();
    this.clearStoredAudio();
    this.userCancelledPlayback = false;
    this.pendingAdditionalPrompt = additionalPrompt || null;
    return this.startRecording();
  }

  async stopRecordingWithContext(overrideOptions: AudioMessageOptions = {}): Promise<boolean> {
    const options: AudioMessageOptions = {
      userId: this.userId || undefined,
      username: this.username || undefined,
      history: this.conversationHistory,
      additionalPrompt: this.pendingAdditionalPrompt || undefined,
      ...overrideOptions
    };

    this.pendingAdditionalPrompt = null;
    return this.stopRecording(options);
  }

  async sendAudioWithContext(uri: string, additionalPrompt?: string): Promise<void> {
    const options: AudioMessageOptions = {
      userId: this.userId || undefined,
      username: this.username || undefined,
      history: this.conversationHistory,
      additionalPrompt: additionalPrompt
    };

    return this.sendAudioToServer(uri, options);
  }

  /**
   * Get SDK status
   */
  getStatus(): SDKStatus {
    return {
      connected: this.isConnected,
      recording: this.isRecording,
      playing: this.isPlaying,
      streaming: this.isPlayingChunks,
      typing: this.isTyping,
      processing: this.isProcessing,
      audioLoading: false,
      audioChunks: this.audioChunkQueue.length,
      currentAudioIndex: this.currentChunkIndex,
      accumulatedResponse: this.accumulatedResponse,
      hasUserContext: !!(this.userId && this.username),
      historyLength: this.conversationHistory?.length || 0,
      userId: this.userId,
      username: this.username,
      currentSessionId: this.currentSessionId,
      sessionCounter: this.sessionCounter
    };
  }
}

export default AudioToAudioSDK; 