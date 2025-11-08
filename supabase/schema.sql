-- ================================================
-- Learning Assistant PWA - Database Schema
-- ================================================
-- このSQLファイルをSupabase SQL Editorで実行してください
-- 実行方法：
-- 1. Supabaseダッシュボードにログイン
-- 2. 左サイドバーから「SQL Editor」を選択
-- 3. 「New query」をクリック
-- 4. このファイルの内容を全てコピー&ペースト
-- 5. 「Run」ボタンをクリック
-- ================================================

-- ================================================
-- テーブル作成
-- ================================================

-- ユーザープロファイル（Supabase Authと連携）
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 学習プロジェクト（ユーザーごと）
CREATE TABLE IF NOT EXISTS projects (
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

-- 学習記録
CREATE TABLE IF NOT EXISTS learning_sessions (
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

-- 復習用質問
CREATE TABLE IF NOT EXISTS review_questions (
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

-- 復習履歴（SM-2アルゴリズム）
CREATE TABLE IF NOT EXISTS review_history (
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

-- ================================================
-- インデックス作成（パフォーマンス向上）
-- ================================================

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON learning_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON learning_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON learning_sessions(date);
CREATE INDEX IF NOT EXISTS idx_questions_user_id ON review_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_session_id ON review_questions(session_id);
CREATE INDEX IF NOT EXISTS idx_questions_project_id ON review_questions(project_id);
CREATE INDEX IF NOT EXISTS idx_review_history_user_id ON review_history(user_id);
CREATE INDEX IF NOT EXISTS idx_review_history_question_id ON review_history(question_id);
CREATE INDEX IF NOT EXISTS idx_review_history_next_review_date ON review_history(next_review_date);

-- ================================================
-- トリガー関数（updated_atの自動更新）
-- ================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- user_profilesのトリガー
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- projectsのトリガー
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- 完了メッセージ
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '✅ テーブル作成が完了しました！';
  RAISE NOTICE '次のステップ: rls.sql を実行してRow Level Securityを設定してください';
END $$;
