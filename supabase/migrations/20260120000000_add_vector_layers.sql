-- Add vector_layers column for storing SVG icon/vector data
-- Used for client-side rendering of icons and arrows with react-native-svg

ALTER TABLE templates
ADD COLUMN IF NOT EXISTS vector_layers JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN templates.vector_layers IS 'Vector layer geometries for rendering icons with react-native-svg. Contains SVG path data, viewBox, fill color, and rotation.';
