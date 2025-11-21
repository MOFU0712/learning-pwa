-- System prompts table for customizable AI tutor instructions

CREATE TABLE IF NOT EXISTS system_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_system_prompts_user_id ON system_prompts(user_id);

-- RLS
ALTER TABLE system_prompts ENABLE ROW LEVEL SECURITY;

-- Users can only access their own prompts
DROP POLICY IF EXISTS "Users can manage own prompts" ON system_prompts;
CREATE POLICY "Users can manage own prompts" ON system_prompts
  FOR ALL USING (auth.uid() = user_id);

COMMENT ON TABLE system_prompts IS 'User-customizable system prompts for AI tutor';
