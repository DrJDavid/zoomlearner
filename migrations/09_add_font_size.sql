-- Add font_size column to reading_sessions
ALTER TABLE reading_sessions
ADD COLUMN font_size integer DEFAULT 64;

-- Update RLS policies to include font_size
ALTER POLICY "Users can insert own reading sessions" ON reading_sessions
    WITH CHECK (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON COLUMN reading_sessions.font_size IS 'Font size in pixels for this reading session'; 