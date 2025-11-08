# Vercelデプロイ トラブルシューティング

## 🚨 エラー: "Error · Merge pull request #1"

### ステップ1: 環境変数を確認

1. Vercelダッシュボード → あなたのプロジェクト
2. **Settings** タブ → **Environment Variables**
3. 以下の3つが設定されているか確認：

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

#### もし設定されていない場合：

1. **Add New** をクリック
2. 各変数を追加：

**変数1:**
- **Name**: `NEXT_PUBLIC_SUPABASE_URL`
- **Value**: `https://xxxxx.supabase.co`（あなたのSupabase Project URL）
- **Environments**: Production ✓, Preview ✓, Development ✓
- **Save**

**変数2:**
- **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value**: `eyJhbGci...`（あなたのSupabase Anon Key）
- **Environments**: Production ✓, Preview ✓, Development ✓
- **Save**

**変数3:**
- **Name**: `SUPABASE_SERVICE_ROLE_KEY`
- **Value**: `eyJhbGci...`（あなたのSupabase Service Role Key）
- **Environments**: Production ✓, Preview ✓, Development ✓
- **Save**

3. 環境変数を保存したら、**再デプロイ**

---

### ステップ2: 再デプロイ

環境変数を設定したら：

1. **Deployments** タブを開く
2. 最新の（失敗した）デプロイを見つける
3. 右側の **「...」** （3点メニュー）をクリック
4. **「Redeploy」** をクリック
5. **「Redeploy」** を再度クリックして確認

---

### ステップ3: ビルドログを確認

再デプロイ中：

1. デプロイをクリック
2. **Building** 状態を確認
3. ログをリアルタイムで確認
4. エラーがあれば、具体的なエラーメッセージをコピー

---

## 📋 確認チェックリスト

- [ ] Supabaseプロジェクトが作成されている
- [ ] Supabaseでテーブルが作成されている（schema.sql実行済み）
- [ ] SupabaseでRLSが設定されている（rls.sql実行済み）
- [ ] Vercelに環境変数が3つとも設定されている
- [ ] 環境変数の値にスペースや改行が含まれていない
- [ ] 環境変数がProduction, Preview, Developmentの全てに適用されている

---

## 🔍 詳細なエラーログの見方

### Vercelダッシュボード:

1. プロジェクトを開く
2. **Deployments** タブ
3. 失敗したデプロイ（赤い✗）をクリック
4. **Build Logs** セクションを展開
5. エラーメッセージを探す（通常は赤字で表示）

### よくあるエラーメッセージ:

#### ❌ "Missing environment variable"
→ **解決**: 環境変数を設定（上記ステップ1参照）

#### ❌ "Build exceeded maximum duration"
→ **解決**: Vercel Proプランにアップグレード、または不要な依存関係を削除

#### ❌ "Module not found"
→ **解決**: `npm install` を実行してコミット、プッシュ

#### ❌ "Failed to compile"
→ **解決**: TypeScriptエラーを修正

---

## 💡 それでも解決しない場合

1. Vercelのビルドログ全体をコピー
2. エラーメッセージの詳細を確認
3. 具体的なエラー内容を教えてください

---

## 🎯 成功の確認

デプロイが成功すると：

- ✅ Deploymentsに緑のチェックマーク
- ✅ **Visit** ボタンでアプリを開ける
- ✅ ログインページが表示される
- ✅ サインアップ・ログインができる

---

## 📞 サポート

この手順で解決しない場合は、以下を教えてください：

1. Vercelのビルドログのエラーメッセージ（スクリーンショットでもOK）
2. 環境変数が設定されているか（Yes/No）
3. Supabaseプロジェクトが作成されているか（Yes/No）
