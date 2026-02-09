import { useState, useEffect } from 'react'
import { apiUrl } from '../lib/api'

interface ConfirmEmailForDownloadProps {
  pendingDelivery: Array<{ downloadUrl: string; name: string }>
  initialEmail?: string
  onMagicLinkSent?: (email: string) => void
  /** So App can use this email for "Email me files" / "Save as default" without showing the modal again. */
  onEmailChange?: (email: string) => void
  className?: string
}

export function ConfirmEmailForDownload({
  pendingDelivery,
  initialEmail,
  onMagicLinkSent,
  onEmailChange,
  className = '',
}: ConfirmEmailForDownloadProps) {
  const [email, setEmail] = useState(() => (initialEmail ?? '').trim().toLowerCase())
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const normalized = (initialEmail ?? '').trim().toLowerCase()
    if (normalized && normalized.includes('@')) onEmailChange?.(normalized)
  }, [initialEmail, onEmailChange])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const normalized = email.trim().toLowerCase()
    if (!normalized) return
    setStatus('sending')
    setErrorMessage('')
    try {
      const deliveryPayload = pendingDelivery.map(({ downloadUrl, name }) => {
        const token = downloadUrl.replace(/^.*\/api\/download\//, '').replace(/\?.*$/, '')
        return { token, name }
      })
      const body = {
        email: normalized,
        pendingDelivery: deliveryPayload,
      }
      const res = await fetch(apiUrl('/api/auth/send-magic-link'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus('error')
        setErrorMessage(data.error || res.statusText || 'Failed to send')
        return
      }
      setStatus('sent')
      onMagicLinkSent?.(normalized)
    } catch {
      setStatus('error')
      setErrorMessage('Network error')
    }
  }

  const hasDeliveries = pendingDelivery.length > 0

  return (
    <div className={`rounded-xl border border-violet-200 bg-violet-50/80 p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-slate-800">Confirm your email to download</h3>
      <p className="text-xs text-slate-600 mt-1">
        {hasDeliveries
          ? "We'll send you a magic link to verify your email. Click it to download your files to this device."
          : "Enter your email and we'll send you a magic link. Use it next time to get your files by email."}
      </p>
      {status === 'sent' ? (
        <p className="mt-3 text-sm font-medium text-violet-700">
          Check your inbox and click the link we sent. Your downloads will start when you do.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => {
              const v = e.target.value
              setEmail(v)
              const normalized = v.trim().toLowerCase()
              if (normalized && normalized.includes('@')) onEmailChange?.(normalized)
            }}
            placeholder="you@example.com"
            className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            disabled={status === 'sending'}
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            className="shrink-0 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-60"
          >
            {status === 'sending' ? 'Sending…' : 'Send magic link'}
          </button>
        </form>
      )}
      {status === 'error' && errorMessage && (
        <p className="mt-2 text-xs text-red-600">{errorMessage}</p>
      )}
    </div>
  )
}
