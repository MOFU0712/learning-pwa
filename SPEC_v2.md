# 学習補助PWAアプリ 開発仕様書 v2.0（SPEC_v2.md）

## 📋 プロジェクト概要

### アプリ名
Learning Assistant PWA

### コンセプト変更（v2.0）

**v1.0（旧）：**
- AIチャット（Gemini/Claude）で学習 → JSON出力 → アプリに取り込み
- アクティブリコール中心

**v2.0（新）⭐：**
- **アプリ内でAI家庭教師と対話**
- PDFから書籍を自動登録（Gemini PDF Processing）
- セマンティック検索で必要な部分だけ読み込み
- 複数LLM対応（Gemini/Claude選択可能）
- 学習記録自動蓄積 → アクティブリコール

### 目的
技術書などのPDFをアップロードするだけで、AI家庭教師がマンツーマンで教えてくれる学習アプリ。対話を通じて理解を深め、間隔反復学習で確実に定着させる。

### ターゲットユーザー
- 最初：開発者本人（個人利用）
- 将来：公開サービスとして収益化

### 技術スタック
- **フロントエンド**: Next.js 14 (App Router) + TypeScript
- **スタイリング**: Tailwind CSS + shadcn/ui
- **状態管理**: Zustand
- **バックエンド**: Next.js API Routes
- **データベース**: Supabase (PostgreSQL + pgvector)
- **認証**: Supabase Auth
- **LLM API**: 
  - Google Gemini 2.0 Flash（推奨・コスパ最強）
  - Claude Haiku 4.5（高速・高品質）
  - Claude Sonnet 4（最高品質）
- **ストレージ**: Supabase Storage（PDF保存）
- **ホスティング**: Vercel
- **PWA**: next-pwa
- **グラフ**: Recharts
- **PDF処理**: Gemini Native PDF Processing

---

## 🎯 機能要件

### フェーズ1：コア機能（3週間）

#### 1.1 書籍登録システム（Week 1）⭐最重要

**PDF自動処理:**
- PDFファイルをドラッグ&ドロップでアップロード
- Gemini 2.0 FlashでPDFを直接処理
- 章・節構造を自動抽出
- テキスト内容を自動分割
- embeddings生成（セマンティック検索用）
- プレビュー画面で確認後、DB登録

**処理フロー:**
```
1. ユーザーがPDFアップロード
2. Supabase Storageに保存
3. Gemini APIでPDF処理
   - 目次抽出
   - 章・節に分割
   - 図表の位置を認識
   - 本文抽出
4. embeddings生成（OpenAI/Gemini）
5. データベースに保存
   - books
   - chapters
   - sections（+ vector）
6. プレビュー表示
7. ユーザー確認後、完了
```

**UI要件:**
- アップロードエリア（ドラッグ&ドロップ対応）
- 処理中のプログレスバー
- プレビュー画面（目次表示、編集可能）
- エラーハンドリング（ファイルサイズ上限、形式チェック）

**技術仕様:**
```typescript
interface BookData {
  title: string;
  author: string;
  totalPages: number;
  chapters: Chapter[];
}

interface Chapter {
  number: number;
  title: string;
  summary: string;
  sections: Section[];
}

interface Section {
  number: number;
  title: string;
  content: string;
  embedding?: number[];
  tokenCount: number;
  estimatedMinutes: number;
}
```

**Gemini APIプロンプト:**
```typescript
const BOOK_EXTRACTION_PROMPT = `この技術書を分析して、以下のJSON形式で出力してください。

要件:
- 書籍タイトルと著者を抽出
- 章と節の構造を正確に抽出
- 各節の本文全体を含める（ただし、目次・索引・奥付は除外）
- 図表は[図1.1: 説明文]のようにプレースホルダーで記載
- 表は[表1.1: タイトル]として記載し、可能なら内容も簡潔に
- コードブロックは\`\`\`言語\nコード\n\`\`\`形式で保持
- ページ番号、ヘッダー、フッターは除外
- 各節の読了時間を推定（分単位）

出力形式:
{
  "title": "書籍タイトル",
  "author": "著者名",
  "totalPages": ページ数,
  "chapters": [
    {
      "number": 1,
      "title": "章タイトル",
      "summary": "章の概要（2-3文）",
      "sections": [
        {
          "number": 1,
          "title": "節タイトル",
          "content": "節の本文全文...",
          "estimatedMinutes": 10
        }
      ]
    }
  ]
}

注意: JSONのみを出力し、説明文は不要です。`;
```

#### 1.2 AI家庭教師チャット機能（Week 2）⭐最重要

**基本機能:**
- リアルタイムチャット（ストリーミング対応）
- 学習セッション管理（開始・中断・再開）
- 複数LLM選択可能
- コンテキスト管理（過去10往復 + 関連セクション）
- 参照セクション表示

**学習フロー:**
```
1. ユーザー「第3章を学びたい」
2. システム：
   - learning_sessions作成
   - 第3章の全セクションを読み込み
   - システムプロンプト構築
3. AI「第3章では制御構造について学びます...」
4. 対話開始
   - 説明 → 質問 → 回答 → 理解度確認
