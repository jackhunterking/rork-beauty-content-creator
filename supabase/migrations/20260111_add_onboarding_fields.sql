-- Migration: Add onboarding fields to profiles table
-- This stores user survey responses from the Superwall onboarding flow

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS goals TEXT[],
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE;

-- Add comments for documentation
COMMENT ON COLUMN profiles.industry IS 'User industry from onboarding survey: beauty_wellness, medical_aesthetic, body_art, fitness_health, photography, other, or custom text';
COMMENT ON COLUMN profiles.goals IS 'Array of user goals from onboarding survey: get_customers, online_presence, showcase_work, stand_out';
COMMENT ON COLUMN profiles.onboarding_completed_at IS 'Timestamp when user completed the onboarding flow';
