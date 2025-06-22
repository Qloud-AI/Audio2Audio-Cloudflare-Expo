// OpenAI Text-to-Speech for Cloudflare Workers
// Generic speech synthesis service

export interface TTSConfig {
	model?: string;
	voice?: string;
	response_format?: string;
	speed?: number;
}

export async function generateSpeech(
	text: string, 
	apiKey: string, 
	config: TTSConfig = {}
): Promise<ArrayBuffer> {
	try {
		console.log('Generating speech for text:', text.substring(0, 100) + '...');
		
		const ttsConfig = {
			model: 'tts-1',
			voice: 'alloy',
			response_format: 'mp3',
			speed: 1.0,
			...config
		};

		const response = await fetch('https://api.openai.com/v1/audio/speech', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: ttsConfig.model,
				input: text,
				voice: ttsConfig.voice,
				response_format: ttsConfig.response_format,
				speed: ttsConfig.speed
			})
		});

		if (!response.ok) {
			throw new Error(`OpenAI TTS API error: ${response.status} ${response.statusText}`);
		}

		const arrayBuffer = await response.arrayBuffer();
		console.log('Speech generated successfully, size:', arrayBuffer.byteLength);
		
		return arrayBuffer;
	} catch (error) {
		console.error('Error generating speech:', error);
		throw error;
	}
} 