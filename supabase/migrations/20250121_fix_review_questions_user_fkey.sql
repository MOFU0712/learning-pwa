-- review_questions の user_id 外部キーを auth.users に変更
-- 現在 user_profiles を参照しているが、auth.users を参照するように修正

-- 既存の外部キー制約を削除
ALTER TABLE review_questions
DROP CONSTRAINT IF EXISTS review_questions_user_id_fkey;

-- auth.users を参照する新しい外部キー制約を追加
ALTER TABLE review_questions
ADD CONSTRAINT review_questions_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- review_history も同様に修正
ALTER TABLE review_history
DROP CONSTRAINT IF EXISTS review_history_user_id_fkey;

ALTER TABLE review_history
ADD CONSTRAINT review_history_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
