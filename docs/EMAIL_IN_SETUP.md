# Email-in / email-out watermark service

Users can **email files as attachments** to your inbound address and receive **watermarked files back by email**, using the defaults they set on the website.

---

## Flow

1. User visits the site (e.g. **www.watermarkfile.com**), sets **default watermark** (text, template, scope) and saves them (optionally with the same email they’ll use to send).
2. User sends an email to your **inbound address** (e.g. **submit@watermarkfile.com**) with **PDF or image attachments** (JPG, PNG, WebP).
3. Backend receives the email (via Resend Inbound), looks up **saved defaults** for the sender email, watermarks each attachment, and **replies** with the watermarked files attached.

**Note:** Email-in supports **text watermarks only**. Logo defaults must be used on the website.

---

## 1. Backend requirements

On **Railway** (or wherever the backend runs), set:

| Variable | Purpose |
|----------|---------|
| `APP_ORIGIN` | Frontend URL (e.g. `https://www.watermarkfile.com`) – used in reply messages |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | So user defaults are stored and loaded for inbound senders |
| `RESEND_API_KEY` | Resend API key – used to **fetch** inbound attachments (and optionally to send; otherwise use SMTP) |
| SMTP vars (see [EMAIL_PRODUCTION.md](./EMAIL_PRODUCTION.md)) | To **send** the reply email with watermarked attachments |

The **same** Resend API key can be used for SMTP (sending) and for the Inbound API (listing/downloading attachments).

---

## 2. Supabase schema

User defaults are stored in Supabase. Run the **full** schema in `docs/supabase-schema.sql` so that the **user_defaults** table exists. If you already ran an older version, add and run:

```sql
CREATE TABLE IF NOT EXISTS public.user_defaults (
  email text PRIMARY KEY,
  mode text NOT NULL DEFAULT 'text',
  text_value text NOT NULL DEFAULT '',
  template text NOT NULL DEFAULT 'diagonal-center',
  scope text NOT NULL DEFAULT 'all-pages',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_defaults ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only on user_defaults" ON public.user_defaults;
CREATE POLICY "Service role only on user_defaults"
  ON public.user_defaults FOR ALL USING (false) WITH CHECK (false);
```

---

## 3. Resend Inbound

1. In [Resend](https://resend.com): **Domains** → your domain (e.g. **watermarkfile.com**) → **Receiving** (Inbound).
2. Enable **Inbound** and set the **webhook URL** to your backend:

   `https://<your-backend-host>/api/webhooks/inbound-email`

   Example:  
   `https://watermarkfile-production-f560.up.railway.app/api/webhooks/inbound-email`

3. Create an **inbound address** (e.g. **submit@watermarkfile.com**) or use the one Resend provides for your domain.
4. (Optional) In Resend → **Webhooks**, create a webhook for **email.received** pointing to the same URL and copy the **Signing secret**; you can later add `RESEND_WEBHOOK_SECRET` for verification.

---

## 4. User-facing copy

Tell users:

- **First time:** Go to the site and set your default watermark (text, template, scope) and save (optionally with the email you’ll use to send).
- **Then:** Send an email to **submit@watermarkfile.com** (or your inbound address) with PDF or image attachments. You’ll get a reply with the same files, watermarked with your defaults.

The footer on the site already mentions **submit@watermarkfile.com** for this flow.

---

## 5. Troubleshooting

- **“Set your defaults first”** – Sender email has no row in **user_defaults**. They need to save defaults on the site (with the same email they use to send).
- **“Use text default for email”** – Saved default is logo mode; email-in only supports text. They can set a text default or use the website for logo.
- **“No supported files”** – No PDF or image attachments, or download failed. Ask them to attach only PDF / JPG / PNG / WebP.
- **No reply at all** – Check Railway logs for `[inbound]` errors; ensure `RESEND_API_KEY` is set and the webhook URL is reachable (HTTPS). Resend must be able to POST to your backend.
