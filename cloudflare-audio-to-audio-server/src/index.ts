/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { WhisperTranscriber } from './lib/whisper.js';
import { getGroqChatStream } from './lib/groq.js';
import { generateSpeech, TTSConfig } from './lib/openai-speech.js';
import { verifyToken } from './lib/auth.js';
import { getPrompt, replacePromptVariables } from './lib/prompt.js';

interface Env {
	JWT_SECRET: string;
	OPENAI_API_KEY: string;
	GROQ_API_KEY: string;
	OPENAI_PROJECT_ID: string;
	CUSTOM_PROMPT?: string;
	TRANSCRIPTION_LANGUAGE?: string;
	TRANSCRIPTION_PROMPT?: string;
	TTS_VOICE?: string;
	TTS_MODEL?: string;
	GROQ_MODEL?: string;
	GOOGLE_SEARCH_API_KEY?: string;
	GOOGLE_SEARCH_ENGINE_ID?: string;
	ENABLE_GOOGLE_SEARCH?: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		console.log('🌐 Incoming request:', request.method, url.pathname);
		console.log('📍 Full URL:', url.toString());
		console.log('🔧 Request headers:', JSON.stringify([...request.headers.entries()], null, 2));
		
		// Handle CORS preflight requests
		if (request.method === 'OPTIONS') {
			console.log('🔄 Handling CORS preflight request');
			return handleCORS(request);
		}
		
		// Handle WebSocket upgrade for /ws
		if (url.pathname === '/ws') {
			console.log('🔌 Routing to WebSocket upgrade handler');
			return handleWebSocketUpgrade(request, env);
		}
		
		// Handle regular HTTP routes
		let response: Response;
		switch (url.pathname) {
			case '/':
				response = new Response('Audio-to-Audio Server - Real-time Voice AI Platform', { status: 200 });
				break;
			
			case '/health':
				response = new Response(JSON.stringify({ status: 'OK', message: 'Server is running' }), {
					headers: { 'Content-Type': 'application/json' }
				});
				break;
			
			case '/api/generate-audio':
				response = await handleGenerateAudio(request, env);
				break;
			
			default:
				response = new Response('Not Found', { status: 404 });
		}
		
		// Add CORS headers to all responses
		return addCORSHeaders(response);
	},
} satisfies ExportedHandler<Env>;

// CORS helper functions
function handleCORS(request: Request): Response {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
			'Access-Control-Max-Age': '86400',
		},
	});
}

function addCORSHeaders(response: Response): Response {
	const newResponse = new Response(response.body, response);
	newResponse.headers.set('Access-Control-Allow-Origin', '*');
	newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
	newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
	return newResponse;
}

async function handleWebSocketUpgrade(request: Request, env: Env): Promise<Response> {
	console.log('🔌 WebSocket upgrade request received');
	
	const url = new URL(request.url);
	console.log('📍 WebSocket URL:', url.toString());
	
	const upgradeHeader = request.headers.get('Upgrade');
	console.log('🔄 Upgrade header:', upgradeHeader);
	
	if (!upgradeHeader || upgradeHeader !== 'websocket') {
		console.log('❌ Invalid upgrade header, expected websocket');
		return new Response('Expected Upgrade: websocket', { status: 426 });
	}
	
	// Verify JWT token from query parameter
	const token = url.searchParams.get('token');
	console.log('🔑 Token received:', token ? `${token.substring(0, 50)}...` : 'null');
	
	if (!token) {
		console.log('❌ No token provided in query parameters');
		return new Response('Missing token', { status: 401 });
	}
	
	try {
		console.log('🔐 Verifying JWT token...');
		console.log('🔧 Environment check - JWT_SECRET exists:', !!env.JWT_SECRET);
		console.log('🔧 Environment check - JWT_SECRET length:', env.JWT_SECRET?.length || 0);
		const decoded = await verifyToken(token, env.JWT_SECRET);
		console.log('✅ Token verification successful:', JSON.stringify(decoded, null, 2));
	} catch (error) {
		console.log('❌ Token verification failed:', error);
		return new Response('Invalid token', { status: 401 });
	}
	
	try {
		console.log('🔧 Creating WebSocket pair...');
		// Create WebSocket pair
		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);
		
		console.log('✅ WebSocket pair created successfully');
		console.log('🎯 Accepting server WebSocket...');
		server.accept();
		console.log('✅ Server WebSocket accepted');
		
		// Handle WebSocket connection
		console.log('🚀 Starting WebSocket connection handler...');
		try {
			handleWebSocketConnection(server, env);
		} catch (handlerError) {
			console.error('❌ Error in WebSocket connection handler:', handlerError);
		}
		
		console.log('✅ WebSocket upgrade completed, returning response');
		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	} catch (error) {
		console.log('❌ Error during WebSocket setup:', error);
		return new Response('WebSocket setup failed', { status: 500 });
	}
}

