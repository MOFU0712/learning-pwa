// Gemini Provider Implementation

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMProvider, Message } from './types';

export class GeminiProvider implements LLMProvider {
  name = 'Gemini 2.0 Flash';
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    if (!process.env.GOOGLE_AI_API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY is not set');
    }

    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.7,
      },
    });
  }

  async *generateStream(messages: Message[]): AsyncGenerator<string> {
    // Gemini APIはシステムメッセージを別で扱う
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    // メッセージをGemini形式に変換
    const history = chatMessages.slice(0, -1).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    const lastMessage = chatMessages[chatMessages.length - 1];

    // チャット開始
    const chat = this.model.startChat({
      history,
      systemInstruction: systemMessage?.content ? {
        role: 'user',
        parts: [{ text: systemMessage.content }],
      } : undefined,
    });

    // ストリーミングレスポンス
    const result = await chat.sendMessageStream(lastMessage.content);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  }

  async generateText(messages: Message[]): Promise<string> {
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const history = chatMessages.slice(0, -1).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    const lastMessage = chatMessages[chatMessages.length - 1];

    const chat = this.model.startChat({
      history,
      systemInstruction: systemMessage?.content ? {
        role: 'user',
        parts: [{ text: systemMessage.content }],
      } : undefined,
    });

    const result = await chat.sendMessage(lastMessage.content);
    return result.response.text();
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // Gemini 2.0 Flash pricing (2025年1月時点)
    // Input: $0.075 / 1M tokens
    // Output: $0.30 / 1M tokens
    return (inputTokens * 0.075 + outputTokens * 0.30) / 1_000_000;
  }
}
