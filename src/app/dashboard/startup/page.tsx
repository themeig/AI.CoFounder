"use client";

import { useEffect, useState } from "react";

export default function StartupPage() {
  const [startup, setStartup] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Outcome/Pivot form state
  const [status, setStatus] = useState("growing");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/demo/startup")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setStartup(data[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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

      // Refresh startup info
      const startupRes = await fetch("/api/demo/startup");
      const startupData = await startupRes.json();
      if (Array.isArray(startupData) && startupData.length > 0) {
        setStartup(startupData[0]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!startup) return <div className="p-8 text-center text-muted-foreground">No startup found.</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Startup Profile</h1>
          <p className="text-gray-500 mt-1">Gestisci le metriche e analizza i pivot della tua startup.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left column: Basic Info & Metrics */}
        <div className="md:col-span-2 space-y-6">
          <div className="p-6 rounded-xl bg-gray-900 border border-gray-800">
            <h2 className="text-lg font-semibold text-white mb-4">Basic Info</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><label className="text-xs text-gray-500 block">Name</label><p className="font-medium text-white">{startup.name}</p></div>
              <div><label className="text-xs text-gray-500 block">Sector</label><p className="font-medium text-white">{startup.sector?.toUpperCase()}</p></div>
              <div><label className="text-xs text-gray-500 block">Phase</label><p className="font-medium text-white">{startup.phase?.toUpperCase()}</p></div>
              <div><label className="text-xs text-gray-500 block">Country</label><p className="font-medium text-white">{startup.country || "—"}</p></div>
              <div><label className="text-xs text-gray-500 block">Team Size</label><p className="font-medium text-white">{startup.teamSize || "—"}</p></div>
              <div><label className="text-xs text-gray-500 block">Website</label><p className="font-medium text-white">{startup.website || "—"}</p></div>
            </div>
            {startup.description && (
              <div className="mt-4 border-t border-gray-800 pt-4">
                <label className="text-xs text-gray-500 block">Description</label>
                <p className="mt-1 text-sm text-gray-300">{startup.description}</p>
              </div>
            )}
          </div>

          <div className="p-6 rounded-xl bg-gray-900 border border-gray-800">
            <h2 className="text-lg font-semibold text-white mb-4">Metrics</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-800/40 p-4 rounded-lg"><label className="text-xs text-gray-500 block mb-1">MRR</label><p className="text-xl font-bold text-white">${startup.mrr?.toLocaleString() || 0}</p></div>
              <div className="bg-gray-800/40 p-4 rounded-lg"><label className="text-xs text-gray-500 block mb-1">Users</label><p className="text-xl font-bold text-white">{startup.users?.toLocaleString() || 0}</p></div>
              <div className="bg-gray-800/40 p-4 rounded-lg"><label className="text-xs text-gray-500 block mb-1">Burn Rate</label><p className="text-xl font-bold text-white">${startup.burnRate?.toLocaleString() || 0}</p></div>
              <div className="bg-gray-800/40 p-4 rounded-lg"><label className="text-xs text-gray-500 block mb-1">Runway</label><p className="text-xl font-bold text-white">{startup.runway || 0} mos</p></div>
            </div>
          </div>

          {/* NEW: Outcome and Pivot Logger Form */}
          <div className="p-6 rounded-xl bg-gray-900 border border-gray-800 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">🔄 Registra un Pivot o Outcome</h2>
              <p className="text-xs text-gray-500 mt-0.5">Segnala un evento importante. L'OmniMemory Analyzer distillerà la causa dell'esito per migliorare tutti gli agenti.</p>
            </div>

            <form onSubmit={handleSubmitOutcome} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Esito/Stato dell'evento</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="growing">📈 Crescita / Trazione (Growing)</option>
                    <option value="pivot">🔄 Cambiamento Strategico (Pivot)</option>
                    <option value="stalled">⏳ Stallo / Rallentamento (Stalled)</option>
                    <option value="failed">❌ Chiusura Progetto (Failed)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Cosa è successo? Spiega i dettagli e le decisioni prese</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Es: Abbiamo ridotto i prezzi del 20% ed eliminato le feature inutili. Il tasso di conversione delle demo è raddoppiato nel giro di 2 settimane."
                  rows={3}
                  required
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium text-sm disabled:opacity-50 transition-colors"
              >
                {submitting ? "Analisi in corso con AI..." : "🚀 Invia ad OmniMemory"}
              </button>
            </form>

            {error && (
              <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 rounded-lg text-xs">
                ❌ Errore: {error}
              </div>
            )}

            {/* Analysis Result Display */}
            {analysis && (
              <div className="mt-4 p-5 bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-800/40 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    🧠 Report Analisi Causale: <span className="text-blue-400">"{analysis.title}"</span>
                  </h3>
                  <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded font-semibold">
                    Salvo in Piattaforma
                  </span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{analysis.analysis}</p>
                
                <div className="grid sm:grid-cols-2 gap-4 text-xs pt-2">
                  {analysis.keyFactors && analysis.keyFactors.length > 0 && (
                    <div>
                      <span className="font-bold text-green-400 block mb-1">🔑 Fattori Chiave Successo:</span>
                      <div className="flex flex-wrap gap-1">
                        {analysis.keyFactors.map((f: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 bg-green-500/10 text-green-300 rounded">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysis.failureModes && analysis.failureModes.length > 0 && (
                    <div>
                      <span className="font-bold text-red-400 block mb-1">⚠️ Errori da Evitare:</span>
                      <div className="flex flex-wrap gap-1">
                        {analysis.failureModes.map((f: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 bg-red-500/10 text-red-300 rounded">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Active Agents list */}
        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-gray-900 border border-gray-800">
            <h2 className="text-lg font-semibold text-white mb-4">Active Agents</h2>
            <div className="space-y-2">
              {startup.agentConfigs?.map((agent: any) => (
                <div key={agent.id} className={`p-3 rounded-lg border flex items-center justify-between ${agent.isActive ? "border-green-500/30 bg-green-500/5 text-green-400" : "border-gray-800 text-gray-500"}`}>
                  <div>
                    <p className="font-medium text-sm">{agent.name}</p>
                    <p className="text-xs text-gray-500">{agent.type}</p>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${agent.isActive ? "bg-green-500" : "bg-gray-600"}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
