// Embeddings Generation Utility

import OpenAI from 'openai';

// OpenAI APIクライアント（シングルトン）
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

/**
 * テキストからembeddingを生成
 * @param text 埋め込みを生成するテキスト
 * @returns 1536次元のベクトル
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient();

  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    encoding_format: 'float',
  });

  return response.data[0].embedding;
}

/**
 * 複数テキストからembeddingsを一括生成
 * @param texts 埋め込みを生成するテキスト配列
 * @returns 1536次元のベクトル配列
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const client = getOpenAIClient();

  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
    encoding_format: 'float',
  });

  return response.data.map((item) => item.embedding);
}

/**
 * Embedding生成のコスト見積もり
 * @param tokenCount トークン数
 * @returns 推定コスト（USD）
 */
export function estimateEmbeddingCost(tokenCount: number): number {
  // text-embedding-3-small: $0.020 / 1M tokens (2025年1月時点)
  return (tokenCount * 0.020) / 1_000_000;
}

/**
 * テキストのトークン数を概算
 * 英語: 1トークン ≈ 4文字
 * 日本語: 1トークン ≈ 1.5文字（ひらがな/カタカナ）、1トークン ≈ 0.5文字（漢字）
 * 簡易的に平均1トークン ≈ 3文字として計算
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 3);
}
