# Set up submit@doc.watermarkfile.com in Resend

Step-by-step instructions to enable **inbound email** so users can send files to **submit@doc.watermarkfile.com** and your backend can process them (watermark and reply).

---

## Prerequisites

- A [Resend](https://resend.com) account.
- Your **Railway backend URL** (e.g. `https://your-app.up.railway.app`). You’ll use it for the webhook.
- Access to **DNS** for **watermarkfile.com** (e.g. GoDaddy or wherever the domain is managed).

---

## Part 1: Add the subdomain in Resend

We use the subdomain **doc.watermarkfile.com** for receiving so that **watermarkfile.com** can stay on Google Workspace (or similar) for company email.

1. Log in at **[resend.com](https://resend.com)**.
2. Go to **[Domains](https://resend.com/domains)**.
3. Click **Add Domain**.
4. Enter **doc.watermarkfile.com** (the subdomain only).
5. Resend will show DNS records to verify the domain. Add them at your DNS provider (e.g. the CNAME or TXT records Resend shows for **doc.watermarkfile.com**). Then in Resend click **Verify** and wait until the domain shows as verified.

---

## Part 2: Enable receiving (inbound) for doc.watermarkfile.com

1. In Resend, go to **[Domains](https://resend.com/domains)** and click **doc.watermarkfile.com**.
2. Find the **Receiving** (or **Inbound**) section.
3. Turn **Receiving** **On** (enable it).
4. Resend will show an **MX record** you must add for receiving:
   - **Type:** MX  
   - **Name/Host:** **doc** (or **doc.watermarkfile.com** depending on your DNS provider)—only for the subdomain, so **watermarkfile.com** stays on Google for company email.  
   - **Value:** something like `feedback-smtp.us-east-1.amazonses.com` or the host Resend displays.  
   - **Priority:** the number Resend shows (e.g. `10`).

**Important about MX:**

- If **watermarkfile.com** currently has **no** MX records (you don’t use it for normal email): add this MX record for **watermarkfile.com**. Then **any** address at that domain (including **submit@doc.watermarkfile.com**) will be received by Resend.
- If **watermarkfile.com** already has MX records (e.g. Google Workspace, Outlook): use a **subdomain** for receiving so company email is unaffected. We use **doc.watermarkfile.com**; you add that subdomain in Resend, enable Receiving for it, and add the MX record only for **doc.watermarkfile.com** in DNS. The inbound address is then **submit@doc.watermarkfile.com**.

5. Add the MX record in your **DNS provider** (GoDaddy, Cloudflare, etc.) exactly as Resend shows.
6. Back in Resend, click **“I’ve added the record”** (or similar) and wait until the receiving/MX status shows as **verified**.

Once the MX is verified, mail to **submit@doc.watermarkfile.com** (or to any address @doc.watermarkfile.com) will be received by Resend.

---

## Part 3: Create the webhook (so your backend gets the emails)

Resend will send a POST request to your backend whenever an email is received. Your app already has the route; you just need to register its URL in Resend.

1. In Resend, go to **[Webhooks](https://resend.com/webhooks)**.
2. Click **Add Webhook**.
3. **Endpoint URL:** enter your Railway backend URL plus the path:
   ```text
   https://<your-railway-host>/api/webhooks/inbound-email
   ```
   Example: `https://watermarkfile-production-f560.up.railway.app/api/webhooks/inbound-email`  
   Replace with your real Railway URL (no trailing slash before the path).
4. **Events:** select **email.received** (or the single “received” / inbound event).
5. Click **Add** (or **Create**).

Resend will send a payload with `type: "email.received"` and metadata (from, to, subject, attachment IDs, etc.). Your backend uses this and the Resend API (with `RESEND_API_KEY`) to fetch attachment content, watermark, and reply.

---

## Part 4: Confirm backend env vars (Railway)

Your backend must have these set on **Railway** so it can handle inbound and send the reply:

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Fetch inbound attachments and send the reply email. |
| `APP_ORIGIN` | Used in reply body (e.g. link to site). |
| `SUPABASE_URL` | Look up user defaults by sender email. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase access. |

Reply emails are sent via the same mechanism as magic-link emails (Resend API or SMTP). So if magic links work, reply sending is already configured; you only need the four above for the full inbound flow.

---

## Quick checklist

- [ ] **Resend → Domains:** doc.watermarkfile.com added and verified.
- [ ] **Resend → Domains → doc.watermarkfile.com:** Receiving turned **On**, MX record for **doc** (subdomain) added in DNS, receiving/MX status **verified**.
- [ ] **Resend → Webhooks:** Webhook added with URL `https://<railway-host>/api/webhooks/inbound-email` and event **email.received**.
- [ ] **Railway:** `RESEND_API_KEY`, `APP_ORIGIN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` set.

---

## Test

1. On your site, save a **text** default with the same email you’ll use to send (see [EMAIL_IN_SETUP.md](./EMAIL_IN_SETUP.md)).
2. Send an email **to submit@doc.watermarkfile.com** from that address with a PDF or image (JPG/PNG/WebP) attached.
3. Check the sender inbox for a **reply** with the watermarked file(s) attached.

If there’s no reply, check Railway logs for `[inbound]` and Resend → **Logs** (or **Webhooks**) to see if the webhook was sent and what response it got.
