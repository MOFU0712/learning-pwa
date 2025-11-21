-- Fix match_sections function return type after section_number changed to TEXT

-- Drop existing function first (required when changing return type)
DROP FUNCTION IF EXISTS match_sections(vector(1536), uuid, float, int);

CREATE OR REPLACE FUNCTION match_sections(
  query_embedding vector(1536),
  chapter_id_param uuid,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  section_number text,  -- Changed from int to text
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
