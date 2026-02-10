import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { PDFDocument, rgb, StandardFonts, RotationTypes } from 'pdf-lib'
import sharp from 'sharp'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import {
  setMagicToken,
  useMagicToken,
  setPendingDelivery,
  getPendingDelivery,
  clearPendingDelivery,
  recordUploadBatch,
  recordSuccessDownloads,
  cleanupExpiredTokens,
} from './store.js'
import { sendMagicLinkEmail, sendReplyWithAttachments } from './email.js'
import { upsertUserStats, saveFileToStorage, saveDefaultLogo, getDefaultLogoBuffer, isSupabaseConfigured, getUserDefaults, upsertUserDefaults, hasUserInStats, checkMonthlyLimit } from './supabase.js'
import { processInboundEmail } from './inbound.js'

const app = express()
// Locked to 3000 for WatermarkFile project (override with PORT env if needed)
const PORT = Number(process.env.PORT) || 3000
const APP_ORIGIN = (process.env.APP_ORIGIN || 'https://www.watermarkfile.com').replace(/\/$/, '')
const MAGIC_LINK_EXPIRY_MS = 15 * 60 * 1000 // 15 minutes
const USER_COOKIE_NAME = 'watermarkfile_user'
const USER_COOKIE_MAX_AGE_DAYS = 365

const DOMAIN = 'www.watermarkfile.com'
const DOMAIN_LABEL = `By ${DOMAIN}`

// In-memory store for processed files: token -> { buffer, filename, contentType }
const store = new Map()
// Cached logo (no email yet): first success token -> { buffer, contentType }; saved to Storage when user submits email on page 2
const cachedLogoByToken = new Map()
// User defaults by email (normalized lowercase): { mode, text?, template, scope, updatedAt }
const defaultsByEmail = new Map()

// Clean old entries (older than 1 hour)
function cleanup() {
  const now = Date.now()
  for (const [token, entry] of store.entries()) {
    if (entry.createdAt && now - entry.createdAt > 60 * 60 * 1000) {
      store.delete(token)
      cachedLogoByToken.delete(token)
    }
  }
}
setInterval(cleanup, 15 * 60 * 1000)
setInterval(cleanupExpiredTokens, 60 * 60 * 1000)

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB per file
})

// GET / or /api or /api/health — backend is API-only
app.get(['/', '/api', '/api/health'], (req, res) => {
  res.json({
    name: 'WatermarkFile API',
    message: 'Use the app at http://localhost:5173 to watermark files.',
    endpoints: { 'POST /api/watermark': 'Upload files and options', 'GET /api/download/:token': 'Download a processed file' },
  })
})

// Read email from cookie (set on magic-link verify) for same-origin or cross-origin requests with credentials
function getEmailFromCookie(req) {
  let value = req.cookies?.[USER_COOKIE_NAME]
  if (!value && req.headers?.cookie) {
    const part = req.headers.cookie.split(';').find((c) => c.trim().startsWith(USER_COOKIE_NAME + '='))
    if (part) value = part.trim().replace(new RegExp('^' + USER_COOKIE_NAME + '='), '')
  }
  if (!value) return null
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8')
    const e = decoded.trim().toLowerCase()
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null
  } catch {
    return null
  }
}

// GET /api/defaults?email= — get saved defaults for email. If no email, try cookie (for new tab/browser). Only return defaults if user is active (in user_stats).
app.get('/api/defaults', async (req, res) => {
  let email = (req.query.email || '').toString().trim().toLowerCase()
  if (!email) email = getEmailFromCookie(req) || ''
  if (!email) return res.status(400).json({ error: 'Email required' })

  const fromDb = isSupabaseConfigured() ? await getUserDefaults(email) : null
  if (fromDb) {
    if (isSupabaseConfigured()) upsertUserStats(email, 0).catch((err) => console.error('[supabase] upsertUserStats (get-defaults):', err.message))
    const payload = { mode: fromDb.mode, text: fromDb.text, template: fromDb.template, scope: fromDb.scope, email }
    if (fromDb.logo_storage_path) {
      payload.logo_url = `/api/defaults/logo?email=${encodeURIComponent(email)}`
    }
    return res.json(payload)
  }
  const saved = defaultsByEmail.get(email)
  if (!saved) {
    const active = isSupabaseConfigured() ? await hasUserInStats(email) : false
    if (!active) return res.status(404).json({ error: 'User not active' })
    return res.status(404).json({ error: 'No defaults found for this email' })
  }
  res.json({ mode: saved.mode, text: saved.text, template: saved.template, scope: saved.scope, email })
})

