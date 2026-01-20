-- Add theme_layers column to templates table
-- Stores geometry information for theme-colored layers that can be customized by users
-- Theme layers are identified by 'theme-' prefix in Templated.io layer names

ALTER TABLE templates ADD COLUMN IF NOT EXISTS theme_layers JSONB DEFAULT '[]';

-- Add comment for documentation
COMMENT ON COLUMN templates.theme_layers IS 'Array of theme layer geometries extracted from Templated.io. Each entry contains: id, x, y, width, height, rotation, borderRadius. These layers are rendered as colored shapes in the app.';
