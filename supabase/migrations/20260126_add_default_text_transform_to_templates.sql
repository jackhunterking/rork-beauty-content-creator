-- Add default_text_transform column to templates table
-- This controls the text casing transformation applied to text layers

ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS default_text_transform TEXT DEFAULT 'none';

-- Add a comment explaining valid values
COMMENT ON COLUMN templates.default_text_transform IS 'Text transform to apply to text layers. Valid values: none, uppercase, lowercase, capitalize';