// GET /api/defaults/logo?email= — stream default logo (same-origin; avoids CORS with Supabase signed URL)
app.get('/api/defaults/logo', async (req, res) => {
  const email = (req.query.email || '').toString().trim().toLowerCase()
  if (!email) return res.status(400).send('Email required')
  if (!isSupabaseConfigured()) return res.status(503).send('Storage not configured')
  const fromDb = await getUserDefaults(email)
  if (!fromDb?.logo_storage_path) return res.status(404).send('No default logo for this email')
  const result = await getDefaultLogoBuffer(fromDb.logo_storage_path)
  if (!result) return res.status(404).send('Logo not found')
  res.setHeader('Content-Type', result.contentType)
  res.setHeader('Cache-Control', 'private, max-age=3600')
  res.send(result.buffer)
})

// 12 offerings: (Logo|Text) × (Diagonal|Repeating|Footer) × (All Pages|First Page Only) — each a unique default
const TEMPLATES_LIST = ['diagonal-center', 'repeating-pattern', 'footer-tag']
const SCOPES_LIST = ['all-pages', 'first-page-only']

// POST /api/defaults — save defaults for email (body: { email, defaults: { mode, text?, template, scope } })
app.post('/api/defaults', async (req, res) => {
  const email = (req.body?.email || '').toString().trim().toLowerCase()
  const def = req.body?.defaults
  if (!email) return res.status(400).json({ error: 'Email required' })
  if (!def || typeof def.mode !== 'string' || typeof def.template !== 'string' || typeof def.scope !== 'string') {
    return res.status(400).json({ error: 'Invalid defaults' })
  }
  const mode = def.mode === 'logo' ? 'logo' : 'text'
  const template = TEMPLATES_LIST.includes(def.template) ? def.template : 'diagonal-center'
  const scope = SCOPES_LIST.includes(def.scope) ? def.scope : 'all-pages'
  const payload = { mode, text: def.text ?? '', template, scope }
  defaultsByEmail.set(email, { ...payload, updatedAt: Date.now() })
  if (isSupabaseConfigured()) {
    await upsertUserDefaults(email, payload)
    await upsertUserStats(email, 0).catch((err) => console.error('[supabase] upsertUserStats (defaults):', err.message))
  }
  res.json({ ok: true })
})

// POST /api/defaults/logo — upload default logo for email (multipart: email, logo)
app.post('/api/defaults/logo', upload.single('logo'), async (req, res) => {
  const email = (req.body?.email || '').toString().trim().toLowerCase()
  const logoFile = req.file
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Valid email required' })
  if (!logoFile || !logoFile.buffer) return res.status(400).json({ error: 'Logo file required' })
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Storage not configured' })
  try {
    const storagePath = await saveDefaultLogo(email, logoFile.buffer, logoFile.mimetype)
    if (!storagePath) return res.status(500).json({ error: 'Failed to save logo' })
    const current = await getUserDefaults(email)
    const payload = current
      ? { mode: current.mode, text: current.text, template: current.template, scope: current.scope, logo_storage_path: storagePath }
      : { mode: 'logo', text: '', template: 'diagonal-center', scope: 'all-pages', logo_storage_path: storagePath }
    await upsertUserDefaults(email, payload)
    await upsertUserStats(email, 0).catch((err) => console.error('[supabase] upsertUserStats (defaults/logo):', err.message))
    defaultsByEmail.set(email, { ...payload, updatedAt: Date.now() })
    res.json({ ok: true })
  } catch (err) {
    console.error('[defaults/logo]', err)
    res.status(500).json({ error: err.message || 'Failed to save logo' })
  }
})

