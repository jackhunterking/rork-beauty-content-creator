-- Create feedback table for user messages and suggestions
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to insert feedback (both authenticated and anonymous users)
CREATE POLICY "Anyone can submit feedback"
  ON public.feedback
  FOR INSERT
  WITH CHECK (true);

-- Policy: Users can only read their own feedback (if authenticated)
CREATE POLICY "Users can view own feedback"
  ON public.feedback
  FOR SELECT
  USING (auth.uid() = user_id);

-- Add index for faster queries by status (for admin use)
CREATE INDEX idx_feedback_status ON public.feedback(status);

-- Add index for user lookups
CREATE INDEX idx_feedback_user_id ON public.feedback(user_id);

-- Add comment to table
COMMENT ON TABLE public.feedback IS 'Stores user feedback and support messages from the app';
