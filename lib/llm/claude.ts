// Claude Provider Implementation

import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, Message } from './types';

export class ClaudeProvider implements LLMProvider {
  name: string;
  private client: Anthropic;
  private model: string;

  constructor(variant: 'haiku' | 'sonnet' = 'haiku') {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }

    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    if (variant === 'haiku') {
      this.name = 'Claude Haiku 4.5';
      this.model = 'claude-3-5-haiku-20241022';
    } else {
      this.name = 'Claude Sonnet 4';
      this.model = 'claude-3-7-sonnet-20250219';
    }
  }

  async *generateStream(messages: Message[]): AsyncGenerator<string> {
    // Claudeはシステムメッセージを別パラメータで扱う
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const stream = await this.client.messages.stream({
      model: this.model,
      max_tokens: 8192,
      system: systemMessage?.content,
      messages: chatMessages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    });

    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        yield chunk.delta.text;
      }
    }
  }

  async generateText(messages: Message[]): Promise<string> {
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const result = await this.client.messages.create({
      model: this.model,
      max_tokens: 8192,
      system: systemMessage?.content,
      messages: chatMessages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    });

    const textBlock = result.content.find(
      block => block.type === 'text'
    ) as Anthropic.TextBlock | undefined;

    return textBlock?.text || '';
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // Claude pricing (2025年1月時点)
    let pricing: { input: number; output: number };

    if (this.model.includes('haiku')) {
      // Haiku: Input $0.80, Output $4.00 per 1M tokens
      pricing = { input: 0.80, output: 4.00 };
    } else {
      // Sonnet: Input $3.00, Output $15.00 per 1M tokens
      pricing = { input: 3.00, output: 15.00 };
    }

    return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  }
}