5. 理解度チェック（3問5択）
6. 全問正解 → 次のトピック
   不正解 → 再説明 → 再度3問
7. セッション完了 → review_questions生成
```

**コンテキスト構築:**
```typescript
interface ChatContext {
  systemPrompt: string;
  bookContext: string; // 書籍の基本情報
  chapterContext: string; // 現在の章の概要
  relevantSections: Section[]; // 関連する節（3-5個）
  conversationHistory: Message[]; // 過去10往復
}

async function buildContext(
  sessionId: string,
  userMessage: string
): Promise<ChatContext> {
  // 1. セッション情報取得
  const session = await getSession(sessionId);
  
  // 2. セマンティック検索で関連セクション取得
  const relevantSections = await searchRelevantSections(
    userMessage,
    session.chapterId,
    5 // 上位5件
  );
  
  // 3. 過去の対話履歴取得
  const history = await getConversationHistory(sessionId, 10);
  
  // 4. システムプロンプト構築
  const systemPrompt = buildSystemPrompt(session, relevantSections);
  
  return {
    systemPrompt,
    bookContext: buildBookContext(session.book),
    chapterContext: buildChapterContext(session.chapter),
    relevantSections,
    conversationHistory: history,
  };
}
```

**システムプロンプト:**
```typescript
const TUTOR_SYSTEM_PROMPT = `あなたは優しくて丁寧な家庭教師AIです。

# 役割
ユーザーが提供した書籍について、詳しく説明し、理解度を確認しながら教えます。

# 重要な原則
- ユーザーは書籍を読まなくても、あなたとの対話だけで内容を完全に理解できるようにする
- 説明していない内容について質問してはいけない
- 説明した内容について、必ず3題の5択問題で理解度を確認
- 全問正解したら次の内容に進む
- 間違えた場合は、その部分を再説明してから再度質問

# 基本スタンス
- 丁寧に、詳しく説明する
- 具体例を豊富に使う
- 区切りごとに「ここまで大丈夫ですか？」と確認
- ユーザーのペースを尊重
- 小さな進歩も褒める

# 理解度確認
各トピックの説明後、必ず以下の形式で3題の5択問題を出してください：

Q1: [質問文]
1) [選択肢1]
2) [選択肢2]
3) [選択肢3]
4) [選択肢4]
5) [選択肢5]

# 現在学習中の書籍
書籍: {book.title}
著者: {book.author}
現在の章: 第{chapter.number}章 {chapter.title}

# 利用可能なセクション
{relevantSections.map(s => `- ${s.title}: ${s.content.substring(0, 200)}...`).join('\n')}

これらのセクションの内容を使って、ユーザーに教えてください。
セクションに書かれていない内容は推測せず、「この書籍では扱われていません」と正直に答えてください。`;
```

**UI要件:**
```
┌─────────────────────────────────────┐
│  ← 📚 Python入門 - 第3章            │
│     制御構造                        │
│  [設定⚙️] [履歴📋]                  │
├─────────────────────────────────────┤
│                                     │
│  🤖 Assistant                       │
│  第3章では制御構造について学びます。│
│  if文、ループ、例外処理などを扱います│
│  📎 参照: 3.1節                     │
│  [09:30]                            │
│                                     │
│  👤 You                             │
│  if文の使い方を教えてください       │
│  [09:31]                            │
│                                     │
│  🤖 Assistant                       │
│  if文は「もし〇〇なら△△をする」   │
│  という条件分岐です...              │
│  📎 参照: 3.1節, 3.2節              │
│  [09:32]                            │
│                                     │
│  ↓ スクロール可能                  │
│                                     │
├─────────────────────────────────────┤
│  💭 メッセージを入力...             │
│  [📎] [🎤]                  [送信→] │
└─────────────────────────────────────┘
```

**ストリーミング実装:**
```typescript
// app/api/chat/route.ts
export async function POST(req: Request) {
  const { sessionId, message } = await req.json();
  
  // コンテキスト構築
  const context = await buildContext(sessionId, message);
  
  // ストリーミングレスポンス
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      // LLMストリーミング呼び出し
      const response = await callLLMStreaming(context, message);
      
      for await (const chunk of response) {
        controller.enqueue(encoder.encode(chunk));
      }
      
      controller.close();
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
```

#### 1.3 セマンティック検索（Week 2）

**pgvector + OpenAI Embeddings:**

```sql
-- pgvector拡張を有効化
CREATE EXTENSION IF NOT EXISTS vector;

-- sectionsテーブルにvectorカラム追加済み
ALTER TABLE sections ADD COLUMN content_vector vector(1536);

-- ベクトル検索関数
CREATE OR REPLACE FUNCTION match_sections(
  query_embedding vector(1536),
  chapter_id uuid,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  section_number int,
  title text,
  content text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    sections.id,
    sections.section_number,
    sections.title,
    sections.content,
    1 - (sections.content_vector <=> query_embedding) AS similarity
  FROM sections
  WHERE sections.chapter_id = match_sections.chapter_id
    AND 1 - (sections.content_vector <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- インデックス作成（検索高速化）
CREATE INDEX ON sections 
  USING ivfflat (content_vector vector_cosine_ops)
  WITH (lists = 100);
```

**embeddings生成:**
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small', // $0.02 / 1M tokens
    input: text,
  });
  
  return response.data[0].embedding;
}

// セクション登録時に自動生成
async function createSection(sectionData: Section) {
  const embedding = await generateEmbedding(sectionData.content);
  
  await supabase.from('sections').insert({
    ...sectionData,
    content_vector: embedding,
  });
}
```

**セマンティック検索実装:**
```typescript
async function searchRelevantSections(
  query: string,
  chapterId: string,
  limit: number = 5
): Promise<Section[]> {
  // 1. クエリをembedding化
  const queryEmbedding = await generateEmbedding(query);
  
  // 2. ベクトル検索
  const { data } = await supabase.rpc('match_sections', {
    query_embedding: queryEmbedding,
    chapter_id: chapterId,
    match_threshold: 0.7,
    match_count: limit,
  });
  
  return data;
}
```

#### 1.4 理解度チェック＆復習機能（Week 3）

**自動問題生成:**
```typescript
async function generateQuizQuestions(
  sessionId: string,
  topic: string,
  content: string
): Promise<QuizQuestion[]> {
  const prompt = `以下の内容について、理解度を確認する3問の5択問題を作成してください。

内容:
${content}

要件:
- 3問の5択問題
- 難易度は中程度
- 正解は1つのみ
- 選択肢は紛らわしいものを含める

出力形式（JSON）:
[
  {
    "question": "質問文",
    "options": ["選択肢1", "選択肢2", "選択肢3", "選択肢4", "選択肢5"],
    "correctAnswer": 2,
    "explanation": "解説"
  }
]`;

  const response = await callLLM(prompt);
  return JSON.parse(response);
}
```

**SM-2アルゴリズム実装:**
```typescript
interface ReviewCalculation {
  nextReviewDate: Date;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
}

function calculateNextReview(
  currentInterval: number,
  currentEaseFactor: number,
  currentRepetitions: number,
  rating: number // 1-5
): ReviewCalculation {
  let easeFactor = currentEaseFactor;
  let interval = currentInterval;
  let repetitions = currentRepetitions;
  
  // rating < 3: 間隔リセット
  if (rating < 3) {
    interval = 1;
    repetitions = 0;
  } else {
    // EF' = EF + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))
    easeFactor = Math.max(
      1.3,
      easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))
    );
    
    repetitions += 1;
    
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
  }
  
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);
  
  return {
    nextReviewDate,
    intervalDays: interval,
    easeFactor,
    repetitions,
  };
}
```

**復習セッション:**
```typescript
async function getTodayReviews(userId: string) {
  const today = new Date().toISOString().split('T')[0];
  
  // 今日が復習日の質問を取得
  const { data } = await supabase
    .from('review_history')
    .select(`
      *,
      question:review_questions(*)
    `)
    .eq('user_id', userId)
    .lte('next_review_date', today)
    .order('next_review_date', { ascending: true });
  
  return data;
}

async function recordReview(
  questionId: string,
  userId: string,
  rating: number
) {
  // 最新の復習履歴取得
  const { data: latest } = await supabase
    .from('review_history')
    .select('*')
    .eq('question_id', questionId)
    .order('reviewed_at', { ascending: false })
    .limit(1)
    .single();
  
  // 次回復習日計算
  const next = calculateNextReview(
    latest?.interval_days || 0,
    latest?.ease_factor || 2.5,
    latest?.repetitions || 0,
    rating
  );
  
  // 新しい履歴レコード作成
  await supabase.from('review_history').insert({
    user_id: userId,
    question_id: questionId,
    self_rating: rating,
    next_review_date: next.nextReviewDate,
    interval_days: next.intervalDays,
    ease_factor: next.easeFactor,
    repetitions: next.repetitions,
  });
}
```

---

### フェーズ2：体験向上（2週間）

#### 2.1 複数LLMプロバイダー対応

**プロバイダー抽象化:**
```typescript
// lib/llm/types.ts
export interface LLMProvider {
  name: string;
  generateStream(messages: Message[]): AsyncGenerator<string>;
  generateText(messages: Message[]): Promise<string>;
  estimateCost(inputTokens: number, outputTokens: number): number;
}

// lib/llm/gemini.ts
export class GeminiProvider implements LLMProvider {
  name = 'Gemini 2.0 Flash';
  
  async *generateStream(messages: Message[]) {
    const result = await gemini.generateContentStream(messages);
    
    for await (const chunk of result.stream) {
      yield chunk.text();
    }
  }
  
  async generateText(messages: Message[]) {
    const result = await gemini.generateContent(messages);
    return result.response.text();
  }
  
  estimateCost(inputTokens: number, outputTokens: number) {
    return (inputTokens * 0.075 + outputTokens * 0.30) / 1_000_000;
  }
}

// lib/llm/claude.ts
export class ClaudeProvider implements LLMProvider {
  constructor(private model: 'haiku' | 'sonnet') {}
  
  name = this.model === 'haiku' ? 'Claude Haiku 4.5' : 'Claude Sonnet 4';
  
  async *generateStream(messages: Message[]) {
    const stream = await anthropic.messages.stream({
      model: this.model === 'haiku' 
        ? 'claude-haiku-4-5-20251001'
        : 'claude-sonnet-4-20250514',
      messages,
      max_tokens: 4096,
    });
    
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta') {
        yield chunk.delta.text;
      }
    }
  }
  
  async generateText(messages: Message[]) {
    const result = await anthropic.messages.create({
      model: this.model === 'haiku'
        ? 'claude-haiku-4-5-20251001'
        : 'claude-sonnet-4-20250514',
      messages,
      max_tokens: 4096,
    });
    
    return result.content[0].text;
  }
  
  estimateCost(inputTokens: number, outputTokens: number) {
    const pricing = this.model === 'haiku'
      ? { input: 0.80, output: 4.00 }
      : { input: 3.00, output: 15.00 };
    
    return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  }
}

// lib/llm/factory.ts
export function createLLMProvider(provider: string): LLMProvider {
  switch (provider) {
    case 'gemini-flash':
      return new GeminiProvider();
    case 'claude-haiku':
      return new ClaudeProvider('haiku');
    case 'claude-sonnet':
      return new ClaudeProvider('sonnet');
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
```

**ユーザー設定:**
```typescript
// ユーザーごとにLLM選択を保存
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id),
  preferred_llm TEXT DEFAULT 'gemini-flash',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2.2 学習統計ダッシュボード

**表示内容:**
- 学習時間の推移（折れ線グラフ）
- 章ごとの進捗（プログレスバー）
- 復習完了率（円グラフ）
- 学習ストリーク（連続学習日数）
- 今週/今月の統計

**実装例:**
```typescript
// app/dashboard/page.tsx
export default async function Dashboard() {
  const stats = await getStudyStats();
  
  return (
    <div className="grid gap-6">
      {/* 今週の統計 */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="今週の学習時間"
          value={`${stats.weeklyMinutes}分`}
          icon={Clock}
        />
        <StatCard
          title="復習完了"
          value={`${stats.reviewsCompleted}/${stats.reviewsTotal}`}
          icon={CheckCircle}
        />
        <StatCard
          title="学習ストリーク"
          value={`${stats.streakDays}日`}
          icon={Flame}
        />
        <StatCard
          title="理解度平均"
          value={`${stats.avgUnderstanding}/5`}
          icon={TrendingUp}
        />
      </div>
      
      {/* 学習時間の推移 */}
      <Card>
        <CardHeader>
          <CardTitle>学習時間の推移</CardTitle>
        </CardHeader>
        <CardContent>
          <StudyTimeChart data={stats.dailyMinutes} />
        </CardContent>
      </Card>
      
      {/* 章ごとの進捗 */}
      <Card>
        <CardHeader>
          <CardTitle>書籍の進捗</CardTitle>
        </CardHeader>
        <CardContent>
          <ChapterProgressList books={stats.books} />
        </CardContent>
      </Card>
    </div>
  );
}
```

#### 2.3 セッション履歴・再開機能

**セッション一覧:**
```typescript
async function getUserSessions(userId: string) {
  const { data } = await supabase
    .from('learning_sessions')
    .select(`
      *,
      book:books(*),
      chapter:chapters(*),
      message_count:chat_messages(count)
    `)
    .eq('user_id', userId)
    .order('started_at', { ascending: false });
  
  return data;
}
```

**セッション再開:**
```typescript
async function resumeSession(sessionId: string) {
  // セッションのステータスを更新
  await supabase
    .from('learning_sessions')
    .update({ status: 'active' })
    .eq('id', sessionId);
  
  // 過去の対話履歴を読み込み
  const messages = await getConversationHistory(sessionId);
  
  return { sessionId, messages };
}
```

---

### フェーズ3：高度化（2週間）

#### 3.1 マルチブック学習

**複数書籍の並行学習:**
- ダッシュボードで書籍を切り替え
- 各書籍ごとに独立したセッション
- 横断的な統計表示

#### 3.2 書籍共有機能（オプション）

**パブリック書籍:**
- 他ユーザーが登録した書籍を検索
- 閲覧権限管理
- 自分の書籍を公開設定

#### 3.3 学習グループ（将来的）

**コミュニティ機能:**
- 同じ書籍を学習する仲間
- 学習記録の共有
- ディスカッション

---

## 📊 データモデル（更新版）

### ERD概要

```
user_profiles (認証)
  ↓
  ├─ books (書籍)
  │   ├─ chapters (章)
  │   │   └─ sections (節 + vector)
  │   └─ learning_sessions (学習セッション)
  │       ├─ chat_messages (対話)
  │       └─ review_questions (復習問題)
  │           └─ review_history (復習履歴)
  │
  └─ user_settings (設定)
```

### テーブル定義

```sql
-- ユーザープロファイル
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ユーザー設定
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  preferred_llm TEXT DEFAULT 'gemini-flash' CHECK (
    preferred_llm IN ('gemini-flash', 'claude-haiku', 'claude-sonnet')
  ),
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 書籍マスター
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  total_pages INTEGER,
  total_chapters INTEGER,
  pdf_url TEXT,
  pdf_hash TEXT UNIQUE,
  processing_status TEXT DEFAULT 'pending' CHECK (
    processing_status IN ('pending', 'processing', 'completed', 'failed')
  ),
  processing_error TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 章
CREATE TABLE chapters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  chapter_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(book_id, chapter_number)
);

-- 節（セクション）
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE NOT NULL,
  section_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_vector vector(1536),
  token_count INTEGER,
  estimated_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chapter_id, section_number)
);

-- 学習セッション
CREATE TABLE learning_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES chapters(id),
  llm_provider TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  current_topic TEXT,
  understanding_level INTEGER CHECK (understanding_level BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 対話メッセージ
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES learning_sessions(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  sections_used UUID[],
  token_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 復習用質問
CREATE TABLE review_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES learning_sessions(id) ON DELETE SET NULL,
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options TEXT[] NOT NULL,
  correct_answer INTEGER NOT NULL,
  explanation TEXT,
  difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 復習履歴
CREATE TABLE review_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES review_questions(id) ON DELETE CASCADE NOT NULL,
  reviewed_at TIMESTAMPTZ DEFAULT NOW(),
  self_rating INTEGER CHECK (self_rating BETWEEN 1 AND 5) NOT NULL,
  next_review_date DATE NOT NULL,
  interval_days INTEGER NOT NULL,
  ease_factor FLOAT NOT NULL,
  repetitions INTEGER DEFAULT 0
);

-- インデックス
CREATE INDEX idx_books_user_id ON books(user_id);
CREATE INDEX idx_books_processing_status ON books(processing_status);
CREATE INDEX idx_chapters_book_id ON chapters(book_id);
CREATE INDEX idx_sections_chapter_id ON sections(chapter_id);
CREATE INDEX idx_sections_vector ON sections 
  USING ivfflat (content_vector vector_cosine_ops)
  WITH (lists = 100);
CREATE INDEX idx_sessions_user_id ON learning_sessions(user_id);
CREATE INDEX idx_sessions_book_id ON learning_sessions(book_id);
CREATE INDEX idx_sessions_status ON learning_sessions(status);
CREATE INDEX idx_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_questions_user_id ON review_questions(user_id);
CREATE INDEX idx_questions_book_id ON review_questions(book_id);
CREATE INDEX idx_review_history_user_id ON review_history(user_id);
CREATE INDEX idx_review_history_next_review ON review_history(next_review_date);

-- RLS（Row Level Security）
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_history ENABLE ROW LEVEL SECURITY;

-- RLSポリシー（各テーブル共通：自分のデータのみアクセス可能）
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own settings" ON user_settings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own books" ON books
  FOR SELECT USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can manage own books" ON books
  FOR ALL USING (auth.uid() = user_id);

-- chapters, sections: 書籍の所有者のみアクセス可能
CREATE POLICY "Users can view chapters of own books" ON chapters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM books 
      WHERE books.id = chapters.book_id 
      AND (books.user_id = auth.uid() OR books.is_public = true)
    )
  );

