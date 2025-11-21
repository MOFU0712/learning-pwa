-- Add function to search sections by book_id (not just chapter_id)
-- This allows searching across all chapters in a book

CREATE OR REPLACE FUNCTION match_sections_by_book(
  query_embedding vector(1536),
  book_id_param uuid,
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  chapter_id uuid,
  section_number text,
  title text,
  content text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    sections.id,
    sections.chapter_id,
    sections.section_number,
    sections.title,
    sections.content,
    1 - (sections.content_vector <=> query_embedding) AS similarity
  FROM sections
  JOIN chapters ON chapters.id = sections.chapter_id
  WHERE chapters.book_id = book_id_param
    AND sections.content_vector IS NOT NULL
    AND 1 - (sections.content_vector <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

COMMENT ON FUNCTION match_sections_by_book IS 'Search for relevant sections across all chapters in a book using vector similarity';
