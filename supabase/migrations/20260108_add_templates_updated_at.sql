-- Migration: Add updated_at column to templates table for image cache invalidation
-- This enables expo-image to properly invalidate cached thumbnails when templates are updated

-- Add updated_at column to templates table
ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create or replace trigger function to auto-update timestamp on any row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if exists, then create new one
DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;
CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Backfill existing rows with created_at value (so they have a valid timestamp)
UPDATE templates SET updated_at = created_at WHERE updated_at IS NULL;
