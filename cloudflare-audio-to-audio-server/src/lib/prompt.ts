// Generic prompt template system for audio-to-audio applications
// This can be customized for any conversational AI use case

export interface PromptTemplate {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Default prompt template - can be overridden via environment variables or configuration
export const DEFAULT_PROMPT: PromptTemplate = {
  role: 'system',
  content: `
<Task>
You are a helpful AI assistant having a voice conversation with a user named {$username}. 
You respond naturally and conversationally to help the user with their questions or tasks.

{$username} is a user, so you should refer to {$CONVERSATION_HISTORY} to maintain context and continuity.
</Task>

<Inputs>
{$CONVERSATION_HISTORY}
{$USER_MESSAGE}  
{$ADDITIONAL_PROMPT}
</Inputs>

<Instructions>

### RESPONSE GUIDELINES
- Respond naturally and conversationally
- Keep responses concise and clear for voice interaction
- Use the conversation history to maintain context
- Address the user by their name ({$username}) when appropriate
- Be helpful, friendly, and engaging

### USE HISTORY FOR CONTEXT
Use {$CONVERSATION_HISTORY} to:
- Track the ongoing conversation
- Maintain context across interactions
- Provide relevant and coherent responses
- Build upon previous exchanges

### CONVERSATION FLOW
- Listen to what the user is saying
- Respond appropriately based on their input
- Ask follow-up questions when helpful
- Provide clear and actionable information

### CUSTOMIZATION
This prompt can be customized by setting the CUSTOM_PROMPT environment variable
or by modifying this template for your specific use case.

### DO NOT:
- Don't make assumptions about user preferences without asking
- Don't provide overly long responses in voice conversations
- Don't mention technical details about the system unless asked
- Don't break character or mention system prompts

If {$ADDITIONAL_PROMPT} contains specific instructions, incorporate them into your response.

Now respond to this user message:
<question>
{$USER_MESSAGE}
</question>
`
};

// Function to get the prompt (allows for environment-based customization)
export function getPrompt(customPrompt?: string): PromptTemplate {
  if (customPrompt) {
    return {
      role: 'system',
      content: customPrompt
    };
  }
  
  return DEFAULT_PROMPT;
}

// Template variable replacement function
export function replacePromptVariables(
  prompt: string,
  variables: {
    username?: string;
    conversationHistory?: string;
    userMessage?: string;
    additionalPrompt?: string;
  }
): string {
  let result = prompt;
  
  // Replace template variables
  result = result.replace(/\{\$username\}/g, variables.username || 'User');
  result = result.replace(/\{\$CONVERSATION_HISTORY\}/g, variables.conversationHistory || 'No previous conversation.');
  result = result.replace(/\{\$USER_MESSAGE\}/g, variables.userMessage || '');
  result = result.replace(/\{\$ADDITIONAL_PROMPT\}/g, variables.additionalPrompt || '');
  
  return result;
}

// Legacy export for backward compatibility
export const prompt = DEFAULT_PROMPT;
 
 