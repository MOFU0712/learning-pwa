// LLM Provider Factory

import { GeminiProvider } from './gemini';
import { ClaudeProvider } from './claude';
import type { LLMProvider, LLMProviderType } from './types';

export function createLLMProvider(provider: LLMProviderType): LLMProvider {
  switch (provider) {
    case 'gemini-flash':
      return new GeminiProvider();
    case 'claude-haiku':
      return new ClaudeProvider('haiku');
    case 'claude-sonnet':
      return new ClaudeProvider('sonnet');
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

// デフォルトプロバイダー（Claude Haiku - 指示追従性が高い）
export function createDefaultLLMProvider(): LLMProvider {
  return createLLMProvider('claude-haiku');
}
