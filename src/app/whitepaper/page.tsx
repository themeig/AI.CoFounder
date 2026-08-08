"use client";

import Link from "next/link";
import { useState } from "react";

export default function WhitePaperPage() {
  const [activeSection, setActiveSection] = useState("abstract");

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#05070B] text-[#E2E8F0] font-sans antialiased selection:bg-[#3B82F6] selection:text-white">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-[#3B82F6]/10 via-[#8B5CF6]/5 to-transparent blur-3xl rounded-full" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-[#3B82F6]/5 blur-3xl rounded-full" />
      </div>

      {/* Top Header / Navigation */}
      <header className="sticky top-0 z-50 bg-[#05070B]/80 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-[#3B82F6]/20">
                AI
              </div>
              <span className="font-bold text-slate-100 tracking-tight group-hover:text-white transition">
                AI.CoFounder
              </span>
            </Link>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800/90 text-slate-400 font-mono border border-slate-700/50">
              Technical White Paper v2.4
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition flex items-center gap-1.5"
            >
              <span>🖨️</span>
              <span>Stampa / Salva PDF</span>
            </button>

            <Link
              href="/dashboard/portfolio"
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:opacity-95 text-white transition shadow-md shadow-[#3B82F6]/25 flex items-center gap-1.5"
            >
              <span>🚀 Apri Workspace</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 relative z-10">
        {/* Sidebar Navigation */}
        <aside className="lg:col-span-3 hidden lg:block">
          <div className="sticky top-24 space-y-6">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-2">
                Indice del White Paper
              </h3>
              <nav className="space-y-1 text-xs">
                {[
                  { id: "abstract", label: "1. Abstract & Executive Summary" },
                  { id: "architecture", label: "2. Architettura Multi-Agente Swarm" },
                  { id: "memory", label: "3. Memoria Mnemosyne & Pgvector" },
                  { id: "sandbox", label: "4. Sandbox Code Execution Engine" },
                  { id: "isolation", label: "5. Isolamento Tenant & Compliance" },
                  { id: "benchmarks", label: "6. Modelli di Successo YC & Data" },
                  { id: "conclusion", label: "7. Conclusioni & Roadmap" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center justify-between ${
                      activeSection === item.id
                        ? "bg-[#3B82F6]/15 text-[#60A5FA] font-semibold border-l-2 border-[#3B82F6]"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Quick Metadata Box */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 text-xs space-y-2 text-slate-400">
              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <span>Data Pubblicazione:</span>
                <span className="font-mono text-slate-200">Agosto 2026</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <span>Versione Sistema:</span>
                <span className="font-mono text-slate-200">v2.4 Enterprise</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <span>Modello Base:</span>
                <span className="font-mono text-slate-200">Claude / OpenRouter Swarm</span>
              </div>
              <div className="flex justify-between">
                <span>Repository:</span>
                <span className="font-mono text-[#60A5FA]">themeig/AI.CoFounder</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Content Body */}
        <main className="lg:col-span-9 space-y-16">
          {/* Title Header */}
          <div className="space-y-6 border-b border-slate-800/80 pb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#3B82F6]/10 border border-[#3B82F6]/20 text-[#60A5FA] text-xs font-semibold">
              <span>📄 DOCUMENTAZIONE TECNICA UFFICIALE</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              AI.CoFounder: Sistema Multi-Agente Autonomo e Motore di Intelligenza Collettiva per la Scalabilità delle Startup
            </h1>

            <p className="text-lg text-slate-300 leading-relaxed font-normal">
              Un'analisi architetturale approfondita sull'orchestrazione agentica distribuita, l'isolamento rigoroso dei dati di startup e l'integrazione della memoria semantica a lungo termine a supporto dei fondatori di tecnologia.
            </p>

            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400 pt-2">
              <div>
                <span className="text-slate-500">Autore:</span>{" "}
                <span className="font-semibold text-slate-200">AI.CoFounder Core Research & AI Systems Team</span>
              </div>
              <div>
                <span className="text-slate-500">Peer Reviewed By:</span>{" "}
                <span className="font-semibold text-slate-200">Advanced Agentic Architecture Group</span>
              </div>
            </div>
          </div>

          {/* Section 1: Abstract & Executive Summary */}
          <section id="abstract" className="space-y-4 scroll-mt-28">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-[#3B82F6]">1.</span> Abstract & Executive Summary
            </h2>
            <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed space-y-4">
              <p>
                Il tasso di fallimento delle startup nelle fasi <em>Pre-Seed</em> e <em>Seed</em> supera storicamente l'85%, principalmente a causa della mancanza di validazione quantitativa del Product-Market Fit (PMF), decisioni finanziarie errate sulla <em>runway</em> e lentezza nell'esecuzione tecnica ed esecutiva.
              </p>
              <p>
                <strong>AI.CoFounder</strong> introduce un nuovo paradigma di orchestrazione di intelligenza artificiale: una piattaforma basata su un **Swarm Multi-Agente Autonomo** coordinato da un agente centrale (il <em>CoFounder Orchestrator</em>) affiancato da 6 agenti verticali altamente dipartimentali: <strong>Strategy, Tech, Finance, Marketing, Legal e Operations</strong>.
              </p>
              <div className="p-4 rounded-xl bg-slate-900/80 border border-[#3B82F6]/30 text-slate-200 text-xs space-y-2">
                <span className="font-bold text-[#60A5FA] uppercase tracking-wider block">Key Technical Highlights:</span>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  <li><strong>Isolamento Rigoroso per Startup:</strong> Ogni startup del founder possiede un ambiente completamente segregato su database Supabase PostgreSQL.</li>
                  <li><strong>Memoria Semantica Cross-Startup (Mnemosyne):</strong> Ricordo a lungo termine basato su vettori embeddings (1536d) che permette l'apprendimento globale di strategie reali salvaguardando i dati privati.</li>
                  <li><strong>Sandbox di Esecuzione in Tempo Reale:</strong> Esecuzione backend sicura di codice Python 3 e TypeScript per formulazioni matematiche RICE e simulazioni finanziarie Monte Carlo.</li>
                  <li><strong>Workspace Frontend Interattivo:</strong> Generazione dinamica di artefatti codice (HTML5/React) visualizzabili in diretta dal founder.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 2: Architettura Multi-Agente Swarm */}
          <section id="architecture" className="space-y-4 scroll-mt-28">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-[#3B82F6]">2.</span> Architettura Multi-Agente Swarm
            </h2>
            <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed space-y-4">
              <p>
                L'architettura del sistema si articola su due livelli gerarchici di elaborazione cognitiva:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <h4 className="font-bold text-[#60A5FA] text-base">🧠 CoFounder Orchestrator</h4>
                  <p className="text-xs text-slate-400">
                    Agente supremo dotato di reasoning loop autonomo (tag <code className="text-[#A78BFA]">&lt;thought&gt;</code>). Scompone le richieste multidisciplinari del founder, invoca ricognizioni dinamiche del team ed effettua deleghe parallele fino a 3 sub-agenti.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <h4 className="font-bold text-[#F472B6] text-base">⚙️ Dipendenti Specializzati (Swarm)</h4>
                  <p className="text-xs text-slate-400">
                    Agenti dedicati con prompt di sistema e tool specifici: <em>Strategy</em> (posizionamento & competitor), <em>Tech</em> (CTO & stack), <em>Finance</em> (MRR & runway), <em>Marketing</em> (funnel & PLG), <em>Legal</em> (GDPR & contratti), <em>Operations</em> (hiring & workflow).
                  </p>
                </div>
              </div>

              <pre className="p-4 rounded-xl bg-[#010409] border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto">
{`+-----------------------------------------------------------------------+
|                       FOUNDER USER INTERFACE                          |
|         (Dashboard / CoFounder Chat / Portfolio Launcher)             |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|                    CoFounder Orchestrator Agent                       |
|   - Active Startup Context Injector (Name, Sector, Phase, MRR)        |
|   - Reasoning Loop Engine (<thought>...</thought>)                    |
|   - Tool Calling & Parallel Delegation Controller                    |
+-----------------------------------------------------------------------+
       |               |               |               |               |
       v               v               v               v               v
  +----------+   +----------+   +----------+   +----------+   +----------+
  | Strategy |   |   Tech   |   | Finance  |   |Marketing |   | Operations|
  |  Agent   |   |  Agent   |   |  Agent   |   |  Agent   |   |  Agent   |
  +----------+   +----------+   +----------+   +----------+   +----------+
       |               |               |               |               |
       +---------------+---------------+---------------+---------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|                       EXECUTION & MEMORY LAYER                        |
|   - Node.js / Python 3 Sandbox Execution Engine                       |
|   - Supabase PostgreSQL (Strict Tenant Isolation)                     |
|   - Mnemosyne Global Knowledge Vector Hub (1536d Embeddings)          |
+-----------------------------------------------------------------------+`}
              </pre>
            </div>
          </section>

          {/* Section 3: Memoria Mnemosyne & Pgvector */}
          <section id="memory" className="space-y-4 scroll-mt-28">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-[#3B82F6]">3.</span> Memoria Mnemosyne & Similarity Vectors (1536d)
            </h2>
            <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed space-y-4">
              <p>
                Uno dei principali limiti dei modelli di linguaggio tradizionali è la perdita di contesto nelle sessioni prolungate. AI.CoFounder risolve questa sfida implementando l'engine di memoria semantica <strong>Mnemosyne</strong>.
              </p>
              <p>
                Ogni informazione o decisione chiave viene classificata con due livelli di ambito:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-300">
                <li><strong className="text-white">scope: "local"</strong> — Memoria specifica ed isolata per la singola startup (es. fatturato riservato, lista clienti, contratti).</li>
                <li><strong className="text-white">scope: "global"</strong> — Lezioni di business generalizzabili (es. playbook di conversione B2B, strategie di acquisizione organica).</li>
              </ul>
              <p>
                Durante il recupero semantico (<em>recall</em>), l'engine calcola la cosin-similarità sui vettori generati tramite l'estensione <strong>pgvector</strong> di Supabase PostgreSQL, rendendo immediatamente accessibile l'esperienza pregressa agli agenti senza violare la riservatezza.
              </p>
            </div>
          </section>

          {/* Section 4: Sandbox Code Execution Engine */}
          <section id="sandbox" className="space-y-4 scroll-mt-28">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-[#3B82F6]">4.</span> Sandbox Code Execution Engine & Math Formalism
            </h2>
            <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed space-y-4">
              <p>
                AI.CoFounder non si limita a generare testo descrittivo. Gli agenti dispongono dell'accesso diretto ad una <strong>Sandbox di Esecuzione Backend</strong> isolata in gradi di eseguire script Python 3 e Node.js/TypeScript.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <h4 className="font-bold text-white mb-2 text-sm">Prioritizzazione RICE automatica</h4>
                  <p className="text-xs text-slate-400">
                    Calcolo automatico del valore strategico dei feature backlog usando la formula RICE:
                    <span className="block font-mono text-[#60A5FA] mt-1 text-[11px]">
                      RICE = (Reach × Impact × Confidence) / Effort
                    </span>
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <h4 className="font-bold text-white mb-2 text-sm">Simulazioni Monte Carlo (1.000 Run)</h4>
                  <p className="text-xs text-slate-400">
                    Analisi della variabilità della cassa futura per stimare la runway minima, media e massima con intervalli di confidenza al 95%.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 5: Isolamento Tenant & Supabase Compliance */}
          <section id="isolation" className="space-y-4 scroll-mt-28">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-[#3B82F6]">5.</span> Isolamento Tenant & Supabase Security
            </h2>
            <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed space-y-4">
              <p>
                La sicurezza dei dati aziendali è garantita dall'architettura multi-tenant con politche di <strong>Row Level Security (RLS)</strong> su Supabase PostgreSQL.
              </p>
              <p>
                Ogni richiesta API risolve il contesto della startup attiva mediante la funzione <code className="text-[#60A5FA]">getActiveStartupContext(req)</code> che legge il cookie cifrato della sessione e isola categoricamente:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-300 text-xs">
                <li>Le configurazioni degli agenti (<code className="text-slate-200">AgentConfig.startupId</code>)</li>
                <li>Gli storici delle conversazioni CoFounder (<code className="text-slate-200">AgentConfig.settings.discussions</code>)</li>
                <li>I messaggi dei dipendenti (<code className="text-slate-200">Message.agentId</code>)</li>
                <li>Le metriche ed i bilanci (<code className="text-slate-200">Startup.id</code>)</li>
              </ul>
            </div>
          </section>

          {/* Section 6: Benchmarks & Y Combinator Data */}
          <section id="benchmarks" className="space-y-4 scroll-mt-28">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-[#3B82F6]">6.</span> Modelli di Successo Y Combinator & Data Benchmarks
            </h2>
            <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed space-y-4">
              <p>
                Il sistema integra oltre <strong>12.000 pattern distillati</strong> da casi reali di Y Combinator, Sequoia Capital e First Round Capital, catalogando le traiettorie di successo e le cause di fallimento più diffuse nelle fasi iniziali.
              </p>

              <div className="overflow-x-auto my-6">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-300">
                      <th className="p-3 font-semibold">Pattern / Strategia</th>
                      <th className="p-3 font-semibold">Fase</th>
                      <th className="p-3 font-semibold">Tasso Successo</th>
                      <th className="p-3 font-semibold">Takeaway Chiave</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-400">
                    <tr>
                      <td className="p-3 font-semibold text-slate-200">Do Things That Don't Scale</td>
                      <td className="p-3">Pre-Seed / MVP</td>
                      <td className="p-3 text-[#34D399] font-bold">78%</td>
                      <td className="p-3">Acquisizione manuale dei primi 100 clienti prima di automatizzare.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-200">Default Alive vs Default Dead</td>
                      <td className="p-3">Pre-Seed / Seed</td>
                      <td className="p-3 text-[#34D399] font-bold">85%</td>
                      <td className="p-3">Mantenere il burn rate controllato per raggiungere la redditività prima della fine della cassa.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-200">Sean Ellis PMF Test (&gt;40%)</td>
                      <td className="p-3">MVP / Growth</td>
                      <td className="p-3 text-[#34D399] font-bold">92%</td>
                      <td className="p-3">Verificare quantitativamente che oltre il 40% degli utenti si dichiari "molto deluso" senza il prodotto.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Section 7: Conclusion & Action Call */}
          <section id="conclusion" className="space-y-6 scroll-mt-28 border-t border-slate-800/80 pt-10">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-[#3B82F6]">7.</span> Conclusioni & Prospettive Future
            </h2>
            <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed space-y-4">
              <p>
                <strong>AI.CoFounder</strong> dimostra come la combinazione di agenti AI autonomi, memoria semantica persistente e rigoroso isolamento multi-tenant possa accelerare drasticamente i tempi di esecuzione delle startup, offrendo al founder un team di livello executive disponibile 24/7.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-gradient-to-r from-[#3B82F6]/15 via-[#8B5CF6]/10 to-transparent border border-[#3B82F6]/30 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Pronto a testare l'architettura dal vivo?</h3>
                <p className="text-xs text-slate-300">
                  Accedi al Workspace interattivo, seleziona una startup ed interagisci con il CoFounder AI.
                </p>
              </div>
              <Link
                href="/dashboard/portfolio"
                className="px-6 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:opacity-95 text-white transition shadow-lg shadow-[#3B82F6]/30 whitespace-nowrap flex items-center gap-2"
              >
                <span>🚀 Accedi al Workspace</span>
                <span>→</span>
              </Link>
            </div>
          </section>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-10 bg-[#020408] text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-tr from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center text-white font-bold text-[9px]">
              AI
            </div>
            <span>AI.CoFounder Technical White Paper © 2026</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-slate-300 transition">Landing Page</Link>
            <Link href="/login" className="hover:text-slate-300 transition">Login</Link>
            <Link href="/dashboard/portfolio" className="hover:text-slate-300 transition">Portfolio</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