CREATE POLICY "Users can view sections of own books" ON sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chapters
      JOIN books ON books.id = chapters.book_id
      WHERE chapters.id = sections.chapter_id
      AND (books.user_id = auth.uid() OR books.is_public = true)
    )
  );

-- sessions, messages: 自分のセッションのみ
CREATE POLICY "Users can manage own sessions" ON learning_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own messages" ON chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM learning_sessions
      WHERE learning_sessions.id = chat_messages.session_id
      AND learning_sessions.user_id = auth.uid()
    )
  );

-- reviews: 自分の復習データのみ
CREATE POLICY "Users can manage own questions" ON review_questions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own review history" ON review_history
  FOR ALL USING (auth.uid() = user_id);
```

---

## 💰 コスト試算

### LLM APIコスト

#### Gemini 2.0 Flash（推奨）

**料金:**
- 入力: $0.075 / 1M tokens
- 出力: $0.30 / 1M tokens

**1セッション（40分、15往復）:**
- 書籍コンテンツ: 10,000 tokens × 15 = 150k tokens
- ユーザー入力: 100 tokens × 15 = 1.5k tokens
- AI出力: 300 tokens × 15 = 4.5k tokens

**コスト:**
- 入力: 151.5k × $0.075 / 1M = $0.011
- 出力: 4.5k × $0.30 / 1M = $0.001
- **合計: $0.012（約1.8円）**

**月間コスト（30セッション）: 約54円**

#### Claude Haiku 4.5

**料金:**
- 入力: $0.80 / 1M tokens
- 出力: $4.00 / 1M tokens

**1セッション:**
- 入力: 151.5k × $0.80 / 1M = $0.121
- 出力: 4.5k × $4.00 / 1M = $0.018
- **合計: $0.139（約21円）**

**月間コスト（30セッション）: 約630円**

#### Claude Sonnet 4

**料金:**
- 入力: $3.00 / 1M tokens
- 出力: $15.00 / 1M tokens

**1セッション:**
- 入力: 151.5k × $3.00 / 1M = $0.455
- 出力: 4.5k × $15.00 / 1M = $0.068
- **合計: $0.523（約78円）**

**月間コスト（30セッション）: 約2,340円**

### Embeddings生成コスト

**OpenAI text-embedding-3-small:**
- $0.02 / 1M tokens

**200ページの書籍（500セクション）:**
- 各セクション平均500トークン
- 合計: 500 × 500 = 250k tokens
- コスト: $0.005（約0.75円）

**書籍10冊: 約7.5円**

### 合計コスト試算

**個人利用（月30セッション、書籍10冊）:**
- Gemini Flash: 54円 + 7.5円 = **約62円/月**
- Claude Haiku: 630円 + 7.5円 = **約638円/月**
- Claude Sonnet: 2,340円 + 7.5円 = **約2,348円/月**

**公開サービス（100ユーザー、月3,000セッション）:**
- Gemini Flash: **約6,200円/月**
- Claude Haiku: **約63,800円/月**

**→ Geminiが圧倒的にコスパ良い！**

---

## 🎨 UI/UX設計

### 画面一覧

#### 1. 認証画面

**ログイン（/login）:**
```
┌─────────────────────────────────────┐
│                                     │
│         📚 Learning Assistant       │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  Email                              │
│  [____________________________]     │
│                                     │
│  Password                           │
│  [____________________________]     │
│                                     │
│  □ ログイン状態を保持               │
│                                     │
│         [ログイン]                  │
│                                     │
│  アカウントをお持ちでない方          │
│  [新規登録はこちら]                 │
│                                     │
└─────────────────────────────────────┘
```

#### 2. ダッシュボード（/dashboard）

```
┌─────────────────────────────────────┐
│  ☰ Learning Assistant      👤 [User]│
├─────────────────────────────────────┤
│                                     │
│  今日のタスク                       │
│  ┌───────────────────────────────┐ │
│  │ 📝 復習 5問                   │ │
│  │ 📚 第3章の続きを学ぶ          │ │
│  └───────────────────────────────┘ │
│                                     │
│  統計サマリー                       │
│  ┌──────┐ ┌──────┐ ┌──────┐     │
│  │ 120分│ │ 5/5  │ │ 7日  │     │
│  │ 今週 │ │ 復習 │ │ 継続 │     │
│  └──────┘ └──────┘ └──────┘     │
│                                     │
│  マイブック                         │
│  ┌───────────────────────────────┐ │
│  │ 📘 Python入門                 │ │
│  │ ▓▓▓▓▓░░░░░ 50% (5/10章)     │ │
│  │ 最終学習: 2時間前             │ │
│  └───────────────────────────────┘ │
│  ┌───────────────────────────────┐ │
│  │ 📗 機械学習の基礎             │ │
│  │ ▓▓░░░░░░░░ 20% (2/10章)     │ │
│  │ 最終学習: 昨日                │ │
│  └───────────────────────────────┘ │
│                                     │
│  [+ 新しい書籍を追加]               │
│                                     │
└─────────────────────────────────────┘
```

#### 3. 書籍登録（/books/new）

```
┌─────────────────────────────────────┐
│  ← 新しい書籍を登録                 │
├─────────────────────────────────────┤
│                                     │
│  PDFファイルをアップロード          │
│  ┌───────────────────────────────┐ │
│  │                               │ │
│  │   📄 PDFをドロップ            │ │
│  │      または                   │ │
│  │   クリックして選択            │ │
│  │                               │ │
│  │   対応: PDF（100MB以下）      │ │
│  │                               │ │
│  └───────────────────────────────┘ │
│                                     │
│  処理設定                           │
│  LLMモデル                          │
│  ◉ Gemini Flash（推奨・コスパ）    │
│  ○ Claude Haiku（高速・高品質）    │
│  ○ Claude Sonnet（最高品質）       │
│                                     │
│  □ セマンティック検索を有効化       │
│    （推奨：より関連性の高い説明）   │
│                                     │
│           [アップロード]            │
│                                     │
└─────────────────────────────────────┘
```

#### 4. 処理中画面

```
┌─────────────────────────────────────┐
│  PDFを処理しています...             │
├─────────────────────────────────────┤
│                                     │
│  📖 Python入門.pdf                  │
│  250ページ                          │
│                                     │
│  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░ 75%            │
│                                     │
│  ✓ PDFアップロード完了              │
│  ✓ テキスト抽出完了                 │
│  ✓ 章構造の分析完了                 │
│  ✓ 節への分割完了（50セクション）   │
│  ⏳ embeddings生成中... (38/50)    │
│                                     │
│  推定残り時間: 約30秒               │
│                                     │
│  ※ 処理中は画面を閉じないでください │
│                                     │
└─────────────────────────────────────┘
```

#### 5. プレビュー画面

```
┌─────────────────────────────────────┐
│  ← 書籍情報を確認    [編集] [登録] │
├─────────────────────────────────────┤
│                                     │
│  📚 Python入門                      │
│  著者: 山田太郎                     │
│  全250ページ / 10章 / 50セクション  │
│                                     │
│  📑 目次                             │
│  ▼ 第1章 Pythonの基礎 (5節)        │
│    1.1 Pythonとは（10分）           │
│    1.2 インストール（15分）         │
│    1.3 対話モード（8分）            │
│    1.4 スクリプト実行（12分）       │
│    1.5 エラー対処（10分）           │
│                                     │
│  ▼ 第2章 変数とデータ型 (6節)      │
│    2.1 変数の宣言（10分）           │
│    2.2 数値型（12分）               │
│    ...                              │
│                                     │
│  ▼ 第3章 制御構造 (5節)            │
│    3.1 if文（15分）                │
│    ...                              │
│                                     │
│  [セクション内容を確認]             │
│                                     │
└─────────────────────────────────────┘
```

#### 6. チャット画面（/books/[id]/chat）

```
┌─────────────────────────────────────┐
│  ← 📚 Python入門 - 第3章            │
│     制御構造                        │
│  [⚙️設定] [📋履歴] [📊統計]         │
├─────────────────────────────────────┤
│                                     │
│  🤖 AI家庭教師                      │
│  第3章では制御構造について学びます。│
│  if文、ループ、例外処理などを扱います│
│  準備はできていますか？             │
│  📎 参照: 3.0節（章の概要）         │
│  [09:30]                            │
│                                     │
│  👤 You                             │
│  はい、お願いします                 │
│  [09:30]                            │
│                                     │
│  🤖 AI家庭教師                      │
│  では、まずif文から始めましょう。   │
│  if文は「もし〇〇なら△△をする」   │
│  という条件分岐の仕組みです。       │
│                                     │
│  基本的な構文：                     │
│  ```python                          │
│  if 条件:                           │
│      処理                           │
│  ```                                │
│  ...（続く）                        │
│  📎 参照: 3.1節, 3.2節              │
│  [09:31]                            │
│                                     │
│  ↓ スクロール                      │
│                                     │
├─────────────────────────────────────┤
│  💭 メッセージを入力...             │
│  [📎] [🎤]                  [送信→] │
└─────────────────────────────────────┘
```

#### 7. 復習画面（/review）

```
┌─────────────────────────────────────┐
│  ← 今日の復習                       │
├─────────────────────────────────────┤
│                                     │
│  📝 進捗: 3/5問完了                 │
│  ▓▓▓▓▓▓░░░░ 60%                   │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  Q4: if-elif-else文で条件を書く順序│
│  はなぜ重要ですか？                 │
│                                     │
│  [💭 考え中...]                     │
│                                     │
│           [答えを見る]              │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  📚 Python入門 - 第3章              │
│  難易度: ★★★☆☆                   │
│  前回: 7日前（理解度: 4/5）         │
│                                     │
└─────────────────────────────────────┘

