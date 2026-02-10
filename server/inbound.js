/**
 * Process Resend inbound email (email.received): look up user defaults, fetch attachments,
 * watermark with text only, return reply payload for sendReplyWithAttachments.
 */

const SUPPORTED_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp']

/** Parse "Name <email@domain.com>" or "email@domain.com" to email */
function parseSenderEmail(from) {
  if (!from || typeof from !== 'string') return ''
  const trimmed = from.trim()
  const match = trimmed.match(/<([^>]+)>/)
  if (match) return match[1].trim().toLowerCase()
  return trimmed.toLowerCase()
}

/**
 * Process inbound email webhook payload. Fetches attachments via Resend API, watermarks with user defaults (text only).
 * @param {object} opts
 * @param {object} opts.body - Resend webhook body { type, data: { from, email_id, attachments: [{ id, filename, content_type }] } }
 * @param {string} opts.appOrigin - e.g. https://www.watermarkfile.com
 * @param {(email: string) => Promise<{ mode, text, template, scope } | null>} opts.getUserDefaults
 * @param {(buffer: Buffer, opts: object) => Promise<Buffer>} opts.watermarkPdf
 * @param {(buffer: Buffer, opts: object) => Promise<{ buffer: Buffer, contentType: string, ext: string }>} opts.watermarkImage
 * @returns {Promise<{ to: string, subject: string, text: string, html?: string, attachments?: { filename: string, content: Buffer }[] }>}
 */
export async function processInboundEmail(opts) {
  const { body, appOrigin, getUserDefaults, watermarkPdf, watermarkImage } = opts
  const from = body?.data?.from
  const emailId = body?.data?.email_id
  const attachmentMeta = body?.data?.attachments || []
  const senderEmail = parseSenderEmail(from)
  if (!senderEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
    return { to: from || 'noreply@watermarkfile.com', subject: 'WatermarkFile – unable to process', text: 'We could not determine your email address. Reply from a valid address.' }
  }

  const defaults = await getUserDefaults(senderEmail)
  console.log('[inbound] sender=', senderEmail, 'defaults=', defaults ? 'found' : 'null')
  if (!defaults) {
    return {
      to: senderEmail,
      subject: 'WatermarkFile – set your defaults first',
      text: `You don't have watermark defaults set yet. Visit ${appOrigin} to add your default watermark (text, template, scope). Then send your files as attachments to this address to get them back watermarked.`,
      html: `<p>You don't have watermark defaults set yet.</p><p>Visit <a href="${appOrigin}">${appOrigin}</a> to add your default watermark (text, template, scope). Then send your files as attachments to this address to get them back watermarked.</p><p>— WatermarkFile</p>`,
    }
  }

  if (defaults.mode === 'logo') {
    return {
      to: senderEmail,
      subject: 'WatermarkFile – use text default for email',
      text: `Your saved default is logo mode. Email-in supports text watermarks only. Visit ${appOrigin} to set a text default, or use the website for logo watermarks.`,
      html: `<p>Your saved default is logo mode. Email-in supports text watermarks only.</p><p>Visit <a href="${appOrigin}">${appOrigin}</a> to set a text default, or use the website for logo watermarks.</p><p>— WatermarkFile</p>`,
    }
  }

  const apiKey = (process.env.RESEND_API_KEY || '').toString().trim()
  if (!apiKey) {
    console.error('[inbound] RESEND_API_KEY not set; cannot fetch attachments')
    return {
      to: senderEmail,
      subject: 'WatermarkFile – temporarily unavailable',
      text: 'Inbound processing is not configured. Please use the website for now.',
    }
  }

  if (!attachmentMeta.length) {
    return {
      to: senderEmail,
      subject: 'WatermarkFile – no attachments',
      text: `Your email had no attachments. Send PDF or image files (JPG, PNG, WebP) as attachments to get them back watermarked with your defaults. Visit ${appOrigin} to change defaults.`,
    }
  }

  let Resend
  try {
    const mod = await import('resend')
    Resend = mod.Resend || mod.default
  } catch (e) {
    console.error('[inbound] resend package not available:', e.message)
    return { to: senderEmail, subject: 'WatermarkFile – error', text: 'Service temporarily unavailable.' }
  }

  const resend = new Resend(apiKey)
  let listResult = []
  try {
    const out = await resend.emails.receiving.attachments.list({ emailId })
    // API returns { data: [...] }; some SDK versions may expose .attachments
    const raw = out?.data ?? out?.attachments
    listResult = Array.isArray(raw) ? raw : []
  } catch (e) {
    console.error('[inbound] List attachments failed:', e.message)
    // Fallback: fetch each attachment by id from webhook meta
    if (attachmentMeta.length > 0) {
      for (const meta of attachmentMeta) {
        try {
          const one = await resend.emails.receiving.attachments.get({ emailId, id: meta.id })
          const att = one?.data ?? one
          if (att?.download_url || att?.url) listResult.push(att)
        } catch (err) {
          console.warn('[inbound] Get attachment failed', meta.id, err.message)
        }
      }
    }
    if (listResult.length === 0) {
      return { to: senderEmail, subject: 'WatermarkFile – error', text: 'Could not read your attachments. Please try again.' }
    }
  }

  const attachments = []
  const optsNoLogo = { mode: 'text', text: defaults.text || 'Watermark', template: defaults.template, scope: defaults.scope, logoFile: null }
  const metaById = new Map(attachmentMeta.map((a) => [a.id, a]))

  for (const att of listResult) {
    const id = att.id
    const meta = metaById.get(id) || att
    const filename = (meta.filename || att.filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')
    const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0] || ''
    const downloadUrl = att.download_url || att.url
    if (!downloadUrl) {
      console.warn('[inbound] No download URL for attachment', id)
      continue
    }
    try {
      const resp = await fetch(downloadUrl)
      if (!resp.ok) {
        console.warn('[inbound] Failed to fetch attachment', id, resp.status)
        continue
      }
      const buffer = Buffer.from(await resp.arrayBuffer())

      if (ext === '.pdf') {
        const out = await watermarkPdf(buffer, optsNoLogo)
        attachments.push({ filename: filename.replace(/\.[^.]+$/, '') + '_watermarked.pdf', content: out })
      } else if (SUPPORTED_IMAGE_EXT.includes(ext)) {
        const out = await watermarkImage(buffer, optsNoLogo)
        const outName = filename.replace(/\.[^.]+$/, '') + '_watermarked' + (out.ext || '.png')
        attachments.push({ filename: outName, content: out.buffer })
      }
    } catch (err) {
      console.error('[inbound] Process attachment', filename, err.message)
    }
  }

  if (attachments.length === 0) {
    return {
      to: senderEmail,
      subject: 'WatermarkFile – no supported files',
      text: `We could not process any supported attachments. Send PDF or image files (JPG, PNG, WebP). Visit ${appOrigin} to set defaults.`,
    }
  }

  return {
    to: senderEmail,
    subject: 'Your watermarked files – WatermarkFile',
    text: `Here are your ${attachments.length} watermarked file(s). You can reply with more files anytime. — WatermarkFile`,
    html: `<p>Here are your ${attachments.length} watermarked file(s). You can reply with more files anytime.</p><p>— WatermarkFile</p>`,
    attachments,
  }
}
