-- chat_sessions テーブルに要約関連カラムを追加
-- 長い会話を要約して保持することで、トークン制限を回避

-- 学習計画を保持するカラム
ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS learning_plan TEXT;

-- 会話の要約を保持するカラム
ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS conversation_summary TEXT;

-- 現在の進捗状況（例: "3/10 トピック完了"）
ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS progress_status TEXT;

-- 要約が最後に更新されたメッセージ数
ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS summarized_message_count INTEGER DEFAULT 0;
