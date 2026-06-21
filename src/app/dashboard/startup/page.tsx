"use client";

import { useEffect, useState, useRef } from "react";

const AGENT_CONFIGS: Record<string, { color: string; gradient: string; label: string; desc: string }> = {
  strategy:   { color: '#1A73E8', gradient: 'linear-gradient(135deg, #1A73E8, #4285F4)', label: 'Strategy', desc: 'Analisi mercato & crescita' },
  tech:       { color: '#34A853', gradient: 'linear-gradient(135deg, #34A853, #0F9D58)', label: 'Tech', desc: 'Sviluppo & architettura' },
  finance:    { color: '#F9AB00', gradient: 'linear-gradient(135deg, #F9AB00, #F4B400)', label: 'Finance', desc: 'Runway, MRR & budget' },
  marketing:  { color: '#EA4335', gradient: 'linear-gradient(135deg, #EA4335, #DB4437)', label: 'Marketing', desc: 'Lead generation & SEO' },
  legal:      { color: '#9334E6', gradient: 'linear-gradient(135deg, #9334E6, #A855F7)', label: 'Legal', desc: 'Società, contratti & GDPR' },
  operations: { color: '#17A2B8', gradient: 'linear-gradient(135deg, #17A2B8, #00ACC1)', label: 'Ops', desc: 'Processi, ticket & automation' },
};

