import { useState, useEffect, useCallback } from 'react'
import { AttractiveView } from './views/AttractiveView'
import { EmailCaptureModal } from './components/EmailCaptureModal'
import { EmailPromptModal } from './components/EmailPromptModal'
import type { PipelineState, ProcessedFile, WatermarkOptions } from './types'
import type { StoredDefaults } from './lib/defaults'
import { triggerDownload } from './lib/download'
import { apiUrl } from './lib/api'

export type PipelineStatus = 'idle' | 'uploading' | 'processing' | 'ready' | 'error'

const EMAIL_STORAGE_KEY = 'watermarkfile_email'

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
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [lastUsedOptions, setLastUsedOptions] = useState<Pick<WatermarkOptions, 'mode' | 'text' | 'template' | 'scope'> | null>(null)
  const [loadedDefaults, setLoadedDefaults] = useState<StoredDefaults | null>(null)
  const [showLoadDefaultsModal, setShowLoadDefaultsModal] = useState(false)
  const [showSaveDefaultsModal, setShowSaveDefaultsModal] = useState(false)
  const [loadDefaultsLoading, setLoadDefaultsLoading] = useState(false)
  const [saveDefaultsLoading, setSaveDefaultsLoading] = useState(false)

  // Auto-load defaults for returning users (email stored from previous session)
  useEffect(() => {
    const storedEmail = localStorage.getItem(EMAIL_STORAGE_KEY)
    if (!storedEmail?.trim()) return
    fetch(apiUrl(`/api/defaults?email=${encodeURIComponent(storedEmail.trim().toLowerCase())}`))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.mode && data?.template && data?.scope) {
          setLoadedDefaults({
            mode: data.mode,
            text: data.text,
            template: data.template,
            scope: data.scope,
          })
        }
      })
      .catch(() => {})
  }, [])

  const onWatermarkRequest = async (files: File[], options: WatermarkOptions) => {
    setPipelineState('uploading')
    setPipelineProgress({
      phase: 'uploading',
      currentStep: 1,
      totalFiles: files.length,
      processedCount: 0,
      fileErrors: [],
    })

    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    form.append('mode', options.mode)
    form.append('text', options.text ?? '')
    form.append('template', options.template)
    form.append('scope', options.scope)
    if (options.mode === 'logo' && options.logoFile) {
      form.append('logo', options.logoFile)
    }

    setPipelineState('processing')
    setPipelineProgress((p) => ({ ...p, phase: 'processing', currentStep: 2 }))

    try {
      const res = await fetch(apiUrl('/api/watermark'), {
        method: 'POST',
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || res.statusText || 'Request failed')
      }
      const fileList = Array.isArray(data.files) ? data.files : []
      setPipelineState('ready')
      setPipelineProgress((p) => ({
        ...p,
        phase: 'ready',
        currentStep: 3,
        processedCount: fileList.length,
      }))
      const mappedResults = fileList.map((f: ProcessedFile & { downloadUrl?: string }) => {
        const status = String(f.status || '').toLowerCase() === 'success' ? 'success' : 'error'
        return {
          id: f.id,
          name: f.name ?? '',
          status,
          downloadUrl: status === 'success' && f.downloadUrl ? apiUrl(f.downloadUrl) : undefined,
          errorMessage: f.errorMessage,
        }
      })
      setResults(mappedResults)
      setLastUsedOptions({ mode: options.mode, text: options.text, template: options.template, scope: options.scope })

      // Auto-download each successful file (stagger slightly so the browser doesn't block multiple)
      mappedResults.forEach((f, i) => {
        if (f.status === 'success' && f.downloadUrl) {
          setTimeout(() => triggerDownload(f.downloadUrl!, f.name), i * 400)
        }
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Processing failed'
      setPipelineState('error')
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
    }
  }

  const onEmailToggleClick = () => {
    if (!emailSaved) {
      setShowEmailModal(true)
    } else {
      setEmailDeliveryToggled((v) => !v)
    }
  }

  const onEmailSaved = (email: string) => {
    const normalized = email.trim().toLowerCase()
    setUserEmail(normalized)
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

  async function saveDefaultsToApi(email: string, defaults: Pick<WatermarkOptions, 'mode' | 'text' | 'template' | 'scope'>) {
    const normalized = email.trim().toLowerCase()
    await fetch(apiUrl('/api/defaults'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalized, defaults }),
    })
    try {
      localStorage.setItem(EMAIL_STORAGE_KEY, normalized)
    } catch {
      // ignore
    }
  }

  const onSkipEmail = () => {
    setShowEmailModal(false)
  }

  const onStartOver = () => {
    setResults([])
    setPipelineState('idle')
    setPipelineProgress({
      phase: 'idle',
      currentStep: 0,
      totalFiles: 0,
      processedCount: 0,
      fileErrors: [],
    })
  }

  const onSaveDefaults = (checked: boolean) => {
    if (!checked) {
      setShowSaveDefaultsModal(false)
      return
    }
    if (userEmail && lastUsedOptions) {
      setSaveDefaultsLoading(true)
      saveDefaultsToApi(userEmail, lastUsedOptions)
        .then(() => setShowSaveDefaultsModal(false))
        .finally(() => setSaveDefaultsLoading(false))
      return
    }
    setShowSaveDefaultsModal(true)
  }

  const onSaveDefaultsModalSubmit = async (email: string) => {
    if (!lastUsedOptions) return
    setSaveDefaultsLoading(true)
    try {
      const normalized = email.trim().toLowerCase()
      await saveDefaultsToApi(normalized, lastUsedOptions)
      setUserEmail(normalized)
      setShowSaveDefaultsModal(false)
    } finally {
      setSaveDefaultsLoading(false)
    }
  }

  const onLoadDefaultsClick = () => {
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
      })
      setShowLoadDefaultsModal(false)
    } catch (err) {
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
        emailSaved={emailSaved}
        emailDeliveryToggled={emailDeliveryToggled}
        onWatermarkRequest={onWatermarkRequest}
        onEmailToggleClick={onEmailToggleClick}
        onSaveDefaults={onSaveDefaults}
        onStartOver={onStartOver}
        onLoadDefaultsClick={onLoadDefaultsClick}
        loadedDefaults={loadedDefaults}
        onDefaultsApplied={onDefaultsApplied}
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
        onClose={() => setShowSaveDefaultsModal(false)}
        title="Enter your email to save these settings as default"
        submitLabel="Save"
        onSubmit={onSaveDefaultsModalSubmit}
        loading={saveDefaultsLoading}
      />
    </>
  )
}

export default App
