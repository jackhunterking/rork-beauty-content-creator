-- Add default background and theme colors to templates
-- These store the original design colors so templates load with their intended appearance
-- Users can then customize from these defaults

ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS default_background_color TEXT DEFAULT '#FFFFFF',
ADD COLUMN IF NOT EXISTS default_theme_color TEXT DEFAULT NULL;

-- Add helpful comments for documentation
COMMENT ON COLUMN templates.default_background_color IS 'Original background color of template design (hex). Used to initialize editor background.';
COMMENT ON COLUMN templates.default_theme_color IS 'Original theme color for theme- prefixed layers (hex). Used to initialize theme layer colors.';
