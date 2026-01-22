-- Migration: Add subscription tier columns for tiered monetization
-- Tiers: 'free', 'pro', 'studio'
-- Sources: 'superwall' (paid), 'complimentary' (admin-assigned for influencers/partners)

-- Add subscription_tier column with default 'free'
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';

-- Add constraint for valid tiers (safely - check if exists first)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_subscription_tier'
  ) THEN
    ALTER TABLE profiles 
    ADD CONSTRAINT valid_subscription_tier 
    CHECK (subscription_tier IN ('free', 'pro', 'studio'));
  END IF;
END $$;

-- Add subscription_tier_source column to track where tier came from
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_tier_source TEXT;

-- Add constraint for valid sources (safely - check if exists first)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_subscription_tier_source'
  ) THEN
    ALTER TABLE profiles 
    ADD CONSTRAINT valid_subscription_tier_source 
    CHECK (subscription_tier_source IS NULL OR subscription_tier_source IN ('superwall', 'complimentary'));
  END IF;
END $$;

-- Migrate existing complimentary pro users to the new tier system
UPDATE profiles 
SET subscription_tier = 'pro', 
    subscription_tier_source = 'complimentary' 
WHERE is_complimentary_pro = true;

-- Note: We keep is_complimentary_pro column for now for backwards compatibility
-- It will be removed in a future migration after code cleanup is complete

-- Add index for querying users by tier (useful for analytics)
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON profiles(subscription_tier);
