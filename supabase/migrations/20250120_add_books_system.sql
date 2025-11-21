-- Learning Assistant v2.0: 書籍システム拡張
-- 2025-01-20

-- vector拡張を有効化（既にある場合はスキップされる）
CREATE EXTENSION IF NOT EXISTS vector;

-- ユーザー設定テーブル
CREATE TABLE IF NOT EXISTS user_settings (
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
CREATE TABLE IF NOT EXISTS books (
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
CREATE TABLE IF NOT EXISTS chapters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,
  chapter_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(book_id, chapter_number)
);

-- 節（セクション）
CREATE TABLE IF NOT EXISTS sections (
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

-- チャットセッション（既存のlearning_sessionsと区別）
CREATE TABLE IF NOT EXISTS chat_sessions (
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
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  sections_used UUID[],
  token_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id);
CREATE INDEX IF NOT EXISTS idx_books_processing_status ON books(processing_status);
CREATE INDEX IF NOT EXISTS idx_chapters_book_id ON chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_sections_chapter_id ON sections(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_book_id ON chat_sessions(book_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);

-- ベクトル検索用インデックス（ivfflat）
CREATE INDEX IF NOT EXISTS idx_sections_vector ON sections
  USING ivfflat (content_vector vector_cosine_ops)
  WITH (lists = 100);

-- RLS（Row Level Security）有効化
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLSポリシー作成

-- user_settings: 自分の設定のみアクセス可能
DROP POLICY IF EXISTS "Users can manage own settings" ON user_settings;
CREATE POLICY "Users can manage own settings" ON user_settings
  FOR ALL USING (auth.uid() = user_id);

-- books: 自分の書籍または公開書籍を閲覧可能
DROP POLICY IF EXISTS "Users can view own or public books" ON books;
CREATE POLICY "Users can view own or public books" ON books
  FOR SELECT USING (auth.uid() = user_id OR is_public = true);

DROP POLICY IF EXISTS "Users can manage own books" ON books;
CREATE POLICY "Users can manage own books" ON books
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own books" ON books;
CREATE POLICY "Users can update own books" ON books
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own books" ON books;
CREATE POLICY "Users can delete own books" ON books
  FOR DELETE USING (auth.uid() = user_id);

-- chapters: 書籍の所有者または公開書籍の章を閲覧可能
DROP POLICY IF EXISTS "Users can view chapters of accessible books" ON chapters;
CREATE POLICY "Users can view chapters of accessible books" ON chapters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM books
      WHERE books.id = chapters.book_id
      AND (books.user_id = auth.uid() OR books.is_public = true)
    )
  );

DROP POLICY IF EXISTS "Users can manage chapters of own books" ON chapters;
CREATE POLICY "Users can manage chapters of own books" ON chapters
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM books
      WHERE books.id = chapters.book_id
      AND books.user_id = auth.uid()
    )
  );

-- sections: 書籍の所有者または公開書籍の節を閲覧可能
DROP POLICY IF EXISTS "Users can view sections of accessible books" ON sections;
CREATE POLICY "Users can view sections of accessible books" ON sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chapters
      JOIN books ON books.id = chapters.book_id
      WHERE chapters.id = sections.chapter_id
      AND (books.user_id = auth.uid() OR books.is_public = true)
    )
  );

DROP POLICY IF EXISTS "Users can manage sections of own books" ON sections;
CREATE POLICY "Users can manage sections of own books" ON sections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM chapters
      JOIN books ON books.id = chapters.book_id
      WHERE chapters.id = sections.chapter_id
      AND books.user_id = auth.uid()
    )
  );

-- chat_sessions: 自分のセッションのみアクセス可能
DROP POLICY IF EXISTS "Users can manage own chat sessions" ON chat_sessions;
CREATE POLICY "Users can manage own chat sessions" ON chat_sessions
  FOR ALL USING (auth.uid() = user_id);

-- chat_messages: 自分のセッションのメッセージのみアクセス可能
DROP POLICY IF EXISTS "Users can manage own chat messages" ON chat_messages;
CREATE POLICY "Users can manage own chat messages" ON chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM chat_sessions
      WHERE chat_sessions.id = chat_messages.session_id
      AND chat_sessions.user_id = auth.uid()
    )
  );

-- ベクトル検索関数
CREATE OR REPLACE FUNCTION match_sections(
  query_embedding vector(1536),
  chapter_id_param uuid,
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
  WHERE sections.chapter_id = chapter_id_param
    AND 1 - (sections.content_vector <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- 完了メッセージ
COMMENT ON TABLE books IS 'Learning Assistant v2.0: 書籍マスターテーブル';
COMMENT ON TABLE chapters IS 'Learning Assistant v2.0: 章テーブル';
COMMENT ON TABLE sections IS 'Learning Assistant v2.0: 節テーブル（ベクトル検索対応）';
COMMENT ON TABLE chat_sessions IS 'Learning Assistant v2.0: チャットセッションテーブル';
COMMENT ON TABLE chat_messages IS 'Learning Assistant v2.0: チャットメッセージテーブル';
