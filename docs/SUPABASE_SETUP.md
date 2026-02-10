# Supabase setup for WatermarkFile

You need to **create a Supabase project in your account** (we don’t have access). Then run the steps below.

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. **New project** → choose org, name (e.g. `watermarkfile`), database password, region.
3. Wait for the project to be ready.

---

## 2. Get API keys and URL

In the project: **Settings → API**.

- **Project URL** → use as `SUPABASE_URL`
- **Service role** (secret) key → use as `SUPABASE_SERVICE_ROLE_KEY` (backend only; never expose in frontend)

---

## 3. Run the database schema

In Supabase: **SQL Editor** → New query → paste and run the SQL below.

**Important:** Copy only the SQL. Do **not** paste markdown (e.g. lines starting with `#`) into the SQL Editor — `#` is not valid SQL and causes "syntax error at or near '#'". Use `--` for single-line comments in SQL. The file `docs/supabase-schema.sql` contains only valid SQL; you can copy that entire file.

```sql
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

-- Service role bypasses RLS, so backend can still read/write. Policies above block anon/auth.
```

(If you prefer to allow the backend via a dedicated role, you can change policies; with the service role key the backend bypasses RLS.)

---

## 4. Create Storage bucket

In Supabase: **Storage** → **New bucket**.

- **Name:** `watermarked-files`
- **Public:** Off (private; only backend with service role key should access).
- **Allowed MIME types:** leave empty or set to `application/pdf, image/jpeg, image/png, image/webp`.

Create the bucket. No need to add extra policies if you only use the **service role** from the backend (it has full access).

---

## 5. Environment variables (backend)

Set these where the Node backend runs (e.g. Railway, or locally in `server/.env` or shell):

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Project URL from Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (secret) key from Settings → API |

If these are **not** set, the app still works: watermarking and in-memory download work as today; only Supabase persistence (user stats + file storage) is skipped.

---

## 6. What the backend does with Supabase

When both env vars are set and a request includes a valid `email` (e.g. from the magic-link flow):

- **user_stats:** Upserts by `email`, increments `upload_count`, sets `last_uploaded_at`, `updated_at`, and on first insert **first_used_at** (date/time of first usage for that email). Tracks **usage_count_this_month** and **usage_period_start** for optional monthly caps.
- **uploads:** Inserts a row per saved file (`email`, `file_name`, `storage_path`, `file_size_bytes`, `created_at`).
- **Storage:** Uploads the **original** (un-watermarked) file to `watermarked-files/{sanitized_email}/{date}/{id}_{filename}`.

The watermarked file is still served from the in-memory store for immediate download; Supabase Storage keeps a persistent copy of the **original** file for your records/audit.

---

## 7. First usage and monthly limits

- **first_used_at:** Set once when a given email first appears in `user_stats` (defaults save, magic link, or watermark). Use this for “first month free” logic: e.g. after 30 days from `first_used_at`, direct the user to a payment/subscribe page (handled in your app or a future admin dashboard).
- **max_uploads_per_month:** Optional. `NULL` = unlimited (default). When set to an integer (e.g. 100), the backend checks **usage_count_this_month** before processing; if the user would exceed the limit, the API returns **402** with a message asking them to subscribe or wait until next month. Usage resets by calendar month (UTC).
- **Existing databases:** Run the `ALTER TABLE` and `UPDATE` statements from the bottom of `docs/supabase-schema.sql` once to add the new columns and backfill `first_used_at` from `created_at` where needed.

---

## 8. Troubleshooting: "Failed to save logo"

When a user checks **Save as default** with a logo, the app uploads the logo to Supabase Storage and inserts a row in `user_logo_assets`. If you see **Failed to save logo** (or a more specific message from the server):

1. **Storage bucket missing** – Create the bucket named exactly `watermarked-files` (Storage → New bucket). The error may say "Storage bucket missing or not configured".
2. **Schema not fully applied** – Default logos require the `user_logo_assets` and `user_defaults` tables. Run the full `docs/supabase-schema.sql` in the SQL Editor (not just the snippet in this doc).
3. **Environment variables** – On the host where the backend runs, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. If either is missing, the app returns "Storage not configured" (503).
4. **Server logs** – Check backend logs for `[supabase] saveLogoAsset upload:` or `saveLogoAsset insert:` to see the exact Supabase error.

After the change in this repo, the API returns more specific error messages so you can see whether the failure was storage or database.