（答えを見た後）

┌─────────────────────────────────────┐
│  ← 今日の復習                       │
├─────────────────────────────────────┤
│                                     │
│  📝 進捗: 3/5問完了                 │
│  ▓▓▓▓▓▓░░░░ 60%                   │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  Q4: if-elif-else文で条件を書く順序│
│  はなぜ重要ですか？                 │
│                                     │
│  💡 答え:                           │
│  上から順に評価され、最初にTrueに  │
│  なった条件のブロックだけが実行され │
│  るため。条件の順序を間違えると意図 │
│  しない動作になる。                 │
│                                     │
│  📖 解説:                           │
│  if-elif-else文は排他的な条件分岐  │
│  です。一度Trueになった条件が実行  │
│  されると...（続く）                │
│                                     │
│  理解度を評価してください:          │
│  [1] [2] [3] [4] [5]               │
│  全く   少し  まあ  よく  完璧      │
│                                     │
└─────────────────────────────────────┘
```

#### 8. 統計画面（/stats）

```
┌─────────────────────────────────────┐
│  ← 学習統計                         │
├─────────────────────────────────────┤
│                                     │
│  📊 今週の学習                      │
│  ┌───────────────────────────────┐ │
│  │         学習時間の推移         │ │
│  │  120├─────────────────────────│ │
│  │   90│     ╱╲    ╱╲           │ │
│  │   60│   ╱    ╲╱    ╲         │ │
│  │   30│ ╱              ╲       │ │
│  │    0└───────────────────────  │ │
│  │     月 火 水 木 金 土 日       │ │
│  └───────────────────────────────┘ │
│                                     │
│  📚 書籍別進捗                      │
│  Python入門                         │
│  ▓▓▓▓▓░░░░░ 50% (5/10章)          │
│  機械学習の基礎                     │
│  ▓▓░░░░░░░░ 20% (2/10章)          │
│                                     │
│  🎯 復習完了率                      │
│  ┌─────────────┐                  │
│  │     85%     │                  │
│  │   ▓▓▓▓▓     │ 17/20問          │
│  │   ░░░░░     │                  │
│  └─────────────┘                  │
│                                     │
│  🔥 学習ストリーク                  │
│  ■■■■■■■ 7日連続！               │
│  最長記録: 14日                     │
│                                     │
└─────────────────────────────────────┘
```

---

## 🔐 セキュリティ要件

### 認証

**Supabase Auth:**
- メールアドレス + パスワード
- マジックリンク（パスワードレス）
- Google OAuth（将来的に）

### Row Level Security (RLS)

**ポリシー原則:**
- ユーザーは自分のデータのみアクセス可能
- 公開設定された書籍は誰でも閲覧可能
- 他ユーザーのデータは閲覧・編集不可

### API保護

**認証チェック:**
```typescript
// middleware.ts
export async function middleware(req: NextRequest) {
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  
  return NextResponse.next();
}
```

### 環境変数管理

**必須環境変数:**
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=  # サーバーサイドのみ

# LLM API
GOOGLE_AI_API_KEY=
ANTHROPIC_API_KEY=

# OpenAI（embeddings）
OPENAI_API_KEY=

# アプリURL
NEXT_PUBLIC_APP_URL=
```

