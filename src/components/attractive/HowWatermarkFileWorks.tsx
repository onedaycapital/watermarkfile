/** "How WatermarkFile Works" 3-step section with icons */

function IconStep1({ className = 'w-16 h-16' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* Document stack */}
      <rect x="12" y="8" width="28" height="36" rx="2" fill="#94a3b8" fillOpacity="0.4" />
      <rect x="16" y="12" width="28" height="36" rx="2" fill="#94a3b8" fillOpacity="0.5" />
      <rect x="20" y="16" width="28" height="36" rx="2" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" />
      {/* Watermark drop on top doc */}
      <path
        d="M34 32c0-2.2-2-4-4-4s-4 1.8-4 4c0 2.5 2 5 4 7s4-4.5 4-7z"
        fill="#8b5cf6"
        fillOpacity="0.9"
      />
      {/* Placement lines */}
      <rect x="24" y="44" width="20" height="2" rx="1" fill="#a78bfa" fillOpacity="0.6" />
    </svg>
  )
}

function IconStep2({ className = 'w-16 h-16' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* Cloud */}
      <path
        d="M48 38c2.2 0 4-1.8 4-4 0-2.2-1.8-4-4-4h-2.4c-.4-3.4-3.2-6-6.6-6-2.8 0-5.2 1.8-6.2 4.2-.2-.2-.4-.2-.6-.2-3.8 0-6.8 3-6.8 6.8s3 6.8 6.8 6.8H48z"
        fill="#a5b4fc"
      />
      {/* Arrow up */}
      <path
        d="M32 22v18m0-18l-6 6m6-6l6 6"
        stroke="#f97316"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Envelope */}
      <rect x="36" y="42" width="20" height="14" rx="2" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
      <path d="M36 46l10 6 10-6" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function IconStep3({ className = 'w-16 h-16' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* Cloud */}
      <path
        d="M48 38c2.2 0 4-1.8 4-4 0-2.2-1.8-4-4-4h-2.4c-.4-3.4-3.2-6-6.6-6-2.8 0-5.2 1.8-6.2 4.2-.2-.2-.4-.2-.6-.2-3.8 0-6.8 3-6.8 6.8s3 6.8 6.8 6.8H48z"
        fill="#a5b4fc"
      />
      {/* Arrow down */}
      <path
        d="M32 46V28m0 18l6-6m-6 6l-6-6"
        stroke="#f97316"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Signal lines */}
      <path d="M26 20c0-3.3 2.7-6 6-6" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.6" />
      <path d="M32 14c0-5.5 4.5-10 10-10" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.4" />
      <path d="M38 20c0-3.3-2.7-6-6-6" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.6" />
    </svg>
  )
}

const STEPS = [
  {
    icon: IconStep1,
    title: '1. Set Your Watermark',
    description: 'Choose a logo or text, select placement, and save your settings. You only need to do this once.',
    trustLine: 'Your settings can be reused anytime.',
  },
  {
    icon: IconStep2,
    title: '2. Upload or Email Files',
    description:
      'Upload files directly for instant downloads — or email documents to submit@doc.watermarkfile.com and get them watermarked automatically.',
    trustLine: 'Both options use your saved watermark.',
  },
  {
    icon: IconStep3,
    title: '3. Get Files Back Instantly',
    description:
      'Download your watermarked files immediately or receive them back in your inbox — ready to share.',
    trustLine: 'Files are processed securely and never stored.',
  },
]

export function HowWatermarkFileWorks() {
  return (
    <section className="w-full max-w-5xl mx-auto px-4 py-12 md:py-16" aria-labelledby="how-it-works-title">
      <div className="text-center mb-10 md:mb-12">
        <h2 id="how-it-works-title" className="inline-flex items-center gap-2 text-2xl md:text-3xl font-bold text-white">
          <span aria-hidden className="text-white/90">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
          </span>
          How WatermarkFile Works
        </h2>
        <p className="text-white/80 text-sm md:text-base mt-2">Set your watermark once. Use it anytime — by upload or email.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
        {STEPS.map(({ icon: Icon, title, description, trustLine }) => (
          <div key={title} className="flex flex-col items-center text-center">
            <div className="flex justify-center mb-4">
              <Icon className="w-16 h-16 md:w-20 md:h-20" />
            </div>
            <h3 className="text-lg md:text-xl font-bold text-white">{title}</h3>
            <p className="text-sm text-white/80 mt-2 leading-relaxed">{description}</p>
            <p className="text-xs text-white/60 mt-2 font-medium">{trustLine}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
