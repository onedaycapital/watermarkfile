/**
 * Email sending: Resend API (when RESEND_API_KEY is set) or nodemailer SMTP.
 * Resend is preferred so one API key handles magic link + reply emails (and inbound uses the same key).
 */

const FROM_DEFAULT = 'WatermarkFile <onboarding@resend.dev>'

function getFrom() {
  return (process.env.RESEND_FROM || process.env.SMTP_FROM || FROM_DEFAULT).trim()
}

let transporter = null

async function getTransporter() {
  if (transporter !== null) return transporter
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT) || 587
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const secure = process.env.SMTP_SECURE === 'true'
  if (host && user && pass) {
    try {
      const nm = await import('nodemailer')
      transporter = nm.default.createTransport({ host, port, secure, auth: { user, pass } })
    } catch (err) {
      console.error('[email] nodemailer not available:', err.message)
    }
  }
  return transporter
}

function hasResendApiKey() {
  return !!((process.env.RESEND_API_KEY || '').toString().trim())
}

async function sendViaResend({ to, subject, text, html, attachments = [] }) {
  const apiKey = (process.env.RESEND_API_KEY || '').toString().trim()
  if (!apiKey) return null
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const payload = {
      from: getFrom(),
      to: [to],
      subject,
      text,
      html: html || text,
    }
    if (attachments.length > 0) {
      payload.attachments = attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
      }))
    }
    const { data, error } = await resend.emails.send(payload)
    if (error) throw new Error(error.message || 'Resend send failed')
    return data
  } catch (err) {
    throw err
  }
}

export async function sendMagicLinkEmail({ to, magicLinkUrl, appOrigin }) {
  const subject = 'Your watermark files are ready – confirm your email'
  const html = `
    <p>Click the link below to confirm your email and download your watermarked files:</p>
    <p><a href="${magicLinkUrl}" style="display:inline-block; padding:10px 20px; background:#7c3aed; color:#fff; text-decoration:none; border-radius:8px;">Open and download</a></p>
    <p>Or copy this link: <a href="${magicLinkUrl}">${magicLinkUrl}</a></p>
    <p>This link expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
    <p>— WatermarkFile</p>
  `
  const text = `Confirm your email and download your files: ${magicLinkUrl}\n\nThis link expires in 15 minutes.`

  if (hasResendApiKey()) {
    return sendViaResend({ to, subject, text, html })
  }

  const transport = await getTransporter()
  if (!transport) {
    console.log('[email] Magic link (no Resend API key or SMTP configured):', magicLinkUrl)
    const err = new Error('EMAIL_NOT_CONFIGURED')
    err.code = 'EMAIL_NOT_CONFIGURED'
    throw err
  }
  return transport.sendMail({
    from: getFrom(),
    to,
    subject,
    text,
    html,
  })
}

/**
 * Send reply email with optional attachments (e.g. watermarked files).
 * @param {{ to: string, subject: string, text: string, html?: string, attachments?: { filename: string, content: Buffer }[] }}
 */
export async function sendReplyWithAttachments({ to, subject, text, html, attachments = [] }) {
  if (hasResendApiKey()) {
    return sendViaResend({ to, subject, text, html, attachments })
  }

  const transport = await getTransporter()
  if (transport) {
    return transport.sendMail({
      from: getFrom(),
      to,
      subject,
      text,
      html: html || text,
      attachments: attachments.map((a) => ({ filename: a.filename, content: a.content })),
    })
  }
  console.log('[email] Reply (no Resend or SMTP):', { to, subject, attachmentCount: attachments.length })
}
