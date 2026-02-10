-- WatermarkFile Supabase schema (copy this entire file into SQL Editor; do not paste markdown)
-- User stats: email + upload count
CREATE TABLE IF NOT EXISTS public.user_stats (
  email text PRIMARY KEY,
  upload_count int NOT NULL DEFAULT 0,
  last_uploaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Optional: log each saved file for listing/audit
CREATE TABLE IF NOT EXISTS public.uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  file_size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for listing by user
CREATE INDEX IF NOT EXISTS idx_uploads_email ON public.uploads (email);
CREATE INDEX IF NOT EXISTS idx_uploads_created_at ON public.uploads (created_at DESC);

-- User watermark defaults (for email-in flow: look up by sender email)
CREATE TABLE IF NOT EXISTS public.user_defaults (
  email text PRIMARY KEY,
  mode text NOT NULL DEFAULT 'text',
  text_value text NOT NULL DEFAULT '',
  template text NOT NULL DEFAULT 'diagonal-center',
  scope text NOT NULL DEFAULT 'all-pages',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: only service role (backend) can read/write
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only on user_stats" ON public.user_stats;
CREATE POLICY "Service role only on user_stats"
  ON public.user_stats FOR ALL
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Service role only on uploads" ON public.uploads;
CREATE POLICY "Service role only on uploads"
  ON public.uploads FOR ALL
  USING (false)
  WITH CHECK (false);

ALTER TABLE public.user_defaults ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only on user_defaults" ON public.user_defaults;
CREATE POLICY "Service role only on user_defaults"
  ON public.user_defaults FOR ALL
  USING (false)
  WITH CHECK (false);

-- Service role bypasses RLS, so backend can still read/write. Policies above block anon/auth.
