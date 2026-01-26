-- Add google_font_name column to custom_fonts table
-- This allows admins to link Templated.io font names to their Google Fonts equivalents
-- for automatic weight fallback loading when specific weight files aren't uploaded

ALTER TABLE custom_fonts ADD COLUMN IF NOT EXISTS google_font_name TEXT;

COMMENT ON COLUMN custom_fonts.google_font_name IS 'Official Google Fonts family name (e.g., "League Spartan") for fallback loading when weight-specific files are not uploaded';
