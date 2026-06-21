'use client';

import { useState, useRef, useEffect } from 'react';
import ModelSelector from '@/components/ModelSelector';
import { DEFAULT_APP_SETTINGS } from '@/lib/settings';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  thinking?: string;
  debugLogs?: string[];
  isStreaming?: boolean;
}

const AGENT_TYPE_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  strategy:   { color: '#1A73E8', bgColor: '#E8F0FE', label: 'Strategy' },
  tech:       { color: '#34A853', bgColor: '#E6F4EA', label: 'Tech' },
  finance:    { color: '#F9AB00', bgColor: '#FEF7E0', label: 'Finance' },
  marketing:  { color: '#EA4335', bgColor: '#FCE8E6', label: 'Marketing' },
  legal:      { color: '#9334E6', bgColor: '#F3E8FF', label: 'Legal' },
  operations: { color: '#17A2B8', bgColor: '#E0F7FA', label: 'Ops' },
};

const AGENT_DESC: Record<string, string> = {
  strategy:   'Analisi di mercato, strategie di crescita, competitor',
  tech:       'Architettura, codice, infrastruttura, DevOps',
  finance:    'Cash flow, fundraising, metriche SaaS',
  marketing:  'Campagne, contenuti, acquisizione utenti',
  legal:      'Contratti, incorporazione, compliance',
  operations: 'Workflow, automazione, gestione del team',
};

const STARTER_PROMPTS: Record<string, string[]> = {
  strategy:   ['Qual è il modello GTM ideale per un SaaS B2B early-stage?', 'Come strutturare l\'analisi dei competitor?', 'Aiutami a definire la proposta di valore per il mercato'],
  tech:       ['Consigliami l\'architettura database per i workflow queue', 'Come configuriamo il deploy su Vercel + Supabase?', 'Scrivi uno script di migrazione SQL con Row Level Security'],
  finance:    ['Come calcoliamo la runway con il burn rate attuale?', 'Crea una tabella di proiezioni finanziarie a 12 mesi', 'Quali metriche SaaS tracciare fin da subito?'],
  marketing:  ['Come impostiamo la strategia SEO a budget zero?', 'Pianifica un lancio su Product Hunt', 'Canali di acquisizione B2B SaaS con approccio PLG'],
  legal:      ['Clausole fondamentali per un contratto SaaS', 'Compliance GDPR per il tracciamento dei log', 'Ripartizione delle quote tra i founder'],
  operations: ['Come strutturare i ticket su Linear?', 'Configura un workflow di notifica con Zapier', 'Checklist per l\'onboarding del primo ingegnere'],
};

// ── Markdown Parser ──────────────────────────────────────────────────
function parseInlineMarkdown(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded font-mono text-[11px]"
          style={{ background: '#F1F3F4', color: '#202124', border: '1px solid #E8EAED' }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return part.split(/(\*\*[^*]+\*\*)/g).map((b, j) =>
      b.startsWith('**') && b.endsWith('**')
        ? <strong key={`${i}-${j}`} style={{ color: '#202124', fontWeight: 600 }}>{b.slice(2, -2)}</strong>
        : b
    );
  });
}

