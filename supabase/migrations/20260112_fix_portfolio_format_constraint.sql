-- Migration: Add 4:5 format support to portfolio table
-- Fixes: "Failed to save to your portfolio" error for Portrait (4:5) format images
-- 
-- The original constraint only allowed '1:1' and '9:16'
-- This adds '4:5' to match the templates table constraint

-- Drop the existing constraint
ALTER TABLE portfolio DROP CONSTRAINT IF EXISTS portfolio_format_check;

-- Add new constraint with all supported formats
ALTER TABLE portfolio ADD CONSTRAINT portfolio_format_check 
  CHECK (format = ANY (ARRAY['4:5'::text, '1:1'::text, '9:16'::text]));

-- Add comment for documentation
COMMENT ON CONSTRAINT portfolio_format_check ON portfolio IS 'Allowed formats: 4:5 (Portrait), 1:1 (Square), 9:16 (Vertical)';
