# Learning Assistant PWA

AI-powered active recall learning app - 学習補助PWAアプリ

## 📋 概要

AIチャット（Gemini/Claude/ChatGPT）で生成した学習記録JSONを取り込み、アクティブリコール（間隔反復学習）を中心とした効果的な復習システムを提供するPWAアプリです。

## 🚀 技術スタック

- **フロントエンド**: Next.js 15 (App Router) + TypeScript
- **スタイリング**: Tailwind CSS + shadcn/ui
- **状態管理**: Zustand
- **バックエンド**: Next.js API Routes
- **データベース**: Supabase (PostgreSQL)
- **認証**: Supabase Auth
- **ホスティング**: Vercel
- **PWA**: next-pwa

## 📦 主な機能

### ✅ 実装済み（フェーズ1）

- **認証機能**
  - メールアドレス + パスワード認証
  - ログイン/サインアップ画面
  - Supabase Auth統合

- **復習セッション（最重要機能）**
  - 今日復習すべき質問の一覧表示
  - カード形式で1問ずつ表示
  - 自己評価（1-5段階）
  - SM-2アルゴリズムによる次回復習日の自動計算

- **SM-2アルゴリズム**
  - 自己評価に基づく間隔反復学習
  - 繰り返すごとに間隔を延ばす
  - 忘れた問題は間隔をリセット

- **ダッシュボード**
  - 今日の復習項目数表示
  - クイックアクション

- **JSON取り込み機能**
  - 学習記録JSONの一括取り込み
  - プロジェクト、セッション、質問の自動登録

- **PWA対応**
  - manifest.json設定
  - Service Worker（next-pwa）
  - オフライン対応基盤

### 🚧 今後の実装予定（フェーズ2・3）

- 学習統計ダッシュボード（グラフ表示）
- フラッシュカード表示
- 苦手な概念の可視化
- 学習スケジュール管理
- PWA通知機能
- プロジェクト管理画面

## 🛠️ セットアップ

詳細なセットアップ手順は [SETUP.md](./SETUP.md) を参照してください。

### 必要な環境

- Node.js 20以上
- Supabaseアカウント
- Vercelアカウント（デプロイ時）

### クイックスタート

1. **依存関係のインストール**

```bash
npm install
```

2. **環境変数の設定**

`.env.local.example` をコピーして `.env.local` を作成し、Supabase認証情報を設定：

```bash
cp .env.local.example .env.local
```

3. **開発サーバーの起動**

```bash
npm run dev
```

4. **ブラウザで確認**

http://localhost:3000 を開く

## 📊 データベース構造

- `user_profiles` - ユーザープロファイル
- `projects` - 学習プロジェクト
- `learning_sessions` - 学習セッション
- `review_questions` - 復習質問
- `review_history` - 復習履歴（SM-2アルゴリズム用）

詳細は [SPEC.md](./SPEC.md) を参照してください。

## 📝 使い方

### 1. アカウント作成

`/signup` でメールアドレスとパスワードを登録

### 2. 学習記録の取り込み

`/sessions/new` でJSON形式の学習記録を取り込み

**入力例:**

```json
{
  "date": "2025-11-06",
  "project": "python-basics",
  "title": "Python入門",
  "chapter": 3,
  "chapter_title": "制御構造",
  "topic": "if文と条件分岐",
  "duration_minutes": 40,
  "understanding_level": 4,
  "key_concepts": ["if-elif-else文の構造"],
  "review_questions": [
    {
      "question": "if-elif-else文で条件を書く順序はなぜ重要ですか？",
      "answer": "上から順に評価され、最初にTrueになった条件のブロックだけが実行されるため",
      "explanation": "...",
      "difficulty_level": 3
    }
  ]
}
```

### 3. 復習セッション

`/review` で今日の復習項目を確認し、自己評価を行う

## 🔐 セキュリティ

- Supabase Auth による認証
- Row Level Security (RLS) による データアクセス制御
- ユーザーは自分のデータのみアクセス可能

## 📱 画面一覧

- `/` - ホーム（ダッシュボードへリダイレクト）
- `/login` - ログイン画面
- `/signup` - サインアップ画面
- `/dashboard` - ダッシュボード
- `/review` - 復習セッション（最重要）
- `/sessions/new` - JSON取り込み画面

## 🧪 ビルド

```bash
npm run build
```

## 📄 ライセンス

Private

## 📚 参考

詳細な仕様は以下を参照してください：

- [SPEC.md](./SPEC.md) - 開発仕様書
- [SETUP.md](./SETUP.md) - セットアップガイド