function formatMessageContent(content: string) {
  if (!content) return null;

  let processedContent = content;
  const codeBlockCount = (content.match(/```/g) || []).length;
  if (codeBlockCount % 2 !== 0) processedContent += '\n```';

  const parts = processedContent.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const codeLines = part.slice(3, -3).trim().split('\n');
      let language = 'text';
      let code = codeLines.join('\n');
      if (codeLines[0] && /^[a-zA-Z0-9+#-]+$/.test(codeLines[0].trim())) {
        language = codeLines[0].trim();
        code = codeLines.slice(1).join('\n');
      }
      return (
        <div key={index} className="my-3 rounded-lg overflow-hidden" style={{ border: '1px solid #E8EAED' }}>
          <div className="px-3 py-1.5 flex items-center justify-between" style={{ background: '#F1F3F4', borderBottom: '1px solid #E8EAED' }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#5F6368' }}>{language}</span>
          </div>
          <pre className="p-3 overflow-x-auto text-xs font-mono leading-relaxed" style={{ background: '#FAFAFA', color: '#202124' }}>
            <code>{code}</code>
          </pre>
        </div>
      );
    }

    const lines = part.split('\n');
    let tableRows: any[] = [];
    let listItems: any[] = [];
    let inList = false;
    let inTable = false;
    const renderedLines: any[] = [];

    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];

      if (line.trim().startsWith('|')) {
        inTable = true;
        if (line.includes('---')) continue;
        const cells = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        tableRows.push(cells);
        continue;
      } else if (inTable) {
        inTable = false;
        renderedLines.push(
          <div key={`table-${l}`} className="my-3 overflow-x-auto rounded-lg" style={{ border: '1px solid #E8EAED' }}>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
                  {tableRows[0]?.map((cell: string, idx: number) => (
                    <th key={idx} className="p-2.5 font-semibold" style={{ color: '#5F6368' }}>{parseInlineMarkdown(cell)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.slice(1).map((row: string[], rowIdx: number) => (
                  <tr key={rowIdx} style={{ borderBottom: '1px solid #F1F3F4' }}>
                    {row.map((cell: string, idx: number) => (
                      <td key={idx} className="p-2.5" style={{ color: '#202124' }}>{parseInlineMarkdown(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
      }

      const isUnorderedList = /^\s*[-*]/.test(line);
      const isOrderedList = /^\s*\d+\.?\s*/.test(line);

      if (isUnorderedList || isOrderedList) {
        inList = true;
        listItems.push({ text: line.replace(/^\s*([-*]|\d+\.?)\s*/, ''), ordered: isOrderedList });
        continue;
      } else if (inList) {
        inList = false;
        const isOrdered = listItems[0]?.ordered;
        const Tag = isOrdered ? 'ol' : 'ul';
        renderedLines.push(
          <Tag key={`list-${l}`} className={isOrdered ? 'list-decimal' : 'list-disc'} style={{ paddingLeft: '1.25rem', margin: '6px 0', color: '#3C4043', fontSize: '0.8125rem', lineHeight: '1.6' }}>
            {listItems.map((item, idx) => <li key={idx}>{parseInlineMarkdown(item.text)}</li>)}
          </Tag>
        );
        listItems = [];
      }

      if (line.trim().startsWith('#')) {
        const hashCount = line.match(/^#+/)?.[0].length || 0;
        const text = line.replace(/^#+/, '').trim();
        if (hashCount === 1) renderedLines.push(<h1 key={l} className="font-bold mt-4 mb-2 text-sm" style={{ color: '#202124' }}>{parseInlineMarkdown(text)}</h1>);
        else if (hashCount === 2) renderedLines.push(<h2 key={l} className="font-semibold mt-3 mb-1.5 text-sm" style={{ color: '#202124' }}>{parseInlineMarkdown(text)}</h2>);
        else renderedLines.push(<h3 key={l} className="font-semibold mt-2.5 mb-1 text-xs" style={{ color: '#3C4043' }}>{parseInlineMarkdown(text)}</h3>);
        continue;
      }

      if (line.trim() !== '') {
        renderedLines.push(
          <p key={l} className="my-0.5 leading-relaxed" style={{ fontSize: '0.8125rem', color: '#3C4043' }}>
            {parseInlineMarkdown(line)}
          </p>
        );
      } else {
        renderedLines.push(<div key={l} className="h-2" />);
      }
    }

    if (tableRows.length > 0) {
      renderedLines.push(
        <div key="table-flush" className="my-3 overflow-x-auto rounded-lg" style={{ border: '1px solid #E8EAED' }}>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
                {tableRows[0]?.map((cell: string, idx: number) => (
                  <th key={idx} className="p-2.5 font-semibold" style={{ color: '#5F6368' }}>{parseInlineMarkdown(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.slice(1).map((row: string[], rowIdx: number) => (
                <tr key={rowIdx} style={{ borderBottom: '1px solid #F1F3F4' }}>
                  {row.map((cell: string, idx: number) => (
                    <td key={idx} className="p-2.5" style={{ color: '#202124' }}>{parseInlineMarkdown(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (listItems.length > 0) {
      const isOrdered = listItems[0]?.ordered;
      const Tag = isOrdered ? 'ol' : 'ul';
      renderedLines.push(
        <Tag key="list-flush" className={isOrdered ? 'list-decimal' : 'list-disc'} style={{ paddingLeft: '1.25rem', margin: '6px 0', color: '#3C4043', fontSize: '0.8125rem', lineHeight: '1.6' }}>
          {listItems.map((item, idx) => <li key={idx}>{parseInlineMarkdown(item.text)}</li>)}
        </Tag>
      );
    }

    return <div key={index}>{renderedLines}</div>;
  });
}

// ── Main Component ────────────────────────────────────────────────────
const AVAILABLE_TOOLS = [
  {
    name: 'webSearch',
    label: 'Cerca su Internet',
    icon: '🌐',
    defaultDescription: 'Esegue una ricerca web su Internet in tempo reale per reperire informazioni aggiornate, notizie, trend di mercato e dati finanziari utili.',
    parameters: 'query: string (la query di ricerca)'
  },
  {
    name: 'readWebPage',
    label: 'Leggi Pagina Web',
    icon: '📄',
    defaultDescription: 'Scarica e legge il testo contenuto in una pagina web/URL specificato per estrarne notizie, articoli o informazioni dettagliate.',
    parameters: 'url: string (l\'indirizzo URL completo)'
  },
  {
    name: 'getStartupInfo',
    label: 'Informazioni Startup',
    icon: '🚀',
    defaultDescription: 'Recupera le informazioni generali e le metriche finanziarie chiave della startup (nome, settore, fase, MRR, utenti, burn rate, runway).',
    parameters: 'Nessuno'
  },
  {
    name: 'getCustomMetrics',
    label: 'Metriche Personalizzate',
    icon: '📊',
    defaultDescription: 'Recupera l\'elenco di tutte le metriche personalizzate e i relativi grafici configurati per la dashboard (titolo, valore, formula, andamento dati).',
    parameters: 'Nessuno'
  },
  {
    name: 'get_knowledge_pattern_details',
    label: 'Dettagli Pattern',
    icon: '🧠',
    defaultDescription: 'Recupera i dettagli completi (analisi qualitativa, fattori di successo, checklist errori) di una specifica conoscenza o pattern inserendo il suo ID.',
    parameters: 'patternId: string (l\'ID del pattern)'
  }
];

export default function AgentsPage() {
  const [settings, setSettings] = useState<any>(DEFAULT_APP_SETTINGS);
  const [agentsList, setAgentsList] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('openrouter/owl-alpha');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAgentType, setNewAgentType] = useState('strategy');
  const [newAgentName, setNewAgentName] = useState('');
  const [creatingAgent, setCreatingAgent] = useState(false);

  const [showToolsPanel, setShowToolsPanel] = useState(false);
  const [expandedToolCustomization, setExpandedToolCustomization] = useState<string | null>(null);
  const [customDescriptionText, setCustomDescriptionText] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // ── Sidebar collapse & resize ────────────────────────────────────
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(288); // 18rem default
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(288);
  const agentSidebarRef = useRef<HTMLDivElement>(null);

  // Persist sidebar state
  useEffect(() => {
    const stored = localStorage.getItem('agentfoundry_sidebar');
    if (stored) {
      try {
        const { collapsed, width } = JSON.parse(stored);
        if (typeof collapsed === 'boolean') setSidebarCollapsed(collapsed);
        if (typeof width === 'number') setSidebarWidth(width);
      } catch {}
    }
  }, []);

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem('agentfoundry_sidebar', JSON.stringify({ collapsed: next, width: sidebarWidth }));
  };

  // Drag-to-resize handlers
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarCollapsed ? 52 : sidebarWidth;
    e.preventDefault();

    // Disable transitions during drag to avoid lag
    if (agentSidebarRef.current) {
      agentSidebarRef.current.style.transition = 'none';
    }

    let wasCollapsed = sidebarCollapsed;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = ev.clientX - startXRef.current;
      const computedWidth = startWidthRef.current + delta;

      // Snap to collapsed if dragged below 130px, otherwise allow smooth resize down to 130px
      const isCollapsedNow = computedWidth < 130;
      const newWidth = isCollapsedNow ? 52 : Math.max(130, Math.min(420, computedWidth));

      if (agentSidebarRef.current) {
        agentSidebarRef.current.style.width = `${newWidth}px`;
      }

      if (isCollapsedNow !== wasCollapsed) {
        wasCollapsed = isCollapsedNow;
        setSidebarCollapsed(isCollapsedNow);
      }
    };

    const handleMouseUp = (ev: MouseEvent) => {
      isResizingRef.current = false;
      const delta = ev.clientX - startXRef.current;
      const computedWidth = startWidthRef.current + delta;

      const isCollapsedNow = computedWidth < 130;
      // Snap to 52px if collapsed, otherwise keep within 200px - 420px expanded range
      const finalWidth = isCollapsedNow ? 52 : Math.max(200, Math.min(420, computedWidth));

      // Restore transitions
      if (agentSidebarRef.current) {
        agentSidebarRef.current.style.transition = '';
      }

      setSidebarWidth(finalWidth);
      setSidebarCollapsed(isCollapsedNow);
      localStorage.setItem('agentfoundry_sidebar', JSON.stringify({ collapsed: isCollapsedNow, width: finalWidth }));
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = (force = false) => {
    const c = chatContainerRef.current;
    if (!c) return;
    if (force || isAtBottomRef.current) c.scrollTo({ top: c.scrollHeight, behavior: 'auto' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  const handleScroll = () => {
    const c = chatContainerRef.current;
    if (!c) return;
    isAtBottomRef.current = c.scrollHeight - c.scrollTop - c.clientHeight <= 100;
  };

  useEffect(() => {
    const stored = localStorage.getItem('agentfoundry_settings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_APP_SETTINGS, ...parsed });
        if (parsed.defaultModel) setSelectedModel(parsed.defaultModel);
      } catch {}
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const agentParamId = params.get('id');

    fetch('/api/demo/agents')
      .then(r => r.json())
      .then(data => {
        setAgentsList(data);
        if (data.length > 0) {
          const target = data.find((a: any) => a.id === agentParamId);
          setSelectedAgent(target ? target.id : null);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedAgent) return;
    setLoading(true);
    setError(null);
    fetch(`/api/demo/chat?agentId=${selectedAgent}`)
      .then(r => r.json())
      .then(data => {
        isAtBottomRef.current = true;
        setMessages(data.map((m: any) => ({ role: m.role, content: m.content, timestamp: new Date(m.createdAt) })));
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedAgent]);

  const currentAgent = agentsList.find(a => a.id === selectedAgent);
  const agentConfig = currentAgent ? (AGENT_TYPE_CONFIG[currentAgent.type] || AGENT_TYPE_CONFIG['strategy']) : null;

  const createAgent = async () => {
    if (!newAgentName.trim()) return;
    setCreatingAgent(true);
    try {
      const res = await fetch('/api/demo/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: newAgentType, name: newAgentName.trim() }),
      });
      if (res.ok) {
        const newAgent = await res.json();
        setAgentsList(prev => [...prev, newAgent]);
        setSelectedAgent(newAgent.id);
        setMessages([]);
        setShowCreateForm(false);
        setNewAgentName('');
      }
    } catch (err: any) { setError(err.message); }
    finally { setCreatingAgent(false); }
  };

  const deleteAgent = async () => {
    if (!selectedAgent || !currentAgent) return;
    if (!confirm(`Eliminare permanentemente "${currentAgent.name}"?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/demo/agents?id=${selectedAgent}`, { method: 'DELETE' });
      if (res.ok) {
        const remaining = agentsList.filter(a => a.id !== selectedAgent);
        setAgentsList(remaining);
        setMessages([]);
        setSelectedAgent(null);
      }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const quickCreateAgent = async (type: string) => {
    const defaultNames: Record<string, string> = {
      strategy: 'Strategy Advisor',
      tech: 'Tech Lead',
      finance: 'CFO Advisor',
      marketing: 'Growth Specialist',
      legal: 'Legal Counsel',
      operations: 'Operations Director',
    };
    const name = defaultNames[type] || 'Nuovo Agente';
    setCreatingAgent(true);
    try {
      const res = await fetch('/api/demo/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name }),
      });
      if (res.ok) {
        const newAgent = await res.json();
        setAgentsList(prev => [...prev, newAgent]);
        setSelectedAgent(newAgent.id);
        setMessages([]);
        setShowCreateForm(false);
        setNewAgentName('');
      }
    } catch (err: any) { setError(err.message); }
    finally { setCreatingAgent(false); }
  };

  const updateAgentSettings = async (updatedSettings: any) => {
    if (!selectedAgent) return;
    setSavingSettings(true);
    try {
      const res = await fetch('/api/demo/agents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedAgent,
          settings: updatedSettings
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setAgentsList(prev => prev.map(a => a.id === selectedAgent ? { ...a, settings: updated.settings } : a));
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Errore salvataggio impostazioni');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleTool = async (toolName: string) => {
    if (!selectedAgent || !currentAgent) return;
    const currentSettings = currentAgent.settings || {};
    const enabledTools = currentSettings.enabledTools || [
      "get_knowledge_pattern_details",
      "webSearch",
      "getStartupInfo",
      "getCustomMetrics",
      "readWebPage"
    ];

    let newEnabledTools;
    if (enabledTools.includes(toolName)) {
      newEnabledTools = enabledTools.filter((t: string) => t !== toolName);
    } else {
      newEnabledTools = [...enabledTools, toolName];
    }

    const nextSettings = {
      ...currentSettings,
      enabledTools: newEnabledTools
    };

    await updateAgentSettings(nextSettings);
  };

  const saveCustomDescription = async (toolName: string, description: string) => {
    if (!selectedAgent || !currentAgent) return;
    const currentSettings = currentAgent.settings || {};
    const customDescriptions = currentSettings.customDescriptions || {};

    const nextSettings = {
      ...currentSettings,
      customDescriptions: {
        ...customDescriptions,
        [toolName]: description.trim()
      }
    };

    await updateAgentSettings(nextSettings);
    setExpandedToolCustomization(null);
  };

  const resetCustomDescription = async (toolName: string) => {
    if (!selectedAgent || !currentAgent) return;
    const currentSettings = currentAgent.settings || {};
    const customDescriptions = { ...(currentSettings.customDescriptions || {}) };
    delete customDescriptions[toolName];

    const nextSettings = {
      ...currentSettings,
      customDescriptions
    };

    await updateAgentSettings(nextSettings);
    setExpandedToolCustomization(null);
  };

  const sendMessage = async () => {
    const userMessage = input.trim();
    if (!userMessage || !selectedAgent || loading || !currentAgent) return;

    setInput('');
    setError(null);
    isAtBottomRef.current = true;
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);
    setLoading(true);

    try {
      const res = await fetch('/api/demo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: currentAgent.id, agentType: currentAgent.type, message: userMessage, modelId: selectedModel, settings }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || err.error || 'Errore sconosciuto');
      }

      isAtBottomRef.current = true;
      setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: new Date(), thinking: '', debugLogs: [], isStreaming: true }]);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = '';

      while (!done && reader) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (done) break;
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const clean = line.trim();
          if (!clean || !clean.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(clean.substring(6));
            if (parsed.type === 'debug') {
              setMessages(prev => {
                const u = [...prev];
                const last = u[u.length - 1];
                if (last?.role === 'assistant') u[u.length - 1] = { ...last, debugLogs: [...(last.debugLogs || []), parsed.content] };
                return u;
              });
            } else if (parsed.type === 'thinking') {
              setMessages(prev => {
                const u = [...prev];
                const last = u[u.length - 1];
                if (last?.role === 'assistant') u[u.length - 1] = { ...last, thinking: (last.thinking || '') + parsed.content };
                return u;
              });
            } else if (parsed.type === 'text') {
              setMessages(prev => {
                const u = [...prev];
                const last = u[u.length - 1];
                if (last?.role === 'assistant') u[u.length - 1] = { ...last, content: (last.content || '') + parsed.content };
                return u;
              });
            } else if (parsed.type === 'error') {
              setError(parsed.content);
            } else if (parsed.type === 'done') {
              setMessages(prev => {
                const u = [...prev];
                const last = u[u.length - 1];
                if (last?.role === 'assistant') u[u.length - 1] = { ...last, isStreaming: false };
                return u;
              });
              done = true;
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setError(err.message);
      setMessages(prev => [...prev, { role: 'assistant', content: `Errore: ${err.message}`, timestamp: new Date(), isStreaming: false }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F8F9FA' }}>
      {/* ── Agent Sidebar ───────────────────────────────────────── */}
      <div
        ref={agentSidebarRef}
        className="flex flex-col flex-shrink-0 h-full overflow-hidden transition-all duration-200"
        style={{
          width: sidebarCollapsed ? '52px' : `${sidebarWidth}px`,
          minWidth: sidebarCollapsed ? '52px' : '200px',
          background: '#FFFFFF',
          borderRight: '1px solid #E8EAED',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div 
          className={`flex items-center flex-shrink-0 ${sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-3'}`} 
          style={{ 
            height: '56px', 
            borderBottom: '1px solid #E8EAED', 
            gap: '6px' 
          }}
        >
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0 pl-1">
              <h2 className="font-semibold text-sm truncate" style={{ color: '#202124' }}>Agenti AI</h2>
              <p className="text-xs" style={{ color: '#9AA0AC' }}>{agentsList.length} agenti</p>
            </div>
          )}
          <div className="flex items-center gap-1">
            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={() => setShowCreateForm(v => !v)}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ background: showCreateForm ? '#E8F0FE' : '#F1F3F4', color: showCreateForm ? '#1A73E8' : '#5F6368' }}
                title="Aggiungi Agente"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
              </button>
            )}
            {/* Collapse / Expand toggle */}
            <button
              type="button"
              onClick={toggleSidebar}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: '#F1F3F4', color: '#5F6368' }}
              title={sidebarCollapsed ? 'Espandi pannello agenti' : 'Comprimi pannello agenti'}
            >
              {sidebarCollapsed ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Create Form — hidden when collapsed */}
        {showCreateForm && !sidebarCollapsed && (
          <div className="p-3 space-y-2.5 animate-fade-in" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
            <p className="text-xs font-semibold" style={{ color: '#5F6368' }}>Nuovo Agente</p>
            <div>
              <label className="block text-[10px] font-medium mb-1" style={{ color: '#5F6368' }}>Ruolo</label>
              <select
                value={newAgentType}
                onChange={e => setNewAgentType(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg text-xs focus:outline-none"
                style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }}
              >
                <option value="strategy">Strategy</option>
                <option value="tech">Tech</option>
                <option value="finance">Finance</option>
                <option value="marketing">Marketing</option>
                <option value="legal">Legal</option>
                <option value="operations">Operations</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium mb-1" style={{ color: '#5F6368' }}>Nome</label>
              <input
                type="text"
                placeholder="Es: CTO Advisor..."
                value={newAgentName}
                onChange={e => setNewAgentName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createAgent()}
                className="w-full px-2.5 py-1.5 rounded-lg text-xs focus:outline-none"
                style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: '#F1F3F4', color: '#5F6368', border: '1px solid #E8EAED' }}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={createAgent}
                disabled={creatingAgent || !newAgentName.trim()}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50"
                style={{ background: '#1A73E8' }}
              >
                {creatingAgent ? 'Crea...' : 'Crea'}
              </button>
            </div>
          </div>
        )}

        {/* Agent List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
          {sidebarCollapsed ? (
            <button
              onClick={() => { setSelectedAgent(null); setMessages([]); setError(null); }}
              className="w-full flex justify-center py-2.5 transition-colors border-b border-[#F1F3F4] mb-1 relative"
              style={{
                background: selectedAgent === null ? '#E8F0FE' : 'transparent',
                borderLeft: selectedAgent === null ? `3px solid #1A73E8` : '3px solid transparent'
              }}
              title="Dashboard Team"
              onMouseEnter={e => { if (selectedAgent !== null) e.currentTarget.style.background = '#F8F9FA'; }}
              onMouseLeave={e => { if (selectedAgent !== null) e.currentTarget.style.background = 'transparent'; }}
            >
              <span className="text-base">📊</span>
            </button>
          ) : (
            <button
              onClick={() => { setSelectedAgent(null); setMessages([]); setError(null); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-[#F1F3F4] mb-1"
              style={{
                background: selectedAgent === null ? '#E8F0FE' : 'transparent',
                borderLeft: selectedAgent === null ? `3px solid #1A73E8` : '3px solid transparent'
              }}
              onMouseEnter={e => { if (selectedAgent !== null) e.currentTarget.style.background = '#F8F9FA'; }}
              onMouseLeave={e => { if (selectedAgent !== null) e.currentTarget.style.background = 'transparent'; }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-base bg-[#E8F0FE] text-[#1A73E8] flex-shrink-0"
              >
                📊
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-xs truncate" style={{ color: '#1A73E8' }}>Dashboard Team</div>
                <div className="text-[10px] truncate mt-0.5" style={{ color: '#5F6368' }}>Panoramica dipendenti</div>
              </div>
            </button>
          )}

          {agentsList.map(agent => {
            const isSelected = selectedAgent === agent.id;
            const cfg = AGENT_TYPE_CONFIG[agent.type] || AGENT_TYPE_CONFIG['strategy'];
            return sidebarCollapsed ? (
              /* Icon-only view when collapsed */
              <button
                key={agent.id}
                onClick={() => { setSelectedAgent(agent.id); setMessages([]); setError(null); }}
                className="w-full flex justify-center py-2.5 transition-colors relative"
                style={{ background: isSelected ? '#E8F0FE' : 'transparent', borderLeft: isSelected ? `3px solid #1A73E8` : '3px solid transparent' }}
                title={agent.name}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#F8F9FA'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: cfg.color }}
                >
                  {agent.name.charAt(0).toUpperCase()}
                </div>
              </button>
            ) : (
              /* Full view when expanded */
              <button
                key={agent.id}
                onClick={() => { setSelectedAgent(agent.id); setMessages([]); setError(null); }}
                className="w-full flex items-center gap-3 px-3 py-3 text-left transition-colors"
                style={{ background: isSelected ? '#E8F0FE' : 'transparent', borderLeft: isSelected ? `3px solid #1A73E8` : '3px solid transparent' }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#F8F9FA'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: cfg.color }}
                >
                  {agent.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate" style={{ color: '#202124' }}>{agent.name}</div>
                  <div className="text-xs truncate mt-0.5" style={{ color: '#5F6368' }}>{AGENT_DESC[agent.type] || agent.type}</div>
                </div>
                {isSelected && (
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#1A73E8' }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Drag-Resize Handle ──────────────────────────────────────────── */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="flex-shrink-0 flex items-center justify-center group"
        style={{
          width: '6px',
          cursor: 'col-resize',
          background: 'transparent',
          position: 'relative',
          zIndex: 10,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#E8EAED')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        title="Trascina per ridimensionare"
      >
        {/* Visible grip dots */}
        {!sidebarCollapsed && (
          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {[0,1,2].map(i => (
              <div key={i} className="w-1 h-1 rounded-full" style={{ background: '#9AA0AC' }} />
            ))}
          </div>
        )}
      </div>

      {/* ── Chat Area ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: '#F8F9FA' }}>
        {currentAgent && agentConfig ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between px-5 py-3" style={{ background: '#FFFFFF', borderBottom: '1px solid #E8EAED' }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: agentConfig.color }}
                >
                  {currentAgent.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm" style={{ color: '#202124' }}>{currentAgent.name}</span>
                    <span
                      className="chip"
                      style={{
                        background: agentConfig.bgColor,
                        color: agentConfig.color,
                        borderColor: agentConfig.bgColor,
                        textTransform: 'uppercase',
                        fontSize: '0.6rem',
                      }}
                    >
                      {agentConfig.label}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: '#5F6368' }}>
                    {AGENT_DESC[currentAgent.type] || currentAgent.type}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} />
                
                {/* Wrench button for tool configuration */}
                <button
                  onClick={() => setShowToolsPanel(prev => !prev)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ 
                    color: showToolsPanel ? '#1A73E8' : '#5F6368',
                    background: showToolsPanel ? '#E8F0FE' : 'transparent'
                  }}
                  title="Configurazione Strumenti"
                  onMouseEnter={e => { if(!showToolsPanel) e.currentTarget.style.background = '#F1F3F4'; }}
                  onMouseLeave={e => { if(!showToolsPanel) e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                </button>

                <button
                  onClick={deleteAgent}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ color: '#EA4335' }}
                  title="Elimina agente"
                  onMouseEnter={e => (e.currentTarget.style.background = '#FCE8E6')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={chatContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar"
              style={{ background: '#F8F9FA' }}
            >
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 max-w-lg mx-auto text-center animate-fade-in">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold text-white mb-4"
                    style={{ background: agentConfig.color }}
                  >
                    {currentAgent.name.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="font-semibold text-base mb-2" style={{ color: '#202124' }}>
                    Inizia una conversazione con {currentAgent.name}
                  </h3>
                  <p className="text-sm leading-relaxed mb-8" style={{ color: '#5F6368' }}>
                    {AGENT_DESC[currentAgent.type] || 'Agente AI personalizzato'}
                  </p>
                  <div className="grid grid-cols-1 gap-2 w-full text-left">
                    {(STARTER_PROMPTS[currentAgent.type] || STARTER_PROMPTS['strategy']).map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => setInput(prompt)}
                        className="px-4 py-3 rounded-xl text-sm text-left transition-colors"
                        style={{ background: '#FFFFFF', border: '1px solid #E8EAED', color: '#3C4043', boxShadow: '0 1px 2px rgba(60,64,67,0.1)' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#1A73E8'; e.currentTarget.style.color = '#1A73E8'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E8EAED'; e.currentTarget.style.color = '#3C4043'; }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                    {!isUser && (
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mr-2.5 mt-0.5" style={{ background: agentConfig.color }}>
                        {currentAgent.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div
                      className="max-w-[75%] rounded-2xl px-4 py-3"
                      style={
                        isUser
                          ? { background: '#1A73E8', color: '#FFFFFF', borderTopRightRadius: '4px', boxShadow: '0 1px 3px rgba(26,115,232,0.3)' }
                          : { background: '#FFFFFF', color: '#202124', borderTopLeftRadius: '4px', border: '1px solid #E8EAED', boxShadow: '0 1px 2px rgba(60,64,67,0.1)' }
                      }
                    >
                      {/* Debug logs */}
                      {!isUser && msg.debugLogs && msg.debugLogs.length > 0 && (
                        <details className="mb-2.5 rounded-lg overflow-hidden" style={{ background: '#F8F9FA', border: '1px solid #E8EAED' }} open={msg.isStreaming}>
                          <summary className="px-3 py-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide cursor-pointer select-none" style={{ color: '#5F6368' }}>
                            <span className={`w-1.5 h-1.5 rounded-full ${msg.isStreaming ? 'animate-pulse' : ''}`} style={{ background: msg.isStreaming ? '#F9AB00' : '#34A853' }} />
                            Workflow Logs
                            <span className="ml-auto">▾</span>
                          </summary>
                          <div className="px-3 pb-3 pt-1 space-y-1 max-h-32 overflow-y-auto custom-scrollbar" style={{ borderTop: '1px solid #E8EAED' }}>
                            {msg.debugLogs.map((log, j) => (
                              <div key={j} className="flex items-center gap-1.5 font-mono text-[10px]" style={{ color: j === msg.debugLogs!.length - 1 && msg.isStreaming ? '#1A73E8' : '#5F6368' }}>
                                <span>{j === msg.debugLogs!.length - 1 && msg.isStreaming ? '●' : '✓'}</span>
                                <span>{log}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      {/* Thinking block */}
                      {!isUser && msg.thinking && (
                        <details className="group mb-3.5 rounded-xl overflow-hidden border border-[#DADCE0] bg-[#F8F9FA]/80 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-300 w-full" open={msg.isStreaming}>
                          <summary className="px-4 py-2.5 flex items-center gap-2.5 text-[11px] font-medium tracking-wide cursor-pointer select-none text-[#5F6368] hover:bg-[#F1F3F4]/50 hover:text-[#1A73E8] transition-colors focus:outline-none list-none">
                            <div className="flex items-center gap-2">
                              {/* Glowing/pulsing mind icon */}
                              <span className="relative flex h-2 w-2">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1A73E8] opacity-75 ${!msg.isStreaming && 'hidden'}`}></span>
                                <span className={`relative inline-flex rounded-full h-2 w-2 bg-[#1A73E8] ${!msg.isStreaming && 'bg-[#9AA0AC]'}`}></span>
                              </span>
                              <span className="font-semibold uppercase tracking-wider text-[10px]">
                                {msg.isStreaming ? 'Ragionamento in corso...' : 'Ragionamento completato'}
                              </span>
                            </div>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
                              className="w-3 h-3 ml-auto transform group-open:rotate-180 transition-transform duration-200 text-[#70757a]"
                            >
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </summary>
                          <div className="px-4 pb-3.5 pt-2 text-[11px] leading-relaxed font-mono whitespace-pre-wrap border-t border-[#E8EAED]/60 text-[#3C4043]">
                            {msg.thinking}
                          </div>
                        </details>
                      )}

                      {/* Content */}
                      <div style={{ fontSize: '0.8125rem', lineHeight: '1.6', color: isUser ? '#FFFFFF' : '#202124' }}>
                        {isUser
                          ? parseInlineMarkdown(msg.content)
                          : msg.content
                            ? formatMessageContent(msg.content)
                            : msg.isStreaming
                              ? <span className="animate-pulse-soft" style={{ color: '#9AA0AC' }}>Elaborazione...</span>
                              : null
                        }
                      </div>

                      {/* Timestamp */}
                      <div className="flex items-center gap-1 mt-2" style={{ fontSize: '0.6875rem', color: isUser ? 'rgba(255,255,255,0.6)' : '#9AA0AC' }}>
                        <span>{isUser ? 'Tu' : currentAgent.name}</span>
                        <span>·</span>
                        <span>{msg.timestamp.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    {isUser && (
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ml-2.5 mt-0.5" style={{ background: '#5F6368' }}>
                        F
                      </div>
                    )}
                  </div>
                );
              })}

              {loading && !messages.some(m => m.role === 'assistant' && m.isStreaming) && (
                <div className="flex justify-start animate-fade-in">
                  <div className="w-7 h-7 rounded-lg flex-shrink-0 mr-2.5" style={{ background: agentConfig.color }} />
                  <div className="px-4 py-3 rounded-2xl" style={{ background: '#FFFFFF', border: '1px solid #E8EAED' }}>
                    <div className="flex gap-1.5 items-center">
                      {[0, 150, 300].map(delay => (
                        <span key={delay} className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#DADCE0', animationDelay: `${delay}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div ref={el => { if (el) el.style.height = '1px'; }} />
            </div>

            {/* Error banner */}
            {error && (
              <div className="mx-5 mb-2 px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm animate-fade-in" style={{ background: '#FCE8E6', border: '1px solid #F7CECE', color: '#C5221F' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                {error}
              </div>
            )}

            {/* Input Area */}
            <div className="px-5 py-4" style={{ background: '#FFFFFF', borderTop: '1px solid #E8EAED' }}>
              <div className="flex items-end gap-3 max-w-4xl mx-auto">
                <div
                  className="flex-1 flex items-end rounded-2xl overflow-hidden transition-all"
                  style={{ background: '#F8F9FA', border: '1px solid #E8EAED' }}
                  onFocusCapture={e => (e.currentTarget.style.borderColor = '#1A73E8')}
                  onBlurCapture={e => (e.currentTarget.style.borderColor = '#E8EAED')}
                >
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Scrivi a ${currentAgent.name}...`}
                    rows={1}
                    className="flex-1 px-4 py-3 bg-transparent resize-none focus:outline-none text-sm"
                    style={{ color: '#202124', minHeight: '44px', maxHeight: '120px' }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={loading || !input.trim()}
                    className="m-2 w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40"
                    style={{ background: '#1A73E8', boxShadow: '0 1px 2px rgba(26,115,232,0.3)' }}
                  >
                    {loading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <p className="text-center mt-2 text-[10px]" style={{ color: '#9AA0AC' }}>
                Premi Enter per inviare · Shift+Enter per andare a capo
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#F8F9FA]">
            {/* Dashboard Header */}
            <div className="max-w-5xl mx-auto mb-8 animate-fade-in">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E8EAED] pb-6 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#202124] tracking-tight">Dashboard Dipendenti AI</h1>
                  <p className="text-sm text-[#5F6368] mt-1">
                    Visualizza, gestisci e coordina il tuo team di agenti intelligenti specializzati.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(v => !v)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all duration-200 hover:scale-102 flex items-center gap-1.5 shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #1A73E8, #34A853)' }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M19 13h-6v6-2v-6H5v-2h6V5h2v6h6v2z"/>
                  </svg>
                  Nuovo Dipendente
                </button>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                {/* Stat 1 */}
                <div className="bg-white p-5 rounded-2xl border border-[#E8EAED] shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 rounded-xl bg-[#E8F0FE] flex items-center justify-center text-xl text-[#1A73E8] font-bold">
                    👥
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold tracking-wider text-[#9AA0AC]">Totale Dipendenti</div>
                    <div className="text-xl font-bold text-[#202124] mt-0.5">{agentsList.length} / 6</div>
                    <div className="text-[10px] text-[#5F6368] mt-0.5">Agenti operativi pronti</div>
                  </div>
                </div>

                {/* Stat 2 */}
                <div className="bg-white p-5 rounded-2xl border border-[#E8EAED] shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 rounded-xl bg-[#E6F4EA] flex items-center justify-center text-xl text-[#34A853] font-bold">
                    📊
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold tracking-wider text-[#9AA0AC]">Dipartimenti Coperti</div>
                    <div className="text-xl font-bold text-[#202124] mt-0.5">
                      {agentsList.length > 0 ? Math.round((new Set(agentsList.map(a => a.type)).size / 6) * 100) : 0}%
                    </div>
                    <div className="text-[10px] text-[#5F6368] mt-0.5">
                      {new Set(agentsList.map(a => a.type)).size} di 6 dipartimenti attivi
                    </div>
                  </div>
                </div>

                {/* Stat 3 */}
                <div className="bg-white p-5 rounded-2xl border border-[#E8EAED] shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 rounded-xl bg-[#FEF7E0] flex items-center justify-center text-xl text-[#F9AB00] font-bold">
                    ⚡
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold tracking-wider text-[#9AA0AC]">Stato Team</div>
                    <div className="text-xl font-bold text-[#34A853] mt-0.5 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#34A853] animate-pulse" />
                      Attivo
                    </div>
                    <div className="text-[10px] text-[#5F6368] mt-0.5">Pronti per la delega di compiti</div>
                  </div>
                </div>
              </div>

              {/* Departments Title */}
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#5F6368] mb-4">Dipartimenti e Copertura</h2>

              {/* Grid of 6 Departments */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(AGENT_TYPE_CONFIG).map(([type, cfg]) => {
                  const matchingAgent = agentsList.find(a => a.type === type);
                  const desc = AGENT_DESC[type] || 'Dipartimento operativo della startup';
                  const iconMap: Record<string, string> = {
                    strategy: '🎯',
                    tech: '⚙️',
                    finance: '💰',
                    marketing: '📣',
                    legal: '⚖️',
                    operations: '🔧',
                  };

                  return (
                    <div
                      key={type}
                      className="bg-white rounded-2xl border border-[#E8EAED] p-5 shadow-sm hover:shadow-md hover:border-[#DADCE0] transition-all flex flex-col justify-between"
                      style={{ borderTop: `4px solid ${cfg.color}` }}
                    >
                      <div>
                        {/* Title and Badge */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{iconMap[type] || '🤖'}</span>
                            <span className="font-bold text-xs" style={{ color: '#202124' }}>
                              {cfg.label}
                            </span>
                          </div>
                          <span
                            className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                            style={{
                              background: matchingAgent ? '#E6F4EA' : '#F1F3F4',
                              color: matchingAgent ? '#137333' : '#5F6368',
                            }}
                          >
                            {matchingAgent ? '✓ Creato' : 'Disponibile'}
                          </span>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-[#5F6368] leading-relaxed mb-4">
                          {desc}
                        </p>

                        {/* Agent info if created */}
                        {matchingAgent && (
                          <div className="p-2.5 rounded-xl bg-[#F8F9FA] border border-[#E8EAED] mb-4">
                            <div className="text-[10px] text-[#9AA0AC] font-semibold">Dipendente Assegnato</div>
                            <div className="text-xs font-bold text-[#202124] mt-0.5 truncate">
                              {matchingAgent.name}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Button */}
                      <div>
                        {matchingAgent ? (
                          <button
                            onClick={() => { setSelectedAgent(matchingAgent.id); setMessages([]); setError(null); }}
                            className="w-full py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90 flex items-center justify-center gap-1.5"
                            style={{ background: cfg.color }}
                          >
                            💬 Avvia Chat
                          </button>
                        ) : (
                          <button
                            onClick={() => quickCreateAgent(type)}
                            disabled={creatingAgent}
                            className="w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                            style={{
                              background: '#F1F3F4',
                              color: '#1A73E8',
                              border: '1px solid #DADCE0',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = cfg.bgColor;
                              e.currentTarget.style.color = cfg.color;
                              e.currentTarget.style.borderColor = cfg.color;
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = '#F1F3F4';
                              e.currentTarget.style.color = '#1A73E8';
                              e.currentTarget.style.borderColor = '#DADCE0';
                            }}
                          >
                            ➕ Crea Dipendente
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Team Collaboration Panel / Information */}
              <div className="mt-8 bg-gradient-to-r from-[#EEF2FF] to-[#E0E7FF] p-6 rounded-2xl border border-[#C7D2FE] flex items-start gap-4">
                <div className="text-3xl">💡</div>
                <div>
                  <h3 className="font-bold text-sm text-[#1E3A8A] mb-1">Collaborazione Interdisciplinare</h3>
                  <p className="text-xs text-[#3730A3] leading-relaxed">
                    Il tuo CoFounder virtuale può delegare compiti complessi a questi agenti in background. 
                    Ad esempio, se chiedi al CoFounder un'analisi finanziaria avanzata, interrogherà automaticamente l'agente Finance 
                    e sintetizzerà il risultato per te!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Tools Configuration Panel ────────────────────────────────── */}
      {currentAgent && showToolsPanel && (
        <div
          className="flex-shrink-0 flex flex-col h-full bg-white border-l border-gray-200 transition-all duration-200"
          style={{ width: '360px', borderLeft: '1px solid #E8EAED', background: '#FFFFFF' }}
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0" style={{ height: '56px', borderBottom: '1px solid #E8EAED' }}>
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-blue-600" style={{ color: '#1A73E8' }}>
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
              <span className="font-semibold text-sm text-gray-800" style={{ color: '#202124' }}>Configurazione Strumenti</span>
            </div>
            <button
              onClick={() => setShowToolsPanel(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
              title="Chiudi pannello"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Panel Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            <p className="text-xs text-gray-500 leading-relaxed mb-1" style={{ color: '#5F6368' }}>
              Abilita o disabilita gli strumenti disponibili per <strong>{currentAgent.name}</strong>. Puoi anche personalizzare le istruzioni/descrizioni inviate al modello per descrivere come utilizzare lo strumento.
            </p>

            {savingSettings && (
              <div className="py-1 px-2 text-[10px] font-semibold text-blue-600 bg-blue-50 rounded flex items-center gap-1.5 animate-pulse" style={{ background: '#E8F0FE', color: '#1A73E8' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" style={{ background: '#1A73E8' }} />
                Salvataggio configurazione in corso...
              </div>
            )}

            <div className="space-y-3">
              {AVAILABLE_TOOLS.map(tool => {
                const settingsObj = currentAgent.settings || {};
                const enabledTools = settingsObj.enabledTools || [
                  "get_knowledge_pattern_details",
                  "webSearch",
                  "getStartupInfo",
                  "getCustomMetrics",
                  "readWebPage"
                ];
                const isEnabled = enabledTools.includes(tool.name);
                const customDesc = settingsObj.customDescriptions?.[tool.name] || '';
                const isCustomized = !!customDesc;
                const isExpanded = expandedToolCustomization === tool.name;

                return (
                  <div
                    key={tool.name}
                    className="p-3.5 rounded-xl border border-gray-200 transition-all bg-white"
                    style={{
                      border: '1px solid #E8EAED',
                      boxShadow: '0 1px 2px rgba(60,64,67,0.05)',
                      background: isEnabled ? '#FFFFFF' : '#F8F9FA',
                      opacity: isEnabled ? 1 : 0.8
                    }}
                  >
                    {/* Tool Info Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg flex-shrink-0">{tool.icon}</span>
                        <div>
                          <h4 className="font-semibold text-xs text-gray-800" style={{ color: '#202124' }}>
                            {tool.label}
                          </h4>
                          <span className="font-mono text-[9px] text-gray-400" style={{ color: '#9AA0AC' }}>
                            {tool.name}
                          </span>
                        </div>
                      </div>

                      {/* Toggle Switch */}
                      <button
                        onClick={() => toggleTool(tool.name)}
                        className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                        style={{
                          backgroundColor: isEnabled ? '#1A73E8' : '#DADCE0'
                        }}
                      >
                        <span
                          className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                          style={{
                            transform: isEnabled ? 'translateX(16px)' : 'translateX(0)'
                          }}
                        />
                      </button>
                    </div>

                    {/* Tool Description */}
                    <p className="text-[11px] text-gray-600 mt-2 leading-relaxed" style={{ color: '#5F6368' }}>
                      {isCustomized ? customDesc : tool.defaultDescription}
                    </p>

                    {/* Meta info / custom indicator */}
                    <div className="mt-3 flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-2.5" style={{ borderTop: '1px solid #F1F3F4' }}>
                      <span className="font-mono" style={{ color: '#9AA0AC' }}>
                        Parametri: <span className="font-medium">{tool.parameters}</span>
                      </span>

                      {isEnabled && (
                        <button
                          onClick={() => {
                            if (isExpanded) {
                              setExpandedToolCustomization(null);
                            } else {
                              setExpandedToolCustomization(tool.name);
                              setCustomDescriptionText(customDesc || tool.defaultDescription);
                            }
                          }}
                          className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-0.5"
                          style={{ color: '#1A73E8' }}
                        >
                          {isCustomized ? '⚙️ Personalizzato' : 'Personalizza'}
                        </button>
                      )}
                    </div>

                    {/* Customization Form Drawer */}
                    {isExpanded && isEnabled && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2.5 animate-fade-in" style={{ background: '#F8F9FA', border: '1px solid #E8EAED' }}>
                        <label className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wide" style={{ color: '#5F6368' }}>
                          Istruzione di Sistema per lo Strumento
                        </label>
                        <textarea
                          rows={3}
                          value={customDescriptionText}
                          onChange={e => setCustomDescriptionText(e.target.value)}
                          className="w-full p-2 bg-white rounded-lg border border-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          style={{ border: '1px solid #DADCE0', color: '#202124' }}
                          placeholder="Fornisci istruzioni su come l'agente deve usare questo strumento..."
                        />
                        <div className="flex justify-end gap-2 text-[10px]">
                          {isCustomized && (
                            <button
                              onClick={() => resetCustomDescription(tool.name)}
                              className="px-2 py-1.5 rounded bg-white border border-red-200 text-red-600 hover:bg-red-50 font-semibold"
                              style={{ color: '#EA4335', borderColor: '#FCE8E6' }}
                            >
                              Reimposta
                            </button>
                          )}
                          <button
                            onClick={() => setExpandedToolCustomization(null)}
                            className="px-2.5 py-1.5 rounded bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 font-medium"
                            style={{ borderColor: '#DADCE0', color: '#5F6368' }}
                          >
                            Annulla
                          </button>
                          <button
                            onClick={() => saveCustomDescription(tool.name, customDescriptionText)}
                            className="px-2.5 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 font-medium"
                            style={{ background: '#1A73E8' }}
                          >
                            Salva
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
