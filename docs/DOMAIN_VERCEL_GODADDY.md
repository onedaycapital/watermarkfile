# Connect your domain (GoDaddy) to Vercel

Use this to serve the WatermarkFile app at your own domain (e.g. **www.watermarkfile.com** and **watermarkfile.com**). Domain is registered and hosted at **GoDaddy**; the app is deployed on **Vercel**.

---

## 1. Add the domain in Vercel

1. Go to [vercel.com](https://vercel.com) and open your **WatermarkFile** project.
2. Open **Settings** → **Domains**.
3. Under **Domains**, click **Add** and enter:
   - `www.watermarkfile.com` (recommended primary)
   - Then add `watermarkfile.com` (apex) as well so both work.
4. Vercel will show you what DNS records are needed. Keep this tab open.

---

## 2. Configure DNS in GoDaddy

Log in to [GoDaddy](https://www.godaddy.com) → **My Products** → select your domain (e.g. **watermarkfile.com**) → **DNS** or **Manage DNS**.

You have two approaches.

### Option A: Use Vercel’s nameservers (simplest)

1. In Vercel → **Settings** → **Domains** → your domain → Vercel may offer **Use Vercel Nameservers**. Note the nameservers (e.g. `ns1.vercel-dns.com`, `ns2.vercel-dns.com`).
2. In GoDaddy: **Domain** → **Nameservers** → **Change** → **Enter my own nameservers** and add the two Vercel nameservers.
3. Save. DNS can take from a few minutes up to 24–48 hours to update.
4. In Vercel, add both `www.watermarkfile.com` and `watermarkfile.com` as domains; Vercel will verify automatically once DNS has propagated.

### Option B: Keep GoDaddy DNS and add records

If you want to keep GoDaddy as the DNS host:

**For `www.watermarkfile.com` (www):**

- **Type:** `CNAME`  
- **Name:** `www`  
- **Value:** `cname.vercel-dns.com`  
- **TTL:** 600 (or default)

**For `watermarkfile.com` (apex / root):**

- **Type:** `A`  
- **Name:** `@`  
- **Value:** `76.76.21.21`  
- **TTL:** 600  

*(Vercel’s apex IP can change; double-check in Vercel → Domains → your apex domain for the exact target.)*

Remove or avoid conflicting records (e.g. an old CNAME or A record for `@` or `www` that points elsewhere).

---

## 3. Set primary domain and redirect in Vercel

1. In Vercel → **Settings** → **Domains**, you should see both `www.watermarkfile.com` and `watermarkfile.com` (with a checkmark when DNS is correct).
2. Set **www.watermarkfile.com** as the primary (three dots → **Set as Primary** or similar).
3. For **watermarkfile.com** (apex): use **Edit** → **Redirect to** → `https://www.watermarkfile.com` so visiting the root domain goes to www.

---

## 4. HTTPS

Vercel will issue an SSL certificate for your domain once DNS is verified. No extra steps needed.

---

## 5. After the domain works

- **Vercel:** No code change needed; the app is already built with `www.watermarkfile.com` in `index.html` (canonical, Open Graph, etc.).
- **Railway (backend):** Set **APP_ORIGIN** to your live URL so magic links and emails use the correct link:
  - `APP_ORIGIN` = `https://www.watermarkfile.com` (no trailing slash)

Then you can set up email (Resend, etc.) using the same domain if you want (e.g. `noreply@watermarkfile.com`).

---

## Troubleshooting

| Issue | What to do |
|--------|------------|
| Domain “not verified” in Vercel | Wait for DNS propagation (up to 48 hours). In GoDaddy, confirm the CNAME/A records match exactly what Vercel shows. |
| “Redirect loop” or wrong site | Ensure only one A/CNAME points to Vercel and the primary domain in Vercel is set to www. |
| www works but apex doesn’t | Add the A record for `@` (apex) in GoDaddy and the redirect from apex → www in Vercel. |
