-- Migration: Add complimentary pro field to profiles table
-- This allows admins to grant pro access to users without going through Superwall
-- 
-- IMPORTANT: This migration was already applied to production via Supabase MCP tool.
-- This file exists for version control documentation.

-- Add is_complimentary_pro flag to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_complimentary_pro BOOLEAN DEFAULT false;

-- Add complimentary_pro_granted_at to track when access was granted
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS complimentary_pro_granted_at TIMESTAMPTZ;

-- Add complimentary_pro_notes for admin notes
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS complimentary_pro_notes TEXT;

-- Add comments for documentation
COMMENT ON COLUMN profiles.is_complimentary_pro IS 'When true, user has complimentary pro access granted by admin (bypasses Superwall check)';
COMMENT ON COLUMN profiles.complimentary_pro_granted_at IS 'Timestamp when complimentary pro access was granted';
COMMENT ON COLUMN profiles.complimentary_pro_notes IS 'Admin notes about why pro access was granted';

-- ============================================
-- ADMIN SQL COMMANDS FOR REFERENCE
-- ============================================

-- Grant pro access to a user:
-- UPDATE profiles 
-- SET 
--   is_complimentary_pro = true,
--   complimentary_pro_granted_at = NOW(),
--   complimentary_pro_notes = 'Reason for access'
-- WHERE email = 'user@example.com';

-- Revoke pro access:
-- UPDATE profiles 
-- SET 
--   is_complimentary_pro = false,
--   complimentary_pro_notes = 'Revoked - reason'
-- WHERE email = 'user@example.com';

-- List all complimentary pro users:
-- SELECT email, complimentary_pro_granted_at, complimentary_pro_notes
-- FROM profiles
-- WHERE is_complimentary_pro = true;
