-- Migration: Add is_premium flag to templates table
-- This enables premium template gating for the Pro subscription tier

-- Add is_premium flag to templates table
ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;

-- Index for efficient filtering by premium status
CREATE INDEX IF NOT EXISTS idx_templates_is_premium ON templates(is_premium);

-- Ensure all existing templates have a value (default to free)
UPDATE templates SET is_premium = false WHERE is_premium IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN templates.is_premium IS 'When true, template is only available to Pro subscribers';
