import { IconCheck } from './Icons'

const DOC_TYPES = [
  'Bank Statements',
  'Legal Documents',
  'Void Checks',
  'Driving License',
  'Passport',
  'PDF',
  'Photos',
  'Contracts',
]

export function AttractiveHero() {
  return (
    <section className="shrink-0 px-4 sm:px-6 lg:px-8 pt-8 pb-6 md:pt-10 md:pb-8 text-center overflow-visible">
      <div className="max-w-6xl mx-auto overflow-visible w-full">
        {/* Hero headline — one line, full phrase visible (wider so "seconds" isn't cut) */}
        <h1
          className="font-display font-bold leading-tight whitespace-nowrap overflow-visible text-[clamp(0.9rem,2.8vw+0.75rem,5.5rem)] md:text-hero-gradient"
          style={{
            background: 'linear-gradient(to right, #60a5fa, #a78bfa, #e879f9)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Add watermarks in seconds
        </h1>

        {/* Subheadline — strong, clear hierarchy */}
        <p className="mt-2 md:mt-3 font-display font-bold text-white text-display-2xl [text-shadow:0_2px_24px_rgba(0,0,0,0.4)] leading-tight">
          Protect your documents.
        </p>

        {/* Promo badge — first month free, product offering clear */}
        <div
          className="mt-4 md:mt-5 inline-flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 px-4 py-2.5 rounded-2xl border border-white/20 bg-white/5 backdrop-blur-sm shadow-lg shadow-black/10"
          style={{
            boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <span className="text-sm font-semibold text-white tracking-tight">
            First month free
          </span>
          <span className="hidden sm:inline text-white/50 font-medium" aria-hidden>—</span>
          <span className="text-xs sm:text-sm text-white/80 font-medium text-center sm:text-left">
            Unlimited PDF & image watermarks
          </span>
        </div>

        {/* Supporting line — readable but clearly secondary */}
        <p className="mt-5 md:mt-6 text-base md:text-lg text-white/90 max-w-xl mx-auto font-medium">
          Add watermarks to PDFs and images. Fast. No hassle.
        </p>

        {/* Document types — clear, not competing with hero */}
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 mt-4 text-sm text-white/85">
          {DOC_TYPES.map((label) => (
            <span key={label} className="inline-flex items-center gap-2">
              <span className="text-teal-400 shrink-0">
                <IconCheck className="w-4 h-4" />
              </span>
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