**重要:**
- `NEXT_PUBLIC_`で始まる変数のみクライアント公開
- APIキーは絶対に公開しない
- `.env.local`は`.gitignore`に追加

---

## 🚀 デプロイメント

### Vercel設定

**環境変数（Vercel Dashboard）:**
1. Settings → Environment Variables
2. すべての必須環境変数を追加
3. Production / Preview / Development で分ける

**ビルド設定:**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install"
}
```

### Supabase Storage設定

**PDFストレージバケット作成:**
```sql
-- Storage bucketを作成
INSERT INTO storage.buckets (id, name, public)
VALUES ('book-pdfs', 'book-pdfs', false);

-- RLSポリシー（自分のPDFのみアクセス可能）
CREATE POLICY "Users can upload own PDFs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'book-pdfs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own PDFs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'book-pdfs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

**PDFアップロード:**
```typescript
async function uploadPDF(file: File, userId: string) {
  const fileName = `${userId}/${Date.now()}_${file.name}`;
  
  const { data, error } = await supabase.storage
    .from('book-pdfs')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });
  
  if (error) throw error;
  
  // 公開URLを取得
  const { data: { publicUrl } } = supabase.storage
    .from('book-pdfs')
    .getPublicUrl(fileName);
  
  return publicUrl;
}
```

