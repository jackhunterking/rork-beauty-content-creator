-- Migration: Add user_id columns and proper RLS policies for data isolation
-- This fixes a critical security issue where all users could see all drafts and portfolio items

-- ============================================
-- PART 1: Add user_id to drafts table
-- ============================================

-- Add user_id column to drafts
ALTER TABLE public.drafts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster user-specific queries
CREATE INDEX IF NOT EXISTS idx_drafts_user_id ON public.drafts(user_id);

-- ============================================
-- PART 2: Add user_id to portfolio table
-- ============================================

-- Add user_id column to portfolio
ALTER TABLE public.portfolio ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster user-specific queries
CREATE INDEX IF NOT EXISTS idx_portfolio_user_id ON public.portfolio(user_id);

-- ============================================
-- PART 3: Clean up old RLS policies
-- ============================================

-- Drop old open policies on portfolio (if they exist)
DROP POLICY IF EXISTS "Allow all operations on portfolio" ON public.portfolio;

-- Drop old open policies on drafts (if they exist)
DROP POLICY IF EXISTS "Allow all operations on drafts" ON public.drafts;
DROP POLICY IF EXISTS "Enable all access" ON public.drafts;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.drafts;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.drafts;
DROP POLICY IF EXISTS "Enable update for all users" ON public.drafts;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.drafts;
DROP POLICY IF EXISTS "Drafts are publicly deletable" ON public.drafts;
DROP POLICY IF EXISTS "Drafts are publicly insertable" ON public.drafts;
DROP POLICY IF EXISTS "Drafts are publicly updatable" ON public.drafts;
DROP POLICY IF EXISTS "Drafts are publicly readable" ON public.drafts;

-- ============================================
-- PART 4: Enable RLS on both tables
-- ============================================

ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 5: Create proper RLS policies for drafts
-- ============================================

-- Users can only view their own drafts
CREATE POLICY "Users can view own drafts" ON public.drafts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert drafts for themselves
CREATE POLICY "Users can insert own drafts" ON public.drafts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own drafts
CREATE POLICY "Users can update own drafts" ON public.drafts
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only delete their own drafts
CREATE POLICY "Users can delete own drafts" ON public.drafts
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- PART 6: Create proper RLS policies for portfolio
-- ============================================

-- Users can only view their own portfolio items
CREATE POLICY "Users can view own portfolio" ON public.portfolio
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert portfolio items for themselves
CREATE POLICY "Users can insert own portfolio" ON public.portfolio
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own portfolio items
CREATE POLICY "Users can update own portfolio" ON public.portfolio
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only delete their own portfolio items
CREATE POLICY "Users can delete own portfolio" ON public.portfolio
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- PART 7: Data cleanup (optional - delete orphaned records)
-- ============================================

-- Delete drafts without a user_id (orphaned data from before this migration)
-- These are drafts that cannot be associated with any user
DELETE FROM public.drafts WHERE user_id IS NULL;

-- Delete portfolio items without a user_id (orphaned data)
DELETE FROM public.portfolio WHERE user_id IS NULL;

-- ============================================
-- PART 8: Make user_id NOT NULL after cleanup
-- ============================================

-- Now that orphaned data is removed, make user_id required
ALTER TABLE public.drafts ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.portfolio ALTER COLUMN user_id SET NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.drafts.user_id IS 'Owner of the draft - links to auth.users';
COMMENT ON COLUMN public.portfolio.user_id IS 'Owner of the portfolio item - links to auth.users';
