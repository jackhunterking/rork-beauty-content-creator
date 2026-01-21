-- Add captured_image_adjustments column to drafts table
-- Stores pan/zoom/rotation adjustments for each slot image
-- Format: { "slot-id": { "scale": number, "translateX": number, "translateY": number, "rotation": number } }

ALTER TABLE drafts
ADD COLUMN IF NOT EXISTS captured_image_adjustments JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN drafts.captured_image_adjustments IS 'Stores image adjustments (scale, translateX, translateY, rotation) for each slot, keyed by slot layer ID';
