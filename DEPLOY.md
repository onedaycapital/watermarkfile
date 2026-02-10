# Deploy WatermarkFile to production (browser-only)

Your repo is on GitHub. Build is fixed and ready. Do these in order.

---

## 1. Push latest code (if you just pulled or had fixes)

```bash
cd /Users/Sree/projects/WaterMarkFiles
git push origin main
```

---

## 2. Deploy backend (Railway) — ~2 min

1. Go to **https://railway.app** → Sign in with GitHub.
2. **New Project** → **Deploy from GitHub repo** → select **onedaycapital/watermarkfile**.
3. After the repo is added, click the service → **Settings** (or **Variables**):
   - **Root Directory:** leave blank.
   - **Build Command:** leave blank (or `npm install`).
   - **Start Command:** `node server/index.js`
4. Open **Settings** → **Networking** → **Generate Domain** (or use the default). Copy the URL (e.g. `https://watermarkfile-production-xxxx.up.railway.app`).  
   This is your **API URL** — you’ll use it in step 4 below.

---

## 3. Deploy frontend (Vercel) — ~2 min

1. Go to **https://vercel.com** → Sign in with GitHub.
2. **Add New** → **Project** → Import **onedaycapital/watermarkfile**.
3. Leave **Build Command** as `npm run build` and **Output Directory** as `dist`. Click **Deploy**.
4. Wait for the first deploy to finish. The site will work but **watermarking will fail** until you add the API URL in step 4.

---

## 4. Connect frontend to backend (required for watermark + default logo)

1. In Vercel, open your project → **Settings** → **Environment Variables**.
2. Add:
   - **Name:** `VITE_API_BASE_URL`
   - **Value:** your Railway API URL from step 2 (e.g. `https://watermarkfile-production-xxxx.up.railway.app`) — **no trailing slash**.
   - Apply to **Production** (and Preview if you want).
3. Go to **Deployments** → open the **⋯** on the latest deployment → **Redeploy** (so the new env var is used).

Without this, all API calls (including fetching the default logo when step 1 default is “Logo”) go to the Vercel host and fail. Set it and redeploy so the built app has the correct API base.

---

## 5. Email (magic link) in production

Magic-link emails are sent by the **backend on Railway**, not by Vercel. To send real emails and test on the live site:

1. In **Railway** → your project → **Variables**, add:
   - **`APP_ORIGIN`** = your Vercel app URL, no trailing slash (e.g. `https://www.watermarkfile.com` or `https://watermarkfile.vercel.app`).
   - **Resend (easiest):** `RESEND_API_KEY` = your Resend API key (no SMTP needed). Optional: `RESEND_FROM` for a custom sender. See **docs/EMAIL_PRODUCTION.md** for other options (SMTP).
2. Redeploy the Railway service.
3. Open your Vercel site → watermark a file → enter your email → **Send magic link** → check inbox and click the link.

Full step-by-step and SMTP examples: **docs/EMAIL_PRODUCTION.md**.

For **email-in** (users email files to e.g. **submit@watermarkfile.com** and get watermarked files back): set **RESEND_API_KEY** and Supabase vars on Railway, run the **user_defaults** table (see **docs/supabase-schema.sql**), and configure Resend Inbound webhook → **docs/EMAIL_IN_SETUP.md**.

---

## 6. Done

- **App URL:** your Vercel URL (e.g. `https://watermarkfile.vercel.app`).
- **API:** runs on Railway; frontend calls it via `VITE_API_BASE_URL`.

If something fails, check: Railway start command is `node server/index.js`, and `VITE_API_BASE_URL` has no trailing slash and is set before redeploy.
