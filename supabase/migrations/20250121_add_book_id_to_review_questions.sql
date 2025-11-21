-- review_questions テーブルに book_id カラムを追加
-- books system との連携のため

-- book_id カラムを追加（NULLable - 既存データとの互換性のため）
ALTER TABLE review_questions
ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE CASCADE;

-- chat_session_id カラムを追加（チャットセッションとの紐付け）
ALTER TABLE review_questions
ADD COLUMN IF NOT EXISTS chat_session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE;

-- project_id を NULLable に変更（books system では project_id は不要）
ALTER TABLE review_questions
ALTER COLUMN project_id DROP NOT NULL;

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_review_questions_book_id ON review_questions(book_id);
CREATE INDEX IF NOT EXISTS idx_review_questions_chat_session_id ON review_questions(chat_session_id);

-- RLSポリシーを更新（book_id でもアクセス可能に）
DROP POLICY IF EXISTS "Users can view their own review questions" ON review_questions;
CREATE POLICY "Users can view their own review questions" ON review_questions
  FOR SELECT USING (
    user_id = auth.uid() OR
    book_id IN (SELECT id FROM books WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert their own review questions" ON review_questions;
CREATE POLICY "Users can insert their own review questions" ON review_questions
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR
    book_id IN (SELECT id FROM books WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update their own review questions" ON review_questions;
CREATE POLICY "Users can update their own review questions" ON review_questions
  FOR UPDATE USING (
    user_id = auth.uid() OR
    book_id IN (SELECT id FROM books WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete their own review questions" ON review_questions;
CREATE POLICY "Users can delete their own review questions" ON review_questions
  FOR DELETE USING (
    user_id = auth.uid() OR
    book_id IN (SELECT id FROM books WHERE user_id = auth.uid())
  );
