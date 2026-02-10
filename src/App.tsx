import { useState, useEffect, useCallback } from 'react'
import { AttractiveView } from './views/AttractiveView'
import { EmailCaptureModal } from './components/EmailCaptureModal'
import { EmailPromptModal } from './components/EmailPromptModal'
import type { PipelineState, ProcessedFile, WatermarkOptions } from './types'
import type { StoredDefaults } from './lib/defaults'
import { setStoredDefaults } from './lib/defaults'
import { triggerDownload } from './lib/download'
import { apiUrl } from './lib/api'
import {
  track,
  setUserId as setAnalyticsUserId,
  identify as identifyUser,
  addUserProperty,
  AnalyticsEvents,
  getFileExtension,
} from './lib/analytics'
import { getStoredEmail, getIsVerified, setVerified, getMagicTokenFromUrl, clearMagicFromUrl } from './lib/auth'

export type PipelineStatus = 'idle' | 'uploading' | 'processing' | 'ready' | 'error'

const EMAIL_STORAGE_KEY = 'watermarkfile_email'
/** Keep each request under Vercel serverless body limit (~4.5 MB). */
const MAX_REQUEST_BODY_BYTES = 4.5 * 1024 * 1024

function App() {
  const [pipelineState, setPipelineState] = useState<PipelineStatus>('idle')
  const [pipelineProgress, setPipelineProgress] = useState<PipelineState>({
    phase: 'idle',
    currentStep: 0,
    totalFiles: 0,
    processedCount: 0,
    fileErrors: [],
  })
  const [results, setResults] = useState<ProcessedFile[]>([])
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailSaved, setEmailSaved] = useState(false)
  const [emailDeliveryToggled, setEmailDeliveryToggled] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(() => getStoredEmail())
  const [isVerified, setIsVerified] = useState(getIsVerified())
  const [lastUsedOptions, setLastUsedOptions] = useState<Pick<WatermarkOptions, 'mode' | 'text' | 'template' | 'scope'> | null>(null)
  const [loadedDefaults, setLoadedDefaults] = useState<StoredDefaults | null>(null)
  const [showLoadDefaultsModal, setShowLoadDefaultsModal] = useState(false)
  const [showSaveDefaultsModal, setShowSaveDefaultsModal] = useState(false)
  const [loadDefaultsLoading, setLoadDefaultsLoading] = useState(false)
  const [saveDefaultsLoading, setSaveDefaultsLoading] = useState(false)
  /** When user clicks "Save as default" in step 1 or 2, we store the chosen defaults until modal submit. */
  const [pendingSaveDefaults, setPendingSaveDefaults] = useState<Pick<WatermarkOptions, 'mode' | 'text' | 'template' | 'scope'> | null>(null)
  /** Logo file to upload when saving defaults with email (from step 1 "Save as default" with logo). */
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null)
  /** Email typed in the "Confirm email to download" block – use for toggle/save so we don't ask again. */
  const [emailFromConfirmBlock, setEmailFromConfirmBlock] = useState('')
  /** For the current results: did user choose "Email me files" in step 4? (so we send email and don't auto-download) */
  const [lastEmailMeFilesChoice, setLastEmailMeFilesChoice] = useState(false)
  /** After sending results by email, show success message in results panel */
  const [resultsEmailSent, setResultsEmailSent] = useState(false)

  // Handle magic-link callback: verify token, set auth, trigger downloads, show results
  useEffect(() => {
    const token = getMagicTokenFromUrl()
    if (!token) return
    let cancelled = false
    fetch(apiUrl('/api/auth/verify-magic-link'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data?.ok) return
        const email = (data.email || '').toLowerCase()
        setVerified(email)
        setUserEmail(email)
        setIsVerified(true)
        setAnalyticsUserId(email)
        clearMagicFromUrl()
        const items: Array<{ downloadUrl: string; name: string }> = data.pendingDeliveries || []
        if (items.length > 0) {
          setPipelineState('ready')
          setResults(
            items.map((item: { downloadUrl: string; name: string }, i: number) => ({
              id: `magic-${i}`,
              name: item.name,
              status: 'success' as const,
              downloadUrl: apiUrl(item.downloadUrl),
            }))
          )
          items.forEach((item: { downloadUrl: string; name: string }, i: number) => {
            setTimeout(() => triggerDownload(apiUrl(item.downloadUrl), item.name), i * 400)
          })
        }
        // Load defaults for returning user (cookie was set by verify response)
        return fetch(apiUrl(`/api/defaults?email=${encodeURIComponent(email)}`), { credentials: 'include' })
      })
      .then((res) => (res?.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.mode) return
        setLoadedDefaults({
          mode: data.mode,
          text: data.text,
          template: data.template,
          scope: data.scope,
          logo_url: data.logo_url,
        })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // On every load (new tab, refresh): check user in DB and load defaults if active (from stored email or cookie)
  useEffect(() => {
    const storedEmail = getStoredEmail()
    const url = storedEmail
      ? apiUrl(`/api/defaults?email=${encodeURIComponent(storedEmail)}`)
      : apiUrl('/api/defaults')
    fetch(url, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return
        if (data.email) {
          const normalized = data.email.trim().toLowerCase()
          setUserEmail(normalized)
          try {
            localStorage.setItem(EMAIL_STORAGE_KEY, normalized)
          } catch {
            /* ignore */
          }
        }
        if (data.mode && data.template && data.scope) {
          setLoadedDefaults({
            mode: data.mode,
            text: data.text ?? '',
            template: data.template,
            scope: data.scope,
            logo_url: data.logo_url,
          })
        }
      })
      .catch(() => {})
  }, [])

  /** Sequential uploads so each request stays under Vercel's ~4.5 MB serverless body limit. */
  const onWatermarkRequest = async (files: File[], options: WatermarkOptions, extras?: { emailMeFiles?: boolean }) => {
    const emailMeFiles = !!extras?.emailMeFiles
    setLastEmailMeFilesChoice(emailMeFiles)
    setResultsEmailSent(false)
    const logoSize = options.mode === 'logo' && options.logoFile ? options.logoFile.size : 0
    const sizeLimitMsg = `File too large (max ${(MAX_REQUEST_BODY_BYTES / 1024 / 1024).toFixed(1)} MB per file).`

    const fileTypes = files.map((f) => getFileExtension(f.name))
    const totalSizeBytes = files.reduce((sum, f) => sum + f.size, 0)
    track(AnalyticsEvents.WatermarkStarted, {
      file_count: files.length,
      file_types: fileTypes,
      total_size_bytes: totalSizeBytes,
      mode: options.mode,
      template: options.template,
      scope: options.scope,
    })

    setPipelineState('uploading')
    setPipelineProgress({
      phase: 'uploading',
      currentStep: 1,
      totalFiles: files.length,
      processedCount: 0,
      fileErrors: [],
    })

    setPipelineState('processing')
    setPipelineProgress((p) => ({ ...p, phase: 'processing', currentStep: 2 }))

    const mappedResults: ProcessedFile[] = []

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setPipelineProgress((p) => ({ ...p, processedCount: i }))

        if (file.size + logoSize > MAX_REQUEST_BODY_BYTES) {
          track(AnalyticsEvents.FileSkippedSizeLimit, {
            file_name: file.name,
            file_extension: getFileExtension(file.name),
            file_size_bytes: file.size,
          })
          mappedResults.push({
            id: `size-${i}`,
            name: file.name,
            status: 'error',
            errorMessage: sizeLimitMsg,
          })
          continue
        }

        const form = new FormData()
        form.append('files', file)
        form.append('mode', options.mode)
        form.append('text', options.text ?? '')
        form.append('template', options.template)
        form.append('scope', options.scope)
        // Send email whenever we have it (verified, stored, or from confirm block) so backend can record usage in DB
        const emailToSend = (userEmail || emailFromConfirmBlock.trim() || '').trim().toLowerCase() || null
        if (emailToSend) form.append('email', emailToSend)
        if (options.mode === 'logo' && options.logoFile) {
          form.append('logo', options.logoFile)
        }

        const res = await fetch(apiUrl('/api/watermark'), {
          method: 'POST',
          body: form,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          mappedResults.push({
            id: `err-${i}`,
            name: file.name,
            status: 'error',
            errorMessage: data.error || res.statusText || 'Request failed',
          })
          continue
        }
        const fileList = Array.isArray(data.files) ? data.files : []
        const first = fileList[0]
        if (first) {
          const status = String(first.status || '').toLowerCase() === 'success' ? 'success' : 'error'
          mappedResults.push({
            id: first.id,
            name: first.name ?? file.name,
            status,
            downloadUrl: status === 'success' && first.downloadUrl ? apiUrl(first.downloadUrl) : undefined,
            errorMessage: first.errorMessage,
          })
        } else {
          mappedResults.push({
            id: `err-${i}`,
            name: file.name,
            status: 'error',
            errorMessage: 'No result returned',
          })
        }
      }

      setPipelineState('ready')
      setPipelineProgress((p) => ({
        ...p,
        phase: 'ready',
        currentStep: 3,
        processedCount: files.length,
      }))
      setResults(mappedResults)
      setLastUsedOptions({ mode: options.mode, text: options.text, template: options.template, scope: options.scope })

      const successCount = mappedResults.filter((f) => f.status === 'success').length
      const errorCount = mappedResults.filter((f) => f.status === 'error').length
      const resultFileTypes = mappedResults.map((f) => getFileExtension(f.name))
      track(AnalyticsEvents.WatermarkCompleted, {
        file_count: files.length,
        success_count: successCount,
        error_count: errorCount,
        file_types: resultFileTypes,
        mode: options.mode,
        template: options.template,
        scope: options.scope,
      })
      addUserProperty('total_uploads', 1)
      identifyUser({ last_upload_file_types: resultFileTypes })

      if (isVerified && userEmail) {
        if (emailMeFiles) {
          const successItems = mappedResults.filter((f): f is ProcessedFile & { downloadUrl: string } => f.status === 'success' && !!f.downloadUrl)
          if (successItems.length > 0) {
            const items = successItems.map((f) => {
              const token = f.downloadUrl.replace(/^.*\/api\/download\//, '').replace(/\?.*$/, '')
              return { token, name: f.name }
            })
            try {
              const sendRes = await fetch(apiUrl('/api/send-results-email'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: userEmail, items }),
              })
              if (sendRes.ok) setResultsEmailSent(true)
            } catch {
              // leave resultsEmailSent false
            }
          }
        } else {
          mappedResults.forEach((f: ProcessedFile, i: number) => {
            if (f.status === 'success' && f.downloadUrl) {
              setTimeout(() => triggerDownload(f.downloadUrl!, f.name), i * 400)
            }
          })
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Processing failed'
      track(AnalyticsEvents.WatermarkFailed, {
        file_count: files.length,
        error_message: message,
      })
      setPipelineProgress((p) => ({
        ...p,
        phase: 'error',
        fileErrors: [{ fileName: '', message }],
      }))
      setResults(
        files.map((f, i) => ({
          id: `err-${i}`,
          name: f.name,
          status: 'error' as const,
          errorMessage: message,
        }))
      )
      setPipelineState('ready')
    }
  }

  const onEmailToggleClick = () => {
    if (!emailSaved) {
      const useEmail = emailFromConfirmBlock.trim() || undefined
      if (useEmail) {
        setUserEmail(useEmail)
        setEmailSaved(true)
        setEmailDeliveryToggled(true)
        setEmailFromConfirmBlock('')
        try {
          localStorage.setItem(EMAIL_STORAGE_KEY, useEmail)
        } catch {
          // ignore
        }
      } else {
        track(AnalyticsEvents.EmailCaptureOpened)
        setShowEmailModal(true)
      }
    } else {
      setEmailDeliveryToggled((v) => !v)
      track(AnalyticsEvents.EmailToggled, { enabled: !emailDeliveryToggled })
    }
  }

  /** When user sends magic link from results panel, use that email for "Email me files" and "Save as default" so we don't ask again. */
  const onMagicLinkEmailSent = (email: string) => {
    const normalized = email.trim().toLowerCase()
    setUserEmail(normalized)
    setEmailSaved(true)
    setEmailDeliveryToggled(true)
    setAnalyticsUserId(normalized)
    try {
      localStorage.setItem(EMAIL_STORAGE_KEY, normalized)
    } catch {
      // ignore
    }
  }

  const onEmailSaved = (email: string) => {
    const normalized = email.trim().toLowerCase()
    setUserEmail(normalized)
    setAnalyticsUserId(normalized)
    track(AnalyticsEvents.EmailCaptured)
    identifyUser({ email_captured: true })
    try {
      localStorage.setItem(EMAIL_STORAGE_KEY, normalized)
    } catch {
      // ignore
    }
    setEmailSaved(true)
    setShowEmailModal(false)
    setEmailDeliveryToggled(true)
    if (lastUsedOptions) {
      saveDefaultsToApi(normalized, lastUsedOptions).catch(() => {})
    }
  }

  async function saveDefaultsToApi(email: string, defaults: Pick<WatermarkOptions, 'mode' | 'text' | 'template' | 'scope'>): Promise<void> {
    const normalized = email.trim().toLowerCase()
    const res = await fetch(apiUrl('/api/defaults'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalized, defaults }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error((data?.error as string) || res.statusText || 'Failed to save defaults')
    }
    setStoredDefaults({
      mode: defaults.mode,
      text: defaults.text,
      template: defaults.template,
      scope: defaults.scope,
    })
    try {
      localStorage.setItem(EMAIL_STORAGE_KEY, normalized)
    } catch {
      // ignore
    }
  }

  async function uploadDefaultLogo(email: string, logoFile: File): Promise<void> {
    const normalized = email.trim().toLowerCase()
    const form = new FormData()
    form.append('email', normalized)
    form.append('logo', logoFile)
    const res = await fetch(apiUrl('/api/defaults/logo'), { method: 'POST', body: form })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data?.error as string) || res.statusText || 'Failed to save logo')
  }

  const onSkipEmail = () => {
    track(AnalyticsEvents.EmailSkipped)
    setShowEmailModal(false)
  }

  const onStartOver = () => {
    track(AnalyticsEvents.StartOverClicked)
    setResults([])
    setResultsEmailSent(false)
    setPipelineState('idle')
    setPipelineProgress({
      phase: 'idle',
      currentStep: 0,
      totalFiles: 0,
      processedCount: 0,
      fileErrors: [],
    })
  }

  /** Called from step 1 or step 2 when user checks "Save as default". Persist to localStorage immediately; optionally sync to API (and upload logo) if we have email. */
  const onRequestSaveDefaults = (defaults: Pick<WatermarkOptions, 'mode' | 'text' | 'template' | 'scope'>, logoFile?: File) => {
    track(AnalyticsEvents.SaveDefaultsClicked)
    setPendingSaveDefaults(defaults)
    setPendingLogoFile(logoFile ?? null)
    setStoredDefaults({
      mode: defaults.mode,
      text: defaults.text,
      template: defaults.template,
      scope: defaults.scope,
    })
    const emailToUse = (userEmail || emailFromConfirmBlock.trim() || '').toLowerCase() || null
    if (emailToUse) {
      if (!userEmail) {
        setUserEmail(emailToUse)
        setEmailSaved(true)
        setEmailFromConfirmBlock('')
        try {
          localStorage.setItem(EMAIL_STORAGE_KEY, emailToUse)
        } catch {
          // ignore
        }
      }
      setSaveDefaultsLoading(true)
      saveDefaultsToApi(emailToUse, defaults)
        .then(() => (logoFile ? uploadDefaultLogo(emailToUse, logoFile) : undefined))
        .then(() => {
          track(AnalyticsEvents.SaveDefaultsSuccess)
          setPendingSaveDefaults(null)
          setPendingLogoFile(null)
        })
        .catch((err) => {
          alert(err instanceof Error ? err.message : 'Failed to save defaults')
        })
        .finally(() => setSaveDefaultsLoading(false))
      return
    }
    setShowSaveDefaultsModal(true)
  }

  const onSaveDefaultsModalSubmit = async (email: string) => {
    const toSave = pendingSaveDefaults ?? lastUsedOptions
    if (!toSave) return
    setSaveDefaultsLoading(true)
    try {
      const normalized = email.trim().toLowerCase()
      await saveDefaultsToApi(normalized, toSave)
      if (pendingLogoFile) await uploadDefaultLogo(normalized, pendingLogoFile)
      setUserEmail(normalized)
      setAnalyticsUserId(normalized)
      track(AnalyticsEvents.SaveDefaultsSuccess)
      setShowSaveDefaultsModal(false)
      setPendingSaveDefaults(null)
      setPendingLogoFile(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save defaults')
    } finally {
      setSaveDefaultsLoading(false)
    }
  }

  const onLoadDefaultsClick = () => {
    track(AnalyticsEvents.LoadDefaultsClicked)
    setShowLoadDefaultsModal(true)
  }

  const onLoadDefaultsModalSubmit = async (email: string) => {
    setLoadDefaultsLoading(true)
    try {
      const res = await fetch(apiUrl(`/api/defaults?email=${encodeURIComponent(email.trim().toLowerCase())}`))
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No saved settings for this email')
      }
      const data = await res.json()
      setLoadedDefaults({
        mode: data.mode,
        text: data.text,
        template: data.template,
        scope: data.scope,
        logo_url: data.logo_url,
      })
      track(AnalyticsEvents.LoadDefaultsSuccess)
      setShowLoadDefaultsModal(false)
    } catch (err) {
      track(AnalyticsEvents.LoadDefaultsFailed, {
        error_message: err instanceof Error ? err.message : 'Could not load settings',
      })
      alert(err instanceof Error ? err.message : 'Could not load settings')
    } finally {
      setLoadDefaultsLoading(false)
    }
  }

  const onDefaultsApplied = useCallback(() => {
    setLoadedDefaults(null)
  }, [])

  return (
    <>
      <AttractiveView
        pipelineState={pipelineState}
        pipelineProgress={pipelineProgress}
        results={results}
        isVerified={isVerified}
        emailSaved={emailSaved}
        emailDeliveryToggled={emailDeliveryToggled}
        onWatermarkRequest={onWatermarkRequest}
        onEmailToggleClick={onEmailToggleClick}
        onMagicLinkEmailSent={onMagicLinkEmailSent}
        onConfirmBlockEmailChange={setEmailFromConfirmBlock}
        onRequestSaveDefaults={onRequestSaveDefaults}
        onStartOver={onStartOver}
        onLoadDefaultsClick={userEmail ? undefined : onLoadDefaultsClick}
        loadedDefaults={loadedDefaults}
        onDefaultsApplied={onDefaultsApplied}
        userEmail={userEmail}
        emailMeFilesChosen={lastEmailMeFilesChoice}
        resultsEmailSent={resultsEmailSent}
      />

      <EmailCaptureModal
        open={showEmailModal}
        onClose={onSkipEmail}
        onSave={onEmailSaved}
      />

      <EmailPromptModal
        open={showLoadDefaultsModal}
        onClose={() => setShowLoadDefaultsModal(false)}
        title="Load your saved settings"
        submitLabel="Load"
        onSubmit={onLoadDefaultsModalSubmit}
        loading={loadDefaultsLoading}
      />

      <EmailPromptModal
        open={showSaveDefaultsModal}
        onClose={() => { setShowSaveDefaultsModal(false); setPendingSaveDefaults(null); setPendingLogoFile(null) }}
        title="Enter your email to save these settings as default"
        submitLabel="Save"
        onSubmit={onSaveDefaultsModalSubmit}
        loading={saveDefaultsLoading}
      />
    </>
  )
}

export default App
