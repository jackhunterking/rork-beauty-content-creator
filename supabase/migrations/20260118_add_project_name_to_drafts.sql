-- Add project_name column for user's personal reference
-- If null, UI will show formatted date as placeholder
ALTER TABLE drafts 
ADD COLUMN project_name TEXT DEFAULT NULL;

COMMENT ON COLUMN drafts.project_name IS 
  'User-editable project name for personal reference. If null, UI shows formatted date.';
