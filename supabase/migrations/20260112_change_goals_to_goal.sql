-- Migration: Change goals (array) to goal (single string)
-- This simplifies the onboarding survey from multi-select to single-select

-- Drop the old goals column if it exists
ALTER TABLE profiles DROP COLUMN IF EXISTS goals;

-- Add the new goal column (singular, text)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS goal TEXT;

-- Update comment
COMMENT ON COLUMN profiles.goal IS 'User main goal from onboarding survey: get_customers, online_presence, showcase_work, stand_out';
