import Link from "next/link";

export default function Home() {
  return (
    <main style={{ background: '#FFFFFF', minHeight: '100vh', color: '#202124' }}>
      {/* ── Nav ──────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 h-14 flex items-center justify-between"
        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #E8EAED', boxShadow: '0 1px 3px rgba(60,64,67,0.10)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, #1A73E8, #34A853)' }}>AI</div>
          <span className="font-semibold text-sm" style={{ color: '#202124' }}>AI.CoFounder</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="#features" className="text-sm font-medium transition-colors text-[#5F6368] hover:text-[#202124]">
            Funzionalità
          </Link>
          <Link href="/login"
            className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-all"
            style={{ background: '#1A73E8', boxShadow: '0 1px 2px rgba(26,115,232,0.3)' }}>
            Accedi
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="pt-32 pb-24 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
            style={{ background: '#E8F0FE', color: '#1A73E8', border: '1px solid #C5D9F9' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#34A853' }} />
            Demo live disponibile
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6" style={{ color: '#202124', letterSpacing: '-0.03em' }}>
            Il tuo team AI per<br />
            <span style={{ color: '#1A73E8' }}>costruire startup</span>
          </h1>
          <p className="text-xl leading-relaxed max-w-2xl mx-auto mb-10" style={{ color: '#5F6368' }}>
            Agenti AI specializzati che imparano da migliaia di startup per aiutarti a costruire, crescere e raccogliere fondi. Come avere un team di esperti disponibili 24/7.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login"
              className="px-8 py-3.5 rounded-xl font-semibold text-white text-sm transition-all"
              style={{ background: '#1A73E8', boxShadow: '0 2px 6px rgba(26,115,232,0.4)' }}>
              Prova gratis — Demo Mode
            </Link>
            <Link href="#features"
              className="px-8 py-3.5 rounded-xl font-semibold text-sm transition-all"
              style={{ color: '#202124', background: '#FFFFFF', border: '1px solid #DADCE0' }}>
              Scopri di più
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section id="features" className="py-20 px-6" style={{ background: '#F8F9FA' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3" style={{ color: '#202124' }}>Un esperto AI per ogni funzione</h2>
            <p className="text-base" style={{ color: '#5F6368' }}>Sei agenti specializzati che collaborano con memoria condivisa</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { title: "Strategy Agent", desc: "Analizza mercati, competitor e opportunità. Suggerisce la strategia di crescita ottimale.", color: '#1A73E8', bg: '#E8F0FE' },
              { title: "Tech Agent", desc: "Scrive codice, configura infrastrutture, fa code review. Il tuo AI CTO.", color: '#34A853', bg: '#E6F4EA' },
              { title: "Finance Agent", desc: "Cash flow, proiezioni finanziarie, preparazione fundraising.", color: '#F9AB00', bg: '#FEF7E0' },
              { title: "Marketing Agent", desc: "Crea campagne, contenuti, copy e strategie di acquisizione.", color: '#EA4335', bg: '#FCE8E6' },
              { title: "Legal Agent", desc: "Termini di servizio, NDA, contratti, compliance. Basi legali solide.", color: '#9334E6', bg: '#F3E8FF' },
              { title: "Operations Agent", desc: "Automatizza workflow, gestione team, project management.", color: '#17A2B8', bg: '#E0F7FA' },
            ].map(f => (
              <div key={f.title} className="p-5 rounded-xl transition-all bg-white border border-[#E8EAED] hover:border-[#DADCE0] shadow-[0_1px_2px_rgba(60,64,67,0.10)] hover:shadow-[0_2px_8px_rgba(60,64,67,0.15)]">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: f.bg }}>
                  <div className="w-4 h-4 rounded-full" style={{ background: f.color }} />
                </div>
                <h3 className="font-semibold text-sm mb-1.5" style={{ color: '#202124' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#5F6368' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Memory highlight ─────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="chip chip-blue mb-4">Mnemosyne</div>
            <h2 className="text-3xl font-bold mb-4" style={{ color: '#202124' }}>Memoria a lungo termine che impara</h2>
            <p className="text-base leading-relaxed mb-6" style={{ color: '#5F6368' }}>
              Ogni conversazione alimenta la memoria della piattaforma. Gli agenti ricordano decisioni prese, fatti chiave, preferenze e contesto — senza che tu debba ripetere nulla.
            </p>
            <div className="space-y-3">
              {[
                { label: 'Pattern da YC, Sequoia, First Round Capital', color: '#1A73E8' },
                { label: 'Ricordi persistenti per ogni agente', color: '#34A853' },
                { label: 'Ricerca semantica su tutta la knowledge base', color: '#F9AB00' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                  <span className="text-sm" style={{ color: '#3C4043' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl p-6 space-y-3" style={{ background: '#F8F9FA', border: '1px solid #E8EAED' }}>
            {[
              { category: 'Business', content: 'La startup punta al mercato B2B SaaS verticale nel settore HR', color: '#1A73E8', bg: '#E8F0FE' },
              { category: 'Decisioni', content: 'Priorità al canale sales-led per il prossimo trimestre', color: '#F9AB00', bg: '#FEF7E0' },
              { category: 'Tech', content: 'Stack: Next.js + Supabase + OpenRouter per l\'AI layer', color: '#34A853', bg: '#E6F4EA' },
            ].map(item => (
              <div key={item.category} className="p-3.5 rounded-xl" style={{ background: '#FFFFFF', border: '1px solid #E8EAED' }}>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: item.bg, color: item.color }}>
                  {item.category}
                </span>
                <p className="text-sm mt-2" style={{ color: '#3C4043' }}>{item.content}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="py-20 px-6" style={{ background: '#F8F9FA' }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4" style={{ color: '#202124' }}>Inizia subito — è gratis</h2>
          <p className="text-base mb-8" style={{ color: '#5F6368' }}>
            Unisciti a centinaia di founder che usano AI.CoFounder per accelerare la loro crescita.
          </p>
          <Link href="/login"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-white text-sm transition-all"
            style={{ background: '#1A73E8', boxShadow: '0 2px 6px rgba(26,115,232,0.4)' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
            Accedi al workspace Demo
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="py-8 px-6 text-center" style={{ borderTop: '1px solid #E8EAED' }}>
        <p className="text-sm" style={{ color: '#9AA0AC' }}>
          AI.CoFounder © 2025 · Costruito per i founder che vogliono muoversi veloci
        </p>
      </footer>
    </main>
  );
}
