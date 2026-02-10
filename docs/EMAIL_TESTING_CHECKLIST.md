# Email-in & email-out: configuration and testing checklist

Use this to confirm what’s configured and how to test whether **email out** (magic link + “Email me files”) and **email in** (send files to inbound address, get watermarked reply) are working.

---

## 1. Configuration overview

| Feature | Where | Required config |
|--------|--------|------------------|
| **Email out – magic link** | Railway | `APP_ORIGIN`, and either `RESEND_API_KEY` or SMTP vars |
| **Email out – “Email me files”** | Railway | Same as above (same sending path) |
| **Email in** (inbound → reply) | Railway + Resend + Supabase | All of the above, plus Supabase vars, Resend Inbound webhook, and `user_defaults` table |

---

## 2. What to configure

### 2.1 Railway (backend) – required for any email

| Variable | Required for | Notes |
|----------|--------------|--------|
| `APP_ORIGIN` | Magic link, reply copy | Your frontend URL, no trailing slash (e.g. `https://www.watermarkfile.com`) |
| `RESEND_API_KEY` | All email (recommended) | Resend API key (`re_...`). Used to send magic link, “Email me files”, and email-in replies; also to **fetch** inbound attachments. |
| `RESEND_FROM` | Optional | Sender address (e.g. `WatermarkFile <noreply@watermarkfile.com>`). Omit to use Resend sandbox. |

**If you don’t use Resend API:** set SMTP vars instead (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`). See [EMAIL_PRODUCTION.md](./EMAIL_PRODUCTION.md). Email-in **fetching** still needs `RESEND_API_KEY` (Resend Inbound API).

### 2.2 Railway – required only for email-in

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Backend talks to Supabase to read/write user defaults |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for Supabase |

Supabase must have the schema from `docs/supabase-schema.sql` applied (at least `user_defaults`; `user_stats` and storage are used elsewhere too). See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

### 2.3 Resend – required only for email-in

1. **Domains** → your domain (e.g. **watermarkfile.com**) → **Receiving** (Inbound).
2. **Enable Inbound** and set **Webhook URL** to:
   ```text
   https://<your-railway-host>/api/webhooks/inbound-email
   ```
   Example: `https://watermarkfile-production-f560.up.railway.app/api/webhooks/inbound-email`
3. Ensure you have an **inbound address** (e.g. **submit@doc.watermarkfile.com**) that receives mail.

Optional: create an **email.received** webhook in Resend and add `RESEND_WEBHOOK_SECRET` on Railway for signature verification (not implemented in code yet; you can add it later).

### 2.4 Vercel (frontend)

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Must point at your **Railway** backend URL (e.g. `https://your-app.up.railway.app`) so the app can call `/api/auth/send-magic-link`, `/api/send-results-email`, etc. |

No email secrets go on Vercel.

---

## 3. How to test

### 3.1 Email out – magic link

1. Open your **live app** (Vercel URL).
2. Upload at least one file, set watermark options, run the job to the **results** screen.
3. In **“Confirm your email to download”**, enter an email you can access and click **Send magic link**.
4. **Check inbox (and spam).** You should get an email with subject like “Your watermark files are ready – confirm your email” and a button/link “Open and download”.
5. Click the link. It should open your app (same as `APP_ORIGIN`), verify your email, and start the download(s).

**If it fails:**

- No email at all → Backend not sending: check Railway has `RESEND_API_KEY` (or SMTP) and `APP_ORIGIN`; check Railway logs for send errors. Resend sandbox only sends to the Resend account email until domain is verified.
- Link opens wrong site or “Invalid or expired” → `APP_ORIGIN` on Railway must match the exact frontend URL (no trailing slash, HTTPS).
- Frontend can’t reach backend → `VITE_API_BASE_URL` on Vercel must be the Railway backend URL.

### 3.2 Email out – “Email me files”

1. On the **results** screen, turn on **“Email me files”** (or equivalent) before confirming.
2. Enter your email and complete the flow so that the app calls the backend to send the results by email (no magic link).
3. **Check inbox.** You should get an email with subject “Your watermarked files – WatermarkFile” and the watermarked file(s) attached.

**If it fails:** Same as magic link – check Railway env (Resend or SMTP), and that the frontend is calling the Railway backend (`VITE_API_BASE_URL`). Check Railway logs for `[send-results-email]` errors.

### 3.3 Email in (inbound → reply with watermarked files)

**Prerequisites:**

- Railway: `APP_ORIGIN`, `RESEND_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` set.
- Supabase: `user_defaults` table exists (run `docs/supabase-schema.sql`).
- Resend: Inbound enabled for your domain, webhook URL set to `https://<railway-host>/api/webhooks/inbound-email`, and an inbound address (e.g. **submit@doc.watermarkfile.com**) receiving mail.

**Test steps:**

1. **Create defaults for the sender email (text or logo):**
   - Open your live site.
   - Set watermark to **Text** or **Logo**, configure template/scope, and **save as default** using the **same email** you’ll use to send the inbound email. For logo, upload a logo and save so it’s stored for that email.
   - Ensure that email has a row in `user_defaults`; for logo mode, `logo_storage_path` must be set.

2. **Send an email to your inbound address** (e.g. **submit@doc.watermarkfile.com**) from that same email address, with **one or more attachments**: PDF or JPG/PNG/WebP.

3. **Check inbox** of the sender. They should get a **reply** from your system with:
   - Subject and body indicating watermarked files, and
   - The same file(s) as attachments, now watermarked with the saved text default.

**If it fails:**

- **No reply at all:**  
  - Railway logs: look for `[inbound]` messages. If the webhook is never hit, Resend can’t reach your backend (wrong URL, or backend down).  
  - Ensure `RESEND_API_KEY` is set (needed to fetch attachments and to send the reply).
- **Reply says “Set your defaults first”:** Sender email has no row in `user_defaults`. Save defaults on the site with that exact email (and ensure Supabase is configured and schema is applied).
- **Reply says “No default logo” / “could not load logo”:** Default is logo but no logo is saved or it couldn’t be loaded. Upload a logo on the site and save as default, or switch to a text default.
- **Reply says “No supported files”:** No PDF/image attachments, or attachment fetch failed. Check Railway logs for attachment list/download errors.

---

## 4. Quick reference

| Goal | Configure | Test |
|------|-----------|------|
| **Email out (magic link)** | Railway: `APP_ORIGIN` + `RESEND_API_KEY` (or SMTP). Vercel: `VITE_API_BASE_URL` = Railway URL. | Send magic link from results → open link → download. |
| **Email out (“Email me files”)** | Same as above. | Turn on “Email me files”, complete flow → receive email with attachments. |
| **Email in** | Above + Railway: Supabase vars; Supabase: `user_defaults`; Resend: Inbound + webhook URL. | Save **text** default on site with test email → send PDF/image to inbound address → receive reply with watermarked attachments. |

For more detail: [EMAIL_PRODUCTION.md](./EMAIL_PRODUCTION.md) (sending), [EMAIL_IN_SETUP.md](./EMAIL_IN_SETUP.md) (inbound flow and troubleshooting).
