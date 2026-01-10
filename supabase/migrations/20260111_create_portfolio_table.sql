-- Create portfolio table for storing finished work
-- This replaces the old SavedAsset concept stored in AsyncStorage

CREATE TABLE IF NOT EXISTS portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID REFERENCES drafts(id) ON DELETE SET NULL,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  local_path TEXT,
  thumbnail_url TEXT,
  format TEXT NOT NULL CHECK (format IN ('1:1', '9:16')),
  has_watermark BOOLEAN DEFAULT true,
  published_to TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast listing by creation date (most recent first)
CREATE INDEX IF NOT EXISTS idx_portfolio_created_at ON portfolio(created_at DESC);

-- Index for looking up portfolio items by template
CREATE INDEX IF NOT EXISTS idx_portfolio_template_id ON portfolio(template_id);

-- Enable Row Level Security (RLS)
-- Note: For now, portfolio items are public. Add user_id column when auth is implemented.
ALTER TABLE portfolio ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (no auth yet)
CREATE POLICY "Allow all operations on portfolio" ON portfolio
  FOR ALL
  USING (true)
  WITH CHECK (true);
