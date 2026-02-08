export function AttractiveHeader() {
  return (
    <header className="shrink-0 w-full px-4 sm:px-6 lg:px-8 py-3.5 md:py-4 border-b border-black/30 bg-black">
      <div className="max-w-5xl mx-auto flex items-center justify-start">
        <a
          href="/"
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 rounded"
          aria-label="WatermarkFile home"
        >
          <img
            src="/logo-watermarkfile.png"
            alt="WatermarkFile"
            className="h-[4.5rem] md:h-[5rem] w-auto"
          />
        </a>
      </div>
    </header>
  )
}
