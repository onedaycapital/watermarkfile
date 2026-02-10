import { useState, useRef, useEffect } from 'react'
import type { WatermarkOptions, WatermarkMode, Template, Scope } from '../../types'
import { type StoredDefaults } from '../../lib/defaults'
import { apiUrl } from '../../lib/api'
import { track, AnalyticsEvents, getFileExtension } from '../../lib/analytics'
import { IconUpload, IconChevronRight, IconChevronDown, IconDownload, IconText, IconImage } from './Icons'

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp'
const MAX_TEXT_LEN = 60

const VALID_MODES: WatermarkMode[] = ['text', 'logo']
const VALID_TEMPLATES: Template[] = ['diagonal-center', 'repeating-pattern', 'footer-tag']
const VALID_SCOPES: Scope[] = ['all-pages', 'first-page-only']

function clampMode(m: unknown): WatermarkMode {
  return VALID_MODES.includes(m as WatermarkMode) ? (m as WatermarkMode) : 'text'
}
function clampTemplate(t: unknown): Template {
  return VALID_TEMPLATES.includes(t as Template) ? (t as Template) : 'diagonal-center'
}
function clampScope(s: unknown): Scope {
  return VALID_SCOPES.includes(s as Scope) ? (s as Scope) : 'all-pages'
}

const TEMPLATES: { value: Template; label: string }[] = [
  { value: 'diagonal-center', label: 'Diagonal' },
  { value: 'repeating-pattern', label: 'Repeating' },
  { value: 'footer-tag', label: 'Footer' },
]

const STEP_ACCENTS = [
  { border: 'border-l-violet-500', header: 'bg-gradient-to-r from-violet-50 to-white', badge: 'bg-violet-500', badgeRing: 'ring-violet-200' },
  { border: 'border-l-indigo-500', header: 'bg-gradient-to-r from-indigo-50 to-white', badge: 'bg-indigo-500', badgeRing: 'ring-indigo-200' },
  { border: 'border-l-fuchsia-500', header: 'bg-gradient-to-r from-fuchsia-50 to-white', badge: 'bg-fuchsia-500', badgeRing: 'ring-fuchsia-200' },
  { border: 'border-l-violet-500', header: 'bg-gradient-to-r from-violet-50 to-white', badge: 'bg-gradient-to-r from-violet-500 to-fuchsia-500', badgeRing: 'ring-violet-200' },
]