// POST /api/auth/send-magic-link — send magic link for email verification; store pending delivery
app.post('/api/auth/send-magic-link', async (req, res) => {
  try {
    const email = (req.body?.email || '').toString().trim().toLowerCase()
    const pendingDelivery = req.body?.pendingDelivery // [{ token, name }]
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email required' })
    }
    const fileCount = Array.isArray(pendingDelivery) ? pendingDelivery.length : 0
    if (isSupabaseConfigured()) {
      const limitCheck = await checkMonthlyLimit(email, fileCount)
      if (!limitCheck.allowed) {
        return res.status(402).json({ error: limitCheck.reason || 'Monthly file limit reached.' })
      }
    }
    const token = uuidv4()
    const expiresAt = Date.now() + MAGIC_LINK_EXPIRY_MS
    setMagicToken(token, { email, expiresAt })
    if (Array.isArray(pendingDelivery) && pendingDelivery.length > 0) {
      setPendingDelivery(email, pendingDelivery)
    }
    // Record user and file count the minute they submit on page 2 (first-time user)
    if (isSupabaseConfigured()) {
      upsertUserStats(email, fileCount).catch((err) => console.error('[supabase] upsertUserStats (send-magic-link):', err.message))
      // Save cached originals (from first run without email) to Storage and uploads table
      if (Array.isArray(pendingDelivery) && pendingDelivery.length > 0) {
        let logoSaved = false
        for (const it of pendingDelivery) {
          const fileToken = (it.token || (it.downloadUrl || '').replace(/^.*\/api\/download\//, '').replace(/\?.*$/, '')).trim()
          if (!fileToken) continue
          const storeEntry = store.get(fileToken)
          if (storeEntry?.original) {
            const { buffer: origBuffer, filename: origFilename, contentType: origContentType } = storeEntry.original
            saveFileToStorage(email, origFilename, origBuffer, origContentType).catch((err) => console.error('[supabase] saveFileToStorage (cached):', err.message))
            delete storeEntry.original
          }
          if (!logoSaved) {
            const cachedLogo = cachedLogoByToken.get(fileToken)
            if (cachedLogo) {
              logoSaved = true
              const template = cachedLogo.template || 'diagonal-center'
              const scope = cachedLogo.scope || 'all-pages'
              saveDefaultLogo(email, cachedLogo.buffer, cachedLogo.contentType).then((logoPath) => {
                if (logoPath) return upsertUserDefaults(email, { mode: 'logo', text: '', template, scope, logo_storage_path: logoPath })
              }).catch((err) => console.error('[supabase] saveDefaultLogo (cached):', err.message))
              cachedLogoByToken.delete(fileToken)
            }
          }
        }
      }
    }
    const magicLinkUrl = `${APP_ORIGIN}/?magic=${token}`
    await sendMagicLinkEmail({ to: email, magicLinkUrl, appOrigin: APP_ORIGIN })
    res.json({ ok: true, message: 'Magic link sent' })
  } catch (err) {
    console.error('[send-magic-link]', err)
    const isNotConfigured = err.code === 'EMAIL_NOT_CONFIGURED' || err.message === 'EMAIL_NOT_CONFIGURED'
    if (isNotConfigured) {
      return res.status(503).json({
        error: 'Email delivery is not configured. Please try again later or contact the site administrator.',
      })
    }
    let message = err.message || 'Failed to send magic link'
    // Resend sandbox: you can only send to the email you signed up with
    if (/only send.*to.*your own email|development mode|recipient.*not allowed/i.test(message)) {
      message = 'Resend sandbox allows sending only to your Resend account email. Verify your domain in Resend and set RESEND_FROM, or send the magic link to the email you used to sign up for Resend.'
    }
    res.status(500).json({ error: message })
  }
})

// POST /api/auth/verify-magic-link — verify token, return email + pending deliveries, record stats
app.post('/api/auth/verify-magic-link', (req, res) => {
  try {
    const token = (req.body?.token || '').toString().trim()
    if (!token) return res.status(400).json({ error: 'Token required' })
    const data = useMagicToken(token)
    if (!data) return res.status(400).json({ error: 'Invalid or expired link' })
    const now = Date.now()
    if (data.expiresAt && now > data.expiresAt) {
      return res.status(400).json({ error: 'Link expired' })
    }
    const email = data.email
    const pending = getPendingDelivery(email)
    const items = pending?.items ?? []
    const successCount = items.length
    if (successCount > 0) {
      recordUploadBatch(email, { successCount, errorCount: 0, failReasons: [] })
      recordSuccessDownloads(email, successCount)
      clearPendingDelivery(email)
      // user_stats already updated in send-magic-link when they submitted on page 2; avoid double-count
    }
    // Ensure user is in user_stats so GET /api/defaults considers them "active" (e.g. when they only arrived via magic link)
    if (isSupabaseConfigured()) upsertUserStats(email, 0).catch((err) => console.error('[supabase] upsertUserStats (verify):', err.message))
    // Set cookie so new tab/browser can load defaults without localStorage (credentials: 'include' on GET /api/defaults)
    const cookieValue = Buffer.from(email.trim().toLowerCase(), 'utf8').toString('base64url')
    res.cookie(USER_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: USER_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60,
      path: '/',
    })
    res.json({
      ok: true,
      email,
      pendingDeliveries: items.map(({ token: t, name }) => ({ downloadUrl: `/api/download/${t}`, name })),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Verification failed' })
  }
})

// POST /api/webhooks/inbound-email — Resend email.received webhook: process attachments, reply with watermarked files
app.post('/api/webhooks/inbound-email', async (req, res) => {
  res.status(200).send()
  const body = req.body
  if (body?.type !== 'email.received') return
  console.log('[inbound] Supabase configured:', isSupabaseConfigured(), 'raw from:', body?.data?.from)
  try {
    const reply = await processInboundEmail({
      body,
      appOrigin: APP_ORIGIN,
      getUserDefaults: (email) => (isSupabaseConfigured() ? getUserDefaults(email) : Promise.resolve(null)),
      getDefaultLogoBuffer: isSupabaseConfigured() ? getDefaultLogoBuffer : undefined,
      watermarkPdf: (buffer, opts) => watermarkPdf(buffer, opts),
      watermarkImage: (buffer, opts) => watermarkImage(buffer, opts),
    })
    await sendReplyWithAttachments(reply)
  } catch (err) {
    console.error('[inbound] Webhook processing failed:', err)
  }
})

// POST /api/send-results-email — send watermarked files by email (no magic link; for verified users who chose "Email me files")
app.post('/api/send-results-email', async (req, res) => {
  try {
    const email = (req.body?.email || '').toString().trim().toLowerCase()
    const items = Array.isArray(req.body?.items) ? req.body.items : []
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email required' })
    }
    if (items.length === 0) return res.status(400).json({ error: 'No items to send' })
    const attachments = []
    for (const it of items) {
      const token = (it.token || (it.downloadUrl || '').replace(/^.*\/api\/download\//, '').replace(/\?.*$/, '')).trim()
      if (!token) continue
      const entry = store.get(token)
      if (!entry) continue
      attachments.push({ filename: entry.filename, content: entry.buffer })
    }
    if (attachments.length === 0) {
      return res.status(400).json({ error: 'No valid files to send; they may have expired' })
    }
    await sendReplyWithAttachments({
      to: email,
      subject: 'Your watermarked files – WatermarkFile',
      text: `Here are your ${attachments.length} watermarked file(s). — WatermarkFile`,
      html: `<p>Here are your ${attachments.length} watermarked file(s).</p><p>— WatermarkFile</p>`,
      attachments,
    })
    // user_stats already updated in POST /api/watermark when request included email; avoid double-count
    res.json({ ok: true, sent: attachments.length })
  } catch (err) {
    console.error('[send-results-email]', err)
    res.status(500).json({ error: err.message || 'Failed to send email' })
  }
})

// GET /api/download/:token — stream processed file
app.get('/api/download/:token', (req, res) => {
  const entry = store.get(req.params.token)
  if (!entry) {
    return res.status(404).json({ error: 'Not found or expired' })
  }
  res.setHeader('Content-Type', entry.contentType)
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(entry.filename)}"`)
  res.send(entry.buffer)
  // Token is left in store until cleanup (1h); allows both instant download and later button click
})

// POST /api/watermark — multipart: files[], mode, text, template, scope, logo (file optional)
app.post('/api/watermark', upload.fields([
  { name: 'files', maxCount: 20 },
  { name: 'logo', maxCount: 1 },
]), async (req, res) => {
  try {
    const files = req.files?.files || []
    const logoFiles = req.files?.logo || []
    const mode = (req.body.mode === 'logo' ? 'logo' : 'text')
    const text = (req.body.text || '').trim()
    const template = TEMPLATES_LIST.includes(req.body.template) ? req.body.template : 'diagonal-center'
    const scope = SCOPES_LIST.includes(req.body.scope) ? req.body.scope : 'all-pages'
    const logoFile = logoFiles[0]

    if (!files.length) {
      return res.status(400).json({ error: 'No files uploaded' })
    }
    if (mode === 'text' && !text) {
      return res.status(400).json({ error: 'Text watermark requires "text" field' })
    }
    if (mode === 'logo' && !logoFile) {
      return res.status(400).json({ error: 'Logo watermark requires "logo" file' })
    }

    const emailForLimit = (req.body.email || '').toString().trim().toLowerCase()
    const hasEmailForLimit = emailForLimit && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForLimit)
    if (hasEmailForLimit && isSupabaseConfigured()) {
      const limitCheck = await checkMonthlyLimit(emailForLimit, files.length)
      if (!limitCheck.allowed) {
        return res.status(402).json({ error: limitCheck.reason || 'Monthly file limit reached.' })
      }
    }

    const results = []
    const failReasons = []

    for (const file of files) {
      const id = uuidv4()
      let name = file.originalname.replace(/\.[^.]+$/, '') + '_watermarked'
      try {
        const ext = path.extname(file.originalname).toLowerCase()
        let buffer = file.buffer
        let contentType = file.mimetype
        let outExt = ext

        if (ext === '.pdf') {
          const out = await watermarkPdf(buffer, { mode, text, logoFile, template, scope })
          buffer = out
          outExt = '.pdf'
          contentType = 'application/pdf'
        } else if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
          const out = await watermarkImage(buffer, { mode, text, logoFile, template })
          buffer = out.buffer
          contentType = out.contentType
          outExt = out.ext
        } else {
          results.push({ id, name: file.originalname, status: 'error', errorMessage: 'Unsupported file type' })
          failReasons.push('Unsupported file type')
          continue
        }

        name += outExt
        const token = uuidv4()
        const emailForSupabase = (req.body.email || '').toString().trim().toLowerCase()
        const hasEmail = emailForSupabase && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForSupabase)
        const entry = {
          buffer,
          filename: name,
          contentType,
          createdAt: Date.now(),
        }
        if (!hasEmail && isSupabaseConfigured()) {
          entry.original = {
            buffer: Buffer.from(file.buffer),
            filename: file.originalname,
            contentType: file.mimetype,
          }
        }
        store.set(token, entry)
        results.push({
          id,
          name,
          status: 'success',
          downloadUrl: `/api/download/${token}`,
        })
        if (hasEmail && isSupabaseConfigured()) {
          saveFileToStorage(emailForSupabase, file.originalname, file.buffer, file.mimetype).catch((err) => console.error('[supabase] saveFileToStorage:', err.message))
        }
      } catch (err) {
        const msg = err.message || 'Processing failed'
        results.push({
          id,
          name: file.originalname,
          status: 'error',
          errorMessage: msg,
        })
        failReasons.push(msg)
      }
    }

    const email = (req.body.email || '').toString().trim().toLowerCase()
    const hasEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (hasEmail) {
      const successCount = results.filter((r) => r.status === 'success').length
      const errorCount = results.filter((r) => r.status === 'error').length
      recordUploadBatch(email, { successCount, errorCount, failReasons })
      if (successCount > 0) {
        if (isSupabaseConfigured()) {
          upsertUserStats(email, successCount).catch((err) => console.error('[supabase] upsertUserStats:', err.message))
          if (mode === 'logo' && logoFile) {
            saveDefaultLogo(email, logoFile.buffer, logoFile.mimetype).then((logoPath) => {
              if (logoPath) upsertUserDefaults(email, { mode, text: text || '', template, scope, logo_storage_path: logoPath }).catch((e) => console.error('[supabase] upsertUserDefaults logo:', e.message))
            }).catch((err) => console.error('[supabase] saveDefaultLogo:', err.message))
          }
        } else {
          console.log('[supabase] Skipped: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Railway to persist stats and storage.')
        }
      }
    } else if (mode === 'logo' && logoFile && isSupabaseConfigured()) {
      const firstSuccess = results.find((r) => r.status === 'success' && r.downloadUrl)
      if (firstSuccess) {
        const token = firstSuccess.downloadUrl.replace(/^.*\/api\/download\//, '').replace(/\?.*$/, '').trim()
        if (token) cachedLogoByToken.set(token, { buffer: Buffer.from(logoFile.buffer), contentType: logoFile.mimetype || 'image/png', template, scope })
      }
    }

    res.json({ files: results })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Server error' })
  }
})

