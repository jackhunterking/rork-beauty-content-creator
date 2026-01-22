-- Add theme_color column to drafts table
-- This stores the user's customized theme color for theme layers (hex format, e.g., "#FF00F6")
-- When null, the editor uses the template's default theme color

ALTER TABLE drafts
ADD COLUMN IF NOT EXISTS theme_color TEXT;

-- Add comment for documentation
COMMENT ON COLUMN drafts.theme_color IS 'User-customized theme color for theme layers (hex color format, e.g., #FF00F6). When null, uses template default.';
