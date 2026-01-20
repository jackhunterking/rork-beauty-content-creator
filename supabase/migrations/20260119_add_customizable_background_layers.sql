-- Add customizable_background_layers column to templates table
-- This column stores an array of layer IDs from layers_json that users can customize the fill color of

ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS customizable_background_layers JSONB DEFAULT '[]';

COMMENT ON COLUMN templates.customizable_background_layers IS 
'Array of layer IDs from layers_json that users can customize the fill color of';

-- Example usage:
-- UPDATE templates SET customizable_background_layers = '["background_bar", "after_button_background", "left_circle", "right_circle"]' WHERE id = 'template-uuid';
