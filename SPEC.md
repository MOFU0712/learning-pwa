# 学習補助PWAアプリ 開発仕様書（SPEC.md）

## 📋 プロジェクト概要

### アプリ名
Learning Assistant PWA（仮）

### 目的
AIチャット（Gemini/Claude/ChatGPT）で生成した学習記録JSONを取り込み、アクティブリコール（間隔反復学習）を中心とした効果的な復習システムを提供するPWAアプリ。

### ターゲットユーザー
- 最初：開発者本人（個人利用）
- 将来：公開サービスとして収益化（知人から開始）

### 技術スタック
- **フロントエンド**: Next.js 14 (App Router) + TypeScript
- **スタイリング**: Tailwind CSS + shadcn/ui
- **状態管理**: Zustand
- **バックエンド**: Next.js API Routes
- **データベース**: Supabase (PostgreSQL)
- **認証**: Supabase Auth
- **ホスティング**: Vercel
- **PWA**: next-pwa
- **グラフ**: Recharts

—

## 🎯 機能要件

### フェーズ1：最優先（アクティブリコール）

#### 1.1 復習セッション画面（最重要）

**画面仕様:**
- 今日復習すべき質問を一覧表示
- カード形式で1問ずつ表示
- 自分で答えを考える → 「答えを見る」ボタン → 答え・解説を表示
- 自己評価（5段階）
  - 1: 全く覚えていない
  - 2: 少し覚えている
  - 3: まあまあ覚えている
  - 4: よく覚えている
  - 5: 完璧に覚えている
- 評価に基づいて次回復習日を自動計算（SM-2アルゴリズム）

**操作フロー:**
```
1. 復習画面を開く
2. 今日の復習項目を表示（例：「5問」）
3. 問題カードを表示
4. 自分で答えを考える
5. 「答えを見る」ボタンをタップ
6. 答え・解説を表示
7. 自己評価（1-5）を選択
8. 次の問題へ
9. すべて完了したら「お疲れ様でした！」
```

**データ取得:**
- `review_history`テーブルから`next_review_date`が今日以前の質問を取得
- 復習していない質問は`interval_days = 1`（翌日復習）として初期化

#### 1.2 復習履歴の記録

**記録内容:**
- 復習日時
- 質問ID
- 自己評価（1-5）
- 次回復習日（SM-2で計算）
- 繰り返し回数

#### 1.3 復習通知

**PWA通知:**
- 毎朝8時に復習リマインダー
- 「今日は5問の復習があります」

**メール通知（既存システム併用）:**
- 既存のGitHub Actions + SendGridを併用
- 将来的にアプリ内メール機能に移行

#### 1.4 SM-2アルゴリズムの実装

**間隔反復学習:**
- 自己評価に基づいて次回復習日を計算
- 繰り返すごとに間隔を延ばす
- 忘れた問題は間隔をリセット

**アルゴリズム仕様:**
```typescript
interface ReviewResult {
  questionId: string;
  rating: number; // 1-5
  currentInterval: number; // 現在の間隔（日数）
  currentEaseFactor: number; // 現在の容易さ係数
  repetitions: number; // 繰り返し回数
}

interface NextReview {
  nextReviewDate: Date;
  interval: number; // 次回の間隔（日数）
  easeFactor: number; // 次回の容易さ係数
  repetitions: number; // 更新後の繰り返し回数
}

function calculateNextReview(result: ReviewResult): NextReview {
  // SM-2アルゴリズムに基づいて計算
  // rating < 3 の場合は間隔をリセット
  // rating >= 3 の場合は間隔を延ばす
}
```

**具体的な間隔例:**
- rating 5: 1日 → 6日 → 14日 → 30日 → 90日 → 180日
- rating 4: 1日 → 4日 → 10日 → 21日 → 60日 → 120日
- rating 3: 1日 → 3日 → 7日 → 14日 → 30日 → 60日
- rating 1-2: 1日にリセット

—

### フェーズ2：次に実装（可視化）

#### 2.1 学習統計ダッシュボード

