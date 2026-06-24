"use client";

import { useEffect, useState, useMemo } from "react";
import { DEFAULT_APP_SETTINGS } from "@/lib/settings";

interface Pattern {
  id: string; title: string; description: string; sector: string | null;
  phase: string | null; successRate: number; sampleSize: number; confidence: number;
  keyFactors: string[]; failureModes: string[]; avgTimeToOutcome: string | null; extractedBy: string;
}
interface Playbook {
  id: string; title: string; description: string; sector: string | null;
  phase: string | null; steps: any[]; successRate: number;
}
interface MemoryItem {
  id: string; agentConfigId: string; agentName: string; agentType: string;
  content: string; importance: number; scope: string; source: string; category: string; createdAt: string;
}

const CATEGORY_META: Record<string, { label: string; color: string; bg: string; border: string; keywords: string[] }> = {
  identity:    { label: "Identità & Team",      color: "#9334E6", bg: "#F3E8FF", border: "#E9D5FF", keywords: ["nome","chiamo","ruolo","team","ceo","cto","founder"] },
  business:    { label: "Business & Strategia", color: "#1A73E8", bg: "#E8F0FE", border: "#C5D9F9", keywords: ["business","mercato","target","strategia","b2b","saas","prodotto"] },
  tech:        { label: "Tecnologia & Stack",    color: "#17A2B8", bg: "#E0F7FA", border: "#B2EBF2", keywords: ["tech","stack","react","database","api","architettura","backend"] },
  finance:     { label: "Finanza & Budget",      color: "#34A853", bg: "#E6F4EA", border: "#CEEAD6", keywords: ["budget","revenue","funding","mrr","arr","profitto"] },
  contacts:    { label: "Contatti & Link",       color: "#F9AB00", bg: "#FEF7E0", border: "#FDE293", keywords: ["email","linkedin","twitter","sito","url","contatto"] },
  preferences: { label: "Preferenze & Stile",   color: "#EA4335", bg: "#FCE8E6", border: "#F7CECE", keywords: ["preferisce","piace","stile","ama","favorito"] },
  decisions:   { label: "Decisioni & Pivot",    color: "#FF6D00", bg: "#FFF3E0", border: "#FFE0B2", keywords: ["decisione","deciso","pivot","cambiato","approvato"] },
  milestones:  { label: "Milestone & Scadenze", color: "#00897B", bg: "#E0F2F1", border: "#B2DFDB", keywords: ["lancio","deadline","obiettivo","milestone","beta","release"] },
  general:     { label: "Generali",             color: "#5F6368", bg: "#F1F3F4", border: "#E8EAED", keywords: [] },
};

function inferCategory(content: string): string {
  const lower = content.toLowerCase();
  let best = "general"; let bestScore = 0;
  for (const [key, cfg] of Object.entries(CATEGORY_META)) {
    if (key === "general") continue;
    const score = cfg.keywords.filter(kw => lower.includes(kw)).length;
    if (score > bestScore) { bestScore = score; best = key; }
  }
  return best;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
      style={{ background: value ? '#1A73E8' : '#DADCE0' }}>
      <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
        style={{ transform: value ? 'translateX(20px)' : 'translateX(0)' }} />
    </button>
  );
}

