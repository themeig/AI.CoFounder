"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Startup {
  id: string;
  name: string;
  sector: string;
  phase: string;
  mrr: number;
  users: number;
  burnRate: number;
  runway: number;
  agentConfigs: { id: string; type: string; name: string; isActive: boolean }[];
}

const METRIC_COLORS = {
  mrr: { bg: "#E8F0FE", icon: "#1A73E8", label: "MRR" },
  users: { bg: "#E6F4EA", icon: "#34A853", label: "Utenti" },
  agents: { bg: "#FEF7E0", icon: "#F9AB00", label: "Agenti Attivi" },
  runway: { bg: "#FCE8E6", icon: "#EA4335", label: "Runway (mesi)" },
};

function MetricCard({ label, value, bg, icon, sub }: { label: string; value: string; bg: string; icon: string; sub?: string }) {
  return (
    <div
      className="p-5 rounded-xl flex items-start gap-4"
      style={{ background: "#FFFFFF", border: "1px solid #E8EAED", boxShadow: "0 1px 2px rgba(60,64,67,0.10)" }}
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
        <span className="text-lg" style={{ color: icon }}>{icon === "#1A73E8" ? "💶" : icon === "#34A853" ? "👥" : icon === "#F9AB00" ? "🤖" : "📅"}</span>
      </div>
      <div>
        <p className="text-xs font-medium mb-0.5" style={{ color: "#5F6368" }}>{label}</p>
        <p className="text-2xl font-bold leading-tight" style={{ color: "#202124" }}>{value}</p>
        {sub && <p className="text-[11px] mt-0.5" style={{ color: "#9AA0AC" }}>{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardHome() {
  const [startup, setStartup] = useState<Startup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/demo/startup")
      .then((res) => res.json())
      .then((data) => {
        setStartup(Array.isArray(data) && data.length > 0 ? data[0] : null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 rounded-full border-2 border-[#1A73E8] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!startup) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="p-8 rounded-xl text-center" style={{ background: "#FFFFFF", border: "1px solid #E8EAED" }}>
          <p className="text-sm" style={{ color: "#5F6368" }}>Nessuna startup trovata. Riprova.</p>
          <Link href="/login" className="btn-primary mt-4 inline-flex">Ricomincia</Link>
        </div>
      </div>
    );
  }

  const activeAgents = startup.agentConfigs?.filter((a) => a.isActive) ?? [];

  const quickActions = [
    {
      href: "/dashboard/agents",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" style={{ color: "#1A73E8" }}>
          <path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3zm-2 10H6V7h12v12zm-9-6c-.83 0-1.5-.67-1.5-1.5S8.17 10 9 10s1.5.67 1.5 1.5S9.83 13 9 13zm7.5-1.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zM8 15h8v2H8v-2z"/>
        </svg>
      ),
      title: "Parla con gli Agenti",
      desc: "Consulta i tuoi esperti AI per strategia, tech, finanza e marketing",
      bg: "#E8F0FE",
    },
    {
      href: "/dashboard/memory",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" style={{ color: "#34A853" }}>
          <path d="M12 2c-4.42 0-8 3.58-8 8 0 2.93 1.58 5.5 3.93 6.93V21h8.14v-4.07C18.42 15.5 20 12.93 20 10c0-4.42-3.58-8-8-8zm2 14.5v2.5h-4v-2.5C7.36 15.16 6 12.71 6 10c0-3.31 2.69-6 6-6s6 2.69 6 6c0 2.71-1.36 5.16-4 6.5z"/>
        </svg>
      ),
      title: "Memoria & Conoscenza",
      desc: "Pattern da migliaia di startup, ricordi estratti e playbook strategici",
      bg: "#E6F4EA",
    },
    {
      href: "/dashboard/startup",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" style={{ color: "#F9AB00" }}>
          <path d="M13 2.05v2.02c3.95.49 7 3.85 7 7.93 0 3.21-1.81 6-4.72 7.28L13 17v5h5l-1.22-1.22C19.91 19.07 22 15.76 22 12c0-5.18-3.95-9.45-9-9.95zM11 2.05C5.95 2.55 2 6.82 2 12c0 3.76 2.09 7.07 5.22 8.78L6 22h5V2.05z"/>
        </svg>
      ),
      title: "Profilo Startup",
      desc: "Tieni aggiornate le metriche e registra pivot ed eventi chiave",
      bg: "#FEF7E0",
    },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="chip chip-blue">{startup.sector?.toUpperCase()}</span>
            <span className="chip chip-gray">{startup.phase?.toUpperCase()}</span>
          </div>
          <h1 className="text-display">{startup.name}</h1>
          <p className="text-body mt-1">Panoramica delle metriche e accesso rapido alle funzioni</p>
        </div>
        <Link
          href="/dashboard/agents"
          className="btn-primary"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3z"/>
          </svg>
          Apri Chat
        </Link>
      </div>

      {/* ── Metrics ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="MRR"
          value={`$${(startup.mrr ?? 0).toLocaleString()}`}
          bg="#E8F0FE"
          icon="#1A73E8"
        />
        <MetricCard
          label="Utenti"
          value={(startup.users ?? 0).toLocaleString()}
          bg="#E6F4EA"
          icon="#34A853"
        />
        <MetricCard
          label="Agenti Attivi"
          value={String(activeAgents.length)}
          bg="#FEF7E0"
          icon="#F9AB00"
          sub="Configurazioni attive"
        />
        <MetricCard
          label="Runway"
          value={`${startup.runway ?? 0} mesi`}
          bg="#FCE8E6"
          icon="#EA4335"
          sub={startup.burnRate ? `Burn: $${startup.burnRate.toLocaleString()}/mo` : undefined}
        />
      </div>

      {/* ── Quick Actions ───────────────────────────────────────── */}
      <div>
        <h2 className="text-title mb-4">Azioni rapide</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href} passHref legacyBehavior>
              <a
                className="p-5 rounded-xl flex gap-4 transition-all group"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E8EAED",
                  boxShadow: "0 1px 2px rgba(60,64,67,0.10)",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(60,64,67,0.15)";
                  e.currentTarget.style.borderColor = "#DADCE0";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "0 1px 2px rgba(60,64,67,0.10)";
                  e.currentTarget.style.borderColor = "#E8EAED";
                }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: action.bg }}>
                  {action.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm mb-1" style={{ color: "#202124" }}>{action.title}</div>
                  <div className="text-xs leading-relaxed" style={{ color: "#5F6368" }}>{action.desc}</div>
                </div>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0 mt-1 opacity-30 group-hover:opacity-100 transition-opacity" style={{ color: "#5F6368" }}>
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                </svg>
              </a>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Active Agents ───────────────────────────────────────── */}
      {activeAgents.length > 0 && (
        <div>
          <h2 className="text-title mb-4">Team Agenti</h2>
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: "#FFFFFF", border: "1px solid #E8EAED", boxShadow: "0 1px 2px rgba(60,64,67,0.10)" }}
          >
            {activeAgents.map((agent, i) => (
              <Link key={agent.id} href="/dashboard/agents" passHref legacyBehavior>
                <a
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors"
                  style={{
                    borderBottom: i < activeAgents.length - 1 ? "1px solid #F1F3F4" : "none",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#F8F9FA")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{
                      background: agent.type === "strategy" ? "#1A73E8" : agent.type === "tech" ? "#34A853" : agent.type === "finance" ? "#F9AB00" : "#EA4335",
                    }}
                  >
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: "#202124" }}>{agent.name}</div>
                    <div className="text-xs" style={{ color: "#5F6368" }}>{agent.type} agent</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#34A853" }} />
                    <span className="text-xs" style={{ color: "#34A853", fontWeight: 500 }}>Attivo</span>
                  </div>
                </a>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
