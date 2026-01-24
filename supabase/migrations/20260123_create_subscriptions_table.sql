-- Migration: Create subscriptions table - THE SINGLE SOURCE OF TRUTH for subscription status
-- This table is synced from Superwall webhooks or admin grants

-- Create subscriptions table
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Subscription Status (THE source of truth)
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'studio')),
    source TEXT NOT NULL DEFAULT 'none' CHECK (source IN ('none', 'superwall', 'admin')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'grace_period')),
    
    -- Superwall Data (populated by webhook)
    superwall_product_id TEXT,
    superwall_transaction_id TEXT,
    superwall_original_transaction_id TEXT,
    superwall_expires_at TIMESTAMPTZ,
    superwall_purchased_at TIMESTAMPTZ,
    superwall_environment TEXT CHECK (superwall_environment IS NULL OR superwall_environment IN ('PRODUCTION', 'SANDBOX')),
    
    -- Admin Grant Data (populated when admin grants access)
    admin_granted_by TEXT,
    admin_granted_at TIMESTAMPTZ,
    admin_expires_at TIMESTAMPTZ,
    admin_notes TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure one subscription per user
    CONSTRAINT unique_user_subscription UNIQUE(user_id)
);

-- Comments for documentation
COMMENT ON TABLE public.subscriptions IS 'Single source of truth for user subscription status. Synced from Superwall webhooks or admin grants.';
COMMENT ON COLUMN public.subscriptions.tier IS 'Subscription tier: free (default), pro (download/share), studio (pro + AI features)';
COMMENT ON COLUMN public.subscriptions.source IS 'Where the subscription came from: none (free), superwall (paid), admin (complimentary)';
COMMENT ON COLUMN public.subscriptions.status IS 'Current subscription status for lifecycle tracking';

-- Indexes for common queries
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_tier ON public.subscriptions(tier);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);

-- Create subscription_history table for audit trail
CREATE TABLE public.subscription_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    
    -- Event Details
    event_type TEXT NOT NULL,
    event_source TEXT NOT NULL CHECK (event_source IN ('superwall_webhook', 'admin_action', 'system')),
    
    -- Snapshot of state at event time
    tier_before TEXT,
    tier_after TEXT,
    status_before TEXT,
    status_after TEXT,
    
    -- Raw event data (for debugging)
    raw_payload JSONB,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT -- admin email or 'webhook' or 'system'
);

COMMENT ON TABLE public.subscription_history IS 'Audit trail of all subscription changes for compliance and debugging';

-- Indexes for querying history
CREATE INDEX idx_subscription_history_user_id ON public.subscription_history(user_id);
CREATE INDEX idx_subscription_history_created_at ON public.subscription_history(created_at DESC);
CREATE INDEX idx_subscription_history_event_type ON public.subscription_history(event_type);

-- Auto-update updated_at trigger for subscriptions
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_subscriptions_updated_at();

-- Auto-create subscription row when a new profile is created
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.subscriptions (user_id, tier, source, status)
    VALUES (NEW.id, 'free', 'none', 'active')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_create_subscription_on_profile
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION create_default_subscription();
