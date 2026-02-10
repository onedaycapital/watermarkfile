# When is user data captured in the database?

This explains when rows are written to Supabase (or why nothing was captured for a given user).

## Requirements for any DB writes

1. **Supabase must be configured on the backend (Railway)**  
   Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Railway. If these are missing, the backend only uses in-memory state and **nothing is written to the database**.

2. **Tables must exist**  
   Run `docs/supabase-schema.sql` in the Supabase SQL Editor so `user_defaults`, `user_stats`, and `uploads` exist with the expected columns and RLS.

---

## When each table gets a row

### `user_defaults`

- **When:** User clicks **Save as default** in step 1 or 2 and completes the flow (with or without the email modal).
- **Trigger:** Frontend calls `POST /api/defaults` with `{ email, defaults }`. Backend calls `upsertUserDefaults(email, payload)` when Supabase is configured.
- **If nothing was captured:** The user never clicked “Save as default”, or the save-defaults request failed (e.g. network, wrong API URL), or Supabase env vars are not set on the backend.

### `user_stats`

- **When:** (1) **Page 2 submit:** User enters email and requests magic link → `POST /api/auth/send-magic-link` records email and file count. (2) **Watermark with email:** `POST /api/watermark` adds success count. (Verify-magic-link and send-results-email do not add again; count is recorded only once.)
- **Trigger:** Supabase configured; send-magic-link or watermark runs with valid email and calls `upsertUserStats`.
- **If nothing was captured:**  
  - **Previously:** Magic-link verify and send-results-email did not write to Supabase; we also only sent `email` in watermark when **verified** (magic link clicked) and had `userEmail` set. So first-time or unverified users (e.g. only typed email in “confirm email to download”) never had their email sent → no stats.  
  - **Now:** We send `email` whenever we have it (stored email, or from the confirm block), so stats can be recorded even before magic-link verification.  
  - Other causes: Supabase not configured, or backend never received `email` (e.g. user never entered email anywhere before running a job).

### `uploads` (and Storage: originals)

- **When:** (1) A **watermark** request that includes a valid `email` → originals are saved immediately. (2) **First run without email:** originals are cached in memory; when the user submits their email on page 2 (magic link), `POST /api/auth/send-magic-link` saves the cached originals to Storage and `uploads` for that email.
- **If nothing was captured:** Supabase not configured, or store entry expired (cleanup after 1h) before they submitted email on page 2.

---

## Example: “User indu04@gmail.com used the system but nothing was captured”

Typical causes:

1. **Email was never sent with the watermark request**  
   - Before the fix: we only sent `email` when `isVerified && userEmail`. So if they never clicked the magic link (or never had their email stored), no email was sent → no `user_stats` or `uploads`.  
   - After the fix: we send email whenever we have it (e.g. from confirm block or stored). So if they run a job **after** entering their email somewhere, the next run will include email and the DB will get stats/uploads.

2. **They never saved defaults**  
   So no row in `user_defaults` (unless they clicked “Save as default” and the request succeeded).

3. **Supabase not configured on Railway**  
   No env vars → no DB writes at all. Check Railway project → Variables → `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

4. **Backend not reachable or wrong URL**  
   If `VITE_API_BASE_URL` in the frontend (Vercel) does not point at the Railway backend, watermark and defaults requests may fail or hit the wrong server; DB writes won’t happen.

---

## Quick checklist when “nothing was captured”

- [ ] Railway has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set.
- [ ] Supabase project has tables and RLS from `docs/supabase-schema.sql`.
- [ ] User has either: saved defaults (so `user_defaults` can be written), or run a watermark **after** we have their email (so `user_stats` / `uploads` can be written).
- [ ] Frontend `VITE_API_BASE_URL` points at the Railway backend in production.
