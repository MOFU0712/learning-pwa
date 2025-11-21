-- Fix section_number to TEXT type to support hierarchical numbering (e.g., "1.1.1")
-- Using a workaround for memory limitations

-- Step 1: Drop the unique constraint
ALTER TABLE sections DROP CONSTRAINT IF EXISTS sections_chapter_id_section_number_key;

-- Step 2: Add new TEXT column
ALTER TABLE sections ADD COLUMN section_number_new TEXT;

-- Step 3: Copy data (cast to text)
UPDATE sections SET section_number_new = section_number::TEXT;

-- Step 4: Drop old column
ALTER TABLE sections DROP COLUMN section_number;

-- Step 5: Rename new column
ALTER TABLE sections RENAME COLUMN section_number_new TO section_number;

-- Step 6: Set NOT NULL
ALTER TABLE sections ALTER COLUMN section_number SET NOT NULL;

-- Step 7: Add back unique constraint
ALTER TABLE sections ADD CONSTRAINT sections_chapter_id_section_number_key UNIQUE (chapter_id, section_number);
