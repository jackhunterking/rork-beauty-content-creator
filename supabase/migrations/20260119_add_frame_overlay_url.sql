-- Add frame_overlay_url column to templates table
-- This stores the PNG URL with transparent slots and background for client-side compositing

ALTER TABLE templates
ADD COLUMN IF NOT EXISTS frame_overlay_url TEXT DEFAULT NULL;

COMMENT ON COLUMN templates.frame_overlay_url IS 
'PNG URL with transparent slots and background - for client-side compositing';
