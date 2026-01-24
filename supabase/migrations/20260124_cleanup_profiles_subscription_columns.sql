-- Migration: Cleanup deprecated subscription columns from profiles table
-- 
-- IMPORTANT: This migration should be applied AFTER verifying the new 
-- subscriptions table system is working correctly in production.
-- 
-- The subscription data has been moved to the `subscriptions` table which is 
-- now the SINGLE SOURCE OF TRUTH for user subscription status.
--
-- Columns being removed:
-- - is_premium: Was never synced from Superwall
-- - subscription_tier: Moved to subscriptions.tier
-- - subscription_tier_source: Moved to subscriptions.source
-- - is_complimentary_pro: Replaced by subscriptions.source = 'admin'
-- - complimentary_pro_granted_at: Moved to subscriptions.admin_granted_at
-- - complimentary_pro_notes: Moved to subscriptions.admin_notes

-- First, drop the constraints
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS valid_subscription_tier;

ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS valid_subscription_tier_source;

-- Drop the index
DROP INDEX IF EXISTS idx_profiles_subscription_tier;

-- Remove the deprecated columns
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS is_premium;

ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS subscription_tier;

ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS subscription_tier_source;

ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS is_complimentary_pro;

ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS complimentary_pro_granted_at;

ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS complimentary_pro_notes;

-- Add comment documenting the change
COMMENT ON TABLE public.profiles IS 'User profiles linked to auth.users for account management. Subscription data is stored in the subscriptions table.';