/** Pill toggle group — matches Step 4 style: violet track, selected = solid violet */
function ToggleGroup({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: string; label: string; icon?: React.ReactNode }[]
  value: string
  onChange: (v: string) => void
  label?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>}
      <div
        role="group"
        aria-label={label}
        className="inline-flex w-full rounded-full bg-violet-200/90 p-1 gap-0.5 shadow-inner"
      >
        {options.map((opt) => {
          const isSelected = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                isSelected
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StepConnector({ isLast }: { isLast: boolean }) {
  if (isLast) return null
  return (
    <>
      {/* Mobile: vertical stack — arrow points down */}
      <div className="flex flex-col items-center py-2 md:hidden" aria-hidden>
        <div className="w-px h-4 bg-gradient-to-b from-violet-200 to-indigo-200" />
        <IconChevronDown className="w-4 h-4 text-violet-400 mt-0.5" />
      </div>
      {/* Desktop: horizontal — arrow points right */}
      <div className="hidden md:flex flex-1 min-w-[20px] max-w-[28px] items-center justify-center shrink-0" aria-hidden>
        <div className="h-px flex-1 min-w-[10px] bg-gradient-to-r from-violet-200 to-transparent" />
        <IconChevronRight className="w-4 h-4 text-violet-400 shrink-0 mx-0.5" />
        <div className="h-px flex-1 min-w-[10px] bg-gradient-to-l from-indigo-200 to-transparent" />
      </div>
    </>
  )
}

function StepTile({
  step,
  title,
  accent,
  children,
}: {
  step: number
  title: string
  accent: (typeof STEP_ACCENTS)[0]
  children: React.ReactNode
}) {
  return (
    <div className={`flex flex-col rounded-2xl border border-slate-200/90 bg-white overflow-hidden shrink-0 md:min-w-0 md:flex-1 shadow-md shadow-slate-200/50 ${accent.border} border-l-4`}>
      <div className={`px-4 py-3 border-b border-slate-100/80 ${accent.header}`}>
        <div className="flex items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accent.badge} text-sm font-bold text-white shadow-md ring-2 ${accent.badgeRing} ring-offset-2`}>
            {step}
          </span>
          <span className="text-sm font-semibold text-slate-800 tracking-tight">{title}</span>
        </div>
      </div>
      <div className="p-4 flex-1 flex flex-col min-h-0 bg-white">{children}</div>
    </div>
  )
}

export interface LogoAsset {
  id: string
  storage_path: string
  created_at: string | null
  is_default: boolean
}

interface AttractiveToolCardProps {
  onWatermarkRequest: (files: File[], options: WatermarkOptions, extras?: { emailMeFiles: boolean }) => void
  disabled?: boolean
  loadedDefaults?: StoredDefaults | null
  onLoadDefaultsClick?: () => void
  onRequestSaveDefaults?: (defaults: Pick<WatermarkOptions, 'mode' | 'text' | 'template' | 'scope'>, logoFile?: File) => void
  onRefetchDefaults?: (email: string) => void
  userEmail?: string | null
}

function getInitialMode(loadedDefaults: StoredDefaults | null | undefined): WatermarkMode {
  if (!loadedDefaults || typeof loadedDefaults.mode !== 'string') return 'text'
  return clampMode(loadedDefaults.mode)
}
function getInitialText(loadedDefaults: StoredDefaults | null | undefined): string {
  if (!loadedDefaults) return ''
  return typeof loadedDefaults.text === 'string' ? loadedDefaults.text : ''
}
function getInitialTemplate(loadedDefaults: StoredDefaults | null | undefined): Template {
  if (!loadedDefaults || typeof loadedDefaults.template !== 'string') return 'diagonal-center'
  return clampTemplate(loadedDefaults.template)
}
function getInitialScope(loadedDefaults: StoredDefaults | null | undefined): Scope {
  if (!loadedDefaults || typeof loadedDefaults.scope !== 'string') return 'all-pages'
  return clampScope(loadedDefaults.scope)
}
function hasValidDefaults(loadedDefaults: StoredDefaults | null | undefined): boolean {
  return !!(loadedDefaults && typeof loadedDefaults.mode === 'string' && typeof loadedDefaults.template === 'string' && typeof loadedDefaults.scope === 'string')
}

export function AttractiveToolCard({ onWatermarkRequest, disabled, loadedDefaults, onLoadDefaultsClick, onRequestSaveDefaults, onRefetchDefaults, userEmail }: AttractiveToolCardProps) {
  const [files, setFiles] = useState<File[]>([])
  const [mode, setMode] = useState<WatermarkMode>(() => getInitialMode(loadedDefaults))
  const [text, setText] = useState(() => getInitialText(loadedDefaults))
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [template, setTemplate] = useState<Template>(() => getInitialTemplate(loadedDefaults))
  const [scope, setScope] = useState<Scope>(() => getInitialScope(loadedDefaults))
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [disabledHint, setDisabledHint] = useState<string | null>(null)
  const [emailMeFiles, setEmailMeFiles] = useState(false)
  const [saveAsDefaultStep1, setSaveAsDefaultStep1] = useState(() => hasValidDefaults(loadedDefaults))
  const [saveAsDefaultStep2, setSaveAsDefaultStep2] = useState(() => hasValidDefaults(loadedDefaults))
  const [logoAssets, setLogoAssets] = useState<LogoAsset[]>([])
  const [assetPickerOpen, setAssetPickerOpen] = useState(false)
  const [assetPickerLoading, setAssetPickerLoading] = useState<string | null>(null)
  const [referralPanelOpen, setReferralPanelOpen] = useState(false)
  const [referralUrl, setReferralUrl] = useState<string | null>(null)
  const [referralLoading, setReferralLoading] = useState(false)
  const [referralCopied, setReferralCopied] = useState(false)
  const lastAppliedDefaultsRef = useRef<StoredDefaults | null>(null)

  // Logo preview: create object URL when logo file is set, revoke on change/unmount
  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      return
    }
    const url = URL.createObjectURL(logoFile)
    setLogoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return url
    })
    return () => URL.revokeObjectURL(url)
  }, [logoFile])

  // Single source of truth: when loadedDefaults is set, apply step 1 and step 2 values exactly. Do not clear loadedDefaults so it persists when user returns to form (e.g. Watermark more files).
  useEffect(() => {
    if (!loadedDefaults || typeof loadedDefaults.mode !== 'string' || typeof loadedDefaults.template !== 'string' || typeof loadedDefaults.scope !== 'string') {
      lastAppliedDefaultsRef.current = null
      return
    }
    if (lastAppliedDefaultsRef.current === loadedDefaults) return
    lastAppliedDefaultsRef.current = loadedDefaults

    let cancelled = false
    const modeVal = clampMode(loadedDefaults.mode)
    const templateVal = clampTemplate(loadedDefaults.template)
    const scopeVal = clampScope(loadedDefaults.scope)
    const textVal = typeof loadedDefaults.text === 'string' ? loadedDefaults.text : ''

    setMode(modeVal)
    setText(textVal)
    setTemplate(templateVal)
    setScope(scopeVal)
    setSaveAsDefaultStep1(true)
    setSaveAsDefaultStep2(true)

    const email = (loadedDefaults.email || userEmail)?.trim().toLowerCase()

    if (modeVal === 'logo' && email) {
      setLogoFile(null)
      const logoUrl = loadedDefaults.logo_url ? apiUrl(loadedDefaults.logo_url) : apiUrl(`/api/defaults/logo?email=${encodeURIComponent(email)}`)
      fetch(logoUrl, { credentials: 'include' })
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`${r.status}`))))
        .then((blob) => new File([blob], 'default-logo.png', { type: blob.type || 'image/png' }))
        .then((file) => { if (!cancelled) setLogoFile(file) })
        .catch(() => { if (!cancelled) setLogoFile(null) })
    } else {
      setLogoFile(null)
    }

    return () => { cancelled = true }
  }, [loadedDefaults, userEmail])

  const logoEmail = (loadedDefaults?.email || userEmail)?.trim().toLowerCase()

  useEffect(() => {
    if (mode !== 'logo' || !logoEmail) {
      setLogoAssets([])
      return
    }
    let cancelled = false
    fetch(apiUrl(`/api/defaults/logo-assets?email=${encodeURIComponent(logoEmail)}`), { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { assets: [] }))
      .then((data) => { if (!cancelled) setLogoAssets(Array.isArray(data?.assets) ? data.assets : []) })
      .catch(() => { if (!cancelled) setLogoAssets([]) })
    return () => { cancelled = true }
  }, [mode, logoEmail])

  const handleUseAssetForRun = (storagePath: string) => {
    if (!logoEmail) return
    setAssetPickerLoading(storagePath)
    const url = apiUrl(`/api/defaults/logo?email=${encodeURIComponent(logoEmail)}&path=${encodeURIComponent(storagePath)}`)
    fetch(url, { credentials: 'include' })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`${r.status}`))))
      .then((blob) => new File([blob], 'logo.png', { type: blob.type || 'image/png' }))
      .then((file) => { setLogoFile(file); setAssetPickerOpen(false) })
      .catch(() => {})
      .finally(() => setAssetPickerLoading(null))
  }

  const handleSetAssetAsDefault = (storagePath: string) => {
    if (!logoEmail || !onRefetchDefaults) return
    setAssetPickerLoading(storagePath)
    fetch(apiUrl('/api/defaults/logo/set-default'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: logoEmail, storage_path: storagePath }),
    })
      .then((r) => (r.ok ? undefined : Promise.reject(new Error('Failed'))))
      .then(() => { onRefetchDefaults(logoEmail); setAssetPickerOpen(false) })
      .catch(() => {})
      .finally(() => setAssetPickerLoading(null))
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const items = Array.from(e.target.files || [])
    if (items.length > 0) {
      track(AnalyticsEvents.FilesSelected, {
        file_count: items.length,
        file_types: items.map((f) => getFileExtension(f.name)),
      })
    }
    setFiles((prev) => [...prev, ...items])
    e.target.value = ''
  }

  const handleLogoInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setLogoFile(f)
      setSaveAsDefaultStep1(false)
    }
    e.target.value = ''
  }

  const canSubmit =
    files.length > 0 &&
    (mode === 'text' ? text.trim().length > 0 && text.length <= MAX_TEXT_LEN : !!logoFile)

  const handleSubmit = () => {
    if (disabled) return
    if (!canSubmit) {
      setDisabledHint(
        files.length === 0
          ? 'Select at least one file in step 3.'
          : mode === 'text'
            ? 'Enter watermark text in step 1.'
            : 'Upload a logo in step 1.'
      )
      setTimeout(() => setDisabledHint(null), 3000)
      return
    }
    setDisabledHint(null)
    onWatermarkRequest(files, {
      mode,
      text: mode === 'text' ? text : undefined,
      logoFile: mode === 'logo' ? logoFile || undefined : undefined,
      template,
      scope,
    }, { emailMeFiles })
  }

  return (
    <>
    <section className="w-full max-w-[52rem] md:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-w-0" aria-label="Watermark tool">
      <div className="rounded-3xl border border-slate-200/90 bg-white shadow-card-accent overflow-hidden min-w-0">
        <div className="px-4 py-4 md:px-8 md:py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-violet-50/50 to-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 shrink-0 order-first sm:order-none">
            <button
              type="button"
              onClick={() => {
                setReferralPanelOpen(true)
                setReferralUrl(null)
                setReferralCopied(false)
                const email = (userEmail || loadedDefaults?.email || '').trim().toLowerCase()
                if (email) {
                  setReferralLoading(true)
                  fetch(apiUrl(`/api/referral/url?email=${encodeURIComponent(email)}`), { credentials: 'include' })
                    .then((r) => (r.ok ? r.json() : null))
                    .then((data) => { setReferralUrl(data?.url ?? null); setReferralLoading(false) })
                    .catch(() => setReferralLoading(false))
                }
              }}
              className="text-sm font-semibold text-violet-700 hover:text-violet-800 underline underline-offset-2 transition-colors"
            >
              Refer &amp; get free months
            </button>
          </div>
          <div className="min-w-0 flex-1 text-center">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Create Your Watermarked Files
            </h2>
            <p className="text-sm text-slate-600 mt-1 font-medium break-words">
              Follow the steps in order — each leads to the next.
            </p>
            <p className="text-xs text-slate-500 mt-1 break-words">
              Use &quot;Save as default&quot; in steps 1 and 2 to remember your choices — and to get watermarked files back by email when you send files to our address.
            </p>
          </div>
          {onLoadDefaultsClick && (
            <button
              type="button"
              onClick={onLoadDefaultsClick}
              className="shrink-0 self-start sm:self-auto text-sm font-semibold text-violet-700 bg-white border-2 border-violet-300 hover:border-violet-500 hover:bg-violet-50 rounded-full px-4 py-2 shadow-sm transition-all duration-200 whitespace-nowrap"
            >
              Returning users — load defaults
            </button>
          )}
        </div>
        <div className="p-4 md:p-6 bg-gradient-to-br from-slate-50/80 to-violet-50/30 min-w-0">
          <div className="flex flex-col md:flex-row md:items-stretch gap-0 min-w-0">
            <StepTile step={1} title="Logo or Text" accent={STEP_ACCENTS[0]}>
              <div className="flex flex-col gap-3">
                <ToggleGroup
                  label="Watermark type"
                  value={mode}
                  onChange={(v) => { setMode(v as WatermarkMode); setSaveAsDefaultStep1(false) }}
                  options={[
                    { value: 'logo', label: 'Logo', icon: <IconImage className="w-4 h-4" /> },
                    { value: 'text', label: 'Text', icon: <IconText className="w-4 h-4" /> },
                  ]}
                />
                {mode === 'logo' ? (
                  <div className="flex flex-col gap-2">
                    {logoFile && logoPreviewUrl ? (
                      <div className="rounded-xl border border-violet-100 bg-white p-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Logo for watermark</span>
                        <div className="mt-2 min-h-[100px] flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2">
                          <img
                            src={logoPreviewUrl}
                            alt="Logo preview"
                            className="max-h-24 w-full object-contain"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-xl bg-violet-50 border border-violet-100 px-3 py-2">
                        <IconImage className="w-5 h-5 text-violet-600 shrink-0" />
                        <span className="text-sm text-slate-600">Your default: Logo — choose file below</span>
                      </div>
                    )}
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Upload logo for this session</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoInput}
                        className="text-xs file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-violet-100 file:text-violet-700 file:text-xs file:font-medium file:shadow-sm"
                      />
                    </label>
                    {logoAssets.length >= 2 && (
                      <button
                        type="button"
                        onClick={() => setAssetPickerOpen(true)}
                        className="text-xs font-semibold text-violet-600 hover:text-violet-700 underline underline-offset-2 text-left"
                      >
                        Select from your assets
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {text.trim().length > 0 && (
                      <div className="rounded-xl bg-violet-50 border border-violet-100 px-3 py-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Your watermark text</span>
                        <p className="text-sm font-medium text-slate-800 mt-0.5 break-words">"{text.trim()}"</p>
                      </div>
                    )}
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Watermark text</label>
                    <input
                        type="text"
                        maxLength={MAX_TEXT_LEN}
                        value={text}
                        onChange={(e) => { setText(e.target.value); setSaveAsDefaultStep1(false) }}
                        placeholder="e.g. Confidential"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/25 transition-all duration-200 font-medium"
                    />
                    <span className="text-xs text-slate-500 font-medium">{text.length}/{MAX_TEXT_LEN}</span>
                  </>
                )}
                {onRequestSaveDefaults && (
                  <label className="flex items-center gap-2 cursor-pointer mt-0.5">
                    <input
                      type="checkbox"
                      checked={saveAsDefaultStep1}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setSaveAsDefaultStep1(checked)
                        if (checked) onRequestSaveDefaults({ mode, text: mode === 'text' ? text : undefined, template, scope }, mode === 'logo' ? logoFile ?? undefined : undefined)
                      }}
                      className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                    />
                    <span className="text-xs font-semibold text-slate-600">Save as default</span>
                  </label>
                )}
              </div>
            </StepTile>
            <StepConnector isLast={false} />

            <StepTile step={2} title="Layout & Pages" accent={STEP_ACCENTS[1]}>
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Layout</span>
                  <div className="relative">
                  <select
                    value={template}
                    onChange={(e) => { setTemplate(e.target.value as Template); setSaveAsDefaultStep2(false) }}
                    className="w-full rounded-xl border border-slate-200 bg-white pl-3 pr-9 py-2 text-xs text-slate-800 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/25 appearance-none transition-all duration-200"
                  >
                    {TEMPLATES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <IconChevronDown className="w-4 h-4" />
                  </span>
                </div>
                </div>
                <div className="mt-3">
                <ToggleGroup
                  label="Apply to"
                  value={scope}
                  onChange={(v) => { setScope(v as Scope); setSaveAsDefaultStep2(false) }}
                  options={[
                    { value: 'all-pages', label: 'All pages' },
                    { value: 'first-page-only', label: 'First page only' },
                  ]}
                />
                </div>
                {onRequestSaveDefaults && (
                  <label className="flex items-center gap-2 cursor-pointer mt-0.5">
                    <input
                      type="checkbox"
                      checked={saveAsDefaultStep2}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setSaveAsDefaultStep2(checked)
                        if (checked) onRequestSaveDefaults({ mode, text: mode === 'text' ? text : undefined, template, scope }, mode === 'logo' ? logoFile ?? undefined : undefined)
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-semibold text-slate-600">Save as default</span>
                  </label>
                )}
              </div>
            </StepTile>
            <StepConnector isLast={false} />

            <StepTile step={3} title="Upload Files" accent={STEP_ACCENTS[2]}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
                className="flex-1 min-h-[52px] md:min-h-[60px] rounded-xl flex flex-col items-center justify-center p-3 text-center border border-slate-200/90 bg-slate-50/60 cursor-pointer hover:border-slate-300 hover:bg-slate-100/80 transition-colors duration-200"
                aria-label="Choose files to watermark"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT}
                  multiple
                  onChange={handleFileInput}
                  className="sr-only"
                  aria-hidden
                />
                <IconUpload className="w-6 h-6 md:w-7 md:h-7 mx-auto text-slate-400 mb-1.5" />
                <span className="text-sm font-semibold text-slate-600">Browse files</span>
                {files.length > 0 && (
                  <p className="text-xs text-slate-600 mt-2 font-medium" onClick={(e) => e.stopPropagation()}>
                    {files.length} file{files.length !== 1 ? 's' : ''} selected
                    <button type="button" onClick={(e) => { e.stopPropagation(); setFiles([]) }} className="ml-2 text-fuchsia-600 hover:text-fuchsia-700 font-semibold underline-offset-2 hover:underline">Clear</button>
                  </p>
                )}
              </div>
              <p className="mt-3 text-xs font-medium text-slate-600 text-center">
                Upload up to 20 files per run<br />
                Max 4.5 MB per file • 25 MB total per run
              </p>
              <p className="mt-1 text-[11px] text-slate-500 text-center">
                Accepted formats: PDF, JPG, JPEG, PNG, WebP.
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 text-center">
                Files exceeding limits won't upload — nothing is saved.
              </p>
            </StepTile>
            <StepConnector isLast={false} />

            <StepTile step={4} title="Get Files" accent={STEP_ACCENTS[3]}>
              <div className="flex flex-col justify-center flex-1 gap-3">
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">How do you want your files?</span>
                  <div className="flex flex-col gap-2">
                    <div
                      role="group"
                      aria-label="How do you want your files?"
                      className="inline-flex w-full rounded-full bg-violet-200/90 p-1 gap-0.5 shadow-inner"
                    >
                      <button
                        type="button"
                        onClick={() => setEmailMeFiles(false)}
                        className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                          !emailMeFiles
                            ? 'bg-violet-600 text-white shadow-md'
                            : 'text-slate-600 hover:text-slate-800'
                        }`}
                        aria-pressed={!emailMeFiles}
                        aria-label="Download now"
                      >
                        Download now
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmailMeFiles(true)}
                        className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                          emailMeFiles
                            ? 'bg-violet-600 text-white shadow-md'
                            : 'text-slate-600 hover:text-slate-800'
                        }`}
                        aria-pressed={emailMeFiles}
                        aria-label="Email me files"
                      >
                        Email me files
                      </button>
                    </div>
                  </div>
                </div>
                {(!canSubmit || disabledHint) && (
                  <p className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" role="alert">
                    {disabledHint || (files.length === 0
                      ? 'Select at least one file in step 3 to enable.'
                      : mode === 'text'
                        ? 'Enter watermark text in step 1 to enable.'
                        : 'Upload a logo in step 1 to enable.')}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit || disabled}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold text-sm hover:from-violet-600 hover:to-fuchsia-600 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-violet-500 disabled:hover:to-fuchsia-500 shadow-lg shadow-violet-500/25 flex items-center justify-center gap-2 transition-all duration-200"
                >
                  <IconDownload className="w-4 h-4" />
                  Watermark Files
                </button>
              </div>
            </StepTile>
          </div>
        </div>
      </div>
    </section>

    {assetPickerOpen && logoAssets.length >= 2 && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        onClick={() => setAssetPickerOpen(false)}
        role="dialog"
        aria-modal="true"
        aria-label="Select logo from your assets"
      >
        <div
          className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Select from your assets</h3>
            <button
              type="button"
              onClick={() => setAssetPickerOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <ul className="p-4 overflow-y-auto flex-1 space-y-3">
            {logoAssets.map((asset) => (
              <li key={asset.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                <img
                  src={apiUrl(`/api/defaults/logo?email=${encodeURIComponent(logoEmail!)}&path=${encodeURIComponent(asset.storage_path)}`)}
                  alt=""
                  className="w-14 h-14 rounded-lg object-contain border border-slate-200 bg-white"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-slate-600">{asset.is_default ? 'Default' : 'Asset'}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    disabled={!!assetPickerLoading}
                    onClick={() => handleUseAssetForRun(asset.storage_path)}
                    className="text-xs font-semibold text-violet-600 hover:text-violet-700 disabled:opacity-50"
                  >
                    {assetPickerLoading === asset.storage_path ? '…' : 'Use for this run'}
                  </button>
                  {!asset.is_default && (
                    <button
                      type="button"
                      disabled={!!assetPickerLoading}
                      onClick={() => handleSetAssetAsDefault(asset.storage_path)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-800 disabled:opacity-50"
                    >
                      {assetPickerLoading === asset.storage_path ? '…' : 'Set as default'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )}

    {referralPanelOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        onClick={() => setReferralPanelOpen(false)}
        role="dialog"
        aria-modal="true"
        aria-label="Refer & get free months"
      >
        <div
          className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900">Refer &amp; get free months</h3>
            <button
              type="button"
              onClick={() => setReferralPanelOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Share your link. Every 2 sign-ups = 1 month free for you. No limit.
          </p>
          {referralLoading ? (
            <p className="text-sm text-slate-500">Loading your link…</p>
          ) : referralUrl ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={referralUrl}
                  className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 font-medium"
                  aria-label="Your referral link"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(referralUrl).then(() => setReferralCopied(true))
                    setTimeout(() => setReferralCopied(false), 2000)
                  }}
                  className="shrink-0 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
                >
                  {referralCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Use the app with your email or save defaults first to get your unique referral link.
            </p>
          )}
        </div>
      </div>
    )}
    </>
  )
}
