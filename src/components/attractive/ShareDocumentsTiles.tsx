const TILES = [
  { title: 'Funders and Brokers', description: 'Protect your deal flow before sending files.' },
  { title: 'Real Estate Agents', description: 'Pre-approval letters, Offer Packet.' },
  { title: 'Loan Professionals', description: 'A deal protection tool.' },
  { title: 'Accountants', description: 'Share drafts safely.' },
  { title: 'Lawyers', description: 'Confidential by default.' },
  { title: 'Real Estate', description: 'Mark files before sending to buyers or lenders.' },
  { title: 'Students & Researchers', description: 'Watermark thesis drafts.' },
  { title: 'Content Creators', description: 'Pitch decks, Proposal drafts.' },
  { title: 'Corporate Sales Teams', description: 'Proposals, Pricing decks.' },
  { title: 'HR / Recruiters', description: 'Offer letters, Background check packets.' },
]

function Tile({ title, description }: { title: string; description: string }) {
  return (
    <div className="w-64 shrink-0 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm px-5 py-6 text-center">
      <h3 className="text-base font-bold text-white">{title}</h3>
      <p className="text-sm text-white/75 mt-2 leading-relaxed">{description}</p>
    </div>
  )
}

export function ShareDocumentsTiles() {
  return (
    <section className="w-full max-w-full py-12 md:py-16 overflow-hidden min-w-0" aria-labelledby="share-docs-heading">
      <div className="text-center mb-8 px-4">
        <h2 id="share-docs-heading" className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          Share Documents. Keep Control.
        </h2>
        <p className="text-white/85 mt-2 text-lg font-medium">
          Watermark Before You Send.
        </p>
      </div>
      <div className="relative overflow-hidden min-w-0">
        <div
          className="flex gap-4 will-change-transform"
          style={{
            animation: 'marquee 40s linear infinite',
          }}
        >
          {[...TILES, ...TILES].map((tile, i) => (
            <Tile key={`${tile.title}-${i}`} title={tile.title} description={tile.description} />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  )
}
