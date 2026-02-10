# Email (magic link + email-in) configuration for production

Magic-link emails and **email-in reply emails** are sent by the **backend**, which runs on **Railway**. Configure email there, not on Vercel. Vercel only serves the frontend.

- **Magic link:** User gets an email with a link; clicking it opens the app and lets them download.
- **Email-in:** User emails files to your inbound address (e.g. **submit@doc.watermarkfile.com**); they get a reply with watermarked files. See [EMAIL_IN_SETUP.md](./EMAIL_IN_SETUP.md).

---

## 1. Set backend origin (Railway)

The link inside the email must open your **live app** (the Vercel URL).

In **Railway** → your project → **Variables**, add:

| Variable      | Value |
|---------------|--------|
| `APP_ORIGIN`  | Your frontend URL, **no trailing slash** (e.g. `https://www.watermarkfile.com` or `https://watermarkfile.vercel.app`) |

---

## 2. Configure email sending (Railway)

**Preferred: Resend API** (one key for magic link, reply emails, and email-in). No SMTP needed.

### Option A: Resend API (recommended)

1. At [resend.com](https://resend.com): create an **API Key** (e.g. “WatermarkFile”).
2. In Railway → **Variables**, add:

| Variable          | Value |
|-------------------|--------|
| `RESEND_API_KEY`  | Your Resend API key (starts with `re_`) |
| `RESEND_FROM`     | *(optional)* Sender address. Omit to use `WatermarkFile <onboarding@resend.dev>` (sandbox). For your domain use e.g. `WatermarkFile <noreply@watermarkfile.com>` after verifying the domain in Resend. |

That’s enough for magic link and reply emails. For **email-in** (receive + reply with watermarked files), keep the same key and follow [EMAIL_IN_SETUP.md](./EMAIL_IN_SETUP.md).

**Alternative: Resend via SMTP** – If you prefer SMTP, set `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=resend`, `SMTP_PASS=<your Resend API key>`, and `SMTP_FROM` as above. The app will use SMTP when `RESEND_API_KEY` is not set.

### Option B: SendGrid (SMTP)

1. Create a SendGrid account, create an API key with “Mail Send” permission.
2. In Railway:

| Variable       | Value |
|----------------|--------|
| `SMTP_HOST`    | `smtp.sendgrid.net` |
| `SMTP_PORT`    | `587` |
| `SMTP_USER`    | `apikey` |
| `SMTP_PASS`    | Your SendGrid API key |
| `SMTP_FROM`    | `WatermarkFile <noreply@yourdomain.com>` (use a verified sender) |

### Option C: Gmail (SMTP, dev / low volume)

Use an [App Password](https://support.google.com/accounts/answer/185833), not your normal password.

| Variable       | Value |
|----------------|--------|
| `SMTP_HOST`    | `smtp.gmail.com` |
| `SMTP_PORT`    | `587` |
| `SMTP_USER`    | Your Gmail address |
| `SMTP_PASS`    | App password |
| `SMTP_FROM`    | `WatermarkFile <your@gmail.com>` |

---

## 3. Redeploy Railway

After adding or changing variables, redeploy the service (Railway usually redeploys automatically; otherwise use **Deploy** → **Redeploy**).

---

## 4. Test on Vercel

1. Open your **Vercel app URL** (e.g. `https://www.watermarkfile.com` or `https://watermarkfile.vercel.app`).
2. Upload a file, run the watermark flow to the results screen.
3. Under “Confirm your email to download”, enter **your real email** and click **Send magic link**.
4. Check your inbox (and spam). You should get an email with “Open and download”.
5. Click the link. It should open your Vercel app, verify your email, and start the download(s).

If the link opens the wrong site or gives “Invalid or expired link”, double-check `APP_ORIGIN` on Railway (exact Vercel URL, no trailing slash, HTTPS).

---

## Summary

| Where   | What |
|---------|------|
| **Vercel** | Only `VITE_API_BASE_URL` (and optional `VITE_AMPLITUDE_API_KEY`). No email config. |
| **Railway** | `APP_ORIGIN` + `RESEND_API_KEY` (recommended) or SMTP vars. For **email-in**: same `RESEND_API_KEY`, Supabase vars, and [inbound webhook](EMAIL_IN_SETUP.md). |
