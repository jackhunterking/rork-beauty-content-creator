-- Create data_deletion_requests table for GDPR/platform compliance
CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    user_id TEXT,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    notes TEXT
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_email ON public.data_deletion_requests(email);

-- Create index on status for admin queries
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_status ON public.data_deletion_requests(status);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_created_at ON public.data_deletion_requests(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert their own deletion request (public access)
CREATE POLICY "Anyone can submit deletion request"
    ON public.data_deletion_requests
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Policy: Users can view their own deletion requests
CREATE POLICY "Users can view their own requests"
    ON public.data_deletion_requests
    FOR SELECT
    TO authenticated
    USING (
        email = auth.jwt() ->> 'email'
        OR user_id = auth.uid()::text
    );

-- Policy: Service role can do everything (for admin/automated processing)
CREATE POLICY "Service role full access"
    ON public.data_deletion_requests
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Add helpful comment
COMMENT ON TABLE public.data_deletion_requests IS 'Stores user data deletion requests for GDPR and platform compliance (Facebook, etc.)';