function handleWebSocketConnection(ws: WebSocket, env: Env) {
	console.log('🔗 WebSocket connection handler started');
	
	let isProcessing = false;
	let isCancelled = false;
	let currentGroqStream: any = null;
	let userId: string | null = null;
	let username: string | null = null;
	let whisperTranscriber: WhisperTranscriber | null = null;
	
	// Send immediate welcome message to confirm connection
	console.log('📤 Sending welcome message...');
	try {
		ws.send(JSON.stringify({
			type: 'welcome',
			message: 'WebSocket connection established successfully!',
			timestamp: new Date().toISOString()
		}));
		console.log('✅ Welcome message sent');
	} catch (error) {
		console.error('❌ Failed to send welcome message:', error);
	}
	
	console.log('✅ WebSocket connection handler setup complete');
	
	ws.addEventListener('message', async (event) => {
		console.log('📨 WebSocket message received, data length:', (event.data as string).length);
		
		try {
			const data = JSON.parse(event.data as string);
			console.log('📋 Parsed message type:', data.type);
			console.log('📊 Message data keys:', Object.keys(data));
			
			if (data.type === 'audio' && data.audio) {
				console.log('🎵 Processing audio message...');
				console.log('🔊 Audio data length:', data.audio.length);
				
				const audioBuffer = base64ToArrayBuffer(data.audio);
				console.log('🔄 Converted to ArrayBuffer, size:', audioBuffer.byteLength);
				
				const clientContext = {
					userId: data.userId,
					username: data.username,
					additionalPrompt: data.additionalPrompt,
					history: data.history,
					useStreaming: data.useStreaming
				};
				console.log('📝 Client context:', JSON.stringify(clientContext, null, 2));
				
				await processAudioInput(audioBuffer, clientContext, ws, env);
			} else if (data.type === 'cancel') {
				console.log('🛑 Received cancel request');
				handleCancellation();
			} else if (data.type === 'test') {
				console.log('🧪 Received test message, sending response...');
				ws.send(JSON.stringify({
					type: 'test_response',
					message: 'Test message received successfully!',
					timestamp: new Date().toISOString()
				}));
				console.log('✅ Test response sent');
			} else {
				console.warn('❓ Received unknown message type:', data.type);
				console.log('📄 Full message data:', JSON.stringify(data, null, 2));
			}
		} catch (error) {
			console.error('❌ Error processing message:', error);
			console.error('📄 Raw message data:', event.data);
			
			try {
				ws.send(JSON.stringify({
					type: 'error',
					message: 'Error processing message: ' + (error as Error).message
				}));
			} catch (sendError) {
				console.error('❌ Failed to send error message:', sendError);
			}
		}
		
		console.log('✅ Message processing completed');
	});
	
	ws.addEventListener('close', (event) => {
		console.log('🔌 WebSocket connection closed');
		console.log('📊 Close code:', event.code, 'Reason:', event.reason);
		console.log('🧹 Starting cleanup...');
		cleanup();
	});
	
	ws.addEventListener('error', (error) => {
		console.error('❌ WebSocket connection error:', error);
		console.log('🧹 Starting cleanup due to error...');
		cleanup();
	});
	
	async function processAudioInput(audioBuffer: ArrayBuffer, clientContext: any, ws: WebSocket, env: Env) {
		if (isProcessing) {
			console.log('Already processing, ignoring new input');
			return;
		}
		
		isProcessing = true;
		isCancelled = false;
		
		try {
			// Initialize whisper transcriber lazily
			if (!whisperTranscriber) {
				console.log('🎤 Initializing Whisper transcriber...');
				const whisperConfig = {
					language: env.TRANSCRIPTION_LANGUAGE,
					prompt: env.TRANSCRIPTION_PROMPT
				};
				whisperTranscriber = new WhisperTranscriber(env.OPENAI_API_KEY, whisperConfig);
				console.log('✅ Whisper transcriber initialized');
			}
			
			console.log('Starting transcription...');
			const transcription = await whisperTranscriber.transcribeAudio(audioBuffer);
			console.log('Transcription result:', transcription);
			
			if (isCancelled) {
				console.log('Cancelled during transcription, stopping processing');
				return;
			}
			
			if (!transcription || transcription.trim().length === 0) {
				throw new Error('empty_transcription');
			}
			
			ws.send(JSON.stringify({
				type: 'caption',
				output: JSON.stringify(transcription.trim())
			}));
			
			console.log('Starting Groq chat stream...');
			let llmResponse = '';
			const currentPrompt = getPrompt(env.CUSTOM_PROMPT);
			const contextStack = [currentPrompt]; // Start with the system prompt
			
			// Add user context to system messages
			if (userId) contextStack.unshift({ role: 'system', content: `User ID: ${userId}` });
			if (username) contextStack.unshift({ role: 'system', content: `Username: ${username}` });
			
			// Format the user message using the prompt template
			let formattedUserMessage = transcription;
			
			if (clientContext) {
				console.log('🔍 Processing client context:', JSON.stringify(clientContext, null, 2));
				if (clientContext.userId) {
					userId = clientContext.userId;
					console.log('📝 Extracted userId:', userId);
				}
				if (clientContext.username) {
					username = clientContext.username;
					console.log('📝 Extracted username:', username);
				} else {
					console.log('⚠️ No username found in client context, using fallback');
				}
				
				// Format conversation history
				let conversationHistory = '';
				if (clientContext.history) {
					let parsedHistory;
					if (typeof clientContext.history === 'string') {
						try {
							parsedHistory = JSON.parse(clientContext.history);
						} catch (error) {
							console.error('Error parsing history:', error);
							parsedHistory = [];
						}
					} else if (Array.isArray(clientContext.history)) {
						parsedHistory = clientContext.history;
					} else {
						parsedHistory = [];
					}
					
					// Format history as a readable conversation
					// Clean up any legacy placeholders in historical messages first
					console.log('🧹 Cleaning legacy placeholders from conversation history...');
					const cleanedHistory = parsedHistory.map((msg: any) => {
						const originalContent = msg.content;
						const cleanedContent = msg.content?.replace(/\{\$username\}/g, username || 'user');
						if (originalContent !== cleanedContent) {
							console.log(`🔧 Replaced placeholder in message: "${originalContent}" -> "${cleanedContent}"`);
						}
						return {
							...msg,
							content: cleanedContent
						};
					});
					console.log('✅ Legacy placeholder cleanup completed');
					
					conversationHistory = cleanedHistory.map((msg: any, idx: number) => {
						const formattedMsg = formatHistoricalMessage(msg, idx);
						const speaker = formattedMsg.role === 'user' ? 'User' : 'Assistant';
						return `${speaker}: ${formattedMsg.content}`;
					}).join('\n');
				}
				
				// Create formatted user message by replacing placeholders in the prompt content
				formattedUserMessage = replacePromptVariables(currentPrompt.content, {
					username: username || 'User',
					conversationHistory: conversationHistory || 'No previous conversation.',
					userMessage: transcription,
					additionalPrompt: clientContext.additionalPrompt || ''
				});
			}
			
			const groqOptions = {
				model: env.GROQ_MODEL,
				enableGoogleSearch: env.ENABLE_GOOGLE_SEARCH === 'true',
				googleSearchApiKey: env.GOOGLE_SEARCH_API_KEY,
				googleSearchEngineId: env.GOOGLE_SEARCH_ENGINE_ID
			};
			
			currentGroqStream = getGroqChatStream(formattedUserMessage, contextStack, env.GROQ_API_KEY, groqOptions);
			
			// Buffer for audio streaming
			let textBuffer = '';
			const audioChunkSize = 50; // Generate audio every 50 characters
			let audioChunkIndex = 0;
			
			for await (const chunk of currentGroqStream) {
				if (isCancelled) {
					console.log('Cancelled during LLM response, stopping processing');
					break;
				}
				llmResponse += chunk;
				textBuffer += chunk;
				
				ws.send(JSON.stringify({
					type: 'groq_response_chunk',
					output: chunk
				}));
				
				// Generate audio chunk when buffer reaches threshold
				if (clientContext.useStreaming && textBuffer.length >= audioChunkSize) {
					try {
						console.log(`Generating audio chunk ${audioChunkIndex} with text:`, textBuffer);
						await handleStreamingAudioChunk(ws, textBuffer, audioChunkIndex, env);
						audioChunkIndex++;
						textBuffer = ''; // Reset buffer
					} catch (error) {
						console.error('Error generating audio chunk:', error);
						// Continue with text streaming even if audio fails
					}
				}
			}
			
			if (isCancelled) return;
			
			ws.send(JSON.stringify({
				type: 'groq_response_end',
				output: llmResponse.trim()
			}));
			
			// Handle remaining text buffer
			if (clientContext.useStreaming && textBuffer.length > 0) {
				try {
					console.log(`Generating final audio chunk ${audioChunkIndex} with text:`, textBuffer);
					await handleStreamingAudioChunk(ws, textBuffer, audioChunkIndex, env);
					audioChunkIndex++;
				} catch (error) {
					console.error('Error generating final audio chunk:', error);
				}
				
				// Send audio stream end signal
				ws.send(JSON.stringify({
					type: 'audio_stream_end',
					totalChunks: audioChunkIndex
				}));
			} else if (!clientContext.useStreaming) {
				// Fallback to complete audio response
				console.log('Generating complete audio response');
				await handleAudioResponse(ws, llmResponse, env);
			}
			
		} catch (error) {
			await handleError(error as Error, ws);
		} finally {
			isProcessing = false;
			ws.send(JSON.stringify({ type: 'processing_end' }));
		}
	}
	
	function handleCancellation() {
		isCancelled = true;
		if (currentGroqStream && currentGroqStream.cancel) {
			console.log('Cancelling current Groq stream');
			currentGroqStream.cancel();
		}
		currentGroqStream = null;
		isProcessing = false;
		ws.send(JSON.stringify({ type: 'cancelled' }));
		console.log('Cancel process completed');
	}
	
	function cleanup() {
		if (currentGroqStream && currentGroqStream.cancel) {
			currentGroqStream.cancel();
		}
		currentGroqStream = null;
		isProcessing = false;
	}
}

