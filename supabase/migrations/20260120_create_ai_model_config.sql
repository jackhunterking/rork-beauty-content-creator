-- AI Model Configuration Table
-- Allows changing AI models without app updates
-- Migration: 20260120_create_ai_model_config.sql

CREATE TABLE ai_model_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_key TEXT NOT NULL UNIQUE,  -- 'auto_quality', 'background_remove', 'background_replace'
    display_name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'sparkles',  -- Icon name for UI
    provider TEXT NOT NULL DEFAULT 'fal_ai',  -- Provider abstraction for future flexibility
    model_id TEXT NOT NULL,  -- e.g., 'fal-ai/creative-upscaler'
    model_version TEXT,  -- Optional version pinning
    endpoint_url TEXT,  -- N8N webhook URL (set via admin)
    default_params JSONB DEFAULT '{}',  -- Default parameters for the model
    system_prompt TEXT,  -- For models that support prompts
    cost_credits INTEGER NOT NULL DEFAULT 1,  -- Credits consumed per use
    is_enabled BOOLEAN NOT NULL DEFAULT true,  -- Can disable features remotely
    is_premium_only BOOLEAN NOT NULL DEFAULT true,  -- Requires premium subscription
    sort_order INTEGER NOT NULL DEFAULT 0,  -- Display order in UI
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for enabled features lookup
CREATE INDEX idx_ai_model_config_enabled ON ai_model_config(is_enabled, sort_order);

-- Enable RLS (read-only for authenticated users)
ALTER TABLE ai_model_config ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read enabled configs
CREATE POLICY "Authenticated users can view enabled AI configs"
    ON ai_model_config FOR SELECT
    TO authenticated
    USING (is_enabled = true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_ai_model_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_model_config_updated_at
    BEFORE UPDATE ON ai_model_config
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_model_config_updated_at();

-- Seed initial configuration with your tested Fal.AI endpoints
INSERT INTO ai_model_config (
    feature_key, 
    display_name, 
    description, 
    icon,
    provider, 
    model_id, 
    default_params, 
    cost_credits, 
    is_premium_only,
    sort_order
) VALUES
-- AI Auto-Quality: fal-ai/creative-upscaler
(
    'auto_quality', 
    'AI Auto-Quality', 
    'Enhance image clarity, reduce noise, and upscale resolution up to 5x', 
    'sparkles',
    'fal_ai', 
    'fal-ai/creative-upscaler', 
    '{
        "scale": 2, 
        "creativity": 0, 
        "detail": 5, 
        "shape_preservation": 3, 
        "prompt_suffix": "high quality, highly detailed, high resolution, sharp", 
        "negative_prompt": "blurry, low resolution, bad, ugly, low quality, pixelated, interpolated, compression artifacts, noisey, grainy", 
        "guidance_scale": 7.5, 
        "num_inference_steps": 20,
        "enable_safety_checker": true
    }'::jsonb, 
    2, 
    true,
    0
),
-- Background Remove: fal-ai/birefnet/v2
(
    'background_remove', 
    'Remove Background', 
    'Remove image background with AI precision for transparent output', 
    'scissors',
    'fal_ai', 
    'fal-ai/birefnet/v2', 
    '{
        "model": "General", 
        "operating_resolution": "1024x1024", 
        "output_format": "png"
    }'::jsonb, 
    1, 
    true,
    1
),
-- Background Replace: fal-ai/image-editing/background-change
(
    'background_replace', 
    'Replace Background', 
    'Replace background with professional presets or custom images', 
    'image',
    'fal_ai', 
    'fal-ai/image-editing/background-change', 
    '{
        "output_format": "png",
        "negative_prompt": "blurry, distorted, low quality"
    }'::jsonb, 
    2, 
    true,
    2
);

-- Add comment for documentation
COMMENT ON TABLE ai_model_config IS 'Configuration for AI enhancement features. Allows model swapping and feature toggling without app updates.';
COMMENT ON COLUMN ai_model_config.feature_key IS 'Unique identifier for the feature used in code';
COMMENT ON COLUMN ai_model_config.provider IS 'AI provider abstraction (fal_ai, replicate, etc.) for future flexibility';
COMMENT ON COLUMN ai_model_config.default_params IS 'Default parameters sent to the AI model';
COMMENT ON COLUMN ai_model_config.endpoint_url IS 'N8N webhook URL for this feature (set by admin)';