async function watermarkPdf(pdfBuffer, { mode, text, logoFile, template, scope }) {
  const doc = await PDFDocument.load(pdfBuffer)
  const pages = doc.getPages()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const firstOnly = scope === 'first-page-only'
  const pagesToMark = firstOnly ? pages.slice(0, 1) : pages

  let logoImageEmbed = null
  if (mode === 'logo' && logoFile) {
    const mime = (logoFile.mimetype || '').toLowerCase()
    logoImageEmbed = mime.includes('png')
      ? await doc.embedPng(logoFile.buffer)
      : await doc.embedJpg(logoFile.buffer)
  }

  for (const page of pagesToMark) {
    const { width, height } = page.getSize()
    const opts = { width, height, template }

    if (mode === 'text' && text) {
      drawTextWatermark(page, font, text, opts)
    } else if (mode === 'logo' && logoImageEmbed) {
      drawLogoWatermark(page, logoImageEmbed, opts)
    }
  }

  // Domain stamp: exactly once, bottom-right of first page only (single or multi-page)
  const firstPage = pages[0]
  if (firstPage) {
    const { width, height } = firstPage.getSize()
    const size = 10
    const marginX = 18
    const marginY = 18
    const textWidth = font.widthOfTextAtSize(DOMAIN_LABEL, size)
    const x = Math.max(marginX, width - textWidth - marginX)
    const y = marginY
    firstPage.drawText(DOMAIN_LABEL, {
      x,
      y,
      size,
      font,
      color: rgb(0.15, 0.15, 0.15),
      opacity: 1,
    })
  }

  return Buffer.from(await doc.save())
}