**表示内容:**
- 学習時間の推移（折れ線グラフ）
- 章ごとの進捗（プログレスバー）
- 理解度の推移（折れ線グラフ）
- 今週/今月の学習時間（数値）
- 復習完了率（円グラフ）
- 学習ストリーク（連続学習日数）

**グラフライブラリ:**
- Recharts（Next.jsとの相性が良い）

#### 2.2 フラッシュカード表示

**画面仕様:**
- 質問カードをスワイプで次へ
- 表：質問
- 裏：答え・解説
- 「理解した」「まだ不安」ボタン

#### 2.3 苦手な概念の可視化

**表示内容:**
- 理解度が低い概念をリスト表示
- 関連する質問へのリンク
- 復習頻度の高い質問

—

### フェーズ3：後で実装（スケジューリング）

#### 3.1 学習スケジュール管理

**手動登録:**
- 学習予定を登録
- カレンダー表示
- 通知設定

**自動登録（JSONから）:**
- `next_session_focus`フィールドから次回の学習内容を提案
- ワンタップで登録

#### 3.2 JSON一括取り込み

**既存データの移行:**
- GitHub上の既存JSONファイルを一括取り込み
- `books/*/logs/*.json`を自動読み込み
- プロジェクト、セッション、質問を一括登録

—

## 📊 データモデル

### テーブル構造

#### user_profiles
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### projects
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id) NOT NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  total_chapters INTEGER,
  current_chapter INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);
```

#### learning_sessions
```sql
CREATE TABLE learning_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id) NOT NULL,
  project_id UUID REFERENCES projects(id) NOT NULL,
  date DATE NOT NULL,
  chapter INTEGER,
  chapter_title TEXT,
  topic TEXT,
  duration_minutes INTEGER,
  understanding_level INTEGER,
  key_concepts TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB
);
```

#### review_questions
```sql
CREATE TABLE review_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id) NOT NULL,
  session_id UUID REFERENCES learning_sessions(id),
  project_id UUID REFERENCES projects(id) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  explanation TEXT,
  why_important TEXT,
  difficulty_level INTEGER,
  related_concepts TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### review_history
```sql
CREATE TABLE review_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id) NOT NULL,
  question_id UUID REFERENCES review_questions(id) NOT NULL,
  reviewed_at TIMESTAMPTZ DEFAULT NOW(),
  self_rating INTEGER CHECK (self_rating BETWEEN 1 AND 5),
  next_review_date DATE NOT NULL,
  interval_days INTEGER NOT NULL,
  ease_factor FLOAT NOT NULL,
  repetitions INTEGER DEFAULT 0
);
```

### JSONインポート仕様

**入力JSON形式（学習記録）:**
```json
{
  "date": "2025-10-25",
  "project": "python-basics",
  "chapter": 3,
  "chapter_title": "制御構造",
  "topic": "if文と条件分岐",
  "duration_minutes": 40,
  "understanding_level": 4,
  "key_concepts": [
    "if-elif-else文の構造",
    "比較演算子",
    "論理演算子"
  ],
  "review_questions": [
    {
      "question": "if-elif-else文で条件を書く順序はなぜ重要ですか？",
      "answer": "上から順に評価され、最初にTrueになった条件のブロックだけが実行されるため",
      "explanation": "...",
      "why_important": "...",
      "related_concepts": ["条件式の評価", "短絡評価"],
      "difficulty_level": 3
    }
  ]
}
```

**変換処理:**
1. プロジェクト名でprojectsテーブルを検索（なければ作成）
2. learning_sessionsに記録を追加
3. review_questionsに質問を追加
4. review_historyに初期レコードを追加（next_review_date = 翌日）

—

## 🎨 UI/UX要件

### デザインシステム

**カラーパレット:**
- Primary: Blue（学習・集中）
- Success: Green（達成・完了）
- Warning: Yellow（復習必要）
- Error: Red（苦手）
- Neutral: Gray（背景・テキスト）

**フォント:**
- 日本語: Noto Sans JP
- 英数字: Inter

**コンポーネントライブラリ:**
- shadcn/ui（Radix UI + Tailwind CSS）
- 必要なコンポーネント:
  - Button
  - Card
  - Dialog
  - Form
  - Input
  - Select
  - Progress
  - Tabs
  - Toast（通知）

