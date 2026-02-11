import { useState, useEffect, useMemo } from 'react'
import { AttractiveHeader } from '../components/attractive/AttractiveHeader'
import { AttractiveHero } from '../components/attractive/AttractiveHero'
import { AttractiveToolCard } from '../components/attractive/AttractiveToolCard'
import { IconCheck } from '../components/attractive/Icons'

const USED_BY = ['Bankers', 'Brokers', 'Lenders', 'Lawyers', 'Influencers', 'Professional Photographers']

// Base date for live counters: on this day we show BASE_DOCS and BASE_CUSTOMERS; each day after +25 docs, +2 customers
const STATS_BASE_DATE = new Date('2025-02-10T00:00:00Z')
const BASE_DOCS = 56040
const BASE_CUSTOMERS = 1983
const DOCS_PER_DAY = 25
const CUSTOMERS_PER_DAY = 2

function getLiveStats() {
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const baseDay = new Date(Date.UTC(STATS_BASE_DATE.getUTCFullYear(), STATS_BASE_DATE.getUTCMonth(), STATS_BASE_DATE.getUTCDate()))
  const daysSince = Math.max(0, Math.floor((today.getTime() - baseDay.getTime()) / 86400000))
  return {
    documents: BASE_DOCS + daysSince * DOCS_PER_DAY,
    customers: BASE_CUSTOMERS + daysSince * CUSTOMERS_PER_DAY,
  }
}

function useAnimatedValue(target: number, durationMs: number) {
  const [display, setDisplay] = useState('0')
  useEffect(() => {
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const t = Math.min(1, elapsed / durationMs)
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      const current = Math.round(target * eased)
      setDisplay(current.toLocaleString())
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target])
  return display
}

