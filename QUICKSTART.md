# 🚨 Supabaseセットアップが必要です

## エラーの原因

`.env.local`ファイルが存在しないため、Supabaseに接続できません。

## 📋 セットアップ手順

### ステップ1: Supabaseプロジェクトを作成

1. https://supabase.com にアクセス
2. 「New Project」をクリック
3. 以下を入力：
   - **Name**: learning-assistant（任意）
   - **Database Password**: 強力なパスワード（必ず保存！）
   - **Region**: Northeast Asia (Tokyo) - ap-northeast-1
   - **Pricing Plan**: Free
4. 「Create new project」をクリック
5. 2-3分待つ

### ステップ2: データベーステーブルを作成

1. 左サイドバーから「SQL Editor」を選択
2. 「New query」をクリック
3. `supabase/schema.sql` の内容を**全て**コピー&ペースト
4. 「Run」ボタンをクリック
5. ✅ 成功メッセージを確認

6. もう一度「New query」をクリック
7. `supabase/rls.sql` の内容を**全て**コピー&ペースト
8. 「Run」ボタンをクリック
9. ✅ 成功メッセージを確認

### ステップ3: 認証情報を取得

1. 左サイドバーから「Settings」→「API」を選択
2. 以下をコピー（メモ帳などに保存）：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public**: `eyJhbGciOiJIUzI1...`
   - **service_role**: `eyJhbGciOiJIUzI1...`

### ステップ4: 環境変数ファイルを作成

このプロジェクトのルートディレクトリで以下を実行：

```bash
# テンプレートをコピー
cp .env.local.example .env.local

# エディタで開いて編集
# ステップ3でコピーした値を貼り付け
```

`.env.local` の内容：

```bash
# Supabase（ステップ3でコピーした値を貼り付け）
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1...

# アプリURL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### ステップ5: 開発サーバーを再起動

```bash
# 開発サーバーを停止（Ctrl+C）
# 再起動
npm run dev
```

### ステップ6: ブラウザで確認

http://localhost:3000 を開いて、ログインページが表示されればOK！

## 📚 詳細ガイド

- Supabaseセットアップ: `supabase/README.md`
- 全体的なセットアップ: `SETUP.md`
- Vercelデプロイ: `DEPLOYMENT.md`

## ❓ トラブルシューティング

エラーが続く場合は、以下を確認：
- [ ] `.env.local` ファイルが作成されている
- [ ] Supabase の URL とキーが正しい（スペースや改行がない）
- [ ] 開発サーバーを再起動した
- [ ] SupabaseのプロジェクトURLが https:// で始まっている
