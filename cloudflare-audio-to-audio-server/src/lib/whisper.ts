// Whisper transcription for Cloudflare Workers
// Generic audio transcription service

export interface WhisperConfig {
	model?: string;
	language?: string;
	prompt?: string;
	temperature?: number;
	response_format?: string;
}

export class WhisperTranscriber {
	private apiKey: string;
	private config: WhisperConfig;

	constructor(apiKey: string, config: WhisperConfig = {}) {
		this.apiKey = apiKey;
		this.config = {
			model: 'whisper-1',
			language: undefined, // Auto-detect by default
			prompt: undefined, // No default prompt
			temperature: 0,
			response_format: 'text',
			...config
		};
	}

	async transcribeAudio(audioBuffer: ArrayBuffer, options: WhisperConfig = {}): Promise<string> {
		try {
			console.log('Starting transcription process...');
			
			// Merge options with instance config
			const transcriptionConfig = { ...this.config, ...options };
			
			// Create FormData with audio file
			const formData = new FormData();
			const audioBlob = new Blob([audioBuffer], { type: 'audio/mp4' });
			formData.append('file', audioBlob, 'audio.mp4');
			formData.append('model', transcriptionConfig.model!);
			
			// Add optional parameters if specified
			if (transcriptionConfig.language) {
				formData.append('language', transcriptionConfig.language);
			}
			
			if (transcriptionConfig.prompt) {
				formData.append('prompt', transcriptionConfig.prompt);
			}
			
			      if (transcriptionConfig.temperature !== undefined && transcriptionConfig.temperature !== 0) {
        formData.append('temperature', transcriptionConfig.temperature.toString());
      }
      
      if (transcriptionConfig.response_format && transcriptionConfig.response_format !== 'text') {
        formData.append('response_format', transcriptionConfig.response_format);
      }
			
			console.log('Sending audio to OpenAI Whisper API...');
			
			const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${this.apiKey}`
				},
				body: formData
			});

			if (!response.ok) {
				throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
			}

			const result = await response.json() as { text: string };
			console.log('Transcription result:', result.text);
			
			return result.text;
		} catch (error) {
			console.error('Transcription error:', error);
			throw error;
		}
	}
} 