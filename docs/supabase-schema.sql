-- WatermarkFile Supabase schema (copy this entire file into SQL Editor; do not paste markdown)
-- User stats: email + upload count + first usage (for first-month-free) + optional monthly cap
CREATE TABLE IF NOT EXISTS public.user_stats (
  email text PRIMARY KEY,
  upload_count int NOT NULL DEFAULT 0,
  last_uploaded_at timestamptz,
  first_used_at timestamptz,
  max_uploads_per_month int DEFAULT NULL,
  usage_count_this_month int NOT NULL DEFAULT 0,
  usage_period_start date DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- If table already exists, add new columns (run once):
-- ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS first_used_at timestamptz;
-- ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS max_uploads_per_month int DEFAULT NULL;
-- ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS usage_count_this_month int NOT NULL DEFAULT 0;
-- ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS usage_period_start date DEFAULT NULL;
-- UPDATE public.user_stats SET first_used_at = created_at WHERE first_used_at IS NULL;

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
  logo_storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- If table already exists, add column (run once):
-- ALTER TABLE public.user_defaults ADD COLUMN IF NOT EXISTS logo_storage_path text;

-- Logo assets per user: each uploaded logo is stored; one can be the current default (user_defaults.logo_storage_path).
CREATE TABLE IF NOT EXISTS public.user_logo_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  storage_path text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_logo_assets_email ON public.user_logo_assets (email);
-- At most one default per email:
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_logo_assets_email_default ON public.user_logo_assets (email) WHERE is_default = true;

-- If table already exists (run once): create user_logo_assets and RLS as above; no backfill needed.

ALTER TABLE public.user_logo_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only on user_logo_assets" ON public.user_logo_assets;
CREATE POLICY "Service role only on user_logo_assets"
  ON public.user_logo_assets FOR ALL
  USING (false)
  WITH CHECK (false);

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
