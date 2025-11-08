# Supabase データベースセットアップ

このディレクトリには、Supabaseのデータベースを一括セットアップするためのSQLスクリプトが含まれています。

## 📋 ファイル一覧

- `schema.sql` - テーブル作成とインデックス
- `rls.sql` - Row Level Security (RLS) の設定

## 🚀 セットアップ手順

### 1. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com) にログイン
2. 「New Project」をクリック
3. プロジェクト情報を入力
   - **Name**: learning-assistant（任意）
   - **Database Password**: 強力なパスワードを設定（保存しておく）
   - **Region**: Northeast Asia (Tokyo) - ap-northeast-1
   - **Pricing Plan**: Free
4. 「Create new project」をクリック
5. プロジェクト作成完了まで2-3分待つ

### 2. データベーステーブルの作成

#### 方法A: SQL Editorを使う（推奨）

1. Supabaseダッシュボードの左サイドバーから「SQL Editor」を選択
2. 「New query」をクリック
3. `schema.sql` の内容を全てコピー&ペースト
4. 「Run」ボタンをクリック
5. ✅ "テーブル作成が完了しました！" というメッセージが表示されればOK

#### 方法B: CLIを使う（上級者向け）

```bash
# Supabase CLIのインストール
npm install -g supabase

# ログイン
supabase login

# プロジェクトにリンク
supabase link --project-ref YOUR_PROJECT_REF

# SQLファイルを実行
supabase db execute -f supabase/schema.sql
```

### 3. Row Level Security (RLS) の設定

1. SQL Editorで「New query」をクリック
2. `rls.sql` の内容を全てコピー&ペースト
3. 「Run」ボタンをクリック
4. ✅ "Row Level Security (RLS) の設定が完了しました！" というメッセージが表示されればOK

### 4. 認証設定

1. 左サイドバーから「Authentication」を選択
2. 「Providers」タブをクリック
3. 「Email」プロバイダーが有効になっていることを確認
4. 設定:
   - **Enable Email provider**: ON
   - **Confirm email**: OFF（開発中はOFF、本番ではON推奨）

### 5. API認証情報の取得

1. 左サイドバーから「Settings」→「API」を選択
2. 以下の情報をコピーして保存：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public**: `eyJhbGciOiJIUzI1...`（公開キー）
   - **service_role**: `eyJhbGciOiJIUzI1...`（秘密鍵、サーバーサイドのみ）

⚠️ **重要：service_roleキーは絶対に公開しないこと**

### 6. 環境変数の設定

プロジェクトルートに `.env.local` ファイルを作成：

```bash
cp .env.local.example .env.local
```

`.env.local` を編集して、Supabaseの認証情報を設定：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1...
```

## 🔍 セットアップ確認

### テーブルが正しく作成されたか確認

SQL Editorで以下を実行：

```sql
-- テーブル一覧を確認
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

以下のテーブルが表示されればOK：
- ✅ learning_sessions
- ✅ projects
- ✅ review_history
- ✅ review_questions
- ✅ user_profiles

### RLSが有効になっているか確認

SQL Editorで以下を実行：

```sql
-- RLS状態を確認
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

すべてのテーブルで `rowsecurity = true` になっていればOK

## 🛠️ トラブルシューティング

### エラー: "relation already exists"

テーブルが既に存在している場合は、以下を実行してから再度セットアップ：

```sql
-- 全テーブルを削除（注意: データも削除されます）
DROP TABLE IF EXISTS review_history CASCADE;
DROP TABLE IF EXISTS review_questions CASCADE;
DROP TABLE IF EXISTS learning_sessions CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
```

その後、`schema.sql` と `rls.sql` を再実行。

### エラー: "permission denied"

Supabaseの管理者権限でログインしているか確認してください。

## 📚 参考

- [Supabase公式ドキュメント](https://supabase.com/docs)
- [Row Level Security (RLS) について](https://supabase.com/docs/guides/auth/row-level-security)
- メインドキュメント: [../SETUP.md](../SETUP.md)