### レスポンシブ対応

**ブレークポイント:**
- Mobile: 〜640px
- Tablet: 641px〜1024px
- Desktop: 1025px〜

**優先デバイス:**
- Mobile First（スマホ最優先）

### PWA要件

**manifest.json:**
```json
{
  "name": "Learning Assistant",
  "short_name": "Learning",
  "description": "AI-powered active recall learning app",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Service Worker:**
- オフライン対応
- 復習データのキャッシュ
- バックグラウンド同期

**通知:**
- 復習リマインダー（毎朝8時）
- プッシュ通知許可を求める

—

## 🔐 セキュリティ要件

### 認証

**Supabase Auth:**
- メールアドレス + パスワード
- マジックリンク（パスワードレス）
- Google OAuth（将来的に）

**セッション管理:**
- JWT（Supabase提供）
- リフレッシュトークン

### Row Level Security (RLS)

**ポリシー:**
- ユーザーは自分のデータのみアクセス可能
- 他ユーザーのデータは閲覧・編集不可

**実装例:**
```sql
CREATE POLICY "Users can view own projects" ON projects
  FOR ALL USING (auth.uid() = user_id);
```

### API保護

**認証チェック:**
- すべてのAPI RouteでSupabase JWTを検証
- 未認証ユーザーは401エラー

—

## 📱 画面一覧

### 認証画面

#### `/login`
- メールアドレス入力
- パスワード入力
- ログインボタン
- 「アカウントを作成」リンク
- 「パスワードを忘れた」リンク

#### `/signup`
- メールアドレス入力
- パスワード入力（8文字以上）
- パスワード確認入力
- 利用規約同意チェックボックス
- 登録ボタン
- 「ログインはこちら」リンク

### メイン画面

#### `/dashboard`（ダッシュボード）
- 今日の復習項目数
- 今週の学習時間
- 学習ストリーク
- 最近の学習記録
- クイックアクション
  - 復習を始める
  - 学習記録を追加
  - 新規プロジェクト作成

#### `/projects`（プロジェクト一覧）
- プロジェクトカード一覧
  - プロジェクト名
  - 進捗率
  - 最終学習日
- 「新規プロジェクト」ボタン
- 検索・フィルター

#### `/projects/[id]`（プロジェクト詳細）
- プロジェクト情報
- 章ごとの進捗
- 学習記録一覧
- 統計グラフ
- アクション
  - 学習記録を追加
  - 編集
  - 削除

#### `/projects/new`（新規プロジェクト）
- プロジェクト名入力
- 書籍タイトル入力
- 著者入力
- 全章数入力
- 作成ボタン

#### `/review`（復習セッション）⭐最重要
- 今日の復習項目数表示
- 進捗バー（例：「3/5問完了」）
- 問題カード
  - 問題文
  - 「答えを見る」ボタン
  - 答え・解説（トグル表示）
  - 自己評価ボタン（1-5）
  - 「次へ」ボタン
- 完了画面
  - 「お疲れ様でした！」
  - 今日の復習完了数
  - 次回復習予定
  - 「ダッシュボードに戻る」ボタン

#### `/sessions`（学習記録一覧）
- 学習記録カード一覧
  - 日付
  - プロジェクト名
  - 章・トピック
  - 学習時間
  - 理解度
- フィルター（プロジェクト別、日付範囲）
- 「JSONを取り込む」ボタン

#### `/sessions/new`（JSON取り込み）
- JSON入力エリア（テキストエリア）
- 「取り込む」ボタン
- プレビュー表示
- エラー表示

—

## 🔄 API仕様

### 認証API（Supabase提供）

#### POST `/auth/v1/signup`
- メールアドレス + パスワードで登録

#### POST `/auth/v1/token?grant_type=password`
- ログイン

#### POST `/auth/v1/logout`
- ログアウト

### カスタムAPI Routes

#### GET `/api/projects`
- ユーザーのプロジェクト一覧を取得

**レスポンス例:**
```json
[
  {
    "id": "uuid",
    "name": "python-basics",
    "title": "Python入門",
    "author": "山田太郎",
    "total_chapters": 10,
    "current_chapter": 3,
    "created_at": "2025-10-20T00:00:00Z"
  }
]
```

#### POST `/api/projects`
- 新規プロジェクト作成

**リクエストボディ:**
```json
{
  "name": "python-basics",
  "title": "Python入門",
  "author": "山田太郎",
  "total_chapters": 10
}
```

#### GET `/api/sessions?project_id=uuid`
- 学習記録一覧を取得

#### POST `/api/sessions`
- 学習記録を追加

**リクエストボディ:**
```json
{
  "project_id": "uuid",
  "date": "2025-10-25",
  "chapter": 3,
  "chapter_title": "制御構造",
  "topic": "if文と条件分岐",
  "duration_minutes": 40,
  "understanding_level": 4,
  "key_concepts": ["if文", "else文"],
  "review_questions": [...]
}
```

#### GET `/api/reviews/today`
- 今日の復習項目を取得

**レスポンス例:**
```json
{
  "count": 5,
  "questions": [
    {
      "id": "uuid",
      "question": "if-elif-else文で...",
      "answer": "...",
      "explanation": "...",
      "difficulty_level": 3,
      "last_review": {
        "reviewed_at": "2025-10-20T00:00:00Z",
        "self_rating": 3,
        "interval_days": 5
      }
    }
  ]
}
```

#### POST `/api/reviews`
- 復習結果を記録

**リクエストボディ:**
```json
{
  "question_id": "uuid",
  "self_rating": 4,
  "reviewed_at": "2025-10-25T10:30:00Z"
}
```

**レスポンス:**
```json
{
  "next_review_date": "2025-11-05",
  "interval_days": 11,
  "ease_factor": 2.5,
  "repetitions": 3
}
```

#### POST `/api/import`
- JSON一括取り込み

**リクエストボディ:**
```json
{
  "json": { ... }
}
```

—

## 🧪 テスト要件

### ユニットテスト

**テスト対象:**
- SM-2アルゴリズムロジック
- データ変換関数
- バリデーション

**ツール:**
- Vitest

### E2Eテスト（オプション）

**テスト対象:**
- ログイン → 復習セッション → 完了
- JSON取り込み → データ確認

**ツール:**
- Playwright

—

## 📦 デプロイメント

### 環境変数

**必須:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`（サーバーサイドのみ）

