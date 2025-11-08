# Vercelデプロイガイド

このガイドでは、Learning Assistant PWAをVercelにデプロイする手順を説明します。

## 🚀 クイックデプロイ（推奨）

### 方法A: Vercelダッシュボードから

1. [Vercel](https://vercel.com) にアクセスしてログイン
2. 「Add New...」→「Project」をクリック
3. GitHubリポジトリを選択（`MOFU0712/learning-pwa`）
4. 「Import」をクリック
5. 環境変数を設定（下記参照）
6. 「Deploy」をクリック

### 方法B: CLIを使う

```bash
# Vercel CLIのインストール
npm install -g vercel

# ログイン
vercel login

# デプロイ（初回）
vercel

# プロダクションデプロイ
vercel --prod
```

## 🔐 環境変数の設定

デプロイ前に、以下の環境変数を設定する必要があります。

### 必須環境変数

| 変数名 | 説明 | 取得方法 |
|--------|------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Public Key | Supabase Dashboard → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | Supabase Dashboard → Settings → API → service_role |

⚠️ **重要:** `SUPABASE_SERVICE_ROLE_KEY` は秘密鍵です。絶対に公開しないでください！

### Vercelダッシュボードでの設定手順

1. Vercelプロジェクトページを開く
2. 「Settings」タブをクリック
3. 左サイドバーから「Environment Variables」を選択
4. 各環境変数を追加：
   - **Key**: 変数名（例：`NEXT_PUBLIC_SUPABASE_URL`）
   - **Value**: 値（SupabaseダッシュボードからコピーTODO）
   - **Environments**: Production, Preview, Development を全て選択
5. 「Save」をクリック

### CLI での設定手順

```bash
# 環境変数を追加
vercel env add NEXT_PUBLIC_SUPABASE_URL
# → 値を入力してEnter
# → Production, Preview, Development を全て選択

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# → 値を入力

vercel env add SUPABASE_SERVICE_ROLE_KEY
# → 値を入力

# 環境変数を確認
vercel env ls
```

## 🔄 自動デプロイ設定

GitHubリポジトリと連携すると、自動デプロイが有効になります。

### デプロイトリガー

- **mainブランチへのpush** → 本番環境に自動デプロイ
- **PRの作成/更新** → プレビュー環境に自動デプロイ
- **その他のブランチへのpush** → プレビュー環境に自動デプロイ（設定次第）

### 自動デプロイの確認

1. GitHubでコミットをpush
2. Vercelダッシュボードで「Deployments」タブを確認
3. ビルドログを確認
4. デプロイ完了後、URLをクリックして確認

## 🌐 カスタムドメイン設定（オプション）

1. Vercelプロジェクトページの「Settings」→「Domains」を選択
2. 「Add」をクリック
3. ドメイン名を入力（例：`learning-assistant.com`）
4. DNSレコードを設定（Vercelの指示に従う）
5. SSL証明書が自動的に発行される

### DNSレコード例

```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

## 📊 デプロイ後の確認

### 1. アプリケーションの動作確認

- [ ] ログインページが表示される
- [ ] サインアップができる
- [ ] ダッシュボードが表示される
- [ ] JSON取り込みができる
- [ ] 復習セッションが動作する

### 2. PWAの確認

- [ ] ブラウザでPWAインストールプロンプトが表示される
- [ ] ホーム画面に追加できる
- [ ] オフラインで基本機能が動作する

### 3. パフォーマンスの確認

Vercel Analyticsで以下を確認：
- [ ] Core Web Vitals
- [ ] ページ読み込み速度
- [ ] エラー率

## 🛠️ トラブルシューティング

### ビルドエラー: "Missing environment variable"

**原因:** 環境変数が設定されていない

**解決策:**
1. Vercelダッシュボードで環境変数を確認
2. 必須環境変数が全て設定されているか確認
3. 再デプロイ（「Deployments」→ 最新デプロイの「...」→「Redeploy」）

### ビルドエラー: "Exceeded maximum duration"

**原因:** ビルドに時間がかかりすぎている

**解決策:**
1. `next.config.js` で `swcMinify: true` を確認
2. 不要な依存関係を削除
3. Pro プランにアップグレード（ビルド時間制限が緩和）

### 実行時エラー: "Supabase connection failed"

**原因:** Supabase認証情報が間違っている

**解決策:**
1. `.env.local` の値を確認
2. Vercelの環境変数を確認
3. Supabaseダッシュボードで正しいキーをコピー
4. 環境変数を更新して再デプロイ

### 実行時エラー: "Unauthorized"

**原因:** RLSが正しく設定されていない

**解決策:**
1. `supabase/rls.sql` を実行したか確認
2. Supabase Dashboard → Authentication → Policies を確認
3. RLSポリシーが全テーブルに設定されているか確認

## 🔒 セキュリティチェックリスト

デプロイ前に以下を確認してください：

- [ ] `.env.local` が `.gitignore` に含まれている
- [ ] `SUPABASE_SERVICE_ROLE_KEY` が環境変数としてのみ設定されている（コードに直接書いていない）
- [ ] Supabase RLSが有効になっている
- [ ] Vercelの環境変数が Production, Preview, Development で正しく設定されている
- [ ] カスタムドメインでHTTPSが有効になっている

## 📈 監視とログ

### Vercel Analytics

1. Vercelプロジェクトページの「Analytics」タブを確認
2. Core Web Vitals、ページビュー、エラー率を監視

### Vercel Logs

1. 「Logs」タブを確認
2. リアルタイムログを監視
3. エラーログをフィルタリング

### Supabase Logs

1. Supabase Dashboard → Logs を確認
2. APIリクエスト、エラー、パフォーマンスを監視

## 🚀 継続的デプロイメント

### GitHub Actions（オプション）

より高度なCI/CDを構築する場合：

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

## 📚 参考リンク

- [Vercel公式ドキュメント](https://vercel.com/docs)
- [Next.js デプロイメント](https://nextjs.org/docs/deployment)
- [Supabase + Vercel統合](https://supabase.com/docs/guides/hosting/vercel)
- [環境変数のベストプラクティス](https://vercel.com/docs/concepts/projects/environment-variables)

## 💡 ヒント

- **プレビューデプロイ**: PRごとに自動的にプレビュー環境が作成されます
- **ロールバック**: デプロイ履歴から以前のバージョンに簡単に戻せます
- **A/Bテスト**: Vercel Edge Configを使って機能フラグを実装できます
- **パフォーマンス**: Vercel Analyticsで継続的にパフォーマンスを監視しましょう
