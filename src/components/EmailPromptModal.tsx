import { useState } from 'react'

interface EmailPromptModalProps {
  open: boolean
  onClose: () => void
  title: string
  submitLabel: string
  onSubmit: (email: string) => void
  loading?: boolean
}

export function EmailPromptModal({ open, onClose, title, submitLabel, onSubmit, loading }: EmailPromptModalProps) {
  const [email, setEmail] = useState('')
  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const value = email.trim()
    if (value) onSubmit(value)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-prompt-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="email-prompt-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm text-slate-600">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />
          </label>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50"
            >
              {loading ? 'Loading…' : submitLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
