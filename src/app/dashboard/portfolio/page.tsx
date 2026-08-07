"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface StartupItem {
  id: string;
  name: string;
  description: string;
  sector: string;
  phase: string;
  mrr: number;
  users: number;
  burnRate: number;
  runway: number;
  exitValuation?: number;
  createdAt?: string;
}

interface Stats {
  totalStartups: number;
  activeCount: number;
  soldCount: number;
  failedCount: number;
  totalUsers: number;
  totalMrr: number;
  totalExitValuation: number;
}

export default function PortfolioPage() {
  const [startups, setStartups] = useState<StartupItem[]>([]);
  const [activeStartupId, setActiveStartupId] = useState<string>("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingStartup, setEditingStartup] = useState<StartupItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    sector: "SaaS",
    phase: "pre-seed",
    mrr: 0,
    users: 0,
    burnRate: 0,
    runway: 12,
    exitValuation: 0,
    description: "",
    makeActive: true
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchPortfolio = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/demo/startups");
      const data = await res.json();
      if (data.startups) {
        setStartups(data.startups);
        setActiveStartupId(data.activeStartupId);
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Error fetching portfolio:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const handleMakeActive = async (id: string) => {
    try {
      document.cookie = `active_startup_id=${encodeURIComponent(id)}; path=/; max-age=31536000`;
      const res = await fetch("/api/demo/startups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, makeActive: true })
      });
      if (res.ok) {
        setActiveStartupId(id);
        window.dispatchEvent(new Event("startup-metrics-updated"));
      }
    } catch (err) {
      console.error("Error switching startup:", err);
    }
  };

  const handleSaveStartup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      if (editingStartup) {
        // Edit mode
        const res = await fetch("/api/demo/startups", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingStartup.id, ...formData })
        });
        if (res.ok) {
          setEditingStartup(null);
          fetchPortfolio();
          window.dispatchEvent(new Event("startup-metrics-updated"));
        }
      } else {
        // Create mode
        const res = await fetch("/api/demo/startups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });
        if (res.ok) {
          setShowCreateModal(false);
          fetchPortfolio();
          window.dispatchEvent(new Event("startup-metrics-updated"));
        }
      }
    } catch (err) {
      console.error("Error saving startup:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStartup = async (id: string) => {
    try {
      const res = await fetch(`/api/demo/startups?id=${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setDeletingId(null);
        fetchPortfolio();
        window.dispatchEvent(new Event("startup-metrics-updated"));
      }
    } catch (err) {
      console.error("Error deleting startup:", err);
    }
  };

  const openCreateModal = () => {
    setEditingStartup(null);
    setFormData({
      name: "",
      sector: "SaaS",
      phase: "pre-seed",
      mrr: 0,
      users: 0,
      burnRate: 0,
      runway: 12,
      exitValuation: 0,
      description: "",
      makeActive: true
    });
    setShowCreateModal(true);
  };

  const openEditModal = (s: StartupItem) => {
    setEditingStartup(s);
    setFormData({
      name: s.name,
      sector: s.sector,
      phase: s.phase,
      mrr: s.mrr,
      users: s.users,
      burnRate: s.burnRate,
      runway: s.runway,
      exitValuation: s.exitValuation || 0,
      description: s.description || "",
      makeActive: false
    });
    setShowCreateModal(true);
  };

  const getPhaseBadge = (phase: string) => {
    const p = phase.toLowerCase();
    if (p === "sold" || p === "exit") {
      return { label: "💰 Venduta (Exit)", bg: "#FEF7E0", color: "#B45309", border: "#FCD34D" };
    }
    if (p === "failed" || p === "halted") {
      return { label: "🛑 Interrotta / Fallita", bg: "#FCE8E6", color: "#C5221F", border: "#F7CECE" };
    }
    if (p === "profitable") {
      return { label: "🎯 Profittabile", bg: "#E6F4EA", color: "#137333", border: "#CEEAD6" };
    }
    return { label: `🚀 ${phase.toUpperCase()}`, bg: "#E8F0FE", color: "#1A73E8", border: "#C5D9F9" };
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F0FE] text-[#1A73E8]">
              Portfolio Founder
            </span>
            <span className="text-xs font-mono text-[#5F6368]">
              {startups.length} Startup totali
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#202124]">🚀 Le mie Startup & Portfolio</h1>
          <p className="text-xs text-[#5F6368] mt-1">
            Gestisci, seleziona, crea ed analizza le tue startup attive, vendute e concluse.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-[#DADCE0] text-[#5F6368] hover:bg-white transition shadow-xs">
            ← Ritorna alla Home
          </Link>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-[#1A73E8] text-white hover:bg-[#1557B0] transition shadow-xs flex items-center gap-1.5"
          >
            <span>➕</span>
            <span>Crea Nuova Startup</span>
          </button>
        </div>
      </div>

      {/* ── Statistics KPI Cards Bar ──────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Active Startups */}
          <div className="p-4 rounded-xl border border-[#E8EAED] bg-white shadow-xs">
            <div className="flex items-center justify-between text-[#5F6368] mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">In Corso</span>
              <span className="text-base">🚀</span>
            </div>
            <p className="text-2xl font-bold text-[#202124]">{stats.activeCount}</p>
            <p className="text-[10px] text-[#34A853] font-semibold mt-0.5">Startup attive</p>
          </div>

          {/* Sold Startups */}
          <div className="p-4 rounded-xl border border-[#FCD34D] bg-[#FEF7E0] shadow-xs">
            <div className="flex items-center justify-between text-[#B45309] mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Vendute (Exit)</span>
              <span className="text-base">💰</span>
            </div>
            <p className="text-2xl font-bold text-[#B45309]">{stats.soldCount}</p>
            <p className="text-[10px] text-[#B45309] font-semibold mt-0.5">
              Valore Exit: ${stats.totalExitValuation.toLocaleString()}
            </p>
          </div>

          {/* Failed Startups */}
          <div className="p-4 rounded-xl border border-[#F7CECE] bg-[#FCE8E6] shadow-xs">
            <div className="flex items-center justify-between text-[#C5221F] mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Interrotte</span>
              <span className="text-base">🛑</span>
            </div>
            <p className="text-2xl font-bold text-[#C5221F]">{stats.failedCount}</p>
            <p className="text-[10px] text-[#C5221F] font-semibold mt-0.5">Operazioni chiuse</p>
          </div>

          {/* Total Aggregate Users */}
          <div className="p-4 rounded-xl border border-[#E8EAED] bg-white shadow-xs">
            <div className="flex items-center justify-between text-[#5F6368] mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Totale Utenti</span>
              <span className="text-base">👥</span>
            </div>
            <p className="text-2xl font-bold text-[#202124]">{stats.totalUsers.toLocaleString()}</p>
            <p className="text-[10px] text-[#1A73E8] font-semibold mt-0.5">Utenti aggregati</p>
          </div>

          {/* Aggregate Total Revenue / MRR */}
          <div className="p-4 rounded-xl border border-[#CEEAD6] bg-[#E6F4EA] shadow-xs">
            <div className="flex items-center justify-between text-[#137333] mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">MRR Complessivo</span>
              <span className="text-base">💵</span>
            </div>
            <p className="text-2xl font-bold text-[#137333]">${stats.totalMrr.toLocaleString()}/mo</p>
            <p className="text-[10px] text-[#137333] font-semibold mt-0.5">ARR: ${(stats.totalMrr * 12).toLocaleString()}/yr</p>
          </div>
        </div>
      )}

      {/* ── Startups Grid Section ─────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-[#202124] flex items-center gap-2">
          <span>🏢 Elenco delle tue Startup ({startups.length})</span>
        </h2>

        {loading ? (
          <div className="py-12 text-center text-xs text-[#5F6368] flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-[#1A73E8] border-t-transparent rounded-full animate-spin" />
            <span>Caricamento portfolio in corso...</span>
          </div>
        ) : startups.length === 0 ? (
          <div className="p-8 rounded-2xl border border-[#E8EAED] bg-white text-center text-xs text-[#5F6368]">
            <p className="font-bold text-sm text-[#202124] mb-1">Nessuna startup trovata</p>
            <p className="mb-4">Non hai ancora aggiunto nessuna startup nel tuo portfolio.</p>
            <button onClick={openCreateModal} className="px-4 py-2 bg-[#1A73E8] text-white rounded-xl font-bold">
              ➕ Crea la tua Prima Startup
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {startups.map((s) => {
              const badge = getPhaseBadge(s.phase);
              const isActiveWorkspace = s.id === activeStartupId;

              return (
                <div
                  key={s.id}
                  className="p-5 rounded-2xl border bg-white flex flex-col justify-between space-y-4 transition-all hover:shadow-md"
                  style={{
                    borderColor: isActiveWorkspace ? "#1A73E8" : "#E8EAED",
                    boxShadow: isActiveWorkspace ? "0 0 0 2px rgba(26,115,232,0.2)" : "0 1px 3px rgba(60,64,67,0.08)"
                  }}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#F1F3F4] text-[#5F6368] uppercase">
                            {s.sector}
                          </span>
                          {isActiveWorkspace && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#1A73E8] text-white flex items-center gap-1">
                              <span>✓</span> Attiva nel Workspace
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-base text-[#202124] leading-tight">{s.name}</h3>
                      </div>

                      <span
                        className="px-2.5 py-1 rounded-full text-[10px] font-bold flex-shrink-0"
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`
                        }}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <p className="text-xs text-[#5F6368] line-clamp-2 leading-relaxed mb-3">
                      {s.description || "Nessuna descrizione specificata."}
                    </p>

                    {/* KPI metrics grid */}
                    <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-[#F8F9FA] border border-[#E8EAED] text-xs">
                      <div>
                        <span className="text-[10px] text-[#5F6368] uppercase font-semibold">MRR</span>
                        <p className="font-bold text-[#202124]">${(s.mrr || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#5F6368] uppercase font-semibold">Utenti</span>
                        <p className="font-bold text-[#202124]">{(s.users || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#5F6368] uppercase font-semibold">Burn Rate</span>
                        <p className="font-semibold text-[#5F6368]">${(s.burnRate || 0).toLocaleString()}/mo</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#5F6368] uppercase font-semibold">Runway</span>
                        <p className="font-semibold text-[#5F6368]">{s.runway || 0} mesi</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-[#E8EAED] flex items-center justify-between gap-2">
                    {!isActiveWorkspace ? (
                      <button
                        onClick={() => handleMakeActive(s.id)}
                        className="flex-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-[#E8F0FE] text-[#1A73E8] hover:bg-[#D2E3FC] transition text-center"
                      >
                        ⚡ Seleziona Attiva
                      </button>
                    ) : (
                      <span className="text-xs text-[#34A853] font-bold flex items-center gap-1">
                        <span>✓ Workspace Attivo</span>
                      </span>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(s)}
                        className="p-1.5 rounded-lg text-[#5F6368] hover:bg-[#F1F3F4] transition"
                        title="Modifica Dati"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setDeletingId(s.id)}
                        className="p-1.5 rounded-lg text-[#EA4335] hover:bg-[#FCE8E6] transition"
                        title="Elimina Startup"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal Crea / Modifica Startup ─────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-[#E8EAED]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8EAED]">
              <h3 className="font-bold text-base text-[#202124]">
                {editingStartup ? `✏️ Modifica Startup: ${editingStartup.name}` : "➕ Crea Nuova Startup"}
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-xs text-[#5F6368] hover:text-[#202124]">
                ✕ Chiudi
              </button>
            </div>

            <form onSubmit={handleSaveStartup} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#202124] mb-1">Nome Startup *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Es. PayFlow AI, HealthSync, CloudScale"
                  className="w-full px-3 py-2 rounded-xl border border-[#DADCE0] focus:outline-none focus:border-[#1A73E8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Settore</label>
                  <select
                    value={formData.sector}
                    onChange={e => setFormData({ ...formData, sector: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#DADCE0] focus:outline-none"
                  >
                    <option value="SaaS">SaaS</option>
                    <option value="AI">AI & Machine Learning</option>
                    <option value="Fintech">Fintech</option>
                    <option value="E-Commerce">E-Commerce</option>
                    <option value="Healthtech">Healthtech</option>
                    <option value="Biotech">Biotech</option>
                    <option value="CleanTech">CleanTech</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Fase / Stato *</label>
                  <select
                    value={formData.phase}
                    onChange={e => setFormData({ ...formData, phase: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#DADCE0] focus:outline-none"
                  >
                    <option value="pre-seed">🚀 Pre-Seed (In corso)</option>
                    <option value="seed">🚀 Seed (In corso)</option>
                    <option value="mvp">🛠️ MVP / Beta (In corso)</option>
                    <option value="growth">📈 Growth / Scaling (In corso)</option>
                    <option value="profitable">🎯 Profittabile (In corso)</option>
                    <option value="sold">💰 Venduta (Exit / Acquisita)</option>
                    <option value="failed">🛑 Interrotta / Fallita</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">MRR ($)</label>
                  <input
                    type="number"
                    value={formData.mrr}
                    onChange={e => setFormData({ ...formData, mrr: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-[#DADCE0] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#202124] mb-1">Utenti Attivi</label>
                  <input
                    type="number"
                    value={formData.users}
                    onChange={e => setFormData({ ...formData, users: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-[#DADCE0] focus:outline-none"
                  />
                </div>
              </div>

              {(formData.phase === "sold" || formData.phase === "exit") && (
                <div>
                  <label className="block font-semibold text-[#B45309] mb-1">Valutazione Exit / Vendita ($)</label>
                  <input
                    type="number"
                    value={formData.exitValuation}
                    onChange={e => setFormData({ ...formData, exitValuation: Number(e.target.value) })}
                    placeholder="Es. 4200000 per 4.2M$"
                    className="w-full px-3 py-2 rounded-xl border border-[#FCD34D] bg-[#FEF7E0] focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-[#202124] mb-1">Descrizione Breve</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrivi brevemente la mission e il prodotto della startup..."
                  className="w-full px-3 py-2 rounded-xl border border-[#DADCE0] focus:outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#E8EAED]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#DADCE0] text-[#5F6368] font-semibold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#1A73E8] text-white font-bold hover:bg-[#1557B0] transition"
                >
                  {submitting ? "Salvataggio..." : editingStartup ? "Salva Modifiche" : "Crea Startup"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Elimina Startup ────────────────────────────── */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 text-center border border-[#E8EAED] shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-[#FCE8E6] text-[#EA4335] flex items-center justify-center text-xl mx-auto font-bold">
              🗑️
            </div>
            <h3 className="font-bold text-base text-[#202124]">Eliminare questa Startup?</h3>
            <p className="text-xs text-[#5F6368]">
              Sei sicuro di voler rimuovere questa startup dal tuo portfolio? L'azione non potrà essere annullata.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2 rounded-xl border border-[#DADCE0] text-xs font-semibold text-[#5F6368]"
              >
                Annulla
              </button>
              <button
                onClick={() => handleDeleteStartup(deletingId)}
                className="flex-1 py-2 rounded-xl bg-[#EA4335] text-white text-xs font-bold hover:bg-[#C5221F]"
              >
                Sì, Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
