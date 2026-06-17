"use client";

import { useEffect, useState } from "react";

interface Pattern {
  id: string;
  title: string;
  description: string;
  sector: string | null;
  phase: string | null;
  successRate: number;
  sampleSize: number;
  confidence: number;
  keyFactors: string[];
  failureModes: string[];
  avgTimeToOutcome: string | null;
  extractedBy: string;
}

interface Playbook {
  id: string;
  title: string;
  description: string;
  sector: string | null;
  phase: string | null;
  steps: any[];
  successRate: number;
}

export default function MemoryPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [tab, setTab] = useState<"patterns" | "playbooks">("patterns");
  const [loading, setLoading] = useState(true);

  // Filters State
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [phaseFilter, setPhaseFilter] = useState("all");

  useEffect(() => {
    Promise.all([
      fetch("/api/memory/patterns").then((res) => res.json()),
      fetch("/api/memory/playbooks").then((res) => res.json()),
    ])
      .then(([p, pb]) => {
        setPatterns(Array.isArray(p) ? p : []);
        setPlaybooks(Array.isArray(pb) ? pb : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Filter logic
  const filteredPatterns = patterns.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) || 
                          p.description.toLowerCase().includes(search.toLowerCase());
    const matchesSector = sectorFilter === "all" || p.sector?.toLowerCase() === sectorFilter.toLowerCase();
    const matchesPhase = phaseFilter === "all" || p.phase?.toLowerCase() === phaseFilter.toLowerCase();
    return matchesSearch && matchesSector && matchesPhase;
  });

  const filteredPlaybooks = playbooks.filter((pb) => {
    const matchesSearch = pb.title.toLowerCase().includes(search.toLowerCase()) || 
                          pb.description.toLowerCase().includes(search.toLowerCase());
    const matchesSector = sectorFilter === "all" || pb.sector?.toLowerCase() === sectorFilter.toLowerCase();
    const matchesPhase = phaseFilter === "all" || pb.phase?.toLowerCase() === phaseFilter.toLowerCase();
    return matchesSearch && matchesSector && matchesPhase;
  });

  if (loading) return <div className="p-8 text-center text-muted-foreground text-sm">Caricamento Knowledge Base...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
          📚 Knowledge Base <span className="text-xs font-semibold px-2.5 py-0.5 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">OmniMemory</span>
        </h1>
        <p className="text-gray-500 mt-1">Conoscenze strategiche, pattern di successo ed errori estratti continuamente dall'AI su migliaia di startup.</p>
      </div>

      {/* Tabs and Filters Panel */}
      <div className="p-6 rounded-2xl bg-gray-900/40 backdrop-blur-md border border-gray-800/80 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tab Selector */}
          <div className="flex gap-2 bg-gray-950 p-1.5 rounded-xl border border-gray-800/50 w-fit">
            <button
              onClick={() => { setTab("patterns"); setSearch(""); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === "patterns" ? "bg-gray-800 text-white shadow" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              🎯 Pattern di Successo / Fallimento ({filteredPatterns.length})
            </button>
            <button
              onClick={() => { setTab("playbooks"); setSearch(""); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === "playbooks" ? "bg-gray-800 text-white shadow" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              📋 Playbook Strategici ({filteredPlaybooks.length})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 md:max-w-xs">
            <input
              type="text"
              placeholder="Cerca conoscenza..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <svg className="w-4 h-4 text-gray-500 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Filter select list */}
        <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-800/40">
          <div>
            <label className="text-[10px] text-gray-500 uppercase font-semibold block mb-1">Settore</label>
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="bg-gray-950 border border-gray-800 text-xs text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Tutti i settori</option>
              <option value="saas">SaaS</option>
              <option value="fintech">Fintech</option>
              <option value="ecommerce">E-commerce B2B/B2C</option>
              <option value="ai">Intelligenza Artificiale</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase font-semibold block mb-1">Fase di Sviluppo</label>
            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              className="bg-gray-950 border border-gray-800 text-xs text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Tutte le fasi</option>
              <option value="idea">Idea Stage</option>
              <option value="pre-seed">Pre-Seed</option>
              <option value="mvp">MVP Stage</option>
              <option value="growth">Growth Stage</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid Content */}
      {tab === "patterns" && (
        <div className="grid gap-6">
          {filteredPatterns.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-10">Nessun pattern di conoscenza trovato corrispondente ai filtri impostati.</p>
          )}

          {filteredPatterns.map((p) => {
            const isFailure = p.successRate < 0.4;
            const isAiLearned = p.extractedBy === "hermes_analyzer";
            
            return (
              <div
                key={p.id}
                className={`p-6 rounded-2xl border transition-all bg-gray-900/20 hover:bg-gray-900/35 relative overflow-hidden ${
                  isFailure 
                    ? "border-red-950/40 hover:border-red-900/30" 
                    : "border-gray-800/80 hover:border-blue-900/30"
                }`}
              >
                {/* AI learned watermark glowing effect */}
                {isAiLearned && (
                  <div className="absolute top-0 right-0 px-3 py-1 bg-gradient-to-l from-blue-500/10 to-purple-500/10 border-b border-l border-blue-500/20 rounded-bl-xl text-[10px] font-bold text-blue-400 uppercase tracking-widest animate-pulse">
                    🤖 AI Learned
                  </div>
                )}

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {p.title}
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {p.sector && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 uppercase border border-blue-500/10">
                          {p.sector}
                        </span>
                      )}
                      {p.phase && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 uppercase border border-purple-500/10">
                          {p.phase}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Visual gauge percentage card */}
                  <div className="flex items-center gap-3 bg-gray-950/60 border border-gray-800/60 p-3 rounded-xl min-w-[140px]">
                    <div className="relative flex items-center justify-center">
                      {/* Circular Gauge */}
                      <svg className="w-10 h-10 transform -rotate-90">
                        <circle cx="20" cy="20" r="16" stroke="currentColor" className="text-gray-800" strokeWidth="2.5" fill="transparent" />
                        <circle cx="20" cy="20" r="16" stroke="currentColor" 
                          className={isFailure ? "text-red-500" : "text-green-500"} 
                          strokeWidth="2.5" 
                          strokeDasharray={100}
                          strokeDashoffset={100 - (p.successRate * 100)}
                          fill="transparent" 
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute text-[10px] font-bold text-white">{(p.successRate * 100).toFixed(0)}%</span>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-semibold">Tasso Successo</p>
                      <p className="text-xs font-bold text-white">{isFailure ? "Alto Rischio" : "Ottimale"}</p>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-gray-300 leading-relaxed mb-4 border-b border-gray-800/40 pb-4 whitespace-pre-wrap">{p.description}</p>

                {/* Structured Columns for Success/Failure tags */}
                <div className="grid md:grid-cols-2 gap-4 text-xs">
                  {p.keyFactors && p.keyFactors.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="font-bold text-green-400 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Fattori Chiave di Successo:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {p.keyFactors.map((factor, i) => (
                          <span key={i} className="px-2.5 py-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/15">{factor}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {p.failureModes && p.failureModes.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="font-bold text-red-400 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Sintomi di Fallimento / Errori Comuni:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {p.failureModes.map((mode, i) => (
                          <span key={i} className="px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/15">{mode}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-800/40 flex gap-4 text-[10px] text-gray-500">
                  <span>Campione: <strong className="text-gray-300">{p.sampleSize} startup</strong></span>
                  <span>Confidenza: <strong className="text-gray-300">{(p.confidence * 100).toFixed(0)}%</strong></span>
                  {p.avgTimeToOutcome && <span>Tempo medio: <strong className="text-gray-300">{p.avgTimeToOutcome}</strong></span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "playbooks" && (
        <div className="grid gap-6">
          {filteredPlaybooks.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-10">Nessun playbook strategico trovato corrispondente ai filtri impostati.</p>
          )}

          {filteredPlaybooks.map((pb) => (
            <div key={pb.id} className="p-6 rounded-2xl border border-gray-800/80 bg-gray-900/20 hover:bg-gray-900/35 transition-all">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{pb.title}</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {pb.sector && <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 uppercase border border-blue-500/10">{pb.sector}</span>}
                    {pb.phase && <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 uppercase border border-purple-500/10">{pb.phase}</span>}
                  </div>
                </div>
                <div className="text-right bg-gray-950/60 border border-gray-800/60 p-3 rounded-xl min-w-[120px]">
                  <p className="text-lg font-black text-green-400">{(pb.successRate * 100).toFixed(0)}%</p>
                  <p className="text-[10px] text-gray-500 uppercase font-semibold">Tasso Successo</p>
                </div>
              </div>

              <p className="text-sm text-gray-300 leading-relaxed mb-6 border-b border-gray-800/40 pb-4">{pb.description}</p>

              {pb.steps && pb.steps.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs uppercase font-bold text-gray-400 tracking-wider">Passaggi Operativi del Playbook:</p>
                  <div className="grid gap-2">
                    {pb.steps.map((step: any, i: number) => (
                      <div key={i} className="flex items-center gap-4 p-3 bg-gray-950/40 border border-gray-850/50 rounded-xl">
                        <span className="w-7 h-7 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 flex items-center justify-center text-xs font-bold shadow-sm">
                          {step.step || i + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white">{step.title}</p>
                          <p className="text-[10px] text-gray-500">Durata stimata: {step.duration}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
