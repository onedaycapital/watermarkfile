# Testing the magic link flow

You can test the magic link flow **without** integrating email or deploying to Vercel.

---

## Option 1: Local test, no email (easiest)

The backend **logs the magic link to the terminal** when SMTP is not configured. You copy the link and open it in the browser.

### 1. Set origin for local links

So the link points at your local app instead of production:

**Backend** (in terminal or `server/.env`):

```bash
export APP_ORIGIN=http://localhost:5173
```

Or create `server/.env`:

```
APP_ORIGIN=http://localhost:5173
```

(If you don’t set this, the logged link will use `https://www.watermarkfile.com` and won’t work locally.)

### 2. Start backend and frontend

```bash
# Terminal 1 – API (set APP_ORIGIN so the logged link works locally)
APP_ORIGIN=http://localhost:5173 node server/index.js

# Terminal 2 – App
npm run dev
```

Or export once then run: `export APP_ORIGIN=http://localhost:5173` then `node server/index.js`.

### 3. Run the flow

1. Open **http://localhost:5173**.
2. Upload a file and run the watermark flow until you see the results panel.
3. In “Confirm your email to download”, enter any email (e.g. `test@example.com`) and click **Send magic link**.
4. In the **terminal where the backend is running**, you should see something like:
   ```text
   [email] Magic link (no SMTP configured): http://localhost:5173/?magic=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   [email] Send to: test@example.com
   ```
5. **Copy that URL** and open it in the same browser (or a new tab).
6. The app should verify the token, set you as verified, and trigger the downloads.

No real email is sent; the link is only in the terminal.

---

## Option 2: Local test with real email

If you want to receive the link by email on your machine:

1. Configure SMTP for the backend (e.g. Gmail, SendGrid, Resend). Set env vars:
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
   - Optionally `SMTP_FROM`, `SMTP_SECURE`
2. Set `APP_ORIGIN=http://localhost:5173` so the link in the email opens your local app.
3. Run backend + frontend as above, go through the flow, and check your inbox for the magic link.

You still don’t need Vercel for this.

---

## Option 3: Deploy and test in production

- **Frontend**: Deploy to Vercel (or any host). No special config needed for magic links.
- **Backend**: Run elsewhere (e.g. Railway, Render). Set:
  - `APP_ORIGIN` = your frontend URL (e.g. `https://www.watermarkfile.com` or your Vercel URL).
  - SMTP (or another sender) if you want real emails in production.

Then test the same flow on the live site; with SMTP configured, users get the link by email.

---

## Summary

| Goal                         | Need email? | Need Vercel? |
|-----------------------------|------------|--------------|
| Test flow locally           | No         | No           |
| Receive link by email local | Yes (SMTP) | No           |
| Test on production URL      | Optional   | Only for hosting frontend |

**Minimum to test the flow:** run backend + frontend locally, set `APP_ORIGIN=http://localhost:5173`, and use the link printed in the backend terminal.
