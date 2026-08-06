"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/LanguageContext";

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

interface Pulse {
  id: string;
  type: "warning" | "critical" | "idea" | "positive" | "action";
  title: string;
  body: string;
  priority: "high" | "medium" | "low";
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  actionText?: string;
}

interface BriefingSpeakerUpdate {
  agentId: string;
  agentType: string;
  agentName: string;
  roleTitle: string;
  avatarIcon: string;
  avatarBg: string;
  message: string;
  keyPoints: string[];
}

interface DailyBriefing {
  id: string;
  date: string;
  timestamp: string;
  cofounderIntro: string;
  employeeUpdates: BriefingSpeakerUpdate[];
  cofounderSummary: string;
  actionItems: string[];
  read: boolean;
}

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
  const { t, language } = useTranslation();
  const [startup, setStartup] = useState<Startup | null>(null);
  const [loading, setLoading] = useState(true);

  // Heartbeat state
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "warning" | "idea" | "positive" | "action">("all");

  // Daily Standup Briefing state
  const [todayBriefing, setTodayBriefing] = useState<DailyBriefing | null>(null);
  const [runningBriefing, setRunningBriefing] = useState(false);
  const [showMeetingRoom, setShowMeetingRoom] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [calendarSyncResult, setCalendarSyncResult] = useState<string | null>(null);

  // Google Calendar state
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [calendarFilter, setCalendarFilter] = useState<'startup' | 'all'>('startup');
  const [calendarLoading, setCalendarLoading] = useState(true);

  useEffect(() => {
    setCalendarLoading(true);
    fetch(`/api/demo/calendar${calendarFilter === 'startup' ? '?startupOnly=true' : ''}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.events)) {
          setCalendarEvents(data.events);
        }
      })
      .catch(() => {})
      .finally(() => setCalendarLoading(false));
  }, [calendarFilter]);

  const handleSyncToCalendar = async () => {
    if (!todayBriefing) return;
    setSyncingCalendar(true);
    setCalendarSyncResult(null);
    try {
      const res = await fetch("/api/demo/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "sync_standup",
          actionItems: todayBriefing.actionItems
        })
      });
      const data = await res.json();
      if (res.ok) {
        setCalendarSyncResult(data.message || "✓ Sincronizzato su Google Calendar!");
      }
    } catch (err: any) {
      setCalendarSyncResult("Errore durante la sincronizzazione");
    } finally {
      setSyncingCalendar(false);
    }
  };

  const fetchBriefing = () => {
    fetch("/api/demo/heartbeat/briefing")
      .then((res) => res.json())
      .then((data) => {
        if (data.todayBriefing) {
          setTodayBriefing(data.todayBriefing);
        }
      })
      .catch((err) => console.error("Error loading briefing:", err));
  };

  const handleRunBriefing = async () => {
    setRunningBriefing(true);
    try {
      const res = await fetch("/api/demo/heartbeat/briefing", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.briefing) {
        setTodayBriefing(data.briefing);
        setShowMeetingRoom(true);
        window.dispatchEvent(new Event("heartbeat-updated"));
      }
    } catch (err) {
      console.error("Error running briefing:", err);
    } finally {
      setRunningBriefing(false);
    }
  };

  const fetchPulses = () => {
    fetch("/api/demo/heartbeat")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.pulses)) {
          setPulses(data.pulses);
          setLastRunAt(data.lastRunAt || null);
        }
      })
      .catch((err) => console.error("Error loading pulses:", err));
  };

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/demo/heartbeat", { method: "POST" });
      const data = await res.json();
      if (res.ok && Array.isArray(data.pulses)) {
        setPulses(data.pulses);
        setLastRunAt(data.lastRunAt);
        window.dispatchEvent(new Event("heartbeat-updated"));
      }
    } catch (err) {
      console.error("Error running heartbeat analysis:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/demo/heartbeat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true })
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.pulses)) {
        setPulses(data.pulses);
        window.dispatchEvent(new Event("heartbeat-updated"));
      }
    } catch (err) {
      console.error("Error marking pulses read:", err);
    }
  };

  const handleMarkSingleRead = async (id: string) => {
    try {
      const res = await fetch("/api/demo/heartbeat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.pulses)) {
        setPulses(data.pulses);
        window.dispatchEvent(new Event("heartbeat-updated"));
      }
    } catch (err) {
      console.error("Error marking pulse read:", err);
    }
  };

  useEffect(() => {
    fetch("/api/demo/startup")
      .then((res) => res.json())
      .then((data) => {
        setStartup(Array.isArray(data) && data.length > 0 ? data[0] : null);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetchPulses();
    fetchBriefing();
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
          <p className="text-sm" style={{ color: "#5F6368" }}>
            {language === "en" ? "No startup found. Please try again." : "Nessuna startup trovata. Riprova."}
          </p>
          <Link href="/login" className="btn-primary mt-4 inline-flex">
            {language === "en" ? "Restart" : "Ricomincia"}
          </Link>
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
          <path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3zm-2 10H6V7h12v12zm-9-6c-.83 0-1.5-.67-1.5-1.5S8.17 10 9 10s1.5.67 1.5 1.5S9.83 13 9 13zm7.5-1.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5.67 1.5 1.5zM8 15h8v2H8v-2z"/>
        </svg>
      ),
      title: t("dashboard.talkToAgents", "Talk to Employees"),
      desc: t("dashboard.talkToAgentsDesc", "Consult your specialized AI experts for strategy, tech, finance, and marketing"),
      bg: "#E8F0FE",
    },
    {
      href: "/dashboard/memory",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" style={{ color: "#34A853" }}>
          <path d="M12 2c-4.42 0-8 3.58-8 8 0 2.93 1.58 5.5 3.93 6.93V21h8.14v-4.07C18.42 15.5 20 12.93 20 10c0-4.42-3.58-8-8-8zm2 14.5v2.5h-4v-2.5C7.36 15.16 6 12.71 6 10c0-3.31 2.69-6 6-6s6 2.69 6 6c0 2.71-1.36 5.16-4 6.5z"/>
        </svg>
      ),
      title: t("dashboard.memoryKnowledge", "Memory & Knowledge"),
      desc: t("dashboard.memoryKnowledgeDesc", "Startup patterns from thousands of companies, extracted memories, and playbooks"),
      bg: "#E6F4EA",
    },
    {
      href: "/dashboard/startup",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" style={{ color: "#F9AB00" }}>
          <path d="M13 2.05v2.02c3.95.49 7 3.85 7 7.93 0 3.21-1.81 6-4.72 7.28L13 17v5h5l-1.22-1.22C19.91 19.07 22 15.76 22 12c0-5.18-3.95-9.45-9-9.95zM11 2.05C5.95 2.55 2 6.82 2 12c0 3.76 2.09 7.07 5.22 8.78L6 22h5V2.05z"/>
        </svg>
      ),
      title: t("dashboard.startupProfile", "Startup Profile"),
      desc: t("dashboard.startupProfileDesc", "Keep key metrics updated and log milestones and pivots"),
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
          <p className="text-body mt-1">
            {t("dashboard.subtitle", "Track your startup progress, AI employees, and key strategic metrics")}
          </p>
        </div>
        <Link
          href="/dashboard/agents"
          className="btn-primary"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3z"/>
          </svg>
          {language === "en" ? "Open Chat" : "Apri Chat"}
        </Link>
      </div>

      {/* ── Metrics ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="MRR"
          value={`$${(startup.mrr ?? 0).toLocaleString()}`}
          bg="#E8F0FE"
          icon="#1A73E8"
          sub={language === "en" ? "Monthly Recurring" : "Ricorrente Mensile"}
        />
        <MetricCard
          label={language === "en" ? "Users" : "Utenti"}
          value={(startup.users ?? 0).toLocaleString()}
          bg="#E6F4EA"
          icon="#34A853"
          sub={language === "en" ? "Registered accounts" : "Account registrati"}
        />
        <MetricCard
          label={language === "en" ? "Active Employees" : "Agenti Attivi"}
          value={`${activeAgents.length} / ${startup.agentConfigs?.length ?? 0}`}
          bg="#FEF7E0"
          icon="#F9AB00"
          sub={language === "en" ? "Configured team" : "Team configurato"}
        />
        <MetricCard
          label={language === "en" ? "Runway" : "Runway"}
          value={`${startup.runway ?? 0} ${language === "en" ? "months" : "mesi"}`}
          bg="#FCE8E6"
          icon="#EA4335"
          sub={`Burn: $${(startup.burnRate ?? 0).toLocaleString()}/mo`}
        />
      </div>

      {/* ── Google Calendar Startup Events Widget ───────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #E8EAED", boxShadow: "0 1px 3px rgba(60,64,67,0.08)" }}>
        {/* Header */}
        <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ background: "#F8F9FA", borderBottom: "1px solid #E8EAED" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center text-lg font-bold shadow-xs">
              📅
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm" style={{ color: "#202124" }}>
                  {language === "en" ? "Startup Calendar Events" : "Eventi Google Calendar Startup"}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F0FE] text-[#1A73E8]">
                  {calendarFilter === 'startup' ? '💼 Solo Startup' : '🌐 Tutti gli Eventi'}
                </span>
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: "#5F6368" }}>
                {language === "en"
                  ? "Salient startup & business meetings separated from personal calendar events"
                  : "Eventi salienti della startup separati dagli appuntamenti personali"}
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#F1F3F4]">
            <button
              onClick={() => setCalendarFilter('startup')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                calendarFilter === 'startup'
                  ? 'bg-white text-[#1A73E8] shadow-xs'
                  : 'text-[#5F6368] hover:text-[#202124]'
              }`}
            >
              💼 Solo Startup
            </button>
            <button
              onClick={() => setCalendarFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                calendarFilter === 'all'
                  ? 'bg-white text-[#202124] shadow-xs'
                  : 'text-[#5F6368] hover:text-[#202124]'
              }`}
            >
              🌐 Tutti gli Eventi
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {calendarLoading ? (
            <div className="py-8 text-center text-xs text-[#5F6368] flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-[#1A73E8] border-t-transparent rounded-full animate-spin" />
              <span>Sincronizzazione eventi Google Calendar in corso...</span>
            </div>
          ) : calendarEvents.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#5F6368]">
              <p className="font-semibold text-sm text-[#202124] mb-1">Nessun evento {calendarFilter === 'startup' ? 'startup' : ''} trovato</p>
              <p>Non ci sono impegni {calendarFilter === 'startup' ? 'flaggati per la startup' : 'in agenda'}.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {calendarEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3"
                  style={{
                    background: evt.isStartup ? "#F8FAFF" : "#FFFFFF",
                    borderColor: evt.isStartup ? "#C5D9F9" : "#E8EAED"
                  }}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="font-semibold text-xs leading-snug" style={{ color: "#202124" }}>
                        {evt.summary}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0 ${
                        evt.isStartup ? "bg-[#E8F0FE] text-[#1A73E8]" : "bg-[#F1F3F4] text-[#5F6368]"
                      }`}>
                        {evt.isStartup ? "🚀 Startup" : "👤 Personale"}
                      </span>
                    </div>
                    {evt.description && (
                      <p className="text-[11px] line-clamp-2 leading-relaxed" style={{ color: "#5F6368" }}>
                        {evt.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-between text-[10.5px] border-t border-[#E8EAED]" style={{ color: "#5F6368" }}>
                    <div className="flex items-center gap-1.5">
                      <span>🕒</span>
                      <span>{new Date(evt.start).toLocaleString("it-IT", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    {evt.googleCalendarDirectLink ? (
                      <a
                        href={evt.googleCalendarDirectLink}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#E8F0FE] text-[#1A73E8] font-bold text-[10px] hover:underline"
                      >
                        <span>➕ Google Calendar ↗</span>
                      </a>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span>📍</span>
                        <span className="truncate max-w-[120px]">{evt.location || "Google Meet"}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Daily Standup Meeting Room (Multi-Agent Team Briefing) ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #E8EAED", boxShadow: "0 1px 3px rgba(60,64,67,0.08)" }}>
        {/* Meeting Header */}
        <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ background: "#F8F9FA", borderBottom: "1px solid #E8EAED" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center text-lg font-bold shadow-xs">
              🎙️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm" style={{ color: "#202124" }}>
                  {language === "en" ? "Daily Team Briefing" : "Riunione Giornaliera del Team (Daily Standup)"}
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${todayBriefing ? "bg-[#34A853] text-white" : "bg-[#F9AB00] text-white"}`}>
                  {todayBriefing ? "✓ Riunione di Oggi Svolta" : "○ In attesa dello standup di oggi"}
                </span>
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: "#5F6368" }}>
                {language === "en"
                  ? "The coFounder moderates a daily standup where all active AI employees pitch updates and actionable items."
                  : "Il coFounder raduna tutti i dipendenti AI per un breve punto della situazione e formula gli Action Item del giorno."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunBriefing}
              disabled={runningBriefing}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-[#137333] text-white hover:bg-[#0D5224] transition disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap shadow-xs"
            >
              {runningBriefing ? (
                <>
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                  </svg>
                  <span>Riunione in corso...</span>
                </>
              ) : (
                <>
                  <span>🎙️</span>
                  <span>{todayBriefing ? "Rigenera Standup di Oggi" : "Avvia Riunione di Oggi"}</span>
                </>
              )}
            </button>

            {todayBriefing && (
              <button
                onClick={() => setShowMeetingRoom(!showMeetingRoom)}
                className="px-3.5 py-2 text-xs font-medium rounded-xl text-[#5F6368] hover:bg-[#E8EAED] transition whitespace-nowrap"
                style={{ border: "1px solid #DADCE0" }}
              >
                {showMeetingRoom ? "Nascondi Verbale" : "Apri Sala Riunioni"}
              </button>
            )}
          </div>
        </div>

        {/* Meeting Content Room */}
        {todayBriefing && (showMeetingRoom || !todayBriefing) && (
          <div className="p-6 space-y-6">

            {/* 1. coFounder Opening Speech */}
            <div className="p-4 rounded-xl flex items-start gap-3.5" style={{ background: "#F4F7FE", border: "1px solid #C5D9F9" }}>
              <div className="w-9 h-9 rounded-xl bg-[#1A73E8] text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-xs">
                👔
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs" style={{ color: "#1A73E8" }}>coFounder (Moderatore Riunione)</span>
                  <span className="text-[10px] text-[#9AA0A6] font-mono">
                    {new Date(todayBriefing.timestamp).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-xs leading-relaxed italic" style={{ color: "#202124" }}>
                  "{todayBriefing.cofounderIntro}"
                </p>
              </div>
            </div>

            {/* 2. Employee Team Briefings Grid */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#5F6368" }}>
                🗣️ Brief dei Dipendenti AI ({todayBriefing.employeeUpdates.length} interventi):
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {todayBriefing.employeeUpdates.map((emp, idx) => (
                  <div key={idx} className="p-4 rounded-xl space-y-2.5 transition hover:shadow-sm" style={{ background: "#F8F9FA", border: "1px solid #E8EAED" }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: emp.avatarBg || "#E8F0FE" }}>
                        {emp.avatarIcon || "🤖"}
                      </div>
                      <div>
                        <p className="font-bold text-xs leading-tight" style={{ color: "#202124" }}>{emp.agentName}</p>
                        <p className="text-[10px]" style={{ color: "#9AA0A6" }}>{emp.roleTitle}</p>
                      </div>
                    </div>

                    <p className="text-xs leading-relaxed" style={{ color: "#5F6368" }}>
                      "{emp.message}"
                    </p>

                    {emp.keyPoints && emp.keyPoints.length > 0 && (
                      <div className="pt-2 border-t border-[#E8EAED] space-y-1">
                        {emp.keyPoints.map((pt, pIdx) => (
                          <div key={pIdx} className="flex items-center gap-1.5 text-[10px]" style={{ color: "#202124" }}>
                            <span style={{ color: "#34A853" }}>✓</span>
                            <span>{pt}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Executive Summary & Action Items for the Founder */}
            <div className="p-5 rounded-xl space-y-3" style={{ background: "#E6F4EA", border: "1px solid #CEEAD6" }}>
              <div className="flex items-center gap-2 text-[#137333]">
                <span className="text-base">🎯</span>
                <h4 className="font-bold text-xs uppercase tracking-wider">Sintesi coFounder & Action Items per il Founder:</h4>
              </div>
              <p className="text-xs text-[#202124] leading-relaxed">
                {todayBriefing.cofounderSummary}
              </p>
              <div className="space-y-2 pt-2 border-t border-[#CEEAD6]">
                {todayBriefing.actionItems.map((action, aIdx) => (
                  <div key={aIdx} className="flex items-start gap-2.5 p-2 rounded-lg bg-white/80 border border-[#CEEAD6] text-xs" style={{ color: "#202124" }}>
                    <input type="checkbox" className="mt-0.5 rounded text-[#137333] cursor-pointer" />
                    <span className="font-medium">{action}</span>
                  </div>
                ))}
              </div>

              {/* Google Calendar Sync Button */}
              <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSyncToCalendar}
                  disabled={syncingCalendar}
                  className="px-3.5 py-2 text-xs font-bold rounded-lg bg-[#137333] text-white hover:bg-[#0D5224] transition disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                >
                  {syncingCalendar ? "Sincronizzazione..." : "📅 Sincronizza Standup su Google Calendar"}
                </button>

                {calendarSyncResult && (
                  <span className="text-xs font-semibold text-[#137333] animate-fade-in">
                    {calendarSyncResult}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {!todayBriefing && (
          <div className="p-8 text-center space-y-3">
            <p className="text-xs text-[#5F6368]">
              Nessuna riunione svolta per oggi. Fai clic su <strong>"Avvia Riunione di Oggi"</strong> per radunare il team di dipendenti AI e ricevere il brief giornaliero.
            </p>
          </div>
        )}
      </div>

      {/* ── Startup Heartbeat (AI Monitor & Insights) ──────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #E8EAED", boxShadow: "0 1px 3px rgba(60,64,67,0.08)" }}>
        {/* Heartbeat Header */}
        <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ background: "#F8F9FA", borderBottom: "1px solid #E8EAED" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FCE8E6] text-[#EA4335] flex items-center justify-center text-lg font-bold shadow-xs">
              <span className="animate-pulse">🫀</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm" style={{ color: "#202124" }}>
                  {language === "en" ? "Startup Heartbeat" : "Battito Cardiaco Startup"}
                </h2>
                {pulses.filter((p) => !p.read).length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EA4335] text-white animate-pulse">
                    {pulses.filter((p) => !p.read).length} nuovi avvisi
                  </span>
                )}
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: "#5F6368" }}>
                {language === "en"
                  ? "Real-time AI monitoring: warning signals, growth ideas, and strategic recommendations"
                  : "Monitoraggio AI continuo: segnalazione criticità, idee di crescita e avvisi strategici"}
                {lastRunAt && (
                  <span className="ml-2 text-[10px] font-mono" style={{ color: "#9AA0A6" }}>
                    • Ultimo battito: {new Date(lastRunAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunAnalysis}
              disabled={analyzing}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-[#1A73E8] text-white hover:bg-[#1557B0] transition disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap shadow-xs"
            >
              {analyzing ? (
                <>
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                  </svg>
                  <span>Analisi in corso...</span>
                </>
              ) : (
                <>
                  <span>🫀</span>
                  <span>Analizza Ora</span>
                </>
              )}
            </button>

            {pulses.some((p) => !p.read) && (
              <button
                onClick={handleMarkAllRead}
                className="px-3 py-2 text-xs font-medium rounded-xl text-[#5F6368] hover:bg-[#E8EAED] transition whitespace-nowrap"
                style={{ border: "1px solid #DADCE0" }}
              >
                Segna tutti letti
              </button>
            )}
          </div>
        </div>

        {/* Filters bar */}
        <div className="px-6 py-2.5 flex items-center gap-1 overflow-x-auto border-b border-[#E8EAED]" style={{ background: "#FAFBFC" }}>
          {[
            { id: "all", label: "Tutti", icon: "📌" },
            { id: "warning", label: "Warning & Criticità", icon: "⚠️" },
            { id: "idea", label: "Idee & Opportunità", icon: "💡" },
            { id: "positive", label: "Segnali Positivi", icon: "✅" },
            { id: "action", label: "Azioni Consigliate", icon: "📋" },
          ].map((tab) => {
            const count = tab.id === "all" ? pulses.length : pulses.filter((p) => p.type === tab.id || (tab.id === "warning" && p.type === "critical")).length;
            const isSelected = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap ${
                  isSelected
                    ? "bg-[#E8F0FE] text-[#1A73E8] border border-blue-200"
                    : "text-[#5F6368] hover:bg-[#F1F3F4] border border-transparent"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isSelected ? "bg-[#1A73E8] text-white" : "bg-[#E8EAED] text-[#5F6368]"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Pulse Items List */}
        <div className="divide-y divide-[#E8EAED] max-h-96 overflow-y-auto custom-scrollbar">
          {pulses
            .filter((p) => activeFilter === "all" || p.type === activeFilter || (activeFilter === "warning" && p.type === "critical"))
            .map((pulse) => {
              const isUnread = !pulse.read;
              const typeConfig = {
                warning: { bg: "#FEF7E0", border: "#FBBC04", text: "#E37400", icon: "⚠️", label: "Warning" },
                critical: { bg: "#FCE8E6", border: "#EA4335", text: "#C5221F", icon: "🚨", label: "Critico" },
                idea: { bg: "#E8F0FE", border: "#1A73E8", text: "#1A73E8", icon: "💡", label: "Idea" },
                positive: { bg: "#E6F4EA", border: "#34A853", text: "#137333", icon: "✅", label: "Positivo" },
                action: { bg: "#F3E8FD", border: "#9C27B0", text: "#7B1FA2", icon: "📋", label: "Azione" },
              }[pulse.type] || { bg: "#F8F9FA", border: "#DADCE0", text: "#5F6368", icon: "💬", label: "Insight" };

              return (
                <div
                  key={pulse.id}
                  onClick={() => handleMarkSingleRead(pulse.id)}
                  className={`p-5 transition-all flex items-start justify-between gap-4 cursor-pointer hover:bg-[#F8F9FA] ${
                    isUnread ? "bg-[#FFFBF5]" : "bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3.5 flex-1">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 mt-0.5" style={{ background: typeConfig.bg, border: `1px solid ${typeConfig.border}` }}>
                      {typeConfig.icon}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-tight uppercase" style={{ background: typeConfig.bg, color: typeConfig.text }}>
                          {typeConfig.label}
                        </span>
                        {pulse.priority === "high" && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-[#FCE8E6] text-[#C5221F]">
                            Alta Priorità
                          </span>
                        )}
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-[#EA4335] animate-pulse" title="Non letto" />
                        )}
                        <span className="text-[10px] text-[#9AA0A6] font-mono">
                          {new Date(pulse.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm" style={{ color: "#202124" }}>
                        {pulse.title}
                      </h3>
                      <p className="text-xs leading-relaxed" style={{ color: "#5F6368" }}>
                        {pulse.body}
                      </p>
                    </div>
                  </div>

                  {pulse.actionUrl && (
                    <Link
                      href={pulse.actionUrl}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkSingleRead(pulse.id);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#F1F3F4] text-[#1A73E8] hover:bg-[#E8F0FE] transition flex items-center gap-1 whitespace-nowrap flex-shrink-0"
                    >
                      <span>{pulse.actionText || "Vedi"}</span>
                      <span>→</span>
                    </Link>
                  )}
                </div>
              );
            })}

          {pulses.length === 0 && (
            <div className="p-8 text-center text-xs text-[#9AA0A6]">
              Nessun avviso al momento. Fai clic su "Analizza Ora" per avviare il monitoraggio AI.
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Actions Grid ─────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold mb-4" style={{ color: "#5F6368" }}>
          {language === "en" ? "QUICK ACTIONS" : "AZIONI RAPIDE"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="p-5 rounded-xl block transition-all group border border-[#E8EAED] hover:border-[#1A73E8] bg-white hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: action.bg }}>
                {action.icon}
              </div>
              <h3 className="font-semibold text-sm mb-1 group-hover:text-[#1A73E8] transition-colors" style={{ color: "#202124" }}>
                {action.title}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: "#5F6368" }}>
                {action.desc}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
