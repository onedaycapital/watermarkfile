import type { ProcessedFile } from '../../types'
import { track, AnalyticsEvents, getFileExtension } from '../../lib/analytics'
import { ConfirmEmailForDownload } from '../ConfirmEmailForDownload'
import { IconCheck, IconDownload, IconUpload } from './Icons'

interface AttractiveResultsPanelProps {
  files: ProcessedFile[]
  isVerified?: boolean
  onEmailToggle: () => void
  emailSaved: boolean
  emailDeliveryOn: boolean
  onMagicLinkSent?: (email: string) => void
  onConfirmBlockEmailChange?: (email: string) => void
  onStartOver: () => void
  initialEmail?: string
  resultsEmailSent?: boolean
  className?: string
}

export function AttractiveResultsPanel({
  files,
  isVerified = true,
  onEmailToggle: _onEmailToggle,
  emailSaved: _emailSaved,
  emailDeliveryOn: _emailDeliveryOn,
  onMagicLinkSent,
  onConfirmBlockEmailChange,
  onStartOver,
  initialEmail,
  resultsEmailSent = false,
  className = '',
}: AttractiveResultsPanelProps) {
  const pendingDelivery = files
    .filter((f): f is ProcessedFile & { downloadUrl: string } => f.status === 'success' && !!f.downloadUrl)
    .map((f) => ({ downloadUrl: f.downloadUrl, name: f.name }))

  return (
    <div className={`rounded-3xl border border-slate-200/90 bg-white shadow-card-accent overflow-hidden ${className}`}>
      <div className="px-6 py-4 md:px-8 md:py-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 to-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <IconCheck className="w-5 h-5 text-white" checkStroke="#10b981" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Your files are ready</h2>
            <p className="text-xs text-slate-500 mt-0.5">Download or get them by email</p>
          </div>
        </div>
      </div>
      <div className="p-6 md:p-8">
        {files.length > 0 && !isVerified && (
          <ConfirmEmailForDownload
            pendingDelivery={pendingDelivery}
            initialEmail={initialEmail}
            onMagicLinkSent={onMagicLinkSent}
            onEmailChange={onConfirmBlockEmailChange}
            className="mb-5"
          />
        )}
        {resultsEmailSent && (
          <p className="mb-4 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            Files sent to your email. You can also download below.
          </p>
        )}
        <ul className="space-y-2">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 py-3 px-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-sm text-slate-800 truncate font-medium">{f.name}</span>
              {f.status === 'success' && f.downloadUrl ? (
                isVerified ? (
                  <a
                    href={f.downloadUrl}
                    download={f.name}
                    onClick={() => {
                      track(AnalyticsEvents.DownloadClicked, {
                        file_name: f.name,
                        file_extension: getFileExtension(f.name),
                      })
                    }}
                    className="shrink-0 text-xs font-semibold px-3 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600 flex items-center gap-1.5 shadow-md shadow-violet-500/20 transition-all duration-200"
                  >
                    <IconDownload className="w-3.5 h-3.5" />
                    Download
                  </a>
                ) : (
                  <span className="text-xs text-violet-600 font-medium">Confirm email above to download</span>
                )
              ) : f.status === 'error' ? (
                <span className="text-xs text-amber-600 font-medium">{f.errorMessage || 'Failed'}</span>
              ) : (
                <span className="text-sm text-slate-500">—</span>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-6 pt-5 border-t border-slate-100">
          <button
            type="button"
            onClick={onStartOver}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 text-slate-700 font-semibold text-sm hover:border-violet-300 hover:bg-violet-50/50 hover:text-violet-800 transition-all duration-200"
          >
            <IconUpload className="w-4 h-4" />
            Watermark more files
          </button>
        </div>
      </div>
    </div>
  )
}
