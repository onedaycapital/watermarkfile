import { AttractiveHeader } from '../components/attractive/AttractiveHeader'
import { AttractiveHero } from '../components/attractive/AttractiveHero'
import { AttractiveToolCard } from '../components/attractive/AttractiveToolCard'
import { IconCheck } from '../components/attractive/Icons'

const USED_BY = ['Bankers', 'Brokers', 'Lenders', 'Lawyers', 'Influencers', 'Professional Photographers']
import { AttractiveProgressPipeline } from '../components/attractive/AttractiveProgressPipeline'
import { AttractiveResultsPanel } from '../components/attractive/AttractiveResultsPanel'
import { Footer } from '../components/Footer'
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
  onWatermarkRequest: (files: File[], options: WatermarkOptions) => void
  onEmailToggleClick: () => void
  onMagicLinkEmailSent?: (email: string) => void
  onConfirmBlockEmailChange?: (email: string) => void
  onSaveDefaults: (checked: boolean) => void
  onStartOver: () => void
  onLoadDefaultsClick: () => void
  loadedDefaults: StoredDefaults | null
  onDefaultsApplied: () => void
  userEmail?: string | null
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
  onSaveDefaults,
  onStartOver,
  onLoadDefaultsClick,
  loadedDefaults,
  onDefaultsApplied,
  userEmail,
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
                onWatermarkRequest={onWatermarkRequest}
                disabled={pipelineState === 'uploading' || pipelineState === 'processing'}
                loadedDefaults={loadedDefaults}
                onDefaultsApplied={onDefaultsApplied}
                onLoadDefaultsClick={onLoadDefaultsClick}
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
                onSaveDefaults={onSaveDefaults}
                onStartOver={onStartOver}
                initialEmail={userEmail ?? undefined}
              />
            </div>
          )}
          <p className="text-center text-sm text-slate-400 mt-12 px-4 max-w-xl mx-auto leading-relaxed">
            Email files to{' '}
            <a href="mailto:submit@watermarkfile.com" className="text-slate-300 hover:text-white font-medium underline underline-offset-2 transition-colors duration-200">
              submit@watermarkfile.com
            </a>
            {' '}for instant watermark and inbox back to your email. No need to visit the site after you set your default watermark and preferences.
          </p>
        </main>
        <Footer />
      </div>
    </div>
  )
}
