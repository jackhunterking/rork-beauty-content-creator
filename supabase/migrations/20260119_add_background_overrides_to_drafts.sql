-- Add background_overrides column to drafts table
-- This column stores user's custom background layer colors for a draft

ALTER TABLE drafts 
ADD COLUMN IF NOT EXISTS background_overrides JSONB DEFAULT '{}';

COMMENT ON COLUMN drafts.background_overrides IS 
'Map of layer ID to fill color for user-customized background layers';

-- Example usage:
-- The column stores data like: {"background_bar": "#FF5733", "left_circle": "#3366FF"}
