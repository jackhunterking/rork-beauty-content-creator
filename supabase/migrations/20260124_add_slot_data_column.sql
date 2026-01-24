-- Migration: Add unified slot_data column to drafts table
-- 
-- This migration adds a single JSONB column that replaces the fragmented
-- captured_image_urls, captured_image_adjustments, and captured_image_background_info columns.
-- 
-- The slot_data column stores ALL slot information in a unified structure:
-- {
--   "slot-before": {
--     "uri": "https://...",
--     "width": 1080,
--     "height": 1080,
--     "adjustments": { "scale": 1, "translateX": 0, "translateY": 0, "rotation": 0 },
--     "ai": {
--       "originalUri": "https://...",
--       "enhancementsApplied": ["background_replace"],
--       "transparentPngUrl": "https://...",
--       "backgroundInfo": { "type": "solid", "solidColor": "#FF0000" }
--     }
--   }
-- }
--
-- Benefits:
-- 1. Single source of truth - all slot data in one place
-- 2. Atomic updates - no sync issues between columns
-- 3. Trivial save/load - direct JSON serialization
-- 4. Extensible - adding new slot properties is just adding to the object

-- Add the unified slot_data column
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS slot_data JSONB DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN drafts.slot_data IS 'Unified slot data containing all slot information: uri, dimensions, adjustments, and AI enhancement state. Replaces fragmented captured_image_* columns.';

-- Create an index for faster queries on slot_data
-- This helps with queries that filter by slot content
CREATE INDEX IF NOT EXISTS idx_drafts_slot_data ON drafts USING GIN (slot_data);