function drawTextWatermark(page, font, text, { width, height, template }) {
  const size = Math.min(width, height) * 0.06
  const opacity = 0.25
  const color = rgb(0.5, 0.5, 0.5)

  if (template === 'footer-tag') {
    const x = width / 2 - font.widthOfTextAtSize(text, size) / 2
    page.drawText(text, { x, y: 24, size, font, color, opacity })
    return
  }

  if (template === 'repeating-pattern') {
    // 4 watermarks per page in a 2x2 grid (center of each quadrant)
    const textW = font.widthOfTextAtSize(text, size)
    const positions = [
      { x: width / 4, y: (3 * height) / 4 },
      { x: (3 * width) / 4, y: (3 * height) / 4 },
      { x: width / 4, y: height / 4 },
      { x: (3 * width) / 4, y: height / 4 },
    ]
    for (const { x: cx, y: cy } of positions) {
      page.drawText(text, {
        x: cx - textW / 2,
        y: cy - size / 2,
        size,
        font,
        color,
        opacity,
        rotate: { type: RotationTypes.Degrees, angle: -45 },
      })
    }
    return
  }

  // diagonal-center
  const x = width / 2 - font.widthOfTextAtSize(text, size) / 2
  const y = height / 2 - size / 2
  page.drawText(text, {
    x,
    y,
    size,
    font,
    color,
    opacity,
    rotate: { type: RotationTypes.Degrees, angle: -45 },
  })
}

// Logo watermark opacity: light enough for OCR and watermark norms (bank statements, etc.)
const LOGO_WATERMARK_OPACITY = 0.2

function drawLogoWatermark(page, embeddedImage, { width, height, template }) {
  const maxDim = Math.min(width, height) * 0.25
  const imgW = embeddedImage.width
  const imgH = embeddedImage.height
  const scale = Math.min(maxDim / imgW, maxDim / imgH, 1)
  const w = imgW * scale
  const h = imgH * scale
  const opacity = LOGO_WATERMARK_OPACITY

  if (template === 'footer-tag') {
    const x = width / 2 - w / 2
    page.drawImage(embeddedImage, { x, y: 20, width: w, height: h, opacity })
    return
  }

  if (template === 'repeating-pattern') {
    // 4 watermarks per page in a 2x2 grid (center of each quadrant)
    const positions = [
      { x: width / 4, y: (3 * height) / 4 },
      { x: (3 * width) / 4, y: (3 * height) / 4 },
      { x: width / 4, y: height / 4 },
      { x: (3 * width) / 4, y: height / 4 },
    ]
    for (const { x: cx, y: cy } of positions) {
      page.drawImage(embeddedImage, { x: cx - w / 2, y: cy - h / 2, width: w, height: h, opacity })
    }
    return
  }

  const x = width / 2 - w / 2
  const y = height / 2 - h / 2
  page.drawImage(embeddedImage, { x, y, width: w, height: h, opacity })
}

