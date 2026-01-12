-- Create app_config table for remote app configuration including forced updates
-- Uses single-row pattern with id = 'global' for simplicity

CREATE TABLE public.app_config (
  id TEXT PRIMARY KEY DEFAULT 'global',
  
  -- Version control for forced updates
  min_ios_version TEXT NOT NULL DEFAULT '1.0.0',
  min_android_version TEXT NOT NULL DEFAULT '1.0.0',
  force_update_enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Customizable update message shown to users
  update_message TEXT NOT NULL DEFAULT 'A new version of the app is available. Please update to continue using the app.',
  
  -- Store URLs for update buttons
  store_url_ios TEXT DEFAULT 'https://apps.apple.com/app/resulta/id0000000000',
  store_url_android TEXT DEFAULT 'https://play.google.com/store/apps/details?id=app.resulta.android',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure only one row exists
  CONSTRAINT single_row CHECK (id = 'global')
);

-- Add comment
COMMENT ON TABLE public.app_config IS 'Global app configuration including forced update settings. Single row with id=global.';

-- Insert the default global config row
INSERT INTO public.app_config (id) VALUES ('global');

-- Enable RLS (but allow public read access for the config)
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read the config (no auth required)
-- This is intentional - app config needs to be readable before user authenticates
CREATE POLICY "Anyone can read app config" ON public.app_config
  FOR SELECT USING (true);

-- Only service role can modify (done via Supabase dashboard or admin API)
-- No INSERT/UPDATE/DELETE policies for anon users

-- Auto-update updated_at on changes
CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
