# WatermarkFile — www.watermarkfile.com

Simple, sleek file watermarking. No sign-up required to start.

## UX-first MVP (frontend)

- **Hero** — Minimal copy: “Watermark your documents. Keep your files protected.”
- **Tool card** — Upload (PDF/JPG/PNG), choose Logo or Text watermark, template (Diagonal Center / Repeating Pattern / Footer Tag), scope (All pages / First page only), then “Watermark files”.
- **Progress pipeline** — Intake → Processing → Ready with file counter.
- **Results** — Per-file download, optional “Email me the watermarked files”, “Save as default”, and email capture modal only after first run.
- **Email-in** — CTA: “Send files to submit@doc.watermarkfile.com to get them back watermarked.”
- **Trust** — “Files are auto-deleted after 24 hours.”

## Run locally

**Frontend and backend (recommended):**

```bash
npm install
# Terminal 1 — backend (port 3000)
npm run dev:server
# Terminal 2 — frontend (port 5173)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The app proxies `/api` to the backend.

**Frontend only (mock flow):** run `npm run dev` and use the UI; watermark requests will fail without the server.

## Build

```bash
npm run build
npm run preview
```

## Deploy to production (Git + Vercel + Railway)

The app has two parts: **frontend** (Vite/React) and **backend** (Express API with in-memory file store). The backend must run as a long-lived server so download links work.

### 1. Create a Git repo and push to GitHub

```bash
cd /path/to/WaterMarkFiles
git init
git add .
git commit -m "Initial commit: WatermarkFile app"
```

Create a new repository on [GitHub](https://github.com/new) (e.g. `watermarkfile`), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/watermarkfile.git
git branch -M main
git push -u origin main
```

### 2. Deploy the backend to Railway

The API uses in-memory storage for download tokens, so it must run as a continuous Node server.

1. Go to [railway.app](https://railway.app) and sign in (e.g. with GitHub).
2. **New project** → **Deploy from GitHub repo** → select your `watermarkfile` repo.
3. In project settings, set **Root Directory** to the repo root and configure:
   - **Build command:** (leave empty or `npm install`)
   - **Start command:** `node server/index.js`
   - **Watch paths:** `server/**`
4. Under **Variables**, add `PORT` (Railway often sets this automatically).
5. Deploy. Once live, copy your backend URL (e.g. `https://watermarkfile-production.up.railway.app`).

### 3. Deploy the frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (e.g. with GitHub).
2. **Add New** → **Project** → import your `watermarkfile` repo.
3. Vercel will detect Vite. Use:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
4. Under **Environment Variables**, add:
   - **Name:** `VITE_API_BASE_URL`  
   - **Value:** your Railway backend URL (e.g. `https://watermarkfile-production.up.railway.app`) — no trailing slash.
5. Deploy. Your app will be live at `https://your-project.vercel.app`.

The frontend will call the Railway API for watermarking and downloads. For local dev, leave `VITE_API_BASE_URL` unset so the app uses the Vite proxy to `localhost:3000`.

## Backend

- **Express** server in `server/index.js`: `POST /api/watermark` (multipart: files, mode, text, template, scope, optional logo), `GET /api/download/:token` (stream and delete).
- **PDF:** pdf-lib (text or logo watermark; templates: diagonal-center, repeating-pattern, footer-tag; scope: all-pages, first-page-only).
- **Images:** sharp (JPG/PNG/WebP; text via SVG overlay or logo composite). Processed files are held in memory and served once via token; entries expire after 1 hour.

## Tech

- **Vite** + **React** + **TypeScript**
- **Tailwind CSS**
- **Backend:** Node, Express, multer, pdf-lib, sharp, uuid

## Reference

- UX brief: WatermarkFile UX-First MVP (no email upfront).
- Workflow: logo/text + template/scope → upload → watermark → download or email; optional save defaults.
- Competitor reference: [blumark.pro](https://blumark.pro) (enterprise dual-watermark; we focus on simplicity and zero-friction start).
