// Groq LLaMA streaming chat for Cloudflare Workers
// Adapted from models/groq.js

interface ChatMessage {
	role: string;
	content: string;
}

interface GroqStreamChunk {
	choices: Array<{
		delta?: {
			content?: string;
			tool_calls?: Array<{
				function?: {
					name?: string;
					arguments?: string;
				};
			}>;
		};
	}>;
}

// Optional Google Search integration
// Configure with GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID environment variables
async function googleSearch(query: string, apiKey?: string, searchEngineId?: string): Promise<any[] | null> {
	if (!apiKey || !searchEngineId) {
		console.warn('Google Search not configured - missing API key or search engine ID');
		return null;
	}

	const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}`;

	try {
		const response = await fetch(url);
		const data = await response.json() as any;
		return data.items?.slice(0, 3).map((item: any) => ({
			title: item.title,
			link: item.link,
			snippet: item.snippet
		})) || [];
	} catch (error) {
		console.error('Error performing Google search:', error);
		return null;
	}
}

export async function* getGroqChatStream(
	text: string, 
	stack: ChatMessage[], 
	groqApiKey: string,
	options: {
		model?: string;
		enableGoogleSearch?: boolean;
		googleSearchApiKey?: string;
		googleSearchEngineId?: string;
	} = {}
): AsyncGenerator<string, any, unknown> {
	console.log('groq: request received');
	console.time('groq_api');
	
	stack.push({
		role: 'user',
		content: text
	});

	// Configure request options
	const model = options.model || "llama-3.3-70b-versatile";
	const enableGoogleSearch = options.enableGoogleSearch && options.googleSearchApiKey && options.googleSearchEngineId;

	const tools = enableGoogleSearch ? [
		{
			type: "function",
			function: {
				name: "googleSearch",
				description: "Search the internet using Google Custom Search API",
				parameters: {
					type: "object",
					properties: {
						query: {
							type: "string",
							description: "The search query"
						}
					},
					required: ["query"]
				}
			}
		}
	] : undefined;

	const requestBody: any = {
		messages: stack,
		model: model,
		stream: true
	};

	if (tools) {
		requestBody.tools = tools;
		requestBody.tool_choice = "auto";
	}

	const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${groqApiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
	}

	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error('No response body reader available');
	}

	let accumulatedContent = '';
	let isCancelled = false;

	const cancelStream = () => {
		isCancelled = true;
		reader.cancel();
	};

	try {
		const decoder = new TextDecoder();
		let buffer = '';

		while (true) {
			if (isCancelled) break;
			
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() || '';

			for (const line of lines) {
				if (line.startsWith('data: ')) {
					const data = line.slice(6);
					if (data === '[DONE]') continue;
					
					try {
						const chunk: GroqStreamChunk = JSON.parse(data);
						const content = chunk.choices[0]?.delta?.content || '';
						const toolCalls = chunk.choices[0]?.delta?.tool_calls;

						if (toolCalls && enableGoogleSearch) {
							for (const toolCall of toolCalls) {
								if (toolCall.function?.name === 'googleSearch' && toolCall.function?.arguments) {
									const query = JSON.parse(toolCall.function.arguments).query;
									const searchResults = await googleSearch(
										query, 
										options.googleSearchApiKey, 
										options.googleSearchEngineId
									);
									// Add search results to conversation context
									stack.push({
										role: 'function',
										content: JSON.stringify(searchResults)
									});
									// Continue processing without yielding search results
								}
							}
						} else if (content) {
							accumulatedContent += content;
							yield content;
						}
					} catch (parseError) {
						console.error('Error parsing chunk:', parseError);
						continue;
					}
				}
			}
		}

		if (!isCancelled) {
			stack.push({
				role: 'assistant',
				content: accumulatedContent
			});
		}
	} finally {
		console.timeEnd('groq_api');
	}

	return { cancel: cancelStream };
} 