**オプション:**
- `NEXT_PUBLIC_APP_URL`（本番URL）

### CI/CD

**Vercel自動デプロイ:**
- mainブランチへのプッシュで自動デプロイ
- プレビューデプロイ（PR作成時）

—

## 🚀 開発フェーズ

### フェーズ1（2週間）
- [ ] プロジェクトセットアップ
- [ ] 認証実装
- [ ] データベース構築
- [ ] 復習セッション画面（最重要）
- [ ] SM-2アルゴリズム実装
- [ ] JSON取り込み機能

### フェーズ2（1週間）
- [ ] ダッシュボード
- [ ] 統計グラフ
- [ ] フラッシュカード

### フェーズ3（1週間）
- [ ] スケジュール管理
- [ ] PWA通知
- [ ] パフォーマンス最適化

—

## 📝 備考

### 既存システムとの併用

**移行期間中:**
- GitHub Actions + SendGridのメール機能は継続
- アプリからもJSONを取り込み可能
- 徐々にアプリに移行

**最終的:**
- GitHub Actionsは廃止
- すべてアプリで完結

### 将来の拡張性

**収益化:**
- Stripe統合（サブスクリプション）
- 無料プラン：1プロジェクトまで
- 有料プラン：無制限

**機械学習:**
- Python APIを別サービスで追加
- 学習レコメンド機能
- 苦手分野の自動検出

**SNS機能:**
- 学習記録の共有
- フォロー機能
- ランキング

—

## 🎯 成功指標（KPI）

### 個人利用フェーズ
- 毎日復習を実施できているか
- 復習完了率 > 80%
- 学習継続日数 > 30日

### 公開フェーズ
- ユーザー登録数
- アクティブユーザー数（DAU/MAU）
- 復習完了率
- 継続率（7日後、30日後）

—

このSPEC.mdを元に開発を進めてください。不明点があれば随時更新します。