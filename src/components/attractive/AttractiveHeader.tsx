export function AttractiveHeader() {
  return (
    <header className="shrink-0 w-full px-4 sm:px-6 lg:px-8 py-3.5 md:py-4 border-b border-black/30 bg-black">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        <a
          href="/"
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 rounded shrink-0"
          aria-label="WatermarkFile home"
        >
          <img
            src="/logo-watermarkfile.png"
            alt="WatermarkFile"
            className="h-[4.5rem] md:h-[5rem] w-auto"
          />
        </a>
        <div
          className="shrink-0 inline-flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl border border-white/20 bg-white/5 backdrop-blur-sm shadow-lg shadow-black/10"
          style={{
            boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <span className="text-xs sm:text-sm font-semibold text-white tracking-tight">
            First month free
          </span>
          <span className="hidden sm:inline text-white/50 font-medium" aria-hidden>—</span>
          <span className="text-[11px] sm:text-sm text-white/80 font-medium text-center sm:text-left">
            Unlimited PDF & image watermarks
          </span>
        </div>
      </div>
    </header>
  )
}
