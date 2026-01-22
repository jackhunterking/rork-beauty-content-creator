-- Add captured_image_background_info column to drafts table
-- This stores per-slot background info for transparent PNGs (from AI background replacement)
-- Structure: { "slot-id": { type: "solid" | "gradient", solidColor?: string, gradient?: { type, colors, direction } } }

ALTER TABLE drafts 
ADD COLUMN IF NOT EXISTS captured_image_background_info JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN drafts.captured_image_background_info IS 'Background info for transparent PNGs (from AI background replacement) - stores solid color or gradient data per slot';
