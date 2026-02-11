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

export function ShareDocumentsTiles() {
  return (
    <section className="w-full py-12 md:py-16" aria-labelledby="share-docs-heading">
      <div className="text-center mb-8 px-4">
        <h2 id="share-docs-heading" className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          Share Documents. Keep Control.
        </h2>
        <p className="text-white/85 mt-2 text-lg font-medium">
          Watermark Before You Send.
        </p>
      </div>
      <div className="overflow-x-auto overflow-y-hidden scroll-smooth [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20">
        <div className="flex gap-4 px-4 pb-4 min-w-max">
          {TILES.map((tile) => (
            <div
              key={tile.title}
              className="w-64 shrink-0 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm px-5 py-6 text-center"
            >
              <h3 className="text-base font-bold text-white">{tile.title}</h3>
              <p className="text-sm text-white/75 mt-2 leading-relaxed">{tile.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
