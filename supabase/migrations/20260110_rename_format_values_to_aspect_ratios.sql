-- Migration: Rename format values from 'square'/'vertical' to '1:1'/'9:16'
-- This updates the format column in templates table to use aspect ratio names

-- First drop the old constraint
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_format_check;

-- Update existing values
UPDATE templates SET format = '1:1' WHERE format = 'square';
UPDATE templates SET format = '9:16' WHERE format = 'vertical';

-- Add new constraint with updated values
ALTER TABLE templates ADD CONSTRAINT templates_format_check 
  CHECK (format = ANY (ARRAY['1:1'::text, '9:16'::text]));

-- Update default value
ALTER TABLE templates ALTER COLUMN format SET DEFAULT '1:1';