function MemoryCard({ memory, onDelete }: { memory: MemoryItem; onDelete: (id: string, agentId: string) => void }) {
  const cfg = CATEGORY_META[memory.agentType] || CATEGORY_META.general;
  const importanceColors: Record<number, string> = { 5: '#EA4335', 4: '#F9AB00', 3: '#1A73E8', 2: '#34A853', 1: '#9AA0AC' };

  return (
    <div className="group flex items-start gap-3 p-3.5 rounded-xl transition-colors"
      style={{ background: '#FAFAFA', border: '1px solid #E8EAED' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#F8F9FA')}
      onMouseLeave={e => (e.currentTarget.style.background = '#FAFAFA')}>
      <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
        style={{ background: importanceColors[memory.importance] || '#9AA0AC' }}
        title={`Importanza: ${memory.importance}/5`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-relaxed" style={{ color: '#202124' }}>{memory.content}</p>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className="chip" style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
            {memory.agentType}
          </span>
          <span className="chip" style={{
            background: memory.scope === 'global' ? '#F3E8FF' : '#E8F0FE',
            color: memory.scope === 'global' ? '#9334E6' : '#1A73E8',
            borderColor: memory.scope === 'global' ? '#E9D5FF' : '#C5D9F9',
          }}>
            {memory.scope === 'global' ? 'Globale' : 'Locale'}
          </span>
          <span className="text-[10px]" style={{ color: '#9AA0AC' }}>
            {new Date(memory.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDelete(memory.id, memory.agentConfigId)}
        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center transition-all flex-shrink-0"
        style={{ color: '#EA4335' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#FCE8E6')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        title="Elimina ricordo"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
          <path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/>
        </svg>
      </button>
    </div>
  );
}

function CategoryGroup({ categoryKey, memories, onDelete }: {
  categoryKey: string; memories: MemoryItem[]; onDelete: (id: string, agentId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const cfg = CATEGORY_META[categoryKey] || CATEGORY_META.general;
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAED', background: '#FFFFFF' }}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors"
        style={{ background: '#F8F9FA' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#F1F3F4')}
        onMouseLeave={e => (e.currentTarget.style.background = '#F8F9FA')}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: cfg.bg, color: cfg.color }}>
            {cfg.label.charAt(0)}
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold" style={{ color: '#202124' }}>{cfg.label}</div>
            <div className="text-xs" style={{ color: '#5F6368' }}>{memories.length} {memories.length === 1 ? 'ricordo' : 'ricordi'}</div>
          </div>
        </div>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 transition-transform" style={{ color: '#5F6368', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </button>
      {open && (
        <div className="p-3 space-y-2" style={{ borderTop: '1px solid #E8EAED' }}>
          {memories.map(m => <MemoryCard key={m.id} memory={m} onDelete={onDelete} />)}
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────
function MemoryArtifactCard({ artifact, onDelete }: { artifact: any; onDelete: (id: string) => void }) {
  const [activeTab, setActiveTab] = useState<'code' | 'logs' | 'preview'>('code');
  const [terminalLogs, setTerminalLogs] = useState<string[]>(artifact.logs || []);
  const [running, setRunning] = useState(false);

  const hasLogs = terminalLogs.length > 0;
  const isWeb = artifact.type === 'web' || artifact.filename.endsWith('.html') || artifact.filename.endsWith('.htm');

  const handleRun = async () => {
    setRunning(true);
    setActiveTab('logs');
    const timestamp = new Date().toLocaleTimeString();
    setTerminalLogs(prev => [...prev, `> [${timestamp}] Esecuzione manuale...`]);
    try {
      const res = await fetch('/api/demo/artifacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run', id: artifact.id })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.logs) {
          setTerminalLogs(data.logs);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-xl bg-white border border-[#E8EAED] overflow-hidden shadow-xs flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 bg-[#F8F9FA] border-b border-[#E8EAED] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📦</span>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-[#202124] truncate">{artifact.title}</h3>
            <p className="text-[11px] text-[#5F6368] font-mono truncate">{artifact.filename}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDelete(artifact.id)}
          className="text-[#EA4335] hover:bg-[#FCE8E6] p-1.5 rounded-lg transition"
          title="Elimina artefatto"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/>
          </svg>
        </button>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-[#E8EAED] px-4 bg-[#F8F9FA] text-[11px] font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('code')}
          className={`py-2 px-3 border-b-2 transition ${
            activeTab === 'code' ? 'border-[#1A73E8] text-[#1A73E8]' : 'border-transparent text-[#5F6368] hover:text-[#202124]'
          }`}
        >
          Codice
        </button>
        {hasLogs && (
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`py-2 px-3 border-b-2 transition ${
              activeTab === 'logs' ? 'border-[#1A73E8] text-[#1A73E8]' : 'border-transparent text-[#5F6368] hover:text-[#202124]'
            }`}
          >
            Logs
          </button>
        )}
        {isWeb && (
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`py-2 px-3 border-b-2 transition ${
              activeTab === 'preview' ? 'border-[#1A73E8] text-[#1A73E8]' : 'border-transparent text-[#5F6368] hover:text-[#202124]'
            }`}
          >
            Anteprima
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="p-4 flex-1 flex flex-col min-h-0 bg-[#FAFAFA] justify-between">
        <div className="flex-1 min-h-0 mb-4">
          {activeTab === 'code' && (
            <pre className="overflow-auto font-mono text-[11px] leading-relaxed p-3 rounded-lg border border-[#E8EAED] bg-white h-48 text-[#202124] custom-scrollbar">
              <code>{artifact.code}</code>
            </pre>
          )}
          {activeTab === 'logs' && (
            <div className="bg-black text-[#00E676] font-mono text-[11px] p-3 rounded-lg overflow-auto h-48 custom-scrollbar">
              {terminalLogs.map((log, idx) => (
                <div key={idx} className="whitespace-pre-wrap">{log}</div>
              ))}
            </div>
          )}
          {activeTab === 'preview' && (
            <div className="bg-white rounded-lg border border-[#E8EAED] overflow-hidden h-48">
              <iframe
                srcDoc={artifact.code}
                sandbox="allow-scripts allow-same-origin allow-modals"
                className="w-full h-full border-0 bg-white"
                title="Memory Web App Preview"
              />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-[#E8EAED] pt-3 text-[10px]">
          <span className="text-[#9AA0AC]">
            Creato il: {new Date(artifact.createdAt).toLocaleDateString('it-IT')}
          </span>
          {(artifact.language === 'python' || artifact.language === 'py' || artifact.language === 'typescript' || artifact.language === 'ts' || artifact.language === 'javascript' || artifact.language === 'js') && (
            <button
              type="button"
              onClick={handleRun}
              disabled={running}
              className="px-3 py-1 bg-[#34A853] hover:bg-[#2C8C47] text-white font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {running ? 'Esecuzione...' : '▶ Esegui'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const SECTION_META: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  growth: { label: "Growth & Acquisizione", icon: "📈", color: "#1A73E8", bg: "#E8F0FE", border: "#C5D9F9" },
  tech: { label: "Tecnologia & Infrastruttura", icon: "💻", color: "#17A2B8", bg: "#E0F7FA", border: "#B2EBF2" },
  finance: { label: "Finanza & Fundraising", icon: "💰", color: "#34A853", bg: "#E6F4EA", border: "#CEEAD6" },
  operations: { label: "Organizzazione & Team", icon: "⚙️", color: "#9334E6", bg: "#F3E8FF", border: "#E9D5FF" },
};

function getPatternSection(p: Pattern): 'growth' | 'tech' | 'finance' | 'operations' {
  const sector = p.sector?.toLowerCase() || '';
  const title = p.title.toLowerCase();
  const desc = p.description.toLowerCase();

  // Finance rules
  if (
    sector === 'finance' ||
    sector === 'fintech' ||
    title.includes('fundraising') ||
    title.includes('valutazione') ||
    title.includes('budget') ||
    title.includes('investitor') ||
    title.includes('investimenti') ||
    desc.includes('fundraising') ||
    desc.includes('cassa') ||
    desc.includes('runway') ||
    desc.includes('capit')
  ) {
    return 'finance';
  }

  // Tech & Product rules
  if (
    sector === 'tech' ||
    sector === 'ai' ||
    title.includes('architettura') ||
    title.includes('debito tecnico') ||
    title.includes('monolito') ||
    title.includes('codice') ||
    title.includes('sviluppo') ||
    title.includes('engineering') ||
    desc.includes('software') ||
    desc.includes('cloud') ||
    desc.includes('tecnic')
  ) {
    return 'tech';
  }

  // Operations & Team rules
  if (
    sector === 'operations' ||
    title.includes('team') ||
    title.includes('vesting') ||
    title.includes('equity') ||
    title.includes('hiring') ||
    title.includes('assunzion') ||
    desc.includes('dipendenti') ||
    desc.includes('risorse umane')
  ) {
    return 'operations';
  }

  // Default / Growth & Market (saas, ecommerce, marketing, social, etc.)
  return 'growth';
}

function PatternCard({ p }: { p: Pattern }) {
  const isFailure = p.successRate < 0.4;
  const rateColor = isFailure ? '#EA4335' : p.successRate >= 0.75 ? '#34A853' : '#F9AB00';
  const rateBg = isFailure ? '#FCE8E6' : p.successRate >= 0.75 ? '#E6F4EA' : '#FEF7E0';
  const rateLabel = isFailure ? 'Alto Rischio' : p.successRate >= 0.75 ? 'Ottimale' : 'Moderato';

  return (
    <div className="rounded-xl overflow-hidden bg-white" style={{
      border: `1px solid ${isFailure ? '#F7CECE' : '#E8EAED'}`,
      boxShadow: '0 1px 2px rgba(60,64,67,0.10)',
      borderLeft: `4px solid ${rateColor}`,
    }}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {isFailure && <span className="chip chip-red">Anti-Pattern</span>}
              {p.extractedBy === 'hermes_analyzer' && !isFailure && <span className="chip chip-blue">AI Learned</span>}
              {p.sector && <span className="chip chip-gray">{p.sector.toUpperCase()}</span>}
              {p.phase && <span className="chip chip-gray">{p.phase.toUpperCase()}</span>}
              {p.avgTimeToOutcome && <span className="chip chip-gray">⏱ {p.avgTimeToOutcome}</span>}
            </div>
            <h3 className="font-semibold text-base text-left" style={{ color: '#202124' }}>{p.title}</h3>
          </div>
          {/* Success rate badge */}
          <div className="flex-shrink-0 px-4 py-2 rounded-xl text-center" style={{ background: rateBg }}>
            <div className="text-xl font-bold tabular-nums" style={{ color: rateColor }}>{(p.successRate * 100).toFixed(0)}%</div>
            <div className="text-[10px] font-semibold" style={{ color: rateColor }}>{rateLabel}</div>
            <div className="text-[9px] mt-0.5" style={{ color: '#9AA0AC' }}>{p.sampleSize} casi · {(p.confidence * 100).toFixed(0)}% conf.</div>
          </div>
        </div>

        <p className="text-sm leading-relaxed mb-4 text-left" style={{ color: '#5F6368' }}>{p.description}</p>

        {/* Progress bar for success rate */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-1.5 rounded-full" style={{ background: '#F1F3F4' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${p.successRate * 100}%`, background: rateColor }} />
          </div>
          <span className="text-xs tabular-nums" style={{ color: '#9AA0AC', width: '32px', textAlign: 'right' }}>{(p.successRate * 100).toFixed(0)}%</span>
        </div>

        <div className="grid md:grid-cols-2 gap-4 text-left">
          {p.keyFactors?.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: '#34A853' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                Fattori di Successo
              </p>
              <div className="flex flex-wrap gap-1.5">
                {p.keyFactors.map((f, i) => <span key={i} className="chip chip-green">{f}</span>)}
              </div>
            </div>
          )}
          {p.failureModes?.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: '#EA4335' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                Errori Comuni
              </p>
              <div className="flex flex-wrap gap-1.5">
                {p.failureModes.map((m, i) => <span key={i} className="chip chip-red">{m}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const STORY_SECTOR_META: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  saas: { label: "SaaS & Enterprise Software", icon: "☁️", color: "#1A73E8", bg: "#E8F0FE", border: "#C5D9F9" },
  fintech: { label: "Fintech & Pagamenti", icon: "💳", color: "#34A853", bg: "#E6F4EA", border: "#CEEAD6" },
  ecommerce: { label: "E-commerce & D2C", icon: "🛒", color: "#F9AB00", bg: "#FEF7E0", border: "#FDE293" },
  marketplaces: { label: "Marketplaces & Network", icon: "🤝", color: "#FF6D00", bg: "#FFF3E0", border: "#FFE0B2" },
  ai: { label: "AI & Deeptech", icon: "🧠", color: "#17A2B8", bg: "#E0F7FA", border: "#B2EBF2" },
  social: { label: "Social & Consumer Tech", icon: "📱", color: "#EA4335", bg: "#FCE8E6", border: "#F7CECE" },
  health: { label: "Health & Biotech", icon: "🏥", color: "#00897B", bg: "#E0F2F1", border: "#B2DFDB" },
  general: { label: "Generale / Altro", icon: "🏢", color: "#5F6368", bg: "#F1F3F4", border: "#E8EAED" },
};

function StoryCard({ story }: { story: any }) {
  const isSuccess = story.status === "success";
  const badgeColor = isSuccess ? "#34A853" : "#EA4335";
  const badgeBg = isSuccess ? "#E6F4EA" : "#FCE8E6";
  const badgeLabel = isSuccess ? "Successo" : "Fallimento";

  return (
    <div className="rounded-xl overflow-hidden bg-white flex flex-col justify-between" style={{
      border: `1px solid ${isSuccess ? '#CEEAD6' : '#F7CECE'}`,
      boxShadow: '0 1px 2px rgba(60,64,67,0.10)',
      borderLeft: `4px solid ${badgeColor}`,
    }}>
      <div className="p-5 flex flex-col h-full justify-between">
        <div>
          <div className="flex items-start justify-between gap-4 mb-3">
            <h3 className="font-bold text-base text-left text-[#202124]">{story.title}</h3>
            <span className="px-3 py-1 rounded-full text-xs font-bold flex-shrink-0" style={{ background: badgeBg, color: badgeColor }}>
              {badgeLabel}
            </span>
          </div>
          <p className="text-sm leading-relaxed mb-4 text-left text-[#5F6368] whitespace-pre-wrap">{story.description}</p>
        </div>
        
        {story.takeaway && (
          <div className="mt-2 p-3.5 rounded-lg border text-left" style={{ background: '#F8F9FA', borderColor: '#E8EAED' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#5F6368' }}>💡 Takeaway Chiave</p>
            <p className="text-sm leading-relaxed" style={{ color: '#202124' }}>{story.takeaway}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StorySectionGroup({ sectionKey, stories, isOpen, onToggle }: {
  sectionKey: string; stories: any[]; isOpen: boolean; onToggle: () => void;
}) {
  const cfg = STORY_SECTOR_META[sectionKey] || STORY_SECTOR_META.general;
  const successCount = stories.filter(s => s.status === "success").length;
  const failureCount = stories.filter(s => s.status === "failure").length;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAED', background: '#FFFFFF' }}>
      <button type="button" onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 transition-colors"
        style={{ background: '#F8F9FA' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#F1F3F4')}
        onMouseLeave={e => (e.currentTarget.style.background = '#F8F9FA')}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{ background: cfg.bg }}>
            {cfg.icon}
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold" style={{ color: '#202124' }}>{cfg.label}</div>
            <div className="text-xs flex items-center gap-1.5" style={{ color: '#5F6368' }}>
              <span>{stories.length} {stories.length === 1 ? 'storia' : 'storie'}</span>
              {stories.length > 0 && (
                <>
                  <span style={{ color: '#DADCE0' }}>|</span>
                  {successCount > 0 && <span style={{ color: '#34A853', fontWeight: 500 }}>{successCount} successi</span>}
                  {successCount > 0 && failureCount > 0 && <span>·</span>}
                  {failureCount > 0 && <span style={{ color: '#EA4335', fontWeight: 500 }}>{failureCount} fallimenti</span>}
                </>
              )}
            </div>
          </div>
        </div>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 transition-transform" style={{ color: '#5F6368', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </button>
      {isOpen && (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#FAFAFA]" style={{ borderTop: '1px solid #E8EAED' }}>
          {stories.map(s => <StoryCard key={s.id} story={s} />)}
        </div>
      )}
    </div>
  );
}

function PatternSectionGroup({ sectionKey, patterns, isOpen, onToggle }: {
  sectionKey: string; patterns: Pattern[]; isOpen: boolean; onToggle: () => void;
}) {
  const cfg = SECTION_META[sectionKey] || { label: "Altro", icon: "📌", color: "#5F6368", bg: "#F1F3F4", border: "#E8EAED" };
  const optimalCount = patterns.filter(p => p.successRate >= 0.75).length;
  const riskCount = patterns.filter(p => p.successRate < 0.4).length;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAED', background: '#FFFFFF' }}>
      <button type="button" onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 transition-colors"
        style={{ background: '#F8F9FA' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#F1F3F4')}
        onMouseLeave={e => (e.currentTarget.style.background = '#F8F9FA')}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{ background: cfg.bg }}>
            {cfg.icon}
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold" style={{ color: '#202124' }}>{cfg.label}</div>
            <div className="text-xs flex items-center gap-1.5" style={{ color: '#5F6368' }}>
              <span>{patterns.length} pattern</span>
              {patterns.length > 0 && (
                <>
                  <span style={{ color: '#DADCE0' }}>|</span>
                  {optimalCount > 0 && <span style={{ color: '#34A853', fontWeight: 500 }}>{optimalCount} ottimali</span>}
                  {optimalCount > 0 && riskCount > 0 && <span>·</span>}
                  {riskCount > 0 && <span style={{ color: '#EA4335', fontWeight: 500 }}>{riskCount} rischio</span>}
                </>
              )}
            </div>
          </div>
        </div>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 transition-transform" style={{ color: '#5F6368', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </button>
      {isOpen && (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#FAFAFA]" style={{ borderTop: '1px solid #E8EAED' }}>
          {patterns.map(p => <PatternCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}

export default function MemoryPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [tab, setTab] = useState<"mnemosyne" | "artifacts" | "mnemosyne-settings" | "patterns" | "playbooks" | "knowledge-settings" | "stories">("mnemosyne");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [phaseFilter, setPhaseFilter] = useState("all");

  const [storiesSearch, setStoriesSearch] = useState("");
  const [storiesSectorFilter, setStoriesSectorFilter] = useState("all");
  const [storiesStatusFilter, setStoriesStatusFilter] = useState("all");
  const [loadingStories, setLoadingStories] = useState(false);

  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<'all' | 'local' | 'global'>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');

  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [loadingArtifacts, setLoadingArtifacts] = useState(true);
  const [artifactSearchQuery, setArtifactSearchQuery] = useState("");

  const [memSettings, setMemSettings] = useState(DEFAULT_APP_SETTINGS.memorySettings);
  const [kbSettings, setKbSettings] = useState(DEFAULT_APP_SETTINGS.knowledgeSettings);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    growth: false,
    tech: false,
    finance: false,
    operations: false,
  });

  const [expandedStoriesSections, setExpandedStoriesSections] = useState<Record<string, boolean>>({
    saas: false,
    fintech: false,
    ecommerce: false,
    marketplaces: false,
    ai: false,
    social: false,
    health: false,
    general: false,
  });

  useEffect(() => {
    const stored = localStorage.getItem('agentfoundry_settings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.memorySettings) setMemSettings({ ...DEFAULT_APP_SETTINGS.memorySettings, ...parsed.memorySettings });
        if (parsed.knowledgeSettings) setKbSettings({ ...DEFAULT_APP_SETTINGS.knowledgeSettings, ...parsed.knowledgeSettings });
      } catch {}
    }
  }, []);

  const saveSettings = () => {
    const stored = localStorage.getItem('agentfoundry_settings');
    let current: any = {};
    try { current = stored ? JSON.parse(stored) : {}; } catch {}
    localStorage.setItem('agentfoundry_settings', JSON.stringify({ ...current, memorySettings: memSettings, knowledgeSettings: kbSettings }));
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  };

  const updateMem = (key: string, value: any) => setMemSettings(prev => ({ ...prev, [key]: value }));
  const updateKb = (key: string, value: any) => setKbSettings(prev => ({ ...prev, [key]: value }));

  const fetchMemories = async () => {
    setLoadingMemories(true);
    try {
      const res = await fetch('/api/demo/mnemosyne');
      if (res.ok) setMemories(await res.json());
    } catch {}
    finally { setLoadingMemories(false); }
  };

  useEffect(() => { if (tab === 'mnemosyne') fetchMemories(); }, [tab]);

  const deleteMemory = async (id: string, agentConfigId: string) => {
    if (!confirm("Eliminare questo ricordo permanentemente?")) return;
    try {
      const res = await fetch(`/api/demo/mnemosyne?agentConfigId=${agentConfigId}&id=${id}`, { method: 'DELETE' });
      if (res.ok) setMemories(prev => prev.filter(m => m.id !== id));
    } catch {}
  };

  const fetchArtifacts = async () => {
    setLoadingArtifacts(true);
    try {
      const res = await fetch('/api/demo/artifacts');
      if (res.ok) setArtifacts(await res.json());
    } catch {}
    finally { setLoadingArtifacts(false); }
  };

  useEffect(() => { 
    if (tab === 'artifacts') fetchArtifacts(); 
  }, [tab]);

  const deleteArtifact = async (id: string) => {
    if (!confirm("Eliminare questo artefatto permanentemente?")) return;
    try {
      const res = await fetch(`/api/demo/artifacts?id=${id}`, { method: 'DELETE' });
      if (res.ok) setArtifacts(prev => prev.filter(a => a.id !== id));
    } catch {}
  };

  const fetchStories = async () => {
    setLoadingStories(true);
    try {
      const q = new URLSearchParams();
      if (storiesSearch.trim()) q.set("search", storiesSearch);
      if (storiesSectorFilter !== "all") q.set("sector", storiesSectorFilter);
      if (storiesStatusFilter !== "all") q.set("status", storiesStatusFilter);
      const res = await fetch(`/api/memory/stories?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setStories(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Error fetching stories:", err);
    } finally {
      setLoadingStories(false);
    }
  };

  useEffect(() => {
    if (tab === "stories") {
      fetchStories();
    }
  }, [tab, storiesSearch, storiesSectorFilter, storiesStatusFilter]);

  useEffect(() => {
    Promise.all([
      fetch("/api/memory/patterns").then(r => r.json()),
      fetch("/api/memory/playbooks").then(r => r.json()),
      fetch("/api/memory/stories").then(r => r.json()),
    ]).then(([p, pb, s]) => {
      setPatterns(Array.isArray(p) ? p : []);
      setPlaybooks(Array.isArray(pb) ? pb : []);
      setStories(Array.isArray(s) ? s : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filteredPatterns = patterns.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase());
    const matchesSector = sectorFilter === "all" || p.sector?.toLowerCase() === sectorFilter;
    const matchesPhase = phaseFilter === "all" || p.phase?.toLowerCase() === phaseFilter;
    const matchesRate = (p.successRate * 100) >= kbSettings.minSuccessRate || p.successRate < 0.4;
    return matchesSearch && matchesSector && matchesPhase && matchesRate;
  });

  const filteredPlaybooks = playbooks.filter(pb => {
    const matchesSearch = pb.title.toLowerCase().includes(search.toLowerCase()) || pb.description.toLowerCase().includes(search.toLowerCase());
    const matchesSector = sectorFilter === "all" || pb.sector?.toLowerCase() === sectorFilter;
    const matchesPhase = phaseFilter === "all" || pb.phase?.toLowerCase() === phaseFilter;
    return matchesSearch && matchesSector && matchesPhase;
  });

  const groupedPatterns = useMemo(() => {
    const groups: Record<string, Pattern[]> = {
      growth: [],
      tech: [],
      finance: [],
      operations: [],
    };
    for (const p of filteredPatterns) {
      const sec = getPatternSection(p);
      groups[sec].push(p);
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => b.successRate - a.successRate);
    }
    return groups;
  }, [filteredPatterns]);

  const groupedStories = useMemo(() => {
    const groups: Record<string, any[]> = {
      saas: [],
      fintech: [],
      ecommerce: [],
      marketplaces: [],
      ai: [],
      social: [],
      health: [],
      general: [],
    };
    for (const s of stories) {
      const sec = s.sector || "general";
      if (groups[sec]) {
        groups[sec].push(s);
      } else {
        groups.general.push(s);
      }
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === "success" ? -1 : 1;
        }
        return a.title.localeCompare(b.title);
      });
    }
    return groups;
  }, [stories]);

  const groupedMemories = useMemo(() => {
    const filtered = memories.filter(m => {
      const matchesSearch = m.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesScope = scopeFilter === 'all' || m.scope === scopeFilter;
      const matchesAgent = agentFilter === 'all' || m.agentType === agentFilter;
      return matchesSearch && matchesScope && matchesAgent;
    });
    const groups: Record<string, MemoryItem[]> = {};
    for (const m of filtered) {
      const cat = m.category && m.category !== 'general' ? m.category : inferCategory(m.content);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(m);
    }
    const order = ["identity", "business", "tech", "finance", "contacts", "preferences", "decisions", "milestones", "general"];
    const sorted = order.filter(c => groups[c]?.length > 0).map(c => ({ category: c, items: groups[c] }));
    for (const c of Object.keys(groups)) if (!order.includes(c)) sorted.push({ category: c, items: groups[c] });
    return sorted;
  }, [memories, searchQuery, scopeFilter, agentFilter]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-6 h-6 rounded-full border-2 border-[#1A73E8] border-t-transparent animate-spin" />
    </div>
  );

  const TABS = [
    { id: "mnemosyne", label: "Ricordi", group: "memory" },
    { id: "artifacts", label: "Artefatti", group: "memory" },
    { id: "mnemosyne-settings", label: "Impostazioni", group: "memory" },
    { id: "patterns", label: `Pattern (${patterns.length})`, group: "knowledge" },
    { id: "playbooks", label: `Playbook (${playbooks.length})`, group: "knowledge" },
    { id: "stories", label: `Storie (${stories.length})`, group: "knowledge" },
    { id: "knowledge-settings", label: "Impostazioni", group: "knowledge" },
  ] as const;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* ── Header ─────────────────────────────────────────── */}
      <div>
        <h1 className="text-display">Memoria & Conoscenza</h1>
        <p className="text-body mt-1">Ricordi estratti dalle chat, pattern strategici e playbook operativi</p>
      </div>

      {/* ── Tab Navigation ─────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8EAED', boxShadow: '0 1px 2px rgba(60,64,67,0.10)' }}>
        <div className="px-4 py-0 flex items-center gap-6" style={{ borderBottom: '1px solid #E8EAED' }}>
          {/* Memory group */}
          <div className="flex items-center gap-0">
            <span className="text-xs font-semibold mr-3" style={{ color: '#9AA0AC' }}>MEMORIA</span>
            {TABS.filter(t => t.group === 'memory').map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                className="px-3 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px"
                style={{
                  borderColor: tab === t.id ? '#1A73E8' : 'transparent',
                  color: tab === t.id ? '#1A73E8' : '#5F6368',
                }}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="w-px h-6" style={{ background: '#E8EAED' }} />
          {/* Knowledge group */}
          <div className="flex items-center gap-0">
            <span className="text-xs font-semibold mr-3" style={{ color: '#9AA0AC' }}>CONOSCENZA</span>
            {TABS.filter(t => t.group === 'knowledge').map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                className="px-3 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px"
                style={{
                  borderColor: tab === t.id ? '#34A853' : 'transparent',
                  color: tab === t.id ? '#34A853' : '#5F6368',
                }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters row */}
        <div className="px-4 py-3 flex flex-wrap items-center gap-3" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
          {tab === 'artifacts' && (
            <div className="relative flex-1 max-w-xs">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 absolute left-2.5 top-2" style={{ color: '#9AA0AC' }}>
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <input type="text" placeholder="Cerca negli artefatti..." value={artifactSearchQuery}
                onChange={e => setArtifactSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm focus:outline-none"
                style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }} />
            </div>
          )}
          {tab === 'mnemosyne' && (
            <>
              <div className="relative flex-1 max-w-xs">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 absolute left-2.5 top-2" style={{ color: '#9AA0AC' }}>
                  <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <input type="text" placeholder="Cerca nei ricordi..." value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm focus:outline-none"
                  style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }} />
              </div>
              <select value={scopeFilter} onChange={e => setScopeFilter(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg text-sm focus:outline-none"
                style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }}>
                <option value="all">Tutti gli scope</option>
                <option value="local">Solo Locale</option>
                <option value="global">Solo Globale</option>
              </select>
              <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-sm focus:outline-none"
                style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }}>
                <option value="all">Tutti gli agenti</option>
                <option value="strategy">Strategy</option>
                <option value="tech">Tech</option>
                <option value="finance">Finance</option>
                <option value="marketing">Marketing</option>
                <option value="legal">Legal</option>
                <option value="operations">Operations</option>
              </select>
              <button type="button" onClick={fetchMemories}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{ color: '#1A73E8' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#E8F0FE')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                Aggiorna
              </button>
            </>
          )}
          {(tab === 'patterns' || tab === 'playbooks') && (
            <>
              <div className="relative flex-1 max-w-xs">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 absolute left-2.5 top-2" style={{ color: '#9AA0AC' }}>
                  <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <input type="text" placeholder="Cerca pattern e playbook..." value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm focus:outline-none"
                  style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }} />
              </div>
              <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-sm focus:outline-none"
                style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }}>
                <option value="all">Tutti i settori</option>
                <option value="saas">SaaS</option>
                <option value="fintech">Fintech</option>
                <option value="ecommerce">E-commerce</option>
                <option value="ai">AI</option>
              </select>
              <select value={phaseFilter} onChange={e => setPhaseFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-sm focus:outline-none"
                style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }}>
                <option value="all">Tutte le fasi</option>
                <option value="idea">Idea</option>
                <option value="pre-seed">Pre-Seed</option>
                <option value="mvp">MVP</option>
                <option value="growth">Growth</option>
              </select>
            </>
          )}
          {tab === 'stories' && (
            <>
              <div className="relative flex-1 max-w-xs">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 absolute left-2.5 top-2" style={{ color: '#9AA0AC' }}>
                  <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <input type="text" placeholder="Cerca nelle storie..." value={storiesSearch}
                  onChange={e => setStoriesSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm focus:outline-none"
                  style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }} />
              </div>
              <select value={storiesSectorFilter} onChange={e => setStoriesSectorFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-sm focus:outline-none"
                style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }}>
                <option value="all">Tutti i settori</option>
                <option value="saas">SaaS</option>
                <option value="fintech">Fintech</option>
                <option value="ecommerce">E-commerce</option>
                <option value="marketplaces">Marketplaces</option>
                <option value="ai">AI</option>
                <option value="social">Social</option>
                <option value="health">Health</option>
                <option value="general">Generale</option>
              </select>
              <select value={storiesStatusFilter} onChange={e => setStoriesStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-sm focus:outline-none"
                style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }}>
                <option value="all">Tutti gli outcome</option>
                <option value="success">Successo</option>
                <option value="failure">Fallimento</option>
              </select>
            </>
          )}
        </div>
      </div>

      {/* ══ TAB: MNEMOSYNE ══════════════════════════════════════════ */}
      {tab === "mnemosyne" && (
        <div className="space-y-3">
          {loadingMemories ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 rounded-full border-2 border-[#1A73E8] border-t-transparent animate-spin" />
            </div>
          ) : memories.length === 0 ? (
            <div className="text-center py-16 rounded-xl" style={{ background: '#FFFFFF', border: '1px solid #E8EAED' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: '#E8F0FE' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" style={{ color: '#1A73E8' }}>
                  <path d="M12 2c-4.42 0-8 3.58-8 8 0 2.93 1.58 5.5 3.93 6.93V21h8.14v-4.07C18.42 15.5 20 12.93 20 10c0-4.42-3.58-8-8-8zm2 14.5v2.5h-4v-2.5C7.36 15.16 6 12.71 6 10c0-3.31 2.69-6 6-6s6 2.69 6 6c0 2.71-1.36 5.16-4 6.5z"/>
                </svg>
              </div>
              <h3 className="font-semibold text-sm mb-1" style={{ color: '#202124' }}>Nessun ricordo ancora</h3>
              <p className="text-sm" style={{ color: '#5F6368' }}>
                Mnemosyne estrarrà ricordi automaticamente dalle conversazioni con gli agenti.
              </p>
              <button onClick={() => setTab("mnemosyne-settings")} className="btn-primary mt-4 inline-flex">
                Configura Memoria
              </button>
            </div>
          ) : groupedMemories.length === 0 ? (
            <div className="text-center py-10 rounded-xl" style={{ background: '#FFFFFF', border: '1px solid #E8EAED' }}>
              <p className="text-sm" style={{ color: '#5F6368' }}>Nessun ricordo corrisponde ai filtri.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: '#5F6368' }}>
                  <strong style={{ color: '#202124' }}>{groupedMemories.reduce((s, g) => s + g.items.length, 0)}</strong> ricordi in{' '}
                  <strong style={{ color: '#202124' }}>{groupedMemories.length}</strong> categorie
                </p>
              </div>
              {groupedMemories.map(g => (
                <CategoryGroup key={g.category} categoryKey={g.category} memories={g.items} onDelete={deleteMemory} />
              ))}
            </>
          )}
        </div>
      )}

      {/* ══ TAB: ARTIFACTS ══════════════════════════════════════════ */}
      {tab === "artifacts" && (
        <div className="space-y-4">
          {loadingArtifacts ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 rounded-full border-2 border-[#1A73E8] border-t-transparent animate-spin" />
            </div>
          ) : artifacts.length === 0 ? (
            <div className="text-center py-16 rounded-xl" style={{ background: '#FFFFFF', border: '1px solid #E8EAED' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: '#E8F0FE' }}>
                <span className="text-2xl">📦</span>
              </div>
              <h3 className="font-semibold text-sm mb-1" style={{ color: '#202124' }}>Nessun artefatto salvato</h3>
              <p className="text-sm" style={{ color: '#5F6368' }}>
                Gli artefatti creati dal CoFounder o dagli agenti tramite codice compariranno qui.
              </p>
            </div>
          ) : artifacts.filter(a => a.title.toLowerCase().includes(artifactSearchQuery.toLowerCase()) || a.filename.toLowerCase().includes(artifactSearchQuery.toLowerCase())).length === 0 ? (
            <div className="text-center py-10 rounded-xl" style={{ background: '#FFFFFF', border: '1px solid #E8EAED' }}>
              <p className="text-sm" style={{ color: '#5F6368' }}>Nessun artefatto corrisponde ai filtri.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
              {artifacts
                .filter(a => a.title.toLowerCase().includes(artifactSearchQuery.toLowerCase()) || a.filename.toLowerCase().includes(artifactSearchQuery.toLowerCase()))
                .map(art => (
                  <MemoryArtifactCard key={art.id} artifact={art} onDelete={deleteArtifact} />
                ))}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: MEMORY SETTINGS ════════════════════════════════════ */}
      {tab === "mnemosyne-settings" && (
        <div className="space-y-4 max-w-2xl">
          {/* Memory toggles */}
          <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8EAED' }}>
            <div className="px-5 py-3.5" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
              <h2 className="font-semibold text-sm" style={{ color: '#202124' }}>Mnemosyne — Memoria Persistente</h2>
            </div>
            <div className="divide-y" style={{ borderColor: '#F1F3F4' }}>
              {[
                { key: 'useLongTermMemory', label: 'Memoria a lungo termine', desc: 'Estrae e memorizza fatti importanti tra le sessioni' },
                { key: 'autoSaveInteractions', label: 'Salvataggio automatico interazioni', desc: 'Salva ogni interazione nel database per analisi futura' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <div className="text-sm font-medium" style={{ color: '#202124' }}>{item.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#5F6368' }}>{item.desc}</div>
                  </div>
                  <Toggle value={(memSettings as any)[item.key]} onChange={v => updateMem(item.key, v)} />
                </div>
              ))}
            </div>
          </div>

          {/* Recency bias */}
          <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8EAED' }}>
            <div className="px-5 py-3.5" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
              <h2 className="font-semibold text-sm" style={{ color: '#202124' }}>Parametri di Recall</h2>
            </div>
            <div className="px-5 py-4 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium" style={{ color: '#202124' }}>Peso memoria recente</label>
                  <span className="text-sm font-bold tabular-nums" style={{ color: '#1A73E8' }}>{memSettings.recencyBias.toFixed(1)}</span>
                </div>
                <input type="range" min="0" max="1" step="0.1" value={memSettings.recencyBias}
                  onChange={e => updateMem('recencyBias', parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                  style={{ accentColor: '#1A73E8', background: '#E8EAED' }} />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px]" style={{ color: '#9AA0AC' }}>Uguale peso</span>
                  <span className="text-[10px]" style={{ color: '#9AA0AC' }}>Solo recenti</span>
                </div>
                <div className="mt-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#F8F9FA', color: '#5F6368', border: '1px solid #E8EAED' }}>
                  {memSettings.recencyBias <= 0.2 && "I ricordi vecchi e nuovi hanno lo stesso peso nel recall."}
                  {memSettings.recencyBias > 0.2 && memSettings.recencyBias < 0.7 && "Bilanciato: i ricordi recenti pesano leggermente di più."}
                  {memSettings.recencyBias >= 0.7 && "Alta priorità ai ricordi recenti. I vecchi verranno quasi ignorati."}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium" style={{ color: '#202124' }}>Messaggi di cronologia nel prompt</label>
                  <span className="text-sm font-bold tabular-nums" style={{ color: '#1A73E8' }}>{memSettings.contextMessages}</span>
                </div>
                <input type="range" min="0" max="50" step="5" value={memSettings.contextMessages}
                  onChange={e => updateMem('contextMessages', parseInt(e.target.value))}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                  style={{ accentColor: '#1A73E8', background: '#E8EAED' }} />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px]" style={{ color: '#9AA0AC' }}>0 — Solo system prompt</span>
                  <span className="text-[10px]" style={{ color: '#9AA0AC' }}>50 — Tutta la cronologia</span>
                </div>
              </div>
            </div>
          </div>

          {/* Arch info */}
          <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8EAED' }}>
            <div className="px-5 py-3.5" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
              <h2 className="font-semibold text-sm" style={{ color: '#202124' }}>Architettura Memoria</h2>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { color: '#1A73E8', bg: '#E8F0FE', title: "Sessione", desc: "Cronologia messaggi della chat corrente. Configurabile: 0-50 messaggi." },
                { color: '#9334E6', bg: '#F3E8FF', title: "Mnemosyne", desc: "Memoria a lungo termine per agente. Persistente tra sessioni." },
                { color: '#34A853', bg: '#E6F4EA', title: "Knowledge Base", desc: "Pattern e Playbook condivisi. Fonti: YC, Sequoia, First Round." },
              ].map(item => (
                <div key={item.title} className="p-3 rounded-lg" style={{ background: item.bg }}>
                  <div className="font-semibold text-sm mb-1" style={{ color: item.color }}>{item.title}</div>
                  <div className="text-xs leading-relaxed" style={{ color: '#5F6368' }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={saveSettings} className="btn-primary">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
              Salva impostazioni
            </button>
            {settingsSaved && <span className="text-sm font-medium flex items-center gap-1" style={{ color: '#34A853' }}>✓ Salvato!</span>}
          </div>
        </div>
      )}

      {/* ══ TAB: PATTERNS ═══════════════════════════════════════════ */}
      {tab === "patterns" && (
        <div className="space-y-4">
          {/* Stats bar */}
          <div className="flex flex-wrap items-center gap-4 px-4 py-3 rounded-xl animate-fade-in" style={{ background: '#FFFFFF', border: '1px solid #E8EAED' }}>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="font-semibold" style={{ color: '#202124' }}>{filteredPatterns.length}</span>
              <span style={{ color: '#5F6368' }}>pattern</span>
            </div>
            <div className="w-px h-4" style={{ background: '#E8EAED' }} />
            <div className="flex items-center gap-1.5 text-sm">
              <span className="chip chip-green">{filteredPatterns.filter(p => p.successRate >= 0.6).length} successo</span>
              <span className="chip chip-red">{filteredPatterns.filter(p => p.successRate < 0.4).length} anti-pattern</span>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setExpandedSections({ growth: true, tech: true, finance: true, operations: true })}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#F1F3F4] transition-colors border"
                style={{ color: '#1A73E8', borderColor: '#DADCE0', background: '#FFFFFF' }}
              >
                Espandi tutti
              </button>
              <button
                type="button"
                onClick={() => setExpandedSections({ growth: false, tech: false, finance: false, operations: false })}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#F1F3F4] transition-colors border"
                style={{ color: '#5F6368', borderColor: '#DADCE0', background: '#FFFFFF' }}
              >
                Comprimi tutti
              </button>
            </div>
          </div>

          {filteredPatterns.length === 0 && (
            <div className="text-center py-10 rounded-xl" style={{ background: '#FFFFFF', border: '1px solid #E8EAED' }}>
              <p className="text-sm" style={{ color: '#5F6368' }}>Nessun pattern con i filtri impostati.</p>
            </div>
          )}

          {Object.entries(groupedPatterns).map(([secKey, secPatterns]) => {
            if (secPatterns.length === 0) return null;
            return (
              <PatternSectionGroup
                key={secKey}
                sectionKey={secKey}
                patterns={secPatterns}
                isOpen={!!expandedSections[secKey]}
                onToggle={() => setExpandedSections(prev => ({ ...prev, [secKey]: !prev[secKey] }))}
              />
            );
          })}
        </div>
      )}

      {/* ══ TAB: STORIES ════════════════════════════════════════════ */}
      {tab === "stories" && (
        <div className="space-y-4">
          {/* Stats bar */}
          <div className="flex flex-wrap items-center gap-4 px-4 py-3 rounded-xl animate-fade-in" style={{ background: '#FFFFFF', border: '1px solid #E8EAED' }}>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="font-semibold" style={{ color: '#202124' }}>{stories.length}</span>
              <span style={{ color: '#5F6368' }}>{stories.length === 1 ? 'storia trovata' : 'storie trovate'}</span>
            </div>
            <div className="w-px h-4" style={{ background: '#E8EAED' }} />
            <div className="flex items-center gap-1.5 text-sm">
              <span className="chip chip-green">{stories.filter(s => s.status === 'success').length} successi</span>
              <span className="chip chip-red">{stories.filter(s => s.status === 'failure').length} fallimenti</span>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setExpandedStoriesSections({ saas: true, fintech: true, ecommerce: true, marketplaces: true, ai: true, social: true, health: true, general: true })}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#F1F3F4] transition-colors border"
                style={{ color: '#34A853', borderColor: '#DADCE0', background: '#FFFFFF' }}
              >
                Espandi tutti
              </button>
              <button
                type="button"
                onClick={() => setExpandedStoriesSections({ saas: false, fintech: false, ecommerce: false, marketplaces: false, ai: false, social: false, health: false, general: false })}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#F1F3F4] transition-colors border"
                style={{ color: '#5F6368', borderColor: '#DADCE0', background: '#FFFFFF' }}
              >
                Comprimi tutti
              </button>
            </div>
          </div>

          {loadingStories ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 rounded-full border-2 border-[#34A853] border-t-transparent animate-spin" />
            </div>
          ) : stories.length === 0 ? (
            <div className="text-center py-10 rounded-xl" style={{ background: '#FFFFFF', border: '1px solid #E8EAED' }}>
              <p className="text-sm" style={{ color: '#5F6368' }}>Nessuna storia corrispondente ai filtri.</p>
            </div>
          ) : (
            Object.entries(groupedStories).map(([secKey, secStories]) => {
              if (secStories.length === 0) return null;
              return (
                <StorySectionGroup
                  key={secKey}
                  sectionKey={secKey}
                  stories={secStories}
                  isOpen={!!expandedStoriesSections[secKey]}
                  onToggle={() => setExpandedStoriesSections(prev => ({ ...prev, [secKey]: !prev[secKey] }))}
                />
              );
            })
          )}
        </div>
      )}

      {/* ══ TAB: PLAYBOOKS ══════════════════════════════════════════ */}
      {tab === "playbooks" && (
        <div className="space-y-4">
          {filteredPlaybooks.length === 0 && (
            <div className="text-center py-10 rounded-xl" style={{ background: '#FFFFFF', border: '1px solid #E8EAED' }}>
              <p className="text-sm" style={{ color: '#5F6368' }}>Nessun playbook con i filtri impostati.</p>
            </div>
          )}
          {filteredPlaybooks.map(pb => (
            <div key={pb.id} className="rounded-xl overflow-hidden" style={{
              background: '#FFFFFF', border: '1px solid #E8EAED', borderLeft: '4px solid #34A853',
              boxShadow: '0 1px 2px rgba(60,64,67,0.10)',
            }}>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {pb.sector && <span className="chip chip-gray">{pb.sector.toUpperCase()}</span>}
                      {pb.phase && <span className="chip chip-gray">{pb.phase.toUpperCase()}</span>}
                    </div>
                    <h3 className="font-semibold text-base" style={{ color: '#202124' }}>{pb.title}</h3>
                  </div>
                  <div className="text-center px-4 py-2 rounded-xl flex-shrink-0" style={{ background: '#E6F4EA' }}>
                    <div className="text-xl font-bold" style={{ color: '#34A853' }}>{(pb.successRate * 100).toFixed(0)}%</div>
                    <div className="text-[10px] font-semibold" style={{ color: '#1E8E3E' }}>Successo</div>
                  </div>
                </div>
                <p className="text-sm leading-relaxed mb-4" style={{ color: '#5F6368' }}>{pb.description}</p>
                {pb.steps?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#9AA0AC' }}>Passaggi del Playbook</p>
                    {pb.steps.map((step: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: '#F8F9FA', border: '1px solid #E8EAED' }}>
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#1A73E8' }}>
                          {step.step || i + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium" style={{ color: '#202124' }}>{step.title}</p>
                          <p className="text-xs" style={{ color: '#9AA0AC' }}>Durata: {step.duration}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══ TAB: KNOWLEDGE SETTINGS ═════════════════════════════════ */}
      {tab === "knowledge-settings" && (
        <div className="space-y-4 max-w-2xl">
          <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8EAED' }}>
            <div className="px-5 py-3.5" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
              <h2 className="font-semibold text-sm" style={{ color: '#202124' }}>Fonti di Conoscenza nel Prompt</h2>
            </div>
            <div className="divide-y" style={{ borderColor: '#F1F3F4' }}>
              {[
                { key: 'usePatterns', label: 'Pattern di Successo', desc: 'Inietta i pattern più rilevanti nel system prompt degli agenti' },
                { key: 'usePlaybooks', label: 'Playbook Strategici', desc: 'Includi i playbook step-by-step nel contesto degli agenti' },
                { key: 'useOutcomes', label: 'Traccia Outcome', desc: 'Monitora i risultati delle azioni degli agenti nel tempo' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <div className="text-sm font-medium" style={{ color: '#202124' }}>{item.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#5F6368' }}>{item.desc}</div>
                  </div>
                  <Toggle value={(kbSettings as any)[item.key]} onChange={v => updateKb(item.key, v)} />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8EAED' }}>
            <div className="px-5 py-3.5" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
              <h2 className="font-semibold text-sm" style={{ color: '#202124' }}>Filtro Qualità Pattern</h2>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium" style={{ color: '#202124' }}>Success Rate minima per includere un pattern</label>
                <span className="text-sm font-bold tabular-nums" style={{ color: '#34A853' }}>{kbSettings.minSuccessRate}%</span>
              </div>
              <input type="range" min="0" max="100" step="10" value={kbSettings.minSuccessRate}
                onChange={e => updateKb('minSuccessRate', parseInt(e.target.value))}
                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: '#34A853', background: '#E8EAED' }} />
              <div className="flex justify-between mt-1">
                <span className="text-[10px]" style={{ color: '#9AA0AC' }}>0% — Includi tutti</span>
                <span className="text-[10px]" style={{ color: '#9AA0AC' }}>100% — Solo i migliori</span>
              </div>
              <div className="mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-4" style={{ background: '#F8F9FA', border: '1px solid #E8EAED' }}>
                <span style={{ color: '#34A853', fontWeight: 600 }}>{patterns.filter(p => (p.successRate * 100) >= kbSettings.minSuccessRate).length} pattern inclusi</span>
                <span style={{ color: '#EA4335', fontWeight: 600 }}>{patterns.filter(p => p.successRate < 0.4).length} anti-pattern (sempre visibili)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={saveSettings} className="btn-primary" style={{ background: '#34A853' }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
              Salva impostazioni
            </button>
            {settingsSaved && <span className="text-sm font-medium flex items-center gap-1" style={{ color: '#34A853' }}>✓ Salvato!</span>}
          </div>
        </div>
      )}
    </div>
  );
}
