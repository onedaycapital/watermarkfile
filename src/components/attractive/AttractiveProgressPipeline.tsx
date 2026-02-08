import type { PipelineState } from '../../types'
import { IconCheck, IconChevronRight } from './Icons'

const STEPS = [
  { key: 'intake', label: 'Upload' },
  { key: 'processing', label: 'Process' },
  { key: 'ready', label: 'Done' },
]

type Status = 'idle' | 'uploading' | 'processing' | 'ready' | 'error'

interface AttractiveProgressPipelineProps {
  status: Status
  state: PipelineState
  className?: string
}

export function AttractiveProgressPipeline({ status, state, className = '' }: AttractiveProgressPipelineProps) {
  const activeIndex = status === 'uploading' ? 0 : status === 'processing' ? 1 : status === 'ready' ? 2 : 0
  const allDone = status === 'ready'

  return (
    <div className={`rounded-2xl border border-slate-200/90 bg-white shadow-card-accent px-5 py-4 flex flex-wrap items-center justify-between gap-4 ${className}`}>
      <div className="flex items-center gap-3 flex-wrap">
        {STEPS.map((step, i) => {
          const isDone = allDone || activeIndex > i
          const isCurrent = activeIndex === i && !allDone
          return (
            <div key={step.key} className="flex items-center gap-2">
              <div
                className={`
                  w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-200
                  ${isDone ? 'bg-emerald-500 text-white shadow-sm' : ''}
                  ${isCurrent ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white ring-2 ring-violet-200 shadow-md' : ''}
                  ${!isDone && !isCurrent ? 'bg-slate-100 text-slate-400' : ''}
                `}
              >
                {isDone ? <IconCheck className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-sm font-semibold ${isCurrent ? 'text-slate-800' : isDone ? 'text-slate-600' : 'text-slate-400'}`}>
                {step.label}
              </span>
              {i < STEPS.length - 1 && (
                <IconChevronRight className="w-4 h-4 text-slate-300 hidden sm:block mx-0.5" />
              )}
            </div>
          )
        })}
      </div>
      {(status === 'processing' || status === 'ready') && state.totalFiles > 0 && (
        <span className="text-sm font-medium text-slate-600">{state.processedCount}/{state.totalFiles}</span>
      )}
    </div>
  )
}
