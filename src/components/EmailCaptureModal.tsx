import { useState } from 'react'

interface EmailCaptureModalProps {
  open: boolean
  onClose: () => void
  onSave: (email: string) => void
}

export function EmailCaptureModal({ open, onClose, onSave }: EmailCaptureModalProps) {
  const [email, setEmail] = useState('')
  if (!open) return null

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (email.trim()) onSave(email.trim())
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="email-modal-title" className="text-lg font-semibold text-ink-900">
          Save your defaults + optional email delivery
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm text-ink-600">Email</span>
            <input
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </label>
          <p className="text-xs text-ink-500">
            We only use your email to remember your watermark defaults and send files when requested.
          </p>
          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600"
            >
              Save & enable email delivery
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-ink-200 text-ink-700 text-sm font-medium hover:bg-ink-50"
            >
              Skip
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
