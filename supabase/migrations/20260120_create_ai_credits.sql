-- User AI Credits Table
-- Tracks credit balance per user with monthly reset
-- Migration: 20260120_create_ai_credits.sql

CREATE TABLE ai_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credits_remaining INTEGER NOT NULL DEFAULT 0,
    credits_used_this_period INTEGER NOT NULL DEFAULT 0,
    monthly_allocation INTEGER NOT NULL DEFAULT 10,  -- Credits allocated per period
    period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', NOW()),
    period_end TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', NOW()) + INTERVAL '1 month'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Index for user lookup
CREATE INDEX idx_ai_credits_user ON ai_credits(user_id);

-- Enable RLS
ALTER TABLE ai_credits ENABLE ROW LEVEL SECURITY;

-- Users can view their own credits
CREATE POLICY "Users can view own credits"
    ON ai_credits FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Users can insert their own credits record (for initialization)
CREATE POLICY "Users can create own credits record"
    ON ai_credits FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own credits (for credit operations)
CREATE POLICY "Users can update own credits"
    ON ai_credits FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_ai_credits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_credits_updated_at
    BEFORE UPDATE ON ai_credits
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_credits_updated_at();

-- Function to check and reset credits if period expired
-- Called before any credit operation
-- Uses INSERT ON CONFLICT to handle race conditions with concurrent requests
CREATE OR REPLACE FUNCTION check_and_reset_ai_credits(p_user_id UUID)
RETURNS ai_credits AS $$
DECLARE
    v_credits ai_credits;
BEGIN
    -- First, try to get existing record
    SELECT * INTO v_credits FROM ai_credits WHERE user_id = p_user_id;
    
    IF v_credits IS NULL THEN
        -- Use INSERT ON CONFLICT to handle race conditions
        INSERT INTO ai_credits (user_id, credits_remaining, monthly_allocation)
        VALUES (p_user_id, 10, 10)
        ON CONFLICT (user_id) DO NOTHING;
        
        -- Re-fetch the record (either our insert or the concurrent one)
        SELECT * INTO v_credits FROM ai_credits WHERE user_id = p_user_id;
    ELSIF v_credits.period_end < NOW() THEN
        -- Reset credits for new period
        UPDATE ai_credits
        SET 
            credits_remaining = monthly_allocation,
            credits_used_this_period = 0,
            period_start = date_trunc('month', NOW()),
            period_end = date_trunc('month', NOW()) + INTERVAL '1 month'
        WHERE user_id = p_user_id
        RETURNING * INTO v_credits;
    END IF;
    
    RETURN v_credits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deduct credits (returns true if successful, false if insufficient)
CREATE OR REPLACE FUNCTION deduct_ai_credits(p_user_id UUID, p_amount INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    v_credits ai_credits;
BEGIN
    -- First check and reset if needed
    v_credits := check_and_reset_ai_credits(p_user_id);
    
    -- Check if user has enough credits
    IF v_credits.credits_remaining < p_amount THEN
        RETURN FALSE;
    END IF;
    
    -- Deduct credits
    UPDATE ai_credits
    SET 
        credits_remaining = credits_remaining - p_amount,
        credits_used_this_period = credits_used_this_period + p_amount
    WHERE user_id = p_user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to refund credits (in case of failed generation)
CREATE OR REPLACE FUNCTION refund_ai_credits(p_user_id UUID, p_amount INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE ai_credits
    SET 
        credits_remaining = credits_remaining + p_amount,
        credits_used_this_period = GREATEST(0, credits_used_this_period - p_amount)
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add bonus credits (for purchases or promotions)
CREATE OR REPLACE FUNCTION add_ai_credits(p_user_id UUID, p_amount INTEGER)
RETURNS VOID AS $$
BEGIN
    -- Ensure record exists
    PERFORM check_and_reset_ai_credits(p_user_id);
    
    -- Add credits
    UPDATE ai_credits
    SET credits_remaining = credits_remaining + p_amount
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE ai_credits IS 'Tracks AI credit balance per user with automatic monthly reset';
COMMENT ON COLUMN ai_credits.credits_remaining IS 'Current available credits';
COMMENT ON COLUMN ai_credits.credits_used_this_period IS 'Credits used in current billing period';
COMMENT ON COLUMN ai_credits.monthly_allocation IS 'Credits allocated at start of each period';
COMMENT ON FUNCTION check_and_reset_ai_credits IS 'Gets user credits, creates record if needed, resets if period expired';
COMMENT ON FUNCTION deduct_ai_credits IS 'Deducts credits from user balance, returns false if insufficient';
COMMENT ON FUNCTION refund_ai_credits IS 'Refunds credits to user (for failed generations)';
COMMENT ON FUNCTION add_ai_credits IS 'Adds bonus credits to user balance';
