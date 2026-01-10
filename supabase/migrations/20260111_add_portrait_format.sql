-- Migration: Add 4:5 (Portrait) format for Instagram Posts
-- This updates the format constraint to include the new aspect ratio

-- Drop the existing constraint
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_format_check;

-- Add new constraint with 4:5 included
ALTER TABLE templates ADD CONSTRAINT templates_format_check 
  CHECK (format = ANY (ARRAY['4:5'::text, '1:1'::text, '9:16'::text]));

-- Note: Default remains '1:1' for backwards compatibility
-- New templates should use '4:5' for Instagram Posts