---

## 📦 開発フェーズ

### Week 1-2: 書籍登録システム

**タスク:**
- [ ] Supabase Storage設定
- [ ] PDF アップロード機能
- [ ] Gemini PDF Processing実装
- [ ] データベース登録
- [ ] プレビュー画面
- [ ] エラーハンドリング

**成果物:**
- PDFをアップロードして書籍登録できる

### Week 3-4: チャット機能

**タスク:**
- [ ] LLMプロバイダー抽象化
- [ ] チャットUI実装
- [ ] ストリーミング対応
- [ ] セッション管理
- [ ] コンテキスト構築

**成果物:**
- AI家庭教師と対話できる

### Week 5: セマンティック検索

**タスク:**
- [ ] pgvector設定
- [ ] embeddings生成
- [ ] ベクトル検索実装
- [ ] チャットと統合

**成果物:**
- 関連セクションを自動取得

### Week 6: 復習機能

**タスク:**
- [ ] 理解度チェック（3問5択）
- [ ] SM-2アルゴリズム実装
- [ ] 復習画面
- [ ] 通知機能

**成果物:**
- アクティブリコールが動く

### Week 7-8: 統計・UI改善

**タスク:**
- [ ] ダッシュボード
- [ ] 統計グラフ
- [ ] セッション履歴
- [ ] パフォーマンス最適化

**成果物:**
- MVP完成 🎉

---

## 🎯 成功指標（KPI）

### 個人利用フェーズ
- [ ] 書籍10冊登録
- [ ] 毎日復習を実施（復習完了率 > 80%）
- [ ] 学習継続日数 > 30日
- [ ] 理解度平均 > 4/5

### 公開フェーズ
- [ ] ユーザー登録数 > 100
- [ ] アクティブユーザー（DAU/MAU比率 > 30%）
- [ ] 復習完了率 > 70%
- [ ] 継続率（7日後 > 40%、30日後 > 20%）
- [ ] NPS > 50

---

## 📝 備考

### 既存システムとの関係

**旧システム（GitHub Actions + JSON）:**
- 移行期間中は併用可能
- 最終的に廃止予定

### 将来の拡張性

**収益化:**
- Stripe統合（サブスクリプション）
- 無料プラン：1書籍まで
- 有料プラン：無制限 + 高度な分析

**機械学習:**
- 学習スタイル分析
- 最適な復習タイミング予測
- 苦手分野の自動検出

**SNS機能:**
- 学習記録の共有
- コミュニティ
- ランキング

---

このSPEC_v2.mdを元に開発を進めてください。不明点があれば随時更新します。
