-- Add default_weight column to custom_fonts table
-- Used to specify the default font weight to use when rendering text
-- For variable fonts, this indicates which weight from the font file to use

ALTER TABLE custom_fonts ADD COLUMN IF NOT EXISTS default_weight VARCHAR(10) DEFAULT '400';

-- Add comment for documentation
COMMENT ON COLUMN custom_fonts.default_weight IS 'Default font weight to use (100-900). For variable fonts, specifies which weight variation to apply.';