export default function StartupPage() {
  const [startup, setStartup] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [status, setStatus] = useState("growing");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Integration Configuration & Drawer states (Read-only for cards display)
  const [stripeConnected, setStripeConnected] = useState(false);
  const [mixpanelConnected, setMixpanelConnected] = useState(false);
  const [plaidConnected, setPlaidConnected] = useState(false);
  const [flashMetrics, setFlashMetrics] = useState(false);

  const loadStartupData = () => {
    fetch("/api/demo/startup")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setStartup(data[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Load connection states from localStorage for displaying sources on cards
    if (typeof window !== "undefined") {
      setStripeConnected(localStorage.getItem("agentfoundry_integration_stripe_conn") === "true");
      setMixpanelConnected(localStorage.getItem("agentfoundry_integration_mixpanel_conn") === "true");
      setPlaidConnected(localStorage.getItem("agentfoundry_integration_plaid_conn") === "true");
    }
  };

  useEffect(() => {
    loadStartupData();

    const handleMetricsUpdated = () => {
      loadStartupData();
      setFlashMetrics(true);
      setTimeout(() => setFlashMetrics(false), 1500);
    };

    // Listen to global layout coFounder updates
    window.addEventListener("startup-metrics-updated", handleMetricsUpdated);
    window.addEventListener("startup-agents-updated", loadStartupData);

    return () => {
      window.removeEventListener("startup-metrics-updated", handleMetricsUpdated);
      window.removeEventListener("startup-agents-updated", loadStartupData);
    };
  }, []);

  const handleToggleAgent = async (agentId: string, currentStatus: boolean) => {
    try {
      const res = await fetch("/api/demo/agents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: agentId, isActive: !currentStatus }),
      });
      if (!res.ok) throw new Error("Impossibile aggiornare l'agente");
      
      const startupRes = await fetch("/api/demo/startup");
      const startupData = await startupRes.json();
      if (Array.isArray(startupData) && startupData.length > 0) setStartup(startupData[0]);
    } catch (err) {
      console.error("Toggle agent error:", err);
    }
  };

  const handleSubmitOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setAnalysis(null);
    try {
      const res = await fetch("/api/demo/startup/outcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore durante l'analisi");
      setAnalysis(data.analysis);
      setNotes("");
      const startupRes = await fetch("/api/demo/startup");
      const startupData = await startupRes.json();
      if (Array.isArray(startupData) && startupData.length > 0) setStartup(startupData[0]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: '#F8F9FA' }}>
      <div className="w-8 h-8 rounded-full border-2 border-[#1A73E8] border-t-transparent animate-spin" />
    </div>
  );

  if (!startup) return (
    <div className="p-8 text-center text-sm" style={{ color: '#5F6368' }}>Nessuna startup trovata.</div>
  );

  // Synergy Score Calculations
  const activeAgents = startup.agentConfigs?.filter((a: any) => a.isActive) || [];
  const activeTypes = new Set(activeAgents.map((a: any) => a.type));
  const activeCount = activeTypes.size;
  const synergyScore = Math.round((activeCount / 6) * 100);

  // SVG Gauge calculations
  const strokeDash = 251.2; // 2 * PI * r (r=40)
  const strokeOffset = strokeDash - (strokeDash * synergyScore) / 100;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-fade-in" style={{ background: '#F8F9FA' }}>
      
      {/* Glow Style override */}
      <style>{`
        @keyframes metric-flash-glow {
          0% { background-color: rgba(52, 168, 83, 0.15); border-color: #34A853; box-shadow: 0 0 12px rgba(52, 168, 83, 0.3); }
          100% { background-color: #FFFFFF; border-color: #E8EAED; box-shadow: 0 1px 2px rgba(60,64,67,0.10); }
        }
        .flash-active {
          animation: metric-flash-glow 1.5s ease-out;
        }
        .custom-switch:checked ~ .switch-dot {
          transform: translateX(14px);
          background-color: #FFFFFF;
        }
        .custom-switch:checked {
          background-color: #34A853;
        }
      `}</style>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl border border-[#E8EAED]" style={{ background: '#FFFFFF', boxShadow: '0 1px 2px rgba(60,64,67,0.05)' }}>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider" style={{ background: '#E8F0FE', color: '#1A73E8' }}>
              {startup.sector?.toUpperCase() || "SaaS"}
            </span>
            <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider" style={{ background: '#E6F4EA', color: '#34A853' }}>
              {startup.phase?.toUpperCase() || "Pre-Seed"}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#202124' }}>
            {startup.name || 'Startup Workspace'}
          </h1>
          <p className="text-sm mt-1" style={{ color: '#5F6368' }}>
            Gestisci le metriche, monitora le API in tempo reale e coordina il tuo team di agenti AI.
          </p>
        </div>
      </div>

      {/* Grid Dashboard */}
      <div className="grid lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Columns: Metric Cards & Causal outcome form */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Key Metrics Overhaul */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'MRR (Revenue)',
                value: `$${(startup.mrr || 0).toLocaleString()}`,
                color: '#1A73E8',
                bg: '#E8F0FE',
                source: stripeConnected ? 'Stripe API' : 'Manuale',
                connected: stripeConnected
              },
              {
                label: 'Active Users',
                value: (startup.users || 0).toLocaleString(),
                color: '#34A853',
                bg: '#E6F4EA',
                source: mixpanelConnected ? 'Mixpanel API' : stripeConnected ? 'Stripe API' : 'Manuale',
                connected: mixpanelConnected || stripeConnected
              },
              {
                label: 'Monthly Burn Rate',
                value: `$${(startup.burnRate || 0).toLocaleString()}/mo`,
                color: '#F9AB00',
                bg: '#FEF7E0',
                source: plaidConnected ? 'Plaid API' : 'Manuale',
                connected: plaidConnected
              },
              {
                label: 'Runway (Life)',
                value: `${startup.runway || 0} mesi`,
                color: '#EA4335',
                bg: '#FCE8E6',
                source: plaidConnected ? 'Plaid API' : 'Calcolato',
                connected: plaidConnected
              },
            ].map(m => (
              <div
                key={m.label}
                className={`p-4 rounded-xl border border-[#E8EAED] transition-all flex flex-col justify-between h-28 ${flashMetrics ? 'flash-active' : ''}`}
                style={{ background: '#FFFFFF', boxShadow: '0 1px 2px rgba(60,64,67,0.06)' }}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#5F6368' }}>{m.label}</p>
                    <span
                      className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-tight uppercase"
                      style={{
                        background: m.connected ? '#E6F4EA' : '#F1F3F4',
                        color: m.connected ? '#137333' : '#5F6368',
                        border: m.connected ? '1px solid #CEEAD6' : '1px solid #E8EAED'
                      }}
                    >
                      {m.source}
                    </span>
                  </div>
                  <p className="text-xl font-bold mt-2" style={{ color: '#202124' }}>{m.value}</p>
                </div>
                {/* Visual mini-bar inside metric */}
                <div className="w-full h-1 rounded-full overflow-hidden mt-2" style={{ background: '#F1F3F4' }}>
                  <div className="h-full rounded-full" style={{ width: '60%', background: m.color }} />
                </div>
              </div>
            ))}
          </div>

          {/* Pivot / Causal Analyzer Form */}
          <div className="rounded-2xl border border-[#E8EAED] overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 2px rgba(60,64,67,0.06)' }}>
            <div className="px-6 py-4" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
              <h2 className="font-semibold text-sm" style={{ color: '#202124' }}>Registra un Pivot o Outcome</h2>
              <p className="text-xs" style={{ color: '#5F6368', marginTop: '2px' }}>
                Fornisci all'OmniMemory Analyzer dettagli di eventi significativi per generare regole per il team di agenti.
              </p>
            </div>
            <form onSubmit={handleSubmitOutcome} className="p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#5F6368' }}>Esito dell'evento</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                    style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }}
                  >
                    <option value="growing">Trazione / Crescita (Growing)</option>
                    <option value="pivot">Pivot Strategico (Pivot)</option>
                    <option value="stalled">Stallo / Difficoltà (Stalled)</option>
                    <option value="failed">Interruzione Operazioni (Failed)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#5F6368' }}>Data Rilevamento</label>
                  <input
                    type="text"
                    disabled
                    value={new Date().toLocaleDateString()}
                    className="w-full px-3 py-2 rounded-lg text-xs"
                    style={{ background: '#F1F3F4', border: '1px solid #DADCE0', color: '#9AA0AC' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#5F6368' }}>
                  Causal Log (Cosa è successo e perché)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Descrivi l'evento: ad es. 'Abbiamo lanciato una campagna ADS focalizzata sugli sviluppatori riducendo il CAC del 30% ma la retention a 30 giorni è scesa al 12% a causa di un onboarding difettoso...'"
                  rows={4}
                  required
                  className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                  style={{ background: '#F8F9FA', border: '1px solid #DADCE0', color: '#202124' }}
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg text-xs flex items-center gap-2" style={{ background: '#FCE8E6', border: '1px solid #F7CECE', color: '#C5221F' }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-lg text-white transition disabled:opacity-50"
                style={{ background: '#1A73E8', boxShadow: '0 1px 2px rgba(26,115,232,0.3)' }}
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analisi OmniMemory...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                    Esegui Causal Analysis
                  </>
                )}
              </button>
            </form>

            {/* Causal Analysis Report Display */}
            {analysis && (
              <div className="mx-6 mb-6 p-4 rounded-xl border border-[#C5D9F9]" style={{ background: '#F4F7FE' }}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-xs uppercase tracking-wide" style={{ color: '#1A73E8' }}>
                    Report OmniMemory: "{analysis.title}"
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[8px] font-bold tracking-tight uppercase" style={{ background: '#D2E3FC', color: '#1A73E8' }}>
                    Modello Aggiornato
                  </span>
                </div>
                <p className="text-xs leading-relaxed whitespace-pre-wrap mb-4" style={{ color: '#3C4043' }}>{analysis.analysis}</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {analysis.keyFactors?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#137333' }}>Fattori di Successo</p>
                      <div className="flex flex-wrap gap-1">
                        {analysis.keyFactors.map((f: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded text-[9px] font-semibold" style={{ background: '#E6F4EA', color: '#137333', border: '1px solid #CEEAD6' }}>{f}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysis.failureModes?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#C5221F' }}>Errori di Strategia Rilevati</p>
                      <div className="flex flex-wrap gap-1">
                        {analysis.failureModes.map((f: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded text-[9px] font-semibold" style={{ background: '#FCE8E6', color: '#C5221F', border: '1px solid #F7CECE' }}>{f}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Synergy Gauge & Agent Hub */}
        <div className="space-y-6">
          
          {/* Synergy Score Ring Gauge */}
          <div className="p-5 rounded-2xl border border-[#E8EAED]" style={{ background: '#FFFFFF', boxShadow: '0 1px 2px rgba(60,64,67,0.06)' }}>
            <h2 className="font-semibold text-sm" style={{ color: '#202124' }}>Sinergia Operativa Team</h2>
            <div className="flex items-center gap-4 mt-4">
              <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="32" cy="32" r="28" fill="transparent" stroke="#F1F3F4" strokeWidth="5" />
                  <circle cx="32" cy="32" r="28" fill="transparent" stroke={synergyScore > 60 ? "#34A853" : synergyScore > 30 ? "#F9AB00" : "#EA4335"} strokeWidth="5" strokeDasharray={strokeDash} strokeDashoffset={strokeOffset} strokeLinecap="round" className="transition-all duration-500" />
                </svg>
                <span className="absolute text-xs font-bold" style={{ color: '#202124' }}>{synergyScore}%</span>
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: '#3C4043' }}>
                  {activeCount} su 6 agenti attivati
                </p>
                <p className="text-[11px] mt-1 leading-relaxed" style={{ color: '#5F6368' }}>
                  {synergyScore === 100 
                    ? "Copertura strategica globale completata. Gli agenti coordineranno l'auto-analisi." 
                    : "Attiva più agenti specialistici per sbloccare l'auto-analisi incrociata dei dati."}
                </p>
              </div>
            </div>
          </div>

          {/* Revamped Team Agenti Hub */}
          <div className="rounded-2xl border border-[#E8EAED] overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 2px rgba(60,64,67,0.06)' }}>
            <div className="px-5 py-3.5" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
              <h2 className="font-semibold text-sm" style={{ color: '#202124' }}>Team Agenti Specializzati</h2>
            </div>
            <div className="divide-y" style={{ borderColor: '#F1F3F4' }}>
              {startup.agentConfigs?.map((agent: any) => {
                const cfg = AGENT_CONFIGS[agent.type] || { color: '#5F6368', gradient: 'linear-gradient(135deg, #5F6368, #9AA0AC)', label: agent.type, desc: 'Agente AI' };
                return (
                  <div key={agent.id} className="p-4 flex flex-col gap-3 transition-colors hover:bg-[#FAFBFB]">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {/* Avatar bubble */}
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white relative flex-shrink-0"
                          style={{ background: cfg.gradient }}
                        >
                          {agent.name.charAt(0).toUpperCase()}
                          {/* Glowing pulse indicator */}
                          <div
                            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                            style={{ background: agent.isActive ? '#34A853' : '#DADCE0' }}
                          >
                            {agent.isActive && (
                              <span className="absolute inset-0 rounded-full bg-[#34A853] animate-ping opacity-75" />
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-bold" style={{ color: '#202124' }}>{agent.name}</p>
                          <p className="text-[10px]" style={{ color: '#9AA0AC' }}>{cfg.label} · {cfg.desc}</p>
                        </div>
                      </div>

                      {/* Toggle Switch */}
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={agent.isActive}
                          onChange={() => handleToggleAgent(agent.id, agent.isActive)}
                          className="sr-only custom-switch"
                        />
                        <div className="w-7 h-4 rounded-full bg-[#DADCE0] transition-colors relative">
                          <div className="switch-dot absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-[#FFFFFF] transition-transform" />
                        </div>
                      </label>
                    </div>

                    {/* Stats and Action details */}
                    <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px dashed #F1F3F4' }}>
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F1F3F4] text-[#5F6368] font-medium">
                          💬 {agent.messageCount || 0} messaggi
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F4F7FE] text-[#1A73E8] font-medium">
                          🧠 {agent.memoryCount || 0} ricordi
                        </span>
                      </div>
                      <a
                        href={`/dashboard/agents?id=${agent.id}`}
                        className="text-[10px] font-semibold hover:underline"
                        style={{ color: '#1A73E8' }}
                      >
                        Apri Chat →
                      </a>
                    </div>
                  </div>
                );
              })}
              {(!startup.agentConfigs || startup.agentConfigs.length === 0) && (
                <div className="p-5 text-center text-xs" style={{ color: '#9AA0AC' }}>
                  Nessun agente registrato nel workspace. Vai alla sezione Agenti per inizializzare il team.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
