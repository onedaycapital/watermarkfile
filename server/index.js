import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { PDFDocument, rgb, StandardFonts, RotationTypes } from 'pdf-lib'
import sharp from 'sharp'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'

const app = express()
// Locked to 3000 for WatermarkFile project (override with PORT env if needed)
const PORT = Number(process.env.PORT) || 3000

const DOMAIN = 'www.watermarkfile.com'
const DOMAIN_LABEL = `By ${DOMAIN}`

// In-memory store for processed files: token -> { buffer, filename, contentType }
const store = new Map()
// User defaults by email (normalized lowercase): { mode, text?, template, scope, updatedAt }
const defaultsByEmail = new Map()

// Clean old entries (older than 1 hour)
function cleanup() {
  const now = Date.now()
  for (const [token, entry] of store.entries()) {
    if (entry.createdAt && now - entry.createdAt > 60 * 60 * 1000) store.delete(token)
  }
}
setInterval(cleanup, 15 * 60 * 1000)

app.use(cors({ origin: true }))
app.use(express.json())

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB per file
})

// GET / or /api — backend is API-only; use the app at localhost:5173
app.get(['/', '/api'], (req, res) => {
  res.json({
    name: 'WatermarkFile API',
    message: 'Use the app at http://localhost:5173 to watermark files.',
    endpoints: { 'POST /api/watermark': 'Upload files and options', 'GET /api/download/:token': 'Download a processed file' },
  })
})

// GET /api/defaults?email= — get saved defaults for email
app.get('/api/defaults', (req, res) => {
  const email = (req.query.email || '').toString().trim().toLowerCase()
  if (!email) return res.status(400).json({ error: 'Email required' })
  const saved = defaultsByEmail.get(email)
  if (!saved) return res.status(404).json({ error: 'No defaults found for this email' })
  res.json({ mode: saved.mode, text: saved.text, template: saved.template, scope: saved.scope })
})

// 12 offerings: (Logo|Text) × (Diagonal|Repeating|Footer) × (All Pages|First Page Only) — each a unique default
const TEMPLATES_LIST = ['diagonal-center', 'repeating-pattern', 'footer-tag']
const SCOPES_LIST = ['all-pages', 'first-page-only']

// POST /api/defaults — save defaults for email (body: { email, defaults: { mode, text?, template, scope } })
app.post('/api/defaults', (req, res) => {
  const email = (req.body?.email || '').toString().trim().toLowerCase()
  const def = req.body?.defaults
  if (!email) return res.status(400).json({ error: 'Email required' })
  if (!def || typeof def.mode !== 'string' || typeof def.template !== 'string' || typeof def.scope !== 'string') {
    return res.status(400).json({ error: 'Invalid defaults' })
  }
  const mode = def.mode === 'logo' ? 'logo' : 'text'
  const template = TEMPLATES_LIST.includes(def.template) ? def.template : 'diagonal-center'
  const scope = SCOPES_LIST.includes(def.scope) ? def.scope : 'all-pages'
  defaultsByEmail.set(email, {
    mode,
    text: def.text ?? '',
    template,
    scope,
    updatedAt: Date.now(),
  })
  res.json({ ok: true })
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
  store.delete(req.params.token)
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

    const results = []

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
          continue
        }

        name += outExt
        const token = uuidv4()
        store.set(token, {
          buffer,
          filename: name,
          contentType,
          createdAt: Date.now(),
        })
        results.push({
          id,
          name,
          status: 'success',
          downloadUrl: `/api/download/${token}`,
        })
      } catch (err) {
        results.push({
          id,
          name: file.originalname,
          status: 'error',
          errorMessage: err.message || 'Processing failed',
        })
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

function drawLogoWatermark(page, embeddedImage, { width, height, template }) {
  const maxDim = Math.min(width, height) * 0.25
  const imgW = embeddedImage.width
  const imgH = embeddedImage.height
  const scale = Math.min(maxDim / imgW, maxDim / imgH, 1)
  const w = imgW * scale
  const h = imgH * scale
  const opacity = 0.3

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
    const logoBuf = await logo.resize(w, h).png().toBuffer()

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
