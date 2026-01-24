-- Migration: Add RLS policies for subscriptions and subscription_history tables
-- Important: Service role (used by webhook/admin functions) bypasses RLS automatically

-- Enable RLS on subscriptions table
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription
CREATE POLICY "Users can view own subscription"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users CANNOT modify their own subscription (only webhooks/admin via service role can)
-- No INSERT/UPDATE/DELETE policies for regular users!
-- The service_role has BYPASSRLS attribute so no policy needed for webhooks

-- Enable RLS on subscription_history table
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription history
CREATE POLICY "Users can view own subscription history"
ON public.subscription_history
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE for regular users - only service role
