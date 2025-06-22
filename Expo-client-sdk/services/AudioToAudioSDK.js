import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';

/**
 * Audio-to-Audio Real-time Communication SDK
 * Handles WebSocket connections, audio streaming, text streaming, and voice processing
 * Generic implementation for voice-based AI applications
 */
class AudioToAudioSDK {
  constructor(config = {}) {
    // Configuration with default values - SDK handles server details internally
    this.config = {
      // Server configuration - clients need to provide these
      wsBaseUrl: config.wsBaseUrl || 'wss://your-audio-to-audio-server.workers.dev',
      jwtToken: config.jwtToken || Constants.expoConfig?.extra?.JWT_TOKEN || 'your-jwt-token-here',
      
      // Public configuration options that clients can override
      useStreaming: config.useStreaming !== false, // Default to true
      autoManageHistory: config.autoManageHistory !== false, // Default to true
      autoPlayAudio: config.autoPlayAudio !== false, // Default to true
      autoPlayAudioChunks: config.autoPlayAudioChunks !== false, // Auto-play streaming chunks
      debug: config.debug || false,
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
        },
      },
      
      // Merge any other audio options provided
      ...(config.audioOptions && { 
        audioOptions: {
          ...this.config?.audioOptions,
          ...config.audioOptions
        }
      })
    };

    // Validate required configuration
    if (!this.config.wsBaseUrl || this.config.wsBaseUrl === 'wss://your-audio-to-audio-server.workers.dev') {
      console.warn('[SDK] Warning: Default server URL detected. Please configure your server URL.');
    }

    if (!this.config.jwtToken || this.config.jwtToken === 'your-jwt-token-here') {
      console.warn('[SDK] Warning: Default JWT token detected. Please configure your JWT token.');
    }

    // WebSocket connection
    this.ws = null;
    this.isConnected = false;
    
    // Session management for request isolation
    this.currentSessionId = null;
    this.sessionCounter = 0;
    
    // Audio management
    this.soundRef = new Audio.Sound();
    this.recordingRef = null;
    this.isPlaying = false;
    this.isRecording = false;
    
    // Audio chunk streaming
    this.audioChunkQueue = [];
    this.isPlayingChunks = false;
    this.currentChunkIndex = 0;
    this.chunkPlaybackCancelled = false;
    this.userCancelledPlayback = false; // Track if user manually cancelled
    
    // Audio storage for replay
    this.storedAudioForReplay = null;
    this.replayAudioFilePath = `${FileSystem.documentDirectory}replay_audio.mp3`;
    
    // Text streaming
    this.accumulatedResponse = '';
    this.isTyping = false;
    this.isProcessing = false;
    
    // Conversation context
    this.userId = null;
    this.username = null;
    this.conversationHistory = [];
    this.pendingAdditionalPrompt = null;
    
    // Event handlers
    this.eventHandlers = {};
    
    // Timeouts and intervals
    this.responseTimeout = null;
    this.transcriptionTimeout = null;
    this.reconnectTimeout = null;
    
    // File paths
    this.audioFilePath = `${FileSystem.documentDirectory}tts.mp3`;
  }

  /**
   * Event handler registration
   */
  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  off(event, handler) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event] = this.eventHandlers[event].filter(h => h !== handler);
    }
  }

  emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[SDK] Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Initialize the SDK and connect to WebSocket
   */
  async initialize() {
    try {
      console.log('[SDK] Initializing Audio-to-Audio SDK...');
      
      // Setup audio permissions and mode
      await this.setupAudio();
      
      // Connect to WebSocket
      await this.connect();
      
      this.emit('initialized', { success: true });
      console.log('[SDK] SDK initialized successfully');
      return true;
    } catch (error) {
      console.error('[SDK] Initialization failed:', error);
      this.emit('error', { type: 'initialization', message: error.message });
      return false;
    }
  }

  /**
   * Setup audio permissions and configuration
   */
  async setupAudio() {
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
      });

      console.log('[SDK] Audio setup completed');
    } catch (error) {
      throw new Error(`Audio setup failed: ${error.message}`);
    }
  }

  /**
   * Connect to WebSocket server
   */
  async connect() {
    try {
      console.log('[SDK] Connecting to Audio-to-Audio server...');
      
      // Check if we have a valid JWT token
      if (!this.config.jwtToken || this.config.jwtToken === 'your-jwt-token-here') {
        // For development, we'll try to connect anyway - the server should handle authentication
        console.warn('[SDK] JWT token not configured, using default connection');
      }

      const wsUrl = `${this.config.wsBaseUrl}/ws?token=${this.config.jwtToken}`;
      
      return new Promise((resolve, reject) => {
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
          console.log('[SDK] WebSocket connected to Audio-to-Audio server');
          this.isConnected = true;
          this.emit('connected', { connected: true });
          
          // Clear any existing reconnect timeout
          if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
          }
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
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
          this.emit('disconnected', { code: event.code, reason: event.reason });
          
          if (event.code === 1006) {
            // Auto-reconnect after 3 seconds
            this.reconnectTimeout = setTimeout(() => {
              console.log('[SDK] Attempting to reconnect...');
              this.connect().catch(err => {
                console.error('[SDK] Reconnection failed:', err);
              });
            }, 3000);
          }
        };
      });
    } catch (error) {
      console.error('[SDK] Connection failed:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  async handleMessage(data) {
    try {
      if (this.config.debug) {
        console.log('[SDK DEBUG] Message received:', data);
      }

      // Client-side session filtering - ignore audio messages if no active session
      // But allow text responses to continue even after audio cancellation
      const audioOnlyMessageTypes = ['audio_response', 'audio_chunk', 'audio_stream_end'];
      const isAudioMessage = audioOnlyMessageTypes.includes(data.type);
      
      if (!this.currentSessionId && isAudioMessage) {
        console.log('[SDK] 🚫 Ignoring audio message - no active session:', {
          messageType: data.type,
          hasActiveSession: false
        });
        return; // Ignore audio messages only
      }
      
      if (!this.currentSessionId && !isAudioMessage) {
        console.log('[SDK] 📝 Allowing text message despite no active session:', {
          messageType: data.type,
          reason: 'text_response_continuation'
        });
        // Allow text messages to continue
      }

      // Clear response timeout since we received a message
      if (this.responseTimeout) {
        clearTimeout(this.responseTimeout);
        this.responseTimeout = null;
      }

      switch (data.type) {
        case 'welcome':
          console.log('[SDK] Welcome message received');
          this.emit('welcome', { message: data.message });
          break;

        case 'caption':
          console.log('[SDK] Transcription received, raw output:', data.output);
          
          // Clear transcription timeout since we received transcription
          if (this.transcriptionTimeout) {
            clearTimeout(this.transcriptionTimeout);
            this.transcriptionTimeout = null;
          }
          
          let transcription;
          try {
            // Try to parse as JSON first, fallback to direct string
            transcription = typeof data.output === 'string' ? 
              (data.output.startsWith('{') || data.output.startsWith('[') ? JSON.parse(data.output) : data.output) : 
              data.output;
          } catch (parseError) {
            console.log('[SDK] JSON parse failed, using raw output:', parseError.message);
            transcription = data.output;
          }
          console.log('[SDK] Processed transcription:', transcription);
          
          // Automatically add user message to history if auto-history is enabled
          if (this.config.autoManageHistory !== false && transcription) {
            this.addToHistory('user', transcription);
            console.log('[SDK] Added user message to auto-history:', transcription);
          }
          this.emit('transcription', { text: transcription });
          break;

        case 'groq_response_chunk':
          console.log('[SDK] AI response chunk received');
          this.isTyping = true;
          this.isProcessing = false;
          this.accumulatedResponse += data.output;  // Note: 'output' not 'text'
          this.emit('textChunk', { 
            chunk: data.output, 
            accumulated: this.accumulatedResponse,
            isTyping: true 
          });
          break;

        case 'groq_response_end':
          console.log('[SDK] AI response complete');
          this.isTyping = false;
          this.isProcessing = false;
          // Automatically add assistant response to history if auto-history is enabled
          if (this.config.autoManageHistory !== false && this.accumulatedResponse) {
            this.addToHistory('assistant', this.accumulatedResponse);
          }
          this.emit('textComplete', { 
            text: this.accumulatedResponse,
            isTyping: false 
          });
          // Reset for next conversation
          this.accumulatedResponse = '';
          break;

        case 'processing_end':
          console.log('[SDK] Processing completed');
          this.isProcessing = false;
          this.emit('processingEnd', { processing: false });
          break;

        case 'audio_response':
          console.log('[SDK] Audio response received');
          if (data.audio) {
            try {
              // Store audio for replay functionality
              this.storedAudioForReplay = data.audio;
              
              // Save the complete audio for immediate playback
              await FileSystem.writeAsStringAsync(this.audioFilePath, data.audio, {
                encoding: FileSystem.EncodingType.Base64
              });
              
              // Also save for replay
              await FileSystem.writeAsStringAsync(this.replayAudioFilePath, data.audio, {
                encoding: FileSystem.EncodingType.Base64
              });
              
              console.log('[SDK] Audio saved for playback and replay');
              
              this.emit('audioReceived', { 
                audioLength: data.audio.length 
              });
              
              // Auto-play if enabled
              if (this.config.autoPlayAudio !== false) {
                await this.playAudio();
              }
              
            } catch (error) {
              console.error('[SDK] Error handling audio response:', error);
              this.emit('error', { type: 'audio_response', message: error.message });
            }
          }
          break;

        case 'audio_chunk':
          console.log('[SDK] Audio chunk received for real-time playback');
          if (data.audio) {
            // ALWAYS store audio for replay (even if playback is cancelled)
            if (!this.storedAudioForReplay) {
              this.storedAudioForReplay = data.audio;
            } else {
              this.storedAudioForReplay += data.audio;
            }
            console.log('[SDK] Audio chunk stored for replay, total length:', this.storedAudioForReplay.length);
            
            // Add chunk to queue for sequential playback (if user hasn't cancelled)
            if (!this.userCancelledPlayback) {
              this.audioChunkQueue.push({
                audio: data.audio,
                chunkIndex: data.chunkIndex,
                text: data.text
              });
              console.log('[SDK] Audio chunk added to playback queue, chunk:', data.chunkIndex);
            } else {
              console.log('[SDK] User cancelled playback, storing chunk but not adding to playback queue');
            }
            
            // Handle real-time audio streaming
            this.emit('audioChunk', { 
              chunkIndex: data.chunkIndex,
              audio: data.audio,
              text: data.text
            });
            
            // Start playing chunks if not already playing, user hasn't cancelled, and auto-play is enabled
            if (this.config.autoPlayAudioChunks !== false && !this.isPlayingChunks && !this.userCancelledPlayback) {
              console.log('[SDK] Starting automatic chunk playback');
              await this.startChunkPlayback();
            } else if (this.userCancelledPlayback) {
              console.log('[SDK] User cancelled playback, skipping auto-play for chunk:', data.chunkIndex);
            }
          }
          break;

        case 'audio_stream_end':
          console.log('[SDK] Audio streaming completed');
          
          // Save concatenated audio for replay
          if (this.storedAudioForReplay) {
            try {
              await FileSystem.writeAsStringAsync(this.replayAudioFilePath, this.storedAudioForReplay, {
                encoding: FileSystem.EncodingType.Base64
              });
              console.log('[SDK] Concatenated audio saved for replay, length:', this.storedAudioForReplay.length);
            } catch (error) {
              console.error('[SDK] Error saving concatenated audio for replay:', error);
            }
          }
          
          this.emit('audioStreamEnd', { 
            totalChunks: data.totalChunks 
          });
          // Mark streaming as complete to finish chunk playback
          this.audioStreamComplete = true;
          break;

        case 'error':
          console.error('[SDK] 🚨 Server error received:', {
            message: data.message,
            errorType: data.errorType,
            fullErrorData: data
          });
          
          // Check for rate limit errors
          let errorMessage = data.message;
          if (data.message && (
            data.message.toLowerCase().includes('rate limit') || 
            data.message.toLowerCase().includes('429') ||
            data.message.toLowerCase().includes('heavy load') ||
            data.message.toLowerCase().includes('try again')
          )) {
            errorMessage = "The server is experiencing heavy load right now. Please try again in a few minutes. Thank you for your patience! 🙏";
          }
          
          this.isProcessing = false;
          this.emit('serverError', { 
            message: errorMessage, 
            originalMessage: data.message,
            errorType: data.errorType || 'general_error',
            fullErrorData: data
          });
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
    } catch (error) {
      console.error('[SDK] Error handling message:', error);
      this.emit('error', { type: 'message_handle', message: error.message });
    }
  }

  /**
   * Start audio recording
   */
  async startRecording() {
    try {
      console.log('[SDK] Starting recording...');
      
      if (!this.isConnected) {
        throw new Error('Not connected to server');
      }

      // Clean up any existing recording first
      if (this.recordingRef) {
        console.log('[SDK] 🧹 Cleaning up existing recording object');
        try {
          await this.recordingRef.stopAndUnloadAsync();
        } catch (cleanupError) {
          console.log('[SDK] Cleanup warning:', cleanupError.message);
        }
        this.recordingRef = null;
      }

      // Reset states
      this.resetStates();

      // Invalidate any previous session to ignore remaining messages
      this.invalidateCurrentSession();

      // Generate new session ID for this recording
      this.generateSessionId();

      console.log('[SDK] 🎤 Creating new recording object');
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(this.config.audioOptions);
      await recording.startAsync();
      this.recordingRef = recording;
      this.isRecording = true;

      this.emit('recordingStart', { recording: true });
      console.log('[SDK] ✅ Recording started successfully');
      return true;
    } catch (error) {
      console.error('[SDK] ❌ Recording error:', error);
      // Clean up on error
      if (this.recordingRef) {
        try {
          await this.recordingRef.stopAndUnloadAsync();
        } catch (cleanupError) {
          console.log('[SDK] Error cleanup failed:', cleanupError.message);
        }
        this.recordingRef = null;
      }
      this.isRecording = false;
      this.emit('error', { type: 'recording_start', message: error.message });
      throw error;
    }
  }

  /**
   * Stop audio recording and send to server
   */
  async stopRecording(options = {}) {
    try {
      if (!this.isRecording || !this.recordingRef) {
        console.warn('[SDK] Stop recording called but not recording');
        return;
      }

      console.log('[SDK] Stopping recording...');
      this.isRecording = false;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      await this.recordingRef.stopAndUnloadAsync();
      const uri = this.recordingRef.getURI();
      
      console.log('[SDK] Recording stopped, URI:', uri);
      this.emit('recordingStop', { recording: false, uri });

      if (uri && this.isConnected) {
        await this.sendAudioToServer(uri, options);
      } else {
        throw new Error('Cannot send audio - missing file or connection');
      }

      this.recordingRef = null;
      return true;
    } catch (error) {
      console.error('[SDK] Stop recording error:', error);
      this.emit('error', { type: 'recording_stop', message: error.message });
      throw error;
    }
  }

  /**
   * Send audio file to server via WebSocket
   */
  async sendAudioToServer(uri, options = {}) {
    try {
      console.log('[SDK] Sending audio to server...');
      
      // Get file info and validate
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('Audio file does not exist');
      }
      
      // Read audio file as base64
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
      });

      console.log('[SDK] Audio file read, length:', base64Audio.length);

      // Basic audio validation
      if (!base64Audio || base64Audio.length < 100) {
        throw new Error('Audio file is too small or empty');
      }

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Ensure we have a client session ID for message filtering
        if (!this.currentSessionId) {
          console.warn('[SDK] ⚠️ No client session ID available, generating one now');
          this.generateSessionId();
        }

        // Prepare base message
        const message = {
          type: 'audio',
          audio: base64Audio,
          useStreaming: this.config.useStreaming
          // Note: Server doesn't support session IDs yet, so we handle session management client-side
        };

        // Add optional parameters if provided with validation
        if (options.userId && typeof options.userId === 'string') {
          message.userId = options.userId;
        }
        
        if (options.username && typeof options.username === 'string') {
          message.username = options.username;
        }
        
        if (options.history && Array.isArray(options.history)) {
          // Clean and validate history before sending
          const cleanHistory = options.history.filter(msg => 
            msg && 
            typeof msg === 'object' &&
            msg.role && 
            msg.content &&
            (msg.role === 'user' || msg.role === 'assistant') &&
            typeof msg.content === 'string'
          );
          
          console.log('[SDK] 🧹 History validation:', {
            originalLength: options.history.length,
            cleanedLength: cleanHistory.length,
            filtered: options.history.length - cleanHistory.length
          });
          
          if (cleanHistory.length > 0) {
            message.history = cleanHistory;
          }
        }
        
        if (options.additionalPrompt && typeof options.additionalPrompt === 'string') {
          message.additionalPrompt = options.additionalPrompt;
        }

        // Send via WebSocket
        this.ws.send(JSON.stringify(message));
        console.log('[SDK] 📤 Audio message sent to server with context:', {
          clientSessionId: this.currentSessionId, // Client-side session tracking
          userId: message.userId || 'none',
          username: message.username || 'none',
          hasHistory: !!message.history,
          historyLength: message.history?.length || 0,
          hasAdditionalPrompt: !!message.additionalPrompt,
          useStreaming: message.useStreaming,
          audioLength: base64Audio.length,
          historyPreview: message.history?.slice(-2).map(m => ({ role: m.role, contentLength: m.content?.length })) || []
        });
        
        // Debug: Log the exact message structure being sent (without audio data)
        const debugMessage = { ...message };
        delete debugMessage.audio; // Remove audio to avoid huge logs
        console.log('[SDK] 🔍 Full message structure:', JSON.stringify(debugMessage, null, 2));
        
        this.emit('audioSent', { 
          sent: true, 
          audioLength: base64Audio.length,
          hasContext: !!(message.history || message.additionalPrompt)
        });
        
        // Set transcription timeout (shorter, more specific to transcription)
        this.transcriptionTimeout = setTimeout(() => {
          console.warn('[SDK] No transcription received within 10 seconds');
          
          // Clear the timeout
          if (this.transcriptionTimeout) {
            clearTimeout(this.transcriptionTimeout);
            this.transcriptionTimeout = null;
          }
          
          this.emit('timeout', { 
            type: 'transcription_timeout', 
            duration: 10000,
            message: 'No transcription received within 10 seconds'
          });
        }, 10000);
        
        // Set response timeout
        this.responseTimeout = setTimeout(() => {
          console.warn('[SDK] No response received within 15 seconds');
          
          // Cancel any ongoing operations and reset states
          this.isProcessing = false;
          this.isPlaying = false;
          
          // Try to cancel any audio playback
          this.cancelAudio().catch(err => console.log('[SDK] Error cancelling audio after timeout:', err));
          
          // Clear the timeout
          if (this.responseTimeout) {
            clearTimeout(this.responseTimeout);
            this.responseTimeout = null;
          }
          
          this.emit('timeout', { 
            type: 'response_timeout', 
            duration: 15000,
            message: 'No response received from server within 15 seconds'
          });
        }, 15000);
      } else {
        throw new Error('WebSocket not connected');
      }
    } catch (error) {
      console.error('[SDK] Error sending audio:', error);
      this.emit('error', { type: 'audio_send', message: error.message });
      throw error;
    }
  }

  /**
   * Play saved audio (for replay functionality)
   */
  async playAudio(base64Audio = null) {
    try {
      console.log('[SDK] Playing audio for replay...');
      
      // Reset user cancellation flag when manually playing audio
      this.userCancelledPlayback = false;
      console.log('[SDK] Reset user cancellation flag for manual playback');
      
      let fileUri;

      if (base64Audio) {
        // If base64Audio is provided, write it to a temporary file
        fileUri = `${FileSystem.documentDirectory}temp_replay_${Date.now()}.mp3`;
        await FileSystem.writeAsStringAsync(fileUri, base64Audio, { 
          encoding: FileSystem.EncodingType.Base64 
        });
        console.log('[SDK] Temporary audio file written for replay');
      } else {
        // Use stored replay audio first, fallback to regular audio file
        if (this.storedAudioForReplay) {
          console.log('[SDK] Using stored audio for replay, length:', this.storedAudioForReplay.length);
          fileUri = this.replayAudioFilePath;
          
          // Ensure the replay file exists and is up to date
          await FileSystem.writeAsStringAsync(fileUri, this.storedAudioForReplay, {
            encoding: FileSystem.EncodingType.Base64
          });
        } else {
          // Fallback to regular audio file
          console.log('[SDK] No stored audio, using regular audio file');
          fileUri = this.audioFilePath;
          
          // Check if the file exists
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
          
          // Clean up temporary file if it was created
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
    } catch (error) {
      console.error('[SDK] Error playing audio for replay:', error);
      this.emit('error', { type: 'audio_play', message: error.message });
      throw error;
    }
  }

  /**
   * Start sequential chunk playback
   */
  async startChunkPlayback() {
    if (this.isPlayingChunks) {
      console.log('[SDK] Chunk playback already in progress');
      return;
    }
    
    console.log('[SDK] Starting sequential chunk playback');
    this.isPlayingChunks = true;
    this.currentChunkIndex = 0;
    this.audioStreamComplete = false;
    this.chunkPlaybackCancelled = false;
    
    // Emit single "audio started" event for the entire stream
    this.isPlaying = true;
    console.log('[SDK] Emitting audioStart event for chunk streaming');
    this.emit('audioStart', { streaming: true, playing: true });
    
    // Start playing the first available chunk
    await this.playNextQueuedChunk();
  }

  /**
   * Play next chunk in queue sequentially
   */
  async playNextQueuedChunk() {
    try {
      // Check if we have chunks to play and playback hasn't been cancelled
      while (this.currentChunkIndex < this.audioChunkQueue.length && this.isPlayingChunks && !this.chunkPlaybackCancelled) {
        
        // IMMEDIATE cancellation check at start of each loop iteration
        if (!this.isPlayingChunks || this.chunkPlaybackCancelled) {
          console.log('[SDK] Chunk playback cancelled at loop start, stopping at chunk', this.currentChunkIndex);
          this.finishChunkPlayback();
          return;
        }
        
        const chunk = this.audioChunkQueue[this.currentChunkIndex];
        console.log(`[SDK] Playing queued chunk ${chunk.chunkIndex} (${this.currentChunkIndex + 1}/${this.audioChunkQueue.length})`);
        
        // Double-check for cancellation before proceeding with this specific chunk
        if (!this.isPlayingChunks || this.chunkPlaybackCancelled) {
          console.log('[SDK] Chunk playback cancelled before playing chunk', this.currentChunkIndex);
          this.finishChunkPlayback();
          return;
        }
        
        // Create unique file path for this chunk
        const chunkPath = `${FileSystem.documentDirectory}chunk_${chunk.chunkIndex}_${Date.now()}.mp3`;
        
        // Write chunk to file
        await FileSystem.writeAsStringAsync(chunkPath, chunk.audio, {
          encoding: FileSystem.EncodingType.Base64
        });

        // Stop current audio if playing
        try {
          await this.soundRef.stopAsync();
          await this.soundRef.unloadAsync();
        } catch (e) {
          console.log('[SDK] No audio to stop');
        }

        // Load and play this chunk
        await this.soundRef.loadAsync({ uri: chunkPath });
        
        this.emit('chunkPlaybackStart', { 
          chunkIndex: chunk.chunkIndex,
          playing: true 
        });
        
        // Wait for this chunk to finish before playing next (with immediate cancellation)
        await new Promise(async (resolve, reject) => {
          let isResolved = false;
          let checkCancellationInterval;
          
          // Helper function to resolve only once
          const resolveOnce = (reason = 'finished') => {
            if (!isResolved) {
              isResolved = true;
              console.log(`[SDK] Chunk ${chunk.chunkIndex} resolved: ${reason}`);
              if (checkCancellationInterval) {
                clearInterval(checkCancellationInterval);
              }
              resolve();
            }
          };
          
          this.soundRef.setOnPlaybackStatusUpdate(async (status) => {
            if (status.didJustFinish && !isResolved) {
              this.emit('chunkPlaybackEnd', { 
                chunkIndex: chunk.chunkIndex,
                playing: false 
              });
              
              // Clean up chunk file
              FileSystem.deleteAsync(chunkPath, { idempotent: true }).catch(() => {});
              resolveOnce('natural_finish');
            }
            if (status.error && !isResolved) {
              this.emit('error', { type: 'chunk_playback', message: status.error });
              reject(new Error(status.error));
            }
          });
          
          // IMMEDIATE cancellation check before starting
          if (!this.isPlayingChunks || this.chunkPlaybackCancelled) {
            console.log('[SDK] Chunk playback cancelled before starting chunk', chunk.chunkIndex);
            FileSystem.deleteAsync(chunkPath, { idempotent: true }).catch(() => {});
            resolveOnce('cancelled_before_start');
            return;
          }
          
          // Start VERY frequent cancellation checking (every 10ms for immediate response)
          checkCancellationInterval = setInterval(() => {
            if (!this.isPlayingChunks || this.chunkPlaybackCancelled) {
              console.log('[SDK] IMMEDIATE cancellation detected during chunk playback');
              
              // Stop audio immediately without waiting
              this.soundRef.stopAsync().catch(() => {});
              
              // Clean up chunk file
              FileSystem.deleteAsync(chunkPath, { idempotent: true }).catch(() => {});
              
              this.emit('chunkPlaybackEnd', { 
                chunkIndex: chunk.chunkIndex,
                playing: false,
                cancelled: true
              });
              
              resolveOnce('cancelled_during_playback');
            }
          }, 10); // Check every 10ms for ultra-fast response
          
          // Actually start playing the audio
          try {
            await this.soundRef.playAsync();
            
            // Double-check for cancellation right after playback starts
            if (!this.isPlayingChunks || this.chunkPlaybackCancelled) {
              console.log('[SDK] Cancellation detected immediately after playAsync');
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
        
        // Move to next chunk
        this.currentChunkIndex++;
        
        // IMMEDIATE cancellation check after playing each chunk
        if (!this.isPlayingChunks || this.chunkPlaybackCancelled) {
          console.log('[SDK] Chunk playback cancelled after playing chunk', this.currentChunkIndex - 1);
          this.finishChunkPlayback();
          return;
        }
      }
      
      // Check if playback was cancelled during the while loop
      if (!this.isPlayingChunks || this.chunkPlaybackCancelled) {
        console.log('[SDK] Chunk playback was cancelled during loop, cleaning up');
        this.finishChunkPlayback();
        return;
      }
      
      // Check if we need to wait for more chunks or if streaming is complete
      if (!this.audioStreamComplete && this.currentChunkIndex >= this.audioChunkQueue.length && this.isPlayingChunks && !this.chunkPlaybackCancelled) {
        console.log('[SDK] Waiting for more chunks...');
        // Wait a bit and check again with more frequent cancellation checks
        setTimeout(() => {
          if (this.isPlayingChunks && !this.chunkPlaybackCancelled) {
            this.playNextQueuedChunk();
          } else {
            console.log('[SDK] ⚡ Playback cancelled during wait, finishing immediately');
            this.finishChunkPlayback();
          }
        }, 50); // Reduced wait time for faster cancellation response
      } else {
        // All chunks played, streaming complete, or cancelled
        console.log('[SDK] Finishing playback - chunks played:', this.currentChunkIndex, 'stream complete:', this.audioStreamComplete, 'still playing:', this.isPlayingChunks, 'cancelled:', this.chunkPlaybackCancelled);
        this.finishChunkPlayback();
      }
      
    } catch (error) {
      console.error('[SDK] Error in chunk playback:', error);
      this.emit('error', { type: 'chunk_playback_sequence', message: error.message });
      this.finishChunkPlayback();
    }
  }

  /**
   * Finish chunk playback and cleanup
   */
  finishChunkPlayback() {
    console.log('[SDK] Finishing chunk playback');
    const totalChunks = this.audioChunkQueue.length;
    const wasCancelled = this.chunkPlaybackCancelled;
    
    this.isPlayingChunks = false;
    this.isPlaying = false;
    this.currentChunkIndex = 0;
    this.audioChunkQueue = [];
    this.audioStreamComplete = false;
    this.chunkPlaybackCancelled = false; // Reset cancellation flag
    
    console.log('[SDK] Emitting audioComplete event, totalChunks:', totalChunks, 'cancelled:', wasCancelled);
    this.emit('audioComplete', { 
      playing: false, 
      cancelled: wasCancelled,
      totalChunks: totalChunks 
    });
  }

  /**
   * Cancel current audio playback only (keep text response generation)
   */
  async cancelAudio() {
    try {
      console.log('[SDK] 🔇 AUDIO CANCELLATION - Stopping audio playback only...');
      
      // AUDIO STOP - Set audio cancellation flags immediately
      this.isPlaying = false;
      this.isPlayingChunks = false;
      this.chunkPlaybackCancelled = true;
      this.userCancelledPlayback = true; // Prevent future chunks from auto-playing
      
      console.log('[SDK] 🎵 Audio cancelled - text response will continue generating');
      
      // IMMEDIATELY stop current audio playback without waiting
      if (this.soundRef) {
        try {
          console.log('[SDK] 🛑 Force stopping current audio NOW');
          // Don't await - do it immediately in background
          this.soundRef.stopAsync().catch(() => {});
          this.soundRef.unloadAsync().catch(() => {});
          console.log('[SDK] ✅ Current audio stop initiated');
        } catch (error) {
          console.log('[SDK] Sound already stopped:', error.message);
        }
      }
      
      // Force finish chunk playback if running
      if (this.audioChunkQueue.length > 0) {
        console.log('[SDK] 🚫 Force finishing chunk playback sequence');
        
        // IMPORTANT: Emit audioComplete to reset UI state IMMEDIATELY
        console.log('[SDK] 📢 Emitting IMMEDIATE audioComplete event to reset UI');
        this.emit('audioComplete', { 
          playing: false, 
          cancelled: true,
          totalChunks: this.audioChunkQueue.length 
        });
        
        // Also emit backup events to ensure UI resets
        setTimeout(() => {
          console.log('[SDK] 🔄 Backup audioComplete event');
          this.emit('audioComplete', { 
            playing: false, 
            cancelled: true,
            totalChunks: this.audioChunkQueue.length 
          });
        }, 50);
        
        setTimeout(() => {
          console.log('[SDK] 🔄 Secondary backup audioComplete event');
          this.emit('audioComplete', { 
            playing: false, 
            cancelled: true,
            totalChunks: this.audioChunkQueue.length 
          });
        }, 100);
      }
      
      console.log('[SDK] 📢 Emitting playbackCancelled event');
      this.emit('playbackCancelled', { playing: false, cancelled: true });
      
      // Also emit playbackEnd for regular audio cancellation to ensure UI reset
      setTimeout(() => {
        console.log('[SDK] 📢 Emitting playbackEnd event for regular audio cancellation');
        this.emit('playbackEnd', { playing: false, cancelled: true });
      }, 10);
      
      console.log('[SDK] ✅ AUDIO CANCELLATION COMPLETE - Text response continues');
      return true;
    } catch (error) {
      console.error('[SDK] ❌ Error during audio cancellation:', error);
      this.isPlaying = false;
      this.isPlayingChunks = false;
      this.chunkPlaybackCancelled = true;
      this.emit('playbackCancelled', { playing: false, cancelled: true, error: error.message });
      return false;
    }
  }

  /**
   * Handle cancellation from server
   */
  handleCancellation() {
    console.log('[SDK] Handling cancellation from server');
    this.isProcessing = false;
    this.cancelAudio();
    this.emit('cancelled', { cancelled: true });
  }

  /**
   * Clear stored audio for replay
   */
  clearStoredAudio() {
    console.log('[SDK] Clearing stored audio for new conversation');
    this.storedAudioForReplay = null;
    
    // Clean up replay audio file
    FileSystem.deleteAsync(this.replayAudioFilePath, { idempotent: true }).catch(() => {});
  }

  /**
   * Reset all states for new conversation
   */
  resetStates() {
    this.accumulatedResponse = '';
    this.isPlaying = false;
    this.isTyping = false;
    this.isProcessing = false;
    
    // Reset audio chunk streaming
    this.audioChunkQueue = [];
    this.isPlayingChunks = false;
    this.currentChunkIndex = 0;
    this.audioStreamComplete = false;
    this.chunkPlaybackCancelled = false;
    this.userCancelledPlayback = false; // Reset user cancellation for new conversation
    
    // Clear stored audio from previous conversation
    this.clearStoredAudio();
    
    // Reset client session management
    this.currentSessionId = null;
    console.log('[SDK] 🔄 Reset client session ID for new conversation');
    
    // Clear timeouts
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
    }
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect() {
    try {
      console.log('[SDK] Disconnecting...');
      
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

      // Stop audio playback
      await this.cancelAudio();
      
      // Close WebSocket
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      
      this.isConnected = false;
      this.resetStates();
      
      this.emit('disconnected', { connected: false });
      console.log('[SDK] Disconnected successfully');
      return true;
    } catch (error) {
      console.error('[SDK] Error during disconnect:', error);
      return false;
    }
  }

  /**
   * Set user context for future audio messages
   */
  setUserContext(userId, username) {
    console.log('[SDK] 📝 Setting user context:', { 
      prevUserId: this.userId, 
      newUserId: userId,
      prevUsername: this.username,
      newUsername: username 
    });
    
    this.userId = userId;
    this.username = username;
    
    console.log('[SDK] ✅ User context updated successfully:', { 
      userId: this.userId, 
      username: this.username,
      hasValidContext: !!(this.userId && this.username)
    });
  }

  /**
   * Set conversation history for context
   */
  setConversationHistory(history) {
    this.conversationHistory = history;
    console.log('[SDK] Conversation history set with', history?.length || 0, 'messages');
  }

  /**
   * Add a message to conversation history
   */
  addToHistory(role, content) {
    if (!this.conversationHistory) {
      this.conversationHistory = [];
      console.log('[SDK] 🆕 Initialized new conversation history array');
    }
    
    const newMessage = { 
      role, 
      content, 
      timestamp: new Date().toISOString() 
    };
    
    this.conversationHistory.push(newMessage);
    
    // Keep only last 10 messages (5 exchanges) since server can handle more
    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(-10);
      console.log('[SDK] 🔄 Trimmed history to last 10 messages');
    }
    
    console.log('[SDK] 📝 Added to history:', { role, content: content.substring(0, 50) + '...' }, 'Total messages:', this.conversationHistory.length);
    console.log('[SDK] 📚 Current history roles:', this.conversationHistory.map(m => m.role));
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
    console.log('[SDK] Conversation history cleared');
  }

  /**
   * Invalidate current session to ignore remaining messages from previous session
   */
  invalidateCurrentSession() {
    const oldSessionId = this.currentSessionId;
    this.currentSessionId = null;
    console.log('[SDK] 🚫 Invalidated client session to ignore remaining messages from previous session:', oldSessionId);
  }

  /**
   * Generate a new client session ID for request isolation
   */
  generateSessionId() {
    this.sessionCounter++;
    this.currentSessionId = `client_session_${Date.now()}_${this.sessionCounter}`;
    console.log('[SDK] 🆔 Generated new client session ID:', this.currentSessionId);
    return this.currentSessionId;
  }

  /**
   * Start recording with automatic context inclusion
   */
  async startRecordingWithContext(additionalPrompt = null) {
    // Invalidate any previous session to ignore remaining messages from cancelled/previous sessions
    this.invalidateCurrentSession();
    
    // Generate new session ID to isolate this recording from previous ones
    this.generateSessionId();
    
    // Clear stored audio from previous conversation when starting new recording
    this.clearStoredAudio();
    
    // Reset user cancellation flag for new conversation
    this.userCancelledPlayback = false;
    console.log('[SDK] 🔄 Reset user cancellation flag for new recording session:', this.currentSessionId);
    
    // Store additional prompt for use when stopping recording
    this.pendingAdditionalPrompt = additionalPrompt;
    return this.startRecording();
  }

  /**
   * Stop recording and send with all available context
   */
  async stopRecordingWithContext(overrideOptions = {}) {
    console.log('[SDK] 🎤 Stopping recording with context - current user context:', {
      userId: this.userId,
      username: this.username,
      hasValidContext: !!(this.userId && this.username)
    });
    
    const options = {
      userId: this.userId,
      username: this.username,
      history: this.conversationHistory,
      additionalPrompt: this.pendingAdditionalPrompt,
      ...overrideOptions // Allow overriding any option
    };

    console.log('[SDK] 📤 Prepared options for audio sending:', {
      hasUserId: !!options.userId,
      hasUsername: !!options.username,
      userId: options.userId || 'MISSING',
      username: options.username || 'MISSING',
      historyLength: options.history?.length || 0,
      hasAdditionalPrompt: !!options.additionalPrompt
    });

    // Clean up pending prompt
    this.pendingAdditionalPrompt = null;

    return this.stopRecording(options);
  }

  /**
   * Send audio file with conversation context
   */
  async sendAudioWithContext(uri, additionalPrompt = null) {
    const options = {
      userId: this.userId,
      username: this.username,
      history: this.conversationHistory,
      additionalPrompt: additionalPrompt
    };

    return this.sendAudioToServer(uri, options);
  }

  /**
   * Get current SDK status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      recording: this.isRecording,
      playing: this.isPlaying,
      typing: this.isTyping,
      processing: this.isProcessing,
      accumulatedResponse: this.accumulatedResponse,
      // Context information
      hasUserContext: !!(this.userId && this.username),
      historyLength: this.conversationHistory?.length || 0,
      userId: this.userId || null,
      username: this.username || null,
      // Client session information (for message filtering)
      currentSessionId: this.currentSessionId,
      sessionCounter: this.sessionCounter
    };
  }
}

export default AudioToAudioSDK; 