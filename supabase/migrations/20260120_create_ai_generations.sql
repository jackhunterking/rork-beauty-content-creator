-- AI Generation History Table
-- Tracks all AI operations for analytics and cost tracking
-- Migration: 20260120_create_ai_generations.sql

CREATE TABLE ai_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    draft_id UUID REFERENCES drafts(id) ON DELETE SET NULL,
    slot_id TEXT,  -- Which slot the image belongs to (e.g., 'slot_1')
    
    -- Feature info (denormalized for analytics)
    feature_key TEXT NOT NULL,  -- 'auto_quality', 'background_remove', 'background_replace'
    model_id TEXT NOT NULL,  -- e.g., 'fal-ai/creative-upscaler'
    provider TEXT NOT NULL DEFAULT 'fal_ai',
    
    -- Input/Output
    input_image_url TEXT NOT NULL,  -- Original image URL
    output_image_url TEXT,  -- Enhanced image URL (null until completed)
    input_params JSONB DEFAULT '{}',  -- Parameters sent to the model
    
    -- For background_replace, store the preset used
    background_preset_id UUID REFERENCES background_presets(id) ON DELETE SET NULL,
    custom_prompt TEXT,  -- Custom prompt if not using preset
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed
    error_message TEXT,  -- Error details if failed
    error_code TEXT,  -- Error code for categorization
    
    -- Cost tracking
    credits_charged INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd DECIMAL(10,6),  -- Actual API cost for analytics
    
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    processing_time_ms INTEGER,  -- Time taken to process
    
    -- Metadata
    app_version TEXT,  -- App version for debugging
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_ai_generations_user ON ai_generations(user_id, created_at DESC);
CREATE INDEX idx_ai_generations_status ON ai_generations(status);
CREATE INDEX idx_ai_generations_feature ON ai_generations(feature_key, created_at DESC);
CREATE INDEX idx_ai_generations_draft ON ai_generations(draft_id) WHERE draft_id IS NOT NULL;

-- Enable RLS
ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;

-- Users can view their own generations
CREATE POLICY "Users can view own generations"
    ON ai_generations FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Users can insert their own generations
CREATE POLICY "Users can create own generations"
    ON ai_generations FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own generations (for status updates)
CREATE POLICY "Users can update own generations"
    ON ai_generations FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Function to create a new generation record
CREATE OR REPLACE FUNCTION create_ai_generation(
    p_user_id UUID,
    p_feature_key TEXT,
    p_input_image_url TEXT,
    p_draft_id UUID DEFAULT NULL,
    p_slot_id TEXT DEFAULT NULL,
    p_input_params JSONB DEFAULT '{}',
    p_background_preset_id UUID DEFAULT NULL,
    p_custom_prompt TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_config ai_model_config;
    v_generation_id UUID;
BEGIN
    -- Get config for the feature
    SELECT * INTO v_config FROM ai_model_config WHERE feature_key = p_feature_key AND is_enabled = true;
    
    IF v_config IS NULL THEN
        RAISE EXCEPTION 'Feature % not found or disabled', p_feature_key;
    END IF;
    
    -- Create generation record
    INSERT INTO ai_generations (
        user_id,
        draft_id,
        slot_id,
        feature_key,
        model_id,
        provider,
        input_image_url,
        input_params,
        background_preset_id,
        custom_prompt,
        credits_charged,
        status
    ) VALUES (
        p_user_id,
        p_draft_id,
        p_slot_id,
        p_feature_key,
        v_config.model_id,
        v_config.provider,
        p_input_image_url,
        COALESCE(p_input_params, v_config.default_params),
        p_background_preset_id,
        p_custom_prompt,
        v_config.cost_credits,
        'pending'
    )
    RETURNING id INTO v_generation_id;
    
    RETURN v_generation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update generation status
CREATE OR REPLACE FUNCTION update_ai_generation_status(
    p_generation_id UUID,
    p_status TEXT,
    p_output_url TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_error_code TEXT DEFAULT NULL,
    p_processing_time_ms INTEGER DEFAULT NULL,
    p_estimated_cost_usd DECIMAL DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE ai_generations
    SET 
        status = p_status,
        output_image_url = COALESCE(p_output_url, output_image_url),
        error_message = p_error_message,
        error_code = p_error_code,
        processing_time_ms = p_processing_time_ms,
        estimated_cost_usd = p_estimated_cost_usd,
        completed_at = CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE NULL END
    WHERE id = p_generation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for generation stats (for analytics)
CREATE OR REPLACE VIEW ai_generation_stats AS
SELECT 
    date_trunc('day', created_at) AS date,
    feature_key,
    COUNT(*) AS total_generations,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed,
    SUM(credits_charged) AS total_credits,
    SUM(estimated_cost_usd) AS total_cost_usd,
    AVG(processing_time_ms) FILTER (WHERE status = 'completed') AS avg_processing_ms
FROM ai_generations
GROUP BY date_trunc('day', created_at), feature_key
ORDER BY date DESC, feature_key;

-- Add comments
COMMENT ON TABLE ai_generations IS 'Tracks all AI generation operations for analytics and debugging';
COMMENT ON COLUMN ai_generations.status IS 'Generation status: pending, processing, completed, failed';
COMMENT ON COLUMN ai_generations.credits_charged IS 'Credits charged for this generation';
COMMENT ON COLUMN ai_generations.estimated_cost_usd IS 'Estimated API cost in USD for cost tracking';
COMMENT ON FUNCTION create_ai_generation IS 'Creates a new generation record with proper config lookup';
COMMENT ON FUNCTION update_ai_generation_status IS 'Updates generation status after processing';
