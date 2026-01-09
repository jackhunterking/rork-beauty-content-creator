-- Migration: Add watermarked_preview_url column to templates table
-- This stores a preview with the watermark layer visible, shown to free users in Editor
--
-- Preview URL Strategy:
-- - thumbnail: Clean catalog preview (shown in Create tab for all users)
-- - templated_preview_url: Clean template preview (shown to Pro users in Editor)
-- - watermarked_preview_url: Preview WITH watermark (shown to Free users in Editor)

ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS watermarked_preview_url TEXT;

COMMENT ON COLUMN templates.watermarked_preview_url IS 
  'Preview with watermark layer visible - shown to free users in Editor';