async function watermarkImage(inputBuffer, { mode, text, logoFile, template }) {
  const image = sharp(inputBuffer)
  const meta = await image.metadata()
  const width = meta.width || 800
  const height = meta.height || 600

  if (mode === 'logo' && logoFile) {
    const logo = sharp(logoFile.buffer)
    const logoMeta = await logo.metadata()
    const maxDim = Math.min(width, height) * 0.25
    const scale = Math.min(maxDim / (logoMeta.width || 1), maxDim / (logoMeta.height || 1), 1)
    const w = Math.round((logoMeta.width || 1) * scale)
    const h = Math.round((logoMeta.height || 1) * scale)
    // Semi-transparent logo for OCR-friendly watermarks (aligns with LOGO_WATERMARK_OPACITY for PDFs)
    const logoBuf = await logo.resize(w, h).ensureAlpha(LOGO_WATERMARK_OPACITY).png().toBuffer()

    if (template === 'footer-tag') {
      const left = Math.round((width - w) / 2)
      const top = 20
      let out = await image.composite([{ input: logoBuf, left, top, blend: 'over' }]).toBuffer()
      out = await addDomainToImage(out, width, height)
      return { buffer: out, contentType: 'image/png', ext: '.png' }
    }
    if (template === 'repeating-pattern') {
      const positions = [
        { left: Math.round(width / 4 - w / 2), top: Math.round(height / 4 - h / 2) },
        { left: Math.round((3 * width) / 4 - w / 2), top: Math.round(height / 4 - h / 2) },
        { left: Math.round(width / 4 - w / 2), top: Math.round((3 * height) / 4 - h / 2) },
        { left: Math.round((3 * width) / 4 - w / 2), top: Math.round((3 * height) / 4 - h / 2) },
      ]
      const composites = positions.map(({ left, top }) => ({ input: logoBuf, left, top, blend: 'over' }))
      let out = await image.composite(composites).toBuffer()
      out = await addDomainToImage(out, width, height)
      return { buffer: out, contentType: 'image/png', ext: '.png' }
    }
    // diagonal-center: single logo centered
    const left = Math.round((width - w) / 2)
    const top = Math.round((height - h) / 2)
    let out = await image.composite([{ input: logoBuf, left, top, blend: 'over' }]).toBuffer()
    out = await addDomainToImage(out, width, height)
    return { buffer: out, contentType: 'image/png', ext: '.png' }
  }

  // Text mode: use SVG overlay
  if (!text) {
    let out = await image.toBuffer()
    out = await addDomainToImage(out, width, height)
    return { buffer: out, contentType: meta.format === 'png' ? 'image/png' : 'image/jpeg', ext: meta.format === 'png' ? '.png' : '.jpg' }
  }
  const fontSize = Math.min(width, height) * 0.06
  const fill = 'rgba(128,128,128,0.4)'

  if (template === 'footer-tag') {
    const left = (width - text.length * fontSize * 0.6) / 2
    const top = height * 0.08
    const svg = `<svg width="${width}" height="${height}"><text x="${left}" y="${top}" font-family="Arial" font-size="${fontSize}" fill="${fill}">${escapeXml(text)}</text></svg>`
    const svgBuf = Buffer.from(svg)
    let out = await image.composite([{ input: svgBuf, left: 0, top: 0, blend: 'over' }]).toBuffer()
    out = await addDomainToImage(out, width, height)
    return { buffer: out, contentType: meta.format === 'png' ? 'image/png' : 'image/jpeg', ext: meta.format === 'png' ? '.png' : '.jpg' }
  }
  if (template === 'repeating-pattern') {
    const positions = [
      { x: width / 4, y: height / 4 },
      { x: (3 * width) / 4, y: height / 4 },
      { x: width / 4, y: (3 * height) / 4 },
      { x: (3 * width) / 4, y: (3 * height) / 4 },
    ]
    const texts = positions.map(({ x, y }) => `<text x="${x}" y="${y}" dy="0.35em" font-family="Arial" font-size="${fontSize}" fill="${fill}" text-anchor="middle" transform="rotate(-45 ${x} ${y})">${escapeXml(text)}</text>`).join('')
    const svg = `<svg width="${width}" height="${height}">${texts}</svg>`
    const svgBuf = Buffer.from(svg)
    let out = await image.composite([{ input: svgBuf, left: 0, top: 0, blend: 'over' }]).toBuffer()
    out = await addDomainToImage(out, width, height)
    return { buffer: out, contentType: meta.format === 'png' ? 'image/png' : 'image/jpeg', ext: meta.format === 'png' ? '.png' : '.jpg' }
  }
  // diagonal-center: single text centered, rotated
  const left = (width - text.length * fontSize * 0.6) / 2
  const top = (height - fontSize) / 2
  const svg = `<svg width="${width}" height="${height}"><text x="${left}" y="${top}" font-family="Arial" font-size="${fontSize}" fill="${fill}" transform="rotate(-45 ${width / 2} ${height / 2})">${escapeXml(text)}</text></svg>`
  const svgBuf = Buffer.from(svg)
  let out = await image.composite([{ input: svgBuf, left: 0, top: 0, blend: 'over' }]).toBuffer()
  out = await addDomainToImage(out, width, height)
  return { buffer: out, contentType: meta.format === 'png' ? 'image/png' : 'image/jpeg', ext: meta.format === 'png' ? '.png' : '.jpg' }
}

function escapeXml(s) {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c])
}

async function addDomainToImage(buffer, width, height) {
  const fontSize = Math.max(14, Math.min(width, height) * 0.028)
  const padX = 16
  const padY = 16
  const label = escapeXml(DOMAIN_LABEL)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="${width - padX}" y="${height - padY}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="rgba(40,40,40,0.95)" text-anchor="end" dominant-baseline="auto">${label}</text></svg>`
  return sharp(buffer).composite([{ input: Buffer.from(svg), left: 0, top: 0, blend: 'over' }]).toBuffer()
}

const server = app.listen(PORT, () => {
  console.log(`WatermarkFile backend at http://localhost:${PORT}`)
})
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is in use. Stop the other process or run: lsof -ti:${PORT} | xargs kill -9`)
    process.exit(1)
  }
  throw err
})
