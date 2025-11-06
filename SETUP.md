# セットアップガイド（SETUP.md）

このドキュメントでは、Supabase、Vercel、開発環境のセットアップ手順を説明します。

——

## 📋 前提条件

- GitHubアカウント
- Supabaseアカウント（無料）
- Vercelアカウント（無料）
- Node.js 20以上（ローカル開発の場合）
- スマホ + Claude Code Web または Codex（クラウド開発の場合）

——

## 🗄️ Supabaseのセットアップ

### 1. 新規プロジェクト作成

1. [Supabase](https://supabase.com)にログイン
1. 「New Project」をクリック
1. プロジェクト情報を入力
- **Name**: learning-assistant（任意）
- **Database Password**: 強力なパスワードを設定（保存しておく）
- **Region**: Northeast Asia (Tokyo) - ap-northeast-1
- **Pricing Plan**: Free
1. 「Create new project」をクリック
1. プロジェクト作成完了まで2-3分待つ

### 2. データベーステーブルの作成

#### 方法A：SQL Editorを使う（推奨）

1. 左サイドバーから「SQL Editor」を選択
1. 「New query」をクリック
1. 以下のSQLをコピー&ペーストして実行

```sql
— ユーザープロファイル（Supabase Authと連携）
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

— 学習プロジェクト（ユーザーごと）
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  total_chapters INTEGER,
  current_chapter INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

— 学習記録
CREATE TABLE learning_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  chapter INTEGER,
  chapter_title TEXT,
  topic TEXT,
  duration_minutes INTEGER,
  understanding_level INTEGER CHECK (understanding_level BETWEEN 1 AND 5),
  key_concepts TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB
);

— 復習用質問
CREATE TABLE review_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES learning_sessions(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  explanation TEXT,
  why_important TEXT,
  difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5),
  related_concepts TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

— 復習履歴（SM-2アルゴリズム）
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

— インデックスの作成（パフォーマンス向上）
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_sessions_user_id ON learning_sessions(user_id);
CREATE INDEX idx_sessions_project_id ON learning_sessions(project_id);
CREATE INDEX idx_sessions_date ON learning_sessions(date);
CREATE INDEX idx_questions_user_id ON review_questions(user_id);
CREATE INDEX idx_questions_session_id ON review_questions(session_id);
CREATE INDEX idx_questions_project_id ON review_questions(project_id);
CREATE INDEX idx_review_history_user_id ON review_history(user_id);
CREATE INDEX idx_review_history_question_id ON review_history(question_id);
CREATE INDEX idx_review_history_next_review_date ON review_history(next_review_date);

— updated_atの自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

1. 「Run」ボタンをクリックして実行
1. 成功メッセージを確認

#### 方法B：Table Editorを使う

1. 左サイドバーから「Table Editor」を選択
1. 「New table」をクリック
1. 手動でテーブルを作成（上記SQLを参考に）

**推奨：方法Aを使ってください（簡単で確実）**

### 3. Row Level Security (RLS) の設定

**重要：ユーザーは自分のデータのみアクセス可能にする**

SQL Editorで以下を実行：

```sql
— RLSを有効化
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_history ENABLE ROW LEVEL SECURITY;

— user_profiles のポリシー
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

— projects のポリシー
CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

— learning_sessions のポリシー
CREATE POLICY "Users can view own sessions"
  ON learning_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON learning_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON learning_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON learning_sessions FOR DELETE
  USING (auth.uid() = user_id);

— review_questions のポリシー
CREATE POLICY "Users can view own questions"
  ON review_questions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own questions"
  ON review_questions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own questions"
  ON review_questions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own questions"
  ON review_questions FOR DELETE
  USING (auth.uid() = user_id);

— review_history のポリシー
CREATE POLICY "Users can view own review history"
  ON review_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own review history"
  ON review_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own review history"
  ON review_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own review history"
  ON review_history FOR DELETE
  USING (auth.uid() = user_id);
```

### 4. 認証設定

1. 左サイドバーから「Authentication」を選択
1. 「Providers」タブをクリック
1. 「Email」プロバイダーが有効になっていることを確認
1. 設定:
- **Enable Email provider**: ON
- **Confirm email**: OFF（開発中はOFF、本番ではON推奨）
- **Secure email change**: ON（推奨）

#### マジックリンク（オプション）

パスワードレス認証を有効化する場合：

1. 「Email」プロバイダー設定で「Enable Magic Link」をON
1. メールテンプレートをカスタマイズ（オプション）

### 5. API認証情報の取得

1. 左サイドバーから「Settings」→「API」を選択
1. 以下の情報をコピーして保存：
- **Project URL**: `https://xxxxx.supabase.co`
- **anon public**: `eyJhbGciOiJIUzI1...`（公開キー）
- **service_role**: `eyJhbGciOiJIUzI1...`（秘密鍵、サーバーサイドのみ）

**重要：service_roleキーは絶対に公開しないこと**

——

## ☁️ Vercelのセットアップ

### 1. Vercelアカウント作成

1. [Vercel](https://vercel.com)にアクセス
1. 「Sign Up」をクリック
1. GitHubアカウントで認証

### 2. GitHubリポジトリの連携

1. Vercelダッシュボードで「Add New…」→「Project」をクリック
1. 「Import Git Repository」を選択
1. GitHubリポジトリを選択（例：`learning-pwa`）
1. 「Import」をクリック

### 3. プロジェクト設定

#### Framework Preset

- **Framework**: Next.js（自動検出）
- **Root Directory**: `./`（デフォルト）

#### Build and Output Settings

- **Build Command**: `npm run build`（デフォルト）
- **Output Directory**: `.next`（デフォルト）
- **Install Command**: `npm install`（デフォルト）

#### Environment Variables

「Environment Variables」セクションで以下を追加：

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1...

# アプリURL（デプロイ後に追加）
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**重要：**

- `NEXT_PUBLIC_`で始まる変数はクライアントサイドで使用可能
- `SUPABASE_SERVICE_ROLE_KEY`は`NEXT_PUBLIC_`をつけない（サーバーサイドのみ）

### 4. デプロイ

1. 「Deploy」ボタンをクリック
1. ビルド完了まで2-3分待つ
1. デプロイ成功！

### 5. カスタムドメイン（オプション）

1. プロジェクト設定から「Domains」を選択
1. 独自ドメインを追加
1. DNSレコードを設定

——

## 💻 開発環境のセットアップ

### オプションA：Claude Code Web（推奨）

1. [Claude Code Web](https://code.claude.ai)にアクセス
1. GitHubアカウントで認証
1. リポジトリをクローン
1. ターミナルで以下を実行：

```bash
# 依存関係のインストール
npm install

# 環境変数ファイルの作成
cp .env.local.example .env.local

# .env.localを編集してSupabase認証情報を追加
# （Claude Code Webのエディタで編集）

# 開発サーバーの起動
npm run dev
```

1. ブラウザで `http://localhost:3000` を開く

### オプションB：GitHub Codespaces

1. GitHubリポジトリページで「Code」→「Codespaces」→「Create codespace on main」
1. Codespaceが起動したら、上記と同じコマンドを実行

### オプションC：Codex（モバイル）

1. Codexアプリでリポジトリを開く
1. ターミナルで上記と同じコマンドを実行

### オプションD：ローカル開発（PC）

```bash
# リポジトリをクローン
git clone https://github.com/your-username/learning-pwa.git
cd learning-pwa

# 依存関係のインストール
npm install

# 環境変数ファイルの作成
cp .env.local.example .env.local

# .env.localを編集してSupabase認証情報を追加

# 開発サーバーの起動
npm run dev
```

——

## 🔧 環境変数の設定

### .env.local.example

プロジェクトルートに以下のファイルを作成：

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1...

# アプリURL（本番環境）
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# 開発環境
# NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### .env.local

`.env.local.example`をコピーして作成し、実際の値を入力：

```bash
cp .env.local.example .env.local
```

**重要：`.env.local`はGitにコミットしない（.gitignoreに追加済み）**

——

## 📦 依存パッケージのインストール

### 必須パッケージ

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install zustand
npm install date-fns
npm install recharts
npm install lucide-react
```

### shadcn/ui

```bash
npx shadcn-ui@latest init
```

プロンプトで以下を選択：

- **Style**: Default
- **Base color**: Slate
- **CSS variables**: Yes

必要なコンポーネントをインストール：

```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add form
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add select
npx shadcn-ui@latest add progress
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add avatar
npx shadcn-ui@latest add badge
```

### PWA

```bash
npm install next-pwa
npm install -D @types/serviceworker
```

——

## 🧪 動作確認

### 1. 開発サーバーの起動

```bash
npm run dev
```

### 2. ブラウザで確認

`http://localhost:3000`を開く

### 3. Supabase接続テスト

簡単なテストページを作成：

```typescript
// app/test/page.tsx
import { createClient } from '@/lib/supabase/client';

export default async function TestPage() {
  const supabase = createClient();
  const { data, error } = await supabase.from('projects').select('*');
  
  return (
    <div>
      <h1>Supabase Connection Test</h1>
      <pre>{JSON.stringify({ data, error }, null, 2)}</pre>
    </div>
  );
}
```

ブラウザで `/test` にアクセスして、エラーがなければOK。

——

## 🚀 デプロイ

### 自動デプロイ（Vercel連携済み）

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

Vercelが自動的にビルド・デプロイします。

### 手動デプロイ（Vercel CLI）

```bash
# Vercel CLIのインストール
npm install -g vercel

# ログイン
vercel login

# デプロイ
vercel —prod
```

——

## 🛠️ トラブルシューティング

### Supabase接続エラー

**症状：**

```
Error: Invalid API key
```

**解決策：**

1. `.env.local`の`NEXT_PUBLIC_SUPABASE_URL`と`NEXT_PUBLIC_SUPABASE_ANON_KEY`が正しいか確認
1. Supabaseプロジェクトが正常に作成されているか確認
1. 開発サーバーを再起動：`npm run dev`

### ビルドエラー

**症状：**

```
Module not found: Can't resolve '@/lib/supabase/client'
```

**解決策：**

1. `npm install`を再実行
1. `tsconfig.json`のパスエイリアス設定を確認

### RLSエラー

**症状：**

```
new row violates row-level security policy
```

**解決策：**

1. Supabaseで認証済みか確認
1. RLSポリシーが正しく設定されているか確認
1. `auth.uid()`が正しく取得できているか確認

### Vercelデプロイエラー

**症状：**

```
Error: Missing environment variable
```

**解決策：**

1. Vercelダッシュボードで環境変数が設定されているか確認
1. 環境変数名が正しいか確認（`NEXT_PUBLIC_`プレフィックス）
1. 再デプロイ

——

## 📚 参考リンク

- [Supabase公式ドキュメント](https://supabase.com/docs)
- [Next.js公式ドキュメント](https://nextjs.org/docs)
- [Vercel公式ドキュメント](https://vercel.com/docs)
- [shadcn/ui公式ドキュメント](https://ui.shadcn.com)
- [Zustand公式ドキュメント](https://zustand-demo.pmnd.rs/)

——

## ✅ セットアップ完了チェックリスト

- [ ] Supabaseプロジェクト作成
- [ ] データベーステーブル作成
- [ ] RLS設定
- [ ] Supabase API認証情報取得
- [ ] Vercelアカウント作成
- [ ] GitHubリポジトリ連携
- [ ] Vercel環境変数設定
- [ ] 初回デプロイ成功
- [ ] 開発環境セットアップ（Claude Code Web / Codespaces / Codex）
- [ ] 依存パッケージインストール
- [ ] `.env.local`作成
- [ ] 開発サーバー起動確認
- [ ] Supabase接続テスト成功

すべて完了したら、SPEC.mdを参照して開発を開始してください！🎉