-- chat_sessions テーブルに updated_at カラムを追加
-- 最近の学習記録表示で使用

-- updated_at カラムを追加（デフォルトは created_at と同じ）
ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 既存レコードの updated_at を created_at で初期化
UPDATE chat_sessions SET updated_at = created_at WHERE updated_at IS NULL;

-- updated_at を自動更新するトリガー関数
CREATE OR REPLACE FUNCTION update_chat_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーを作成（既存の場合は置き換え）
DROP TRIGGER IF EXISTS trigger_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER trigger_chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_sessions_updated_at();
