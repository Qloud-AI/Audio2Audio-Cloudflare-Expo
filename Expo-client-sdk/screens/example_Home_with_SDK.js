/**
 * Audio-to-Audio SDK Demo - Complete Implementation Example
 * 
 * This example demonstrates all the enhanced features of the Audio-to-Audio Real-time SDK:
 * 
 * 🎯 KEY FEATURES DEMONSTRATED:
 * • Configurable SDK setup with server and authentication
 * • Context-aware conversations with user identification
 * • Simplified cancellation approach (disable during text generation)
 * • Real-time audio streaming with chunk progress tracking
 * • Smart timeout management (separate transcription/response timeouts)
 * • Contextual error handling based on error types
 * • Automatic conversation history management
 * • Session isolation for reliable operation
 * • Enhanced UI states and visual feedback
 * 
 * 🚀 QUICK START:
 * 1. Copy this file to your project
 * 2. Install dependencies: expo install expo-av expo-file-system expo-constants
 * 3. Configure your server URL and JWT token (see initializeSDK function)
 * 4. Import and use: import Home from './path/to/example_Home_with_SDK'
 * 
 * 💡 IMPLEMENTATION HIGHLIGHTS:
 * • Uses handlePressIn/handlePressOut for proper hold-to-talk behavior
 * • Disables cancellation during text generation for reliable UX
 * • Implements contextual error messages (transcription vs server errors)
 * • Demonstrates both automatic and manual conversation management
 * • Shows proper cleanup and event handler setup
 * • Includes comprehensive debugging and status information
 * 
 * 🔧 CUSTOMIZATION:
 * • Configure wsBaseUrl and jwtToken for your deployment
 * • Modify user context in initializeSDK() for your authentication system
 * • Adjust timeout values in SDK configuration as needed
 * • Customize UI styling and animations to match your app
 * • Add additional event handlers for specific use cases
 * 
 * 📚 DOCUMENTATION:
 * See ../services/README.md for complete API reference and best practices
 * 
 * @version 2.0.0
 * @author Audio-to-Audio Platform Team
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AudioToAudioSDK from '../services/AudioToAudioSDK';

export default function Home() {
  // SDK instance
  const sdkRef = useRef(null);
  
  // State variables
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [audioChunks, setAudioChunks] = useState(0);
  const [conversationCount, setConversationCount] = useState(0);
  
  // Animation values
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const blinkAnimation = useRef(new Animated.Value(1)).current;

  // Initialize SDK on component mount
  useEffect(() => {
    initializeSDK();
    return () => {
      // Cleanup on unmount
      if (sdkRef.current) {
        sdkRef.current.disconnect();
      }
    };
  }, []);

  // Initialize SDK and set up event handlers
  const initializeSDK = async () => {
    try {
      // Create SDK instance with server configuration
      sdkRef.current = new AudioToAudioSDK({
        // Required: Your deployed server configuration
        wsBaseUrl: 'wss://your-audio-to-audio-server.workers.dev', // Replace with your server URL
        jwtToken: 'your-jwt-token-here', // Replace with your JWT token
        
        // Optional configuration with enhanced defaults
        useStreaming: true,              // Enable real-time audio streaming
        autoManageHistory: true,         // Automatically track conversation history
        autoPlayAudio: true,             // Auto-play AI responses
        autoPlayAudioChunks: true,       // Auto-play streaming audio chunks
        transcriptionTimeout: 10000,     // 10 second transcription timeout
        responseTimeout: 15000,          // 15 second response timeout
        debug: __DEV__,                  // Enable debug logging in development
      });

      // Set user context for personalized responses
      // In a real app, you'd get this from your authentication system
      sdkRef.current.setUserContext('demo_user_123', 'Alex');

      // Register event handlers
      setupEventHandlers();

      // Initialize the SDK
      const success = await sdkRef.current.initialize();
      if (!success) {
        setErrorMessage('Failed to initialize SDK. Please check your server configuration.');
      }
    } catch (error) {
      console.error('SDK initialization error:', error);
      if (error.message.includes('wsBaseUrl is required') || error.message.includes('jwtToken is required')) {
        setErrorMessage('Please configure your server URL and JWT token in the code.');
      } else {
        setErrorMessage(`Initialization failed: ${error.message}`);
      }
    }
  };

  // Set up all SDK event handlers
  const setupEventHandlers = () => {
    const sdk = sdkRef.current;

    // Connection events
    sdk.on('connected', () => {
      console.log('SDK connected');
      setIsConnected(true);
      setErrorMessage('');
    });

    sdk.on('disconnected', () => {
      console.log('SDK disconnected');
      setIsConnected(false);
    });

    sdk.on('initialized', () => {
      console.log('SDK fully initialized');
      showFadeInAnimation();
    });

    // Recording events
    sdk.on('recordingStart', () => {
      console.log('Recording started');
      setIsRecording(true);
      setErrorMessage('');
      startPulseAnimation();
    });

    sdk.on('recordingStop', () => {
      console.log('Recording stopped');
      setIsRecording(false);
      stopPulseAnimation();
    });

    // Transcription events
    sdk.on('transcription', (data) => {
      console.log('Transcription received:', data.text);
      setTranscription(data.text);
    });

    // Processing events
    sdk.on('processingStart', () => {
      console.log('Processing started');
      setIsProcessing(true);
    });

    sdk.on('processingEnd', () => {
      console.log('Processing ended');
      setIsProcessing(false);
    });

    // Text streaming events
    sdk.on('textChunk', (data) => {
      console.log('Text chunk received');
      setIsTyping(true);
      setAiResponse(data.accumulated);
      startBlinkAnimation();
    });

    sdk.on('textComplete', (data) => {
      console.log('Text complete');
      setIsTyping(false);
      setAiResponse(data.text);
      setConversationCount(prev => prev + 1);
      stopBlinkAnimation();
    });

    // Audio events
    sdk.on('audioStart', (data) => {
      console.log('Audio playback started, streaming:', data.streaming);
      setIsPlaying(true);
    });

    sdk.on('audioChunk', (data) => {
      console.log('Audio chunk received:', data.chunkIndex + 1, '/', data.totalChunks);
      setAudioChunks(data.totalChunks);
    });

    sdk.on('audioComplete', (data) => {
      console.log('Audio playback complete, cancelled:', data.cancelled);
      setIsPlaying(false);
      setAudioChunks(0);
    });

    sdk.on('playbackStart', (data) => {
      console.log('Manual playback started, is replay:', data.isReplay);
      setIsPlaying(true);
    });

    sdk.on('playbackEnd', () => {
      console.log('Manual playback ended');
      setIsPlaying(false);
    });

    sdk.on('playbackCancelled', (data) => {
      console.log('Audio playback cancelled, text preserved:', !data.textInterrupted);
      setIsPlaying(false);
      setAudioChunks(0);
      // Note: Text response is preserved for reading
    });

    // Error events with contextual handling
    sdk.on('error', (data) => {
      console.error('SDK error:', data);
      
      // Handle different error types appropriately
      switch (data.type) {
        case 'transcription_error':
        case 'audio_processing':
          // Show user-friendly transcription error message
          setErrorMessage("I'm sorry, I couldn't understand that. Please try again by holding the record button and speaking clearly.");
          break;
        case 'permission':
          // Show permission error
          setErrorMessage('Microphone permission is required. Please enable it in your device settings.');
          break;
        default:
          // Log other errors without interrupting conversation
          setErrorMessage(`Error: ${data.message}`);
      }
      
      // Reset states
      setIsRecording(false);
      setIsPlaying(false);
      setIsProcessing(false);
      setIsTyping(false);
      stopPulseAnimation();
      stopBlinkAnimation();
    });

    sdk.on('serverError', (data) => {
      console.error('Server error:', data);
      
      // Only show transcription help for speech-related server errors
      const speechRelatedErrors = [
        'transcription', 'speech recognition', 'speech-to-text',
        'recognize speech', 'understand speech', 'audio processing'
      ];
      
      const isSpeechError = speechRelatedErrors.some(keyword => 
        data.message.toLowerCase().includes(keyword)
      );
      
      if (isSpeechError) {
        setErrorMessage("I'm sorry, I couldn't understand that. Please try again by holding the record button and speaking clearly.");
      } else {
        // Handle other server errors
        if (data.message.includes('rate limit')) {
          setErrorMessage("The server is experiencing heavy load. Please try again in a few minutes. 🙏");
        } else {
          setErrorMessage(`Server error: ${data.message}`);
        }
      }
      
      setIsProcessing(false);
      setIsTyping(false);
      stopBlinkAnimation();
    });

    // Timeout events
    sdk.on('timeout', (data) => {
      console.warn('SDK timeout:', data.type, 'Duration:', data.duration);
      
      if (data.type === 'transcription_timeout') {
        // Show transcription-specific help
        setErrorMessage("I'm sorry, I couldn't understand that. Please try again by holding the record button and speaking clearly.");
      } else if (data.type === 'response_timeout') {
        // Handle general response timeout
        setErrorMessage("Server is taking longer than expected. Please try again.");
      } else {
        setErrorMessage('Request timed out. Please try again.');
      }
      
      setIsProcessing(false);
      setIsTyping(false);
      stopBlinkAnimation();
    });

    // Audio sent confirmation with context info
    sdk.on('audioSent', (data) => {
      console.log('Audio sent to server:', {
        audioLength: data.audioLength,
        hasContext: data.hasContext,
        clientSessionId: data.clientSessionId,
        historyLength: data.historyLength
      });
    });
  };

  // Animation functions
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnimation.stopAnimation();
    Animated.timing(pulseAnimation, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const startBlinkAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnimation, {
          toValue: 0.3,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopBlinkAnimation = () => {
    blinkAnimation.stopAnimation();
    Animated.timing(blinkAnimation, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const showFadeInAnimation = () => {
    Animated.timing(fadeAnimation, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  };

  // Simplified press handlers following best practices
  const handlePressIn = async () => {
    try {
      if (!sdkRef.current || !isConnected) {
        Alert.alert('Error', 'Not connected to server');
        return;
      }

      // Disable cancellation during text generation (simplified approach)
      if (isProcessing || isTyping) {
        console.log('Cannot cancel during text generation');
        return;
      }

      if (isPlaying) {
        // Cancel audio only (text preserved)
        console.log('Cancelling audio playback...');
        await sdkRef.current.cancelAudio();
        return;
      }

      // Start context-aware recording
      const additionalPrompt = conversationCount === 0 
        ? 'This is a new user starting their first conversation with the AI assistant' 
        : 'Continue the conversation based on previous context and help the user with their questions';
        
      await sdkRef.current.startRecordingWithContext(additionalPrompt);
    } catch (error) {
      console.error('Press in error:', error);
      Alert.alert('Error', error.message);
    }
  };

  const handlePressOut = async () => {
    try {
      if (isRecording && sdkRef.current) {
        // Stop context-aware recording
        await sdkRef.current.stopRecordingWithContext();
      }
    } catch (error) {
      console.error('Press out error:', error);
      Alert.alert('Error', error.message);
    }
  };

  // Manual audio replay
  const replayAudio = async () => {
    try {
      if (!sdkRef.current) {
        Alert.alert('Error', 'SDK not initialized');
        return;
      }

      await sdkRef.current.playAudio();
    } catch (error) {
      console.error('Replay audio error:', error);
      Alert.alert('Playback Error', 'Cannot replay audio. Please try recording a new message.');
    }
  };

  // Clear conversation history
  const clearHistory = () => {
    if (sdkRef.current) {
      sdkRef.current.clearHistory();
      setTranscription('');
      setAiResponse('');
      setConversationCount(0);
      setErrorMessage('');
    }
  };

  // Status helpers
  const getConnectionStatus = () => {
    if (!isConnected) return 'Disconnected';
    if (isRecording) return 'Recording...';
    if (isProcessing) return 'Processing...';
    if (isTyping) return 'AI is responding...';
    if (isPlaying) return 'Playing audio...';
    return 'Ready';
  };

  const getStatusColor = () => {
    if (!isConnected) return '#ff4444';
    if (isRecording) return '#ff6b6b';
    if (isProcessing || isTyping) return '#ffa500';
    if (isPlaying) return '#4CAF50';
    return '#4CAF50';
  };

  const getButtonText = () => {
    if (isProcessing || isTyping) return "Generating...";
    if (isPlaying) return "Cancel Audio";
    if (isRecording) return "Release to Send";
    return "Hold to Talk";
  };

  const isButtonDisabled = isProcessing || isTyping;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnimation }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Audio-to-Audio SDK Demo</Text>
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{getConnectionStatus()}</Text>
        </View>
      </View>

      {/* Error Message */}
      {errorMessage ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.clearErrorButton}
            onPress={() => setErrorMessage('')}
          >
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Main Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Welcome Message */}
        {conversationCount === 0 && !transcription && !aiResponse && (
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeTitle}>Welcome to Audio-to-Audio AI!</Text>
            <Text style={styles.welcomeText}>
              This demo showcases the enhanced SDK features:
            </Text>
            <Text style={styles.featureText}>• Context-aware conversations</Text>
            <Text style={styles.featureText}>• Smart audio cancellation</Text>
            <Text style={styles.featureText}>• Real-time text streaming</Text>
            <Text style={styles.featureText}>• Session management</Text>
            <Text style={styles.welcomeText}>
              Hold the button below and start speaking to interact with the AI assistant!
            </Text>
            {!isConnected && (
              <Text style={styles.configText}>
                ⚠️ Please configure your server URL and JWT token in the code to get started.
              </Text>
            )}
          </View>
        )}

        {/* Transcription */}
        {transcription ? (
          <View style={styles.messageContainer}>
            <Text style={styles.messageLabel}>Your message:</Text>
            <Text style={styles.transcriptionText}>{transcription}</Text>
          </View>
        ) : null}

        {/* AI Response */}
        {aiResponse ? (
          <View style={styles.messageContainer}>
            <Text style={styles.messageLabel}>
              AI Assistant: 
              {isTyping ? (
                <Animated.Text style={[styles.typingIndicator, { opacity: blinkAnimation }]}>
                  ✍️ responding...
                </Animated.Text>
              ) : null}
            </Text>
            <Text style={styles.responseText}>{aiResponse}</Text>
            
            {/* Replay button for completed responses */}
            {!isTyping && (
              <TouchableOpacity
                style={styles.replayButton}
                onPress={replayAudio}
                disabled={isPlaying}
              >
                <Ionicons name="play" size={16} color="#4CAF50" />
                <Text style={styles.replayButtonText}>Replay Audio</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* Audio Streaming Info */}
        {audioChunks > 0 && (
          <View style={styles.audioInfo}>
            <Text style={styles.audioInfoText}>
              🎵 Streaming audio chunks: {audioChunks}
            </Text>
          </View>
        )}

        {/* Conversation Counter */}
        {conversationCount > 0 && (
          <View style={styles.conversationInfo}>
            <Text style={styles.conversationText}>
              💬 Conversations: {conversationCount}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        {/* Main Record Button */}
        <Animated.View style={[styles.recordButtonContainer, { transform: [{ scale: pulseAnimation }] }]}>
          <TouchableOpacity
            style={[
              styles.recordButton,
              {
                backgroundColor: isRecording ? '#ff4444' : 
                               isButtonDisabled ? '#ccc' : '#4CAF50',
                opacity: isConnected ? 1 : 0.5,
              },
            ]}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={!isConnected || isButtonDisabled}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isRecording ? 'stop' : isPlaying ? 'stop' : 'mic'}
              size={32}
              color="#fff"
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Button Text */}
        <Text style={[styles.buttonText, { color: isButtonDisabled ? '#ccc' : '#333' }]}>
          {getButtonText()}
        </Text>

        {/* Secondary Controls */}
        <View style={styles.secondaryControls}>
          {/* Clear History Button */}
          <TouchableOpacity
            style={[
              styles.controlButton,
              { opacity: conversationCount > 0 ? 1 : 0.5 },
            ]}
            onPress={clearHistory}
            disabled={conversationCount === 0}
          >
            <Ionicons name="refresh" size={20} color="#ff6b6b" />
            <Text style={styles.controlButtonText}>Clear History</Text>
          </TouchableOpacity>

          {/* SDK Status */}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => {
              const status = sdkRef.current?.getStatus();
              Alert.alert('SDK Status', JSON.stringify(status, null, 2));
            }}
          >
            <Ionicons name="information-circle" size={20} color="#2196F3" />
            <Text style={styles.controlButtonText}>SDK Status</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* SDK Status Debug Info (for development) */}
      {__DEV__ && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            SDK Status: {JSON.stringify(sdkRef.current?.getStatus() || {}, null, 2)}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statusIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff4444',
    padding: 15,
    margin: 10,
    borderRadius: 8,
  },
  errorText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  clearErrorButton: {
    marginLeft: 10,
    padding: 5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  welcomeContainer: {
    backgroundColor: '#e8f5e8',
    padding: 20,
    marginVertical: 10,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 10,
  },
  welcomeText: {
    fontSize: 14,
    color: '#388e3c',
    lineHeight: 20,
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#2e7d32',
    marginLeft: 10,
    marginBottom: 4,
  },
  configText: {
    fontSize: 14,
    color: '#ff5722',
    fontWeight: '500',
    marginTop: 10,
    padding: 10,
    backgroundColor: '#fff3e0',
    borderRadius: 8,
  },
  messageContainer: {
    backgroundColor: '#fff',
    padding: 15,
    marginVertical: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  transcriptionText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  responseText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
    marginBottom: 10,
  },
  typingIndicator: {
    fontSize: 12,
    color: '#4CAF50',
    fontStyle: 'italic',
  },
  replayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f8f0',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  replayButtonText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
    fontWeight: '500',
  },
  audioInfo: {
    backgroundColor: '#e3f2fd',
    padding: 10,
    marginVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
  },
  audioInfoText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
  },
  conversationInfo: {
    backgroundColor: '#fff3e0',
    padding: 8,
    marginVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
  },
  conversationText: {
    fontSize: 12,
    color: '#f57c00',
    fontWeight: '500',
  },
  controlsContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  recordButtonContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 15,
  },
  secondaryControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  controlButton: {
    alignItems: 'center',
    padding: 10,
  },
  controlButtonText: {
    fontSize: 11,
    marginTop: 4,
    color: '#666',
    textAlign: 'center',
  },
  debugInfo: {
    backgroundColor: '#000',
    padding: 10,
    margin: 10,
    borderRadius: 5,
    maxHeight: 150,
  },
  debugText: {
    color: '#0f0',
    fontSize: 8,
    fontFamily: 'monospace',
  },
}); 