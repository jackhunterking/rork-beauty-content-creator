-- Migration: Migrate existing subscription data from profiles to subscriptions table
-- This creates subscription records for all existing users

-- First, insert subscription records for all existing profiles that don't have one yet
INSERT INTO public.subscriptions (
    user_id,
    tier,
    source,
    status,
    admin_granted_at,
    admin_notes,
    created_at,
    updated_at
)
SELECT 
    p.id,
    COALESCE(p.subscription_tier, 'free'),
    CASE 
        WHEN p.is_complimentary_pro = true THEN 'admin'
        WHEN p.subscription_tier_source = 'superwall' THEN 'superwall'
        WHEN p.subscription_tier_source = 'complimentary' THEN 'admin'
        ELSE 'none'
    END,
    'active',
    p.complimentary_pro_granted_at,
    p.complimentary_pro_notes,
    p.created_at,
    p.updated_at
FROM public.profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM public.subscriptions s WHERE s.user_id = p.id
);

-- Log the migration to subscription_history
INSERT INTO public.subscription_history (
    user_id,
    event_type,
    event_source,
    tier_before,
    tier_after,
    status_before,
    status_after,
    created_by,
    raw_payload
)
SELECT 
    p.id,
    'migration_from_profiles',
    'system',
    'free',
    COALESCE(p.subscription_tier, 'free'),
    'active',
    'active',
    'system_migration',
    jsonb_build_object(
        'source_table', 'profiles',
        'original_subscription_tier', p.subscription_tier,
        'original_subscription_tier_source', p.subscription_tier_source,
        'original_is_complimentary_pro', p.is_complimentary_pro,
        'migration_date', NOW()
    )
FROM public.profiles p;
