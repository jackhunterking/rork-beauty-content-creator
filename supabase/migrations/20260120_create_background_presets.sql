-- Background Preset Options for AI Background Replace
-- Uses prompts for fal-ai/image-editing/background-change endpoint
-- Migration: 20260120_create_background_presets.sql

CREATE TABLE background_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,  -- 'studio', 'solid', 'nature', 'blur', 'professional'
    prompt TEXT NOT NULL,  -- AI prompt for background generation
    negative_prompt TEXT,  -- What to avoid in generated background
    preview_url TEXT,  -- Preview thumbnail URL (can be added later)
    preview_color TEXT,  -- Fallback color if no preview image
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_premium BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for active presets lookup
CREATE INDEX idx_background_presets_active ON background_presets(is_active, sort_order);
CREATE INDEX idx_background_presets_category ON background_presets(category, is_active);

-- Enable RLS
ALTER TABLE background_presets ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active presets
CREATE POLICY "Authenticated users can view active presets"
    ON background_presets FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Seed initial presets (prompts optimized for background-change endpoint)
INSERT INTO background_presets (name, category, prompt, negative_prompt, preview_color, sort_order, is_premium) VALUES
-- Free presets (3 options)
(
    'Studio White', 
    'studio', 
    'clean pure white studio background, professional photography lighting, soft even illumination, no shadows, seamless backdrop', 
    'distracting elements, patterns, objects, text, shadows, wrinkles',
    '#FFFFFF',
    0, 
    false
),
(
    'Studio Gray', 
    'studio', 
    'professional gray gradient studio background, subtle shadows, photography backdrop, neutral tones, smooth transition from light to dark gray', 
    'harsh shadows, distracting elements, patterns, color casts',
    '#9CA3AF',
    1, 
    false
),
(
    'Soft Blur', 
    'blur', 
    'soft blurred background, shallow depth of field, beautiful bokeh effect, dreamy atmosphere, creamy smooth blur, neutral colors', 
    'sharp objects, text, faces, recognizable shapes, harsh edges',
    '#D1D5DB',
    2, 
    false
),

-- Premium presets
(
    'Studio Black', 
    'studio', 
    'dramatic black studio background, professional photography, subtle rim lighting effect, elegant dark backdrop, deep shadows', 
    'gray areas, distracting elements, light leaks, uneven darkness',
    '#1F2937',
    10, 
    true
),
(
    'Warm Cream', 
    'solid', 
    'warm cream beige solid background, soft professional lighting, elegant neutral tone, subtle warmth, clean and minimal', 
    'patterns, textures, distractions, cold tones, shadows',
    '#F5F0E8',
    11, 
    true
),
(
    'Cool Blue', 
    'solid', 
    'cool light blue solid background, professional studio lighting, calming corporate tone, clean and modern', 
    'patterns, textures, warm tones, distracting elements',
    '#DBEAFE',
    12, 
    true
),
(
    'Nature Outdoor', 
    'nature', 
    'beautiful outdoor nature background, soft sunlight filtering through leaves, green foliage with soft bokeh, peaceful garden setting, natural lighting', 
    'people, buildings, text, harsh shadows, urban elements, dead plants',
    '#86EFAC',
    20, 
    true
),
(
    'Beach Sunset', 
    'nature', 
    'beautiful beach sunset background, warm golden hour lighting, soft sand and gentle waves, tropical paradise feeling, warm orange and pink sky', 
    'harsh sun, silhouettes, dark shadows, people, buildings',
    '#FCD34D',
    21, 
    true
),
(
    'Mountain Vista', 
    'nature', 
    'majestic mountain landscape background, soft misty atmosphere, pine trees, serene nature, professional outdoor photography', 
    'people, buildings, vehicles, harsh lighting, urban elements',
    '#A7F3D0',
    22, 
    true
),
(
    'Modern Office', 
    'professional', 
    'modern professional office background, clean minimalist workspace, blurred contemporary interior design, business environment', 
    'messy, cluttered, people, specific logos, personal items',
    '#E5E7EB',
    30, 
    true
),
(
    'Luxury Minimal', 
    'professional', 
    'luxury minimalist background, subtle marble texture, soft professional lighting, high-end aesthetic, elegant and sophisticated', 
    'busy patterns, bright colors, clutter, cheap materials',
    '#F3F4F6',
    31, 
    true
),
(
    'Urban City', 
    'professional', 
    'modern urban cityscape background, blurred skyscrapers, professional metropolitan setting, contemporary business environment', 
    'specific landmarks, people, vehicles, harsh sunlight, night scenes',
    '#6B7280',
    32, 
    true
),
(
    'Sunset Golden', 
    'nature', 
    'beautiful golden hour sunset background, warm orange and pink tones, soft clouds, magical lighting, dreamy atmosphere', 
    'harsh sun, silhouettes, dark shadows, night elements',
    '#FDBA74',
    23, 
    true
),
(
    'Gradient Pink', 
    'solid', 
    'soft pink to purple gradient background, smooth color transition, modern aesthetic, social media ready, vibrant but elegant', 
    'harsh lines, patterns, textures, uneven color',
    '#F9A8D4',
    13, 
    true
),
(
    'Deep Navy', 
    'solid', 
    'deep navy blue solid background, professional corporate tone, elegant and authoritative, rich color depth', 
    'patterns, light streaks, uneven color, purple tones',
    '#1E3A5F',
    14, 
    true
);

-- Add comments
COMMENT ON TABLE background_presets IS 'Preset backgrounds for AI background replacement feature';
COMMENT ON COLUMN background_presets.prompt IS 'AI prompt sent to fal-ai/image-editing/background-change';
COMMENT ON COLUMN background_presets.negative_prompt IS 'What to avoid in generated backgrounds';
COMMENT ON COLUMN background_presets.preview_color IS 'Fallback color to display if preview_url not available';
COMMENT ON COLUMN background_presets.is_premium IS 'Whether preset requires premium subscription';