async function handleGenerateAudio(request: Request, env: Env): Promise<Response> {
	// Simple authentication for API endpoint
	const authHeader = request.headers.get('Authorization');
	if (!authHeader) {
		return new Response('Missing Authorization header', { status: 401 });
	}
	
	try {
		await verifyToken(authHeader, env.JWT_SECRET);
	} catch (error) {
		return new Response('Invalid token', { status: 401 });
	}
	
	try {
		const { text } = await request.json() as { text: string };
		if (!text) {
			return new Response('Text is required', { status: 400 });
		}
		
		const ttsConfig: TTSConfig = {
			voice: env.TTS_VOICE,
			model: env.TTS_MODEL
		};
		const mp3ArrayBuffer = await generateSpeech(text, env.OPENAI_API_KEY, ttsConfig);
		
		return new Response(mp3ArrayBuffer, {
			headers: { 'Content-Type': 'audio/mpeg' }
		});
	} catch (error) {
		console.error('Error generating audio:', error);
		return new Response('Error generating audio', { status: 500 });
	}
}

async function handleAudioResponse(ws: WebSocket, text: string, env: Env) {
	try {
		const ttsConfig: TTSConfig = {
			voice: env.TTS_VOICE,
			model: env.TTS_MODEL
		};
		const mp3ArrayBuffer = await generateSpeech(text, env.OPENAI_API_KEY, ttsConfig);
		const base64Audio = arrayBufferToBase64(mp3ArrayBuffer);
		
		ws.send(JSON.stringify({
			type: 'audio_response',
			audio: base64Audio
		}));
	} catch (error) {
		console.error('Error generating audio response:', error);
		ws.send(JSON.stringify({
			type: 'error',
			message: 'Error generating audio response'
		}));
	}
}