function LiveStatsSection() {
  const { documents: targetDocs, customers: targetCustomers } = useMemo(getLiveStats, [])
  const durationMs = 2200
  const displayDocs = useAnimatedValue(targetDocs, durationMs)
  const displayCustomers = useAnimatedValue(targetCustomers, durationMs)

  const stats = [
    { value: displayDocs, label: 'Documents Watermarked' },
    { value: displayCustomers, label: 'Customers Serviced' },
    { value: '8', label: 'Industries' },
    { value: '0', label: 'Files Saved on Server' },
    { value: '99%', label: 'Uptime' },
  ]

  return (
    <section className="w-full max-w-4xl mx-auto px-4 py-8" aria-label="Stats">
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
        <div className="flex flex-wrap justify-center items-stretch divide-x divide-slate-500/40">
          {stats.map((stat) => (
            <div key={stat.label} className="flex-1 min-w-[140px] px-4 py-6 text-center">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tabular-nums">
                {stat.value}
              </div>
              <div className="text-xs sm:text-sm text-white/75 mt-1 font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
import { AttractiveProgressPipeline } from '../components/attractive/AttractiveProgressPipeline'
import { AttractiveResultsPanel } from '../components/attractive/AttractiveResultsPanel'
import { Footer } from '../components/Footer'
import { ShareDocumentsTiles } from '../components/attractive/ShareDocumentsTiles'
import type { PipelineState, ProcessedFile, WatermarkOptions } from '../types'
import type { StoredDefaults } from '../lib/defaults'
export type PipelineStatus = 'idle' | 'uploading' | 'processing' | 'ready' | 'error'

export interface AttractiveViewProps {
  pipelineState: PipelineStatus
  pipelineProgress: PipelineState
  results: ProcessedFile[]
  isVerified?: boolean
  emailSaved: boolean
  emailDeliveryToggled: boolean
  onWatermarkRequest: (files: File[], options: WatermarkOptions, extras?: { emailMeFiles: boolean }) => void
  onEmailToggleClick: () => void
  onMagicLinkEmailSent?: (email: string) => void
  onConfirmBlockEmailChange?: (email: string) => void
  onRequestSaveDefaults: (defaults: Pick<WatermarkOptions, 'mode' | 'text' | 'template' | 'scope'>, logoFile?: File) => void
  onRefetchDefaults?: (email: string) => void
  onStartOver: () => void
  onLoadDefaultsClick?: () => void
  loadedDefaults: StoredDefaults | null
  userEmail?: string | null
  emailMeFilesChosen?: boolean
  resultsEmailSent?: boolean
}

export function AttractiveView({
  pipelineState,
  pipelineProgress,
  results,
  isVerified,
  emailSaved,
  emailDeliveryToggled,
  onWatermarkRequest,
  onEmailToggleClick,
  onMagicLinkEmailSent,
  onConfirmBlockEmailChange,
  onRequestSaveDefaults,
  onRefetchDefaults,
  onStartOver,
  onLoadDefaultsClick,
  loadedDefaults,
  userEmail,
  emailMeFilesChosen: _emailMeFilesChosen = false,
  resultsEmailSent = false,
}: AttractiveViewProps) {
  const showResults = results.length > 0 && pipelineState === 'ready'
  const showProgress = pipelineState === 'uploading' || pipelineState === 'processing' || pipelineState === 'ready'

  return (
    <div
      className="min-h-screen flex flex-col text-white font-sans antialiased"
      style={{
        background: 'linear-gradient(165deg, #0f172a 0%, #1e1b4b 35%, #312e81 60%, #1e293b 100%)',
      }}
    >
      {/* Soft gradient orbs for depth */}
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        aria-hidden
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -15%, rgba(99, 102, 241, 0.2), transparent 50%), radial-gradient(ellipse 50% 60% at 90% 60%, rgba(139, 92, 246, 0.12), transparent 50%), radial-gradient(ellipse 40% 40% at 10% 80%, rgba(59, 130, 246, 0.08), transparent 50%)',
        }}
      />
      <div className="relative flex-1 flex flex-col overflow-visible">
        <AttractiveHeader />
        <AttractiveHero />
        <main className="flex-1 w-full pb-12 md:pb-16 pt-2">
          {!showResults ? (
            <div id="watermark-tool" className="flex flex-col items-center gap-6 md:gap-8 scroll-mt-8">
              <AttractiveToolCard
                key={loadedDefaults ? `defaults-${loadedDefaults.mode}-${loadedDefaults.template}-${loadedDefaults.scope}` : 'no-defaults'}
                onWatermarkRequest={onWatermarkRequest}
                disabled={pipelineState === 'uploading' || pipelineState === 'processing'}
                loadedDefaults={loadedDefaults}
                onLoadDefaultsClick={onLoadDefaultsClick}
                onRequestSaveDefaults={onRequestSaveDefaults}
                onRefetchDefaults={onRefetchDefaults}
                userEmail={userEmail ?? undefined}
              />
              <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-sm text-white/85">
                <span className="text-white/90 font-medium">Used by</span>
                {USED_BY.map((label) => (
                  <span key={label} className="inline-flex items-center gap-2">
                    <span className="text-teal-400 shrink-0">
                      <IconCheck className="w-4 h-4" />
                    </span>
                    {label}
                  </span>
                ))}
              </div>
              <LiveStatsSection />
              <div className="flex flex-col items-center gap-1.5 mt-4 text-xs text-white/70 text-center max-w-xl mx-auto">
                <p className="inline-flex items-center gap-1.5">
                  <span aria-hidden>🔒</span>
                  Files are processed securely and deleted immediately
                </p>
                <p>No signup • No storage • No tracking</p>
                <p>Encrypted upload · No disk storage · Auto-delete</p>
              </div>
              {showProgress && (
                <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
                  <AttractiveProgressPipeline status={pipelineState} state={pipelineProgress} />
                </div>
              )}
            </div>
          ) : (
            <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
              <AttractiveResultsPanel
                files={results}
                isVerified={isVerified}
                onEmailToggle={onEmailToggleClick}
                emailSaved={emailSaved}
                emailDeliveryOn={emailDeliveryToggled}
                onMagicLinkSent={onMagicLinkEmailSent}
                onConfirmBlockEmailChange={onConfirmBlockEmailChange}
                onStartOver={onStartOver}
                initialEmail={userEmail ?? undefined}
                resultsEmailSent={resultsEmailSent}
              />
            </div>
          )}
          <p className="text-center text-sm text-slate-400 mt-12 px-4 max-w-2xl mx-auto leading-relaxed">
            Set your default watermark once on the site, then email PDFs or images to{' '}
            <a href="mailto:submit@doc.watermarkfile.com" className="text-slate-300 hover:text-white font-medium underline underline-offset-2 transition-colors duration-200">
              submit@doc.watermarkfile.com
            </a>
            {' '}to get watermarked files back in your inbox—no need to visit the site again.
          </p>
        </main>
        <ShareDocumentsTiles />
        <Footer />
      </div>
    </div>
  )
}
