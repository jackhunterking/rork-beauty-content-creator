-- Add background_type column to templates table
-- Allows templates to specify whether they use an original image/texture background
-- or a solid color background

ALTER TABLE templates
ADD COLUMN IF NOT EXISTS background_type TEXT DEFAULT 'original' CHECK (background_type IN ('original', 'color'));

-- Add comment for documentation
COMMENT ON COLUMN templates.background_type IS 'Type of background: "original" for image/texture backgrounds from Templated.io, "color" for solid color backgrounds';