async function handleStreamingAudioChunk(ws: WebSocket, text: string, chunkIndex: number, env: Env) {
	try {
		console.log(`Generating audio chunk ${chunkIndex} for text: "${text}"`);
		const ttsConfig: TTSConfig = {
			voice: env.TTS_VOICE,
			model: env.TTS_MODEL
		};
		const mp3ArrayBuffer = await generateSpeech(text, env.OPENAI_API_KEY, ttsConfig);
		const base64Audio = arrayBufferToBase64(mp3ArrayBuffer);
		
		ws.send(JSON.stringify({
			type: 'audio_chunk',
			chunkIndex: chunkIndex,
			audio: base64Audio,
			text: text
		}));
		
		console.log(`Audio chunk ${chunkIndex} sent, size: ${base64Audio.length}`);
	} catch (error) {
		console.error(`Error generating audio chunk ${chunkIndex}:`, error);
		ws.send(JSON.stringify({
			type: 'error',
			errorType: 'audio_chunk_error',
			message: `Error generating audio chunk ${chunkIndex}`,
			chunkIndex: chunkIndex
		}));
	}
}

async function handleError(error: Error, ws: WebSocket) {
	console.error('Processing error:', error);
	
	let errorMessage = 'An error occurred while processing your request.';
	let errorType = 'general_error';
	
	if (error.message === 'empty_transcription') {
		errorMessage = 'Could not transcribe audio. Please try speaking more clearly.';
		errorType = 'transcription_error';
	} else if (error.message.includes('OpenAI')) {
		errorMessage = 'Audio processing service is temporarily unavailable.';
		errorType = 'service_error';
	} else if (error.message.includes('Groq')) {
		errorMessage = 'AI response service is temporarily unavailable.';
		errorType = 'ai_error';
	}
	
	ws.send(JSON.stringify({
		type: 'error',
		errorType: errorType,
		message: errorMessage
	}));
}

function formatHistoricalMessage(chat: any, index: number) {
	const validRoles = ['system', 'user', 'assistant'];
	let role = chat.role?.toLowerCase();
	
	if (role === 'nik') {
		role = 'assistant';
	}
	
	if (!validRoles.includes(role)) {
		console.warn(`Invalid historical message role "${role}" at index ${index}, defaulting to "user"`);
		role = 'user';
	}
	
	return {
		role: role,
		content: chat.content || ''
	};
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}
