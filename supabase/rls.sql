-- ================================================
-- Learning Assistant PWA - Row Level Security (RLS)
-- ================================================
-- このSQLファイルをSupabase SQL Editorで実行してください
-- 注意: schema.sql を先に実行してください
-- ================================================

-- ================================================
-- RLSを有効化
-- ================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_history ENABLE ROW LEVEL SECURITY;

-- ================================================
-- user_profiles のポリシー
-- ================================================

-- 既存のポリシーを削除（エラー回避）
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ================================================
-- projects のポリシー
-- ================================================

DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

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

-- ================================================
-- learning_sessions のポリシー
-- ================================================

DROP POLICY IF EXISTS "Users can view own sessions" ON learning_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON learning_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON learning_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON learning_sessions;

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

-- ================================================
-- review_questions のポリシー
-- ================================================

DROP POLICY IF EXISTS "Users can view own questions" ON review_questions;
DROP POLICY IF EXISTS "Users can insert own questions" ON review_questions;
DROP POLICY IF EXISTS "Users can update own questions" ON review_questions;
DROP POLICY IF EXISTS "Users can delete own questions" ON review_questions;

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

-- ================================================
-- review_history のポリシー
-- ================================================

DROP POLICY IF EXISTS "Users can view own review history" ON review_history;
DROP POLICY IF EXISTS "Users can insert own review history" ON review_history;
DROP POLICY IF EXISTS "Users can update own review history" ON review_history;
DROP POLICY IF EXISTS "Users can delete own review history" ON review_history;

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

-- ================================================
-- 完了メッセージ
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Row Level Security (RLS) の設定が完了しました！';
  RAISE NOTICE 'これでユーザーは自分のデータのみアクセスできるようになりました';
END $$;
