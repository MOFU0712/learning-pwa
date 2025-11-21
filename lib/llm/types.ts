// LLM Provider Types

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMProvider {
  name: string;
  generateStream(messages: Message[]): AsyncGenerator<string>;
  generateText(messages: Message[]): Promise<string>;
  estimateCost(inputTokens: number, outputTokens: number): number;
}

export type LLMProviderType = 'gemini-flash' | 'claude-haiku' | 'claude-sonnet';
