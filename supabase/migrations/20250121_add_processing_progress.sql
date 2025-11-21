-- Add processing progress columns to books table

-- processed_chapters: 処理済みの章数
ALTER TABLE books ADD COLUMN IF NOT EXISTS processed_chapters INTEGER DEFAULT 0;

-- chapters_data: 目次データ（章のリスト）をJSONで保存
ALTER TABLE books ADD COLUMN IF NOT EXISTS chapters_data JSONB;
