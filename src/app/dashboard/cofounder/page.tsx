'use client';

import { useState, useRef, useEffect } from 'react';
import ModelSelector from '@/components/ModelSelector';
import Link from 'next/link';

interface AgentDelegation {
  agentType: string;
  agentLabel: string;
  task: string;
  context?: string;
  response: string;
  success: boolean;
  duration: string;
}

interface AgentSuggestion {
  agentType: string;
  agentLabel: string;
  agentName: string;
  reason: string;
}

interface CofounderMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  tools?: {
    name: string;
    success: boolean;
    details: string;
    arguments?: any;
    result?: any;
  }[];
  thinkingTime?: string;
  delegations?: AgentDelegation[];
  agentSuggestion?: AgentSuggestion | null;
  thinking?: string;
  isStreaming?: boolean;
}

interface Artifact {
  id: string;
  filename: string;
  language: string;
  code: string;
  messageIndex: number;
}

const getFileExtension = (lang: string) => {
  const l = lang.toLowerCase().trim();
  if (l.includes('typescript') || l.includes('ts')) return 'ts';
  if (l.includes('javascript') || l.includes('js')) return 'js';
  if (l.includes('html')) return 'html';
  if (l.includes('css')) return 'css';
  if (l.includes('json')) return 'json';
  if (l.includes('python') || l.includes('py')) return 'py';
  if (l.includes('bash') || l.includes('sh')) return 'sh';
  if (l.includes('markdown') || l.includes('md')) return 'md';
  if (l.includes('sql')) return 'sql';
  return 'txt';
};

const extractArtifacts = (messages: CofounderMessage[]): Artifact[] => {
  const list: Artifact[] = [];
  messages.forEach((msg, msgIdx) => {
    if (msg.role !== 'assistant') return;
    
    const parts = msg.content.split(/(```[\s\S]*?```)/g);
    let blockCount = 0;
    parts.forEach((part) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        blockCount++;
        const codeLines = part.slice(3, -3).trim().split('\n');
        
        let firstLine = codeLines[0] || '';
        let language = 'text';
        let code = codeLines.join('\n');
        
        if (firstLine && /^[a-zA-Z0-9+#-_=."']+$/.test(firstLine.trim())) {
          language = firstLine.trim();
          code = codeLines.slice(1).join('\n');
        }

        let filename = '';
        const filenameMatch = firstLine.match(/filename=["']([^"']+)["']/);
        if (filenameMatch) {
          filename = filenameMatch[1];
          language = firstLine.split(' ')[0] || 'typescript';
        } else {
          const codeFirstLine = codeLines[1] || '';
          const commentMatch = codeFirstLine.match(/^\/\/\s*([\w\.-]+)/) || codeFirstLine.match(/^#\s*([\w\.-]+)/);
          if (commentMatch) {
            filename = commentMatch[1];
          } else {
            filename = `artifact-${msgIdx + 1}-${blockCount}.${getFileExtension(language)}`;
          }
        }

        list.push({
          id: `msg-${msgIdx}-block-${blockCount}`,
          filename,
          language: language.split(' ')[0] || 'text',
          code,
          messageIndex: msgIdx
        });
      }
    });

    if (msg.delegations) {
      msg.delegations.forEach((del, delIdx) => {
        const delParts = del.response.split(/(```[\s\S]*?```)/g);
        let delBlockCount = 0;
        delParts.forEach((part) => {
          if (part.startsWith('```') && part.endsWith('```')) {
            delBlockCount++;
            const codeLines = part.slice(3, -3).trim().split('\n');
            
            let firstLine = codeLines[0] || '';
            let language = 'text';
            let code = codeLines.join('\n');
            
            if (firstLine && /^[a-zA-Z0-9+#-_=."']+$/.test(firstLine.trim())) {
              language = firstLine.trim();
              code = codeLines.slice(1).join('\n');
            }

            let filename = '';
            const filenameMatch = firstLine.match(/filename=["']([^"']+)["']/);
            if (filenameMatch) {
              filename = filenameMatch[1];
              language = firstLine.split(' ')[0] || 'typescript';
            } else {
              const codeFirstLine = codeLines[1] || '';
              const commentMatch = codeFirstLine.match(/^\/\/\s*([\w\.-]+)/) || codeFirstLine.match(/^#\s*([\w\.-]+)/);
              if (commentMatch) {
                filename = commentMatch[1];
              } else {
                filename = `delegate-${del.agentType}-${msgIdx + 1}-${delBlockCount}.${getFileExtension(language)}`;
              }
            }

            list.push({
              id: `msg-${msgIdx}-del-${delIdx}-block-${delBlockCount}`,
              filename,
              language: language.split(' ')[0] || 'text',
              code,
              messageIndex: msgIdx
            });
          }
        });
      });
    }
  });
  return list;
};

const buildPreviewHtml = (artifacts: Artifact[], activeArtifact: Artifact | null): string => {
  // Trova il file HTML principale
  let htmlArtifact = artifacts.find(a => a.filename.endsWith('.html') || a.filename.endsWith('.htm'));
  if (activeArtifact && (activeArtifact.filename.endsWith('.html') || activeArtifact.filename.endsWith('.htm'))) {
    htmlArtifact = activeArtifact;
  }
  
  let htmlBase = htmlArtifact ? htmlArtifact.code : `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Anteprima App</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background: #ffffff;
      color: #333333;
    }
  </style>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;

  // Estrai tutti i CSS degli artifact
  const cssCodes = artifacts
    .filter(a => a.filename.endsWith('.css') && a.id !== (htmlArtifact?.id))
    .map(a => a.code)
    .join('\n');
    
  // Estrai tutti i JS/TS degli artifact (escludendo l'HTML stesso) e transpilali (rimuovi tipi TS)
  const jsCodes = artifacts
    .filter(a => (a.filename.endsWith('.js') || a.filename.endsWith('.ts') || a.filename.endsWith('.jsx') || a.filename.endsWith('.tsx')) && a.id !== (htmlArtifact?.id))
    .map(a => {
      // Transpila TypeScript in JavaScript elementare
      let clean = a.code;
      clean = clean
        .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
        .replace(/type\s+\w+\s*=[^;]+/g, '')
        .replace(/\b(private|public|protected|readonly)\b/g, '')
        .replace(/:\s*(number|string|boolean|any|void|object|unknown|never|undefined|null|Function|Array<[^>]+>|[A-Z]\w*(?!\.)(?:\[\])?)\b(?!['"`])/g, '')
        .replace(/\s+as\s+(number|string|boolean|any|void|object|unknown|never|undefined|null|[A-Z]\w*)/g, '')
        .replace(/<[A-Z]>/g, '')
        .replace(/export\s+/g, '')
        .replace(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?/g, '')
        .replace(/import\s+['"][^'"]+['"];?/g, '');
      return clean;
    })
    .join('\n');

  // Se l'activeArtifact è JS/TS ed è uno script autonomo, lo accodiamo
  let activeJsCode = '';
  if (activeArtifact && (activeArtifact.filename.endsWith('.js') || activeArtifact.filename.endsWith('.ts') || activeArtifact.filename.endsWith('.jsx') || activeArtifact.filename.endsWith('.tsx'))) {
    let clean = activeArtifact.code;
    clean = clean
      .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
      .replace(/type\s+\w+\s*=[^;]+/g, '')
      .replace(/\b(private|public|protected|readonly)\b/g, '')
      .replace(/:\s*(number|string|boolean|any|void|object|unknown|never|undefined|null|Function|Array<[^>]+>|[A-Z]\w*(?!\.)(?:\[\])?)\b(?!['"`])/g, '')
      .replace(/\s+as\s+(number|string|boolean|any|void|object|unknown|never|undefined|null|[A-Z]\w*)/g, '')
      .replace(/<[A-Z]>/g, '')
      .replace(/export\s+/g, '')
      .replace(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?/g, '')
      .replace(/import\s+['"][^'"]+['"];?/g, '');
    activeJsCode = clean;
  }

  const finalJs = jsCodes.includes(activeJsCode) ? jsCodes : jsCodes + '\n' + activeJsCode;

  // Iniezione console custom per inoltro log
  const consoleScript = `
    <script>
      (function() {
        const _log = console.log;
        const _error = console.error;
        const _warn = console.warn;
        
        console.log = function(...args) {
          _log.apply(console, args);
          window.parent.postMessage({
            type: 'IFRAME_LOG',
            message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ')
          }, '*');
        };
        
        console.error = function(...args) {
          _error.apply(console, args);
          window.parent.postMessage({
            type: 'IFRAME_ERROR',
            message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ')
          }, '*');
        };
        
        window.addEventListener('error', function(e) {
          window.parent.postMessage({
            type: 'IFRAME_ERROR',
            message: e.message + ' (line ' + e.lineno + ', col ' + e.colno + ')'
          }, '*');
        });
      })();
    </script>
  `;

  let enrichedHtml = htmlBase;
  if (enrichedHtml.includes('</head>')) {
    enrichedHtml = enrichedHtml.replace('</head>', `${consoleScript}\n<style>${cssCodes}</style>\n</head>`);
  } else {
    enrichedHtml = consoleScript + `\n<style>${cssCodes}</style>\n` + enrichedHtml;
  }

  const scriptTag = `<script>\n${finalJs}\n</script>`;
  if (enrichedHtml.includes('</body>')) {
    enrichedHtml = enrichedHtml.replace('</body>', `${scriptTag}\n</body>`);
  } else {
    enrichedHtml = enrichedHtml + `\n${scriptTag}`;
  }

  return enrichedHtml;
};

const runCode = (code: string, language: string): string[] => {
  const l = language.toLowerCase();
  if (l !== 'javascript' && l !== 'typescript' && l !== 'js' && l !== 'ts') {
    return [`[System] L'esecuzione del codice è supportata solo per JavaScript e TypeScript.`];
  }

  const logs: string[] = [];
  const customConsole = {
    log: (...args: any[]) => {
      logs.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '));
    },
    error: (...args: any[]) => {
      logs.push(`🔴 [Error] ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ')}`);
    },
    warn: (...args: any[]) => {
      logs.push(`⚠️ [Warning] ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ')}`);
    },
    info: (...args: any[]) => {
      logs.push(`ℹ️ [Info] ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ')}`);
    }
  };

  try {
    let cleanCode = code;
    
    // Rimuovi definizioni di tipi ed interfacce typescript
    cleanCode = cleanCode
      .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
      .replace(/type\s+\w+\s*=[^;]+/g, '')
      .replace(/\b(private|public|protected|readonly)\b/g, '')
      .replace(/:\s*(number|string|boolean|any|void|object|unknown|never|undefined|null|Function|Array<[^>]+>|[A-Z]\w*(?!\.)(?:\[\])?)\b(?!['"`])/g, '')
      .replace(/\s+as\s+(number|string|boolean|any|void|object|unknown|never|undefined|null|[A-Z]\w*)/g, '')
      .replace(/<[A-Z]>/g, '')
      .replace(/export\s+/g, '')
      .replace(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?/g, '')
      .replace(/import\s+['"][^'"]+['"];?/g, '');

    const runFn = new Function('console', cleanCode);
    runFn(customConsole);
    
    if (logs.length === 0) {
      logs.push('Codice eseguito con successo (nessun log prodotto).');
    }
  } catch (error: any) {
    logs.push(`🔴 Errore a runtime: ${error.message}`);
  }

  return logs;
};

const AGENT_COLORS: Record<string, { bg: string; border: string; badge: string; text: string; icon: string }> = {
  strategy: { bg: '#EEF2FF', border: '#C7D2FE', badge: '#4F46E5', text: '#3730A3', icon: '🎯' },
  tech: { bg: '#F0FDF4', border: '#BBF7D0', badge: '#16A34A', text: '#15803D', icon: '⚙️' },
  finance: { bg: '#FFFBEB', border: '#FDE68A', badge: '#D97706', text: '#B45309', icon: '💰' },
  marketing: { bg: '#FFF7ED', border: '#FED7AA', badge: '#EA580C', text: '#C2410C', icon: '📣' },
  legal: { bg: '#FFF1F2', border: '#FECDD3', badge: '#E11D48', text: '#BE123C', icon: '⚖️' },
  operations: { bg: '#F8FAFC', border: '#CBD5E1', badge: '#475569', text: '#334155', icon: '🔧' },
};

// Markdown Parser Helper
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

function formatMessageContent(content: string, onOpenInWorkspace?: (code: string, language: string) => void) {
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
            {onOpenInWorkspace && (
              <button
                type="button"
                onClick={() => onOpenInWorkspace(code, language)}
                className="text-[10px] font-semibold text-[#1A73E8] hover:text-[#1557B0] flex items-center gap-1.5 bg-white px-2 py-0.5 rounded border border-[#DADCE0] transition-all hover:shadow-xs focus:outline-none"
              >
                <span>🖥️</span> Apri nel Workspace
              </button>
            )}
          </div>
          <pre className="p-3 overflow-x-auto text-xs font-mono leading-relaxed" style={{ background: '#FAFAFA', color: '#202124' }}>
            <code>{code}</code>
          </pre>
        </div>
      );
    }

    const lines = part.split('\n');
    let listItems: any[] = [];
    let inList = false;
    const renderedLines: any[] = [];

    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      const trimmed = line.trim();

      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        inList = true;
        listItems.push({ text: trimmed.slice(2), ordered: false });
      } else if (/^\d+\.\s/.test(trimmed)) {
        inList = true;
        listItems.push({ text: trimmed.replace(/^\d+\.\s/, ''), ordered: true });
      } else {
        if (inList && listItems.length > 0) {
          const isOrdered = listItems[0].ordered;
          const Tag = isOrdered ? 'ol' : 'ul';
          renderedLines.push(
            <Tag key={`list-${l}`} className={isOrdered ? 'list-decimal' : 'list-disc'} style={{ paddingLeft: '1.25rem', margin: '6px 0', color: '#3C4043', fontSize: '0.8125rem' }}>
              {listItems.map((item, idx) => <li key={idx} className="mb-0.5">{parseInlineMarkdown(item.text)}</li>)}
            </Tag>
          );
          listItems = [];
          inList = false;
        }

        if (trimmed.startsWith('### ')) {
          renderedLines.push(<h4 key={l} className="text-sm font-bold mt-3 mb-1" style={{ color: '#202124' }}>{parseInlineMarkdown(trimmed.slice(4))}</h4>);
        } else if (trimmed.startsWith('## ')) {
          renderedLines.push(<h3 key={l} className="text-base font-bold mt-4 mb-2" style={{ color: '#202124', borderBottom: '1px solid #E8EAED', paddingBottom: '2px' }}>{parseInlineMarkdown(trimmed.slice(3))}</h3>);
        } else if (trimmed.startsWith('# ')) {
          renderedLines.push(<h2 key={l} className="text-lg font-bold mt-5 mb-3" style={{ color: '#202124' }}>{parseInlineMarkdown(trimmed.slice(2))}</h2>);
        } else if (trimmed.startsWith('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')) {
          renderedLines.push(<hr key={l} className="my-4" style={{ borderColor: '#E8EAED' }} />);
        } else if (trimmed.startsWith('>') && trimmed.includes('[!')) {
          const alertType = trimmed.includes('IMPORTANT') ? 'IMPORTANT' : trimmed.includes('WARNING') ? 'WARNING' : 'NOTE';
          let alertContent = '';
          let lookAhead = l + 1;
          while (lookAhead < lines.length && lines[lookAhead].trim().startsWith('>')) {
            alertContent += lines[lookAhead].trim().slice(1) + '\n';
            lookAhead++;
          }
          l = lookAhead - 1;
          const alertBg = alertType === 'IMPORTANT' ? '#E8F0FE' : alertType === 'WARNING' ? '#FCE8E6' : '#F8F9FA';
          const alertBorder = alertType === 'IMPORTANT' ? '#1A73E8' : alertType === 'WARNING' ? '#EA4335' : '#DADCE0';
          renderedLines.push(
            <div key={l} className="p-3 my-2 rounded-r-lg border-l-4 text-xs leading-relaxed" style={{ background: alertBg, borderLeftColor: alertBorder, color: '#3C4043' }}>
              <strong>{alertType}:</strong> {alertContent}
            </div>
          );
        } else if (trimmed) {
          renderedLines.push(<p key={l} className="mb-2 leading-relaxed" style={{ color: '#3C4043', fontSize: '0.8125rem' }}>{parseInlineMarkdown(line)}</p>);
        }
      }
    }

    if (inList && listItems.length > 0) {
      const isOrdered = listItems[0].ordered;
      const Tag = isOrdered ? 'ol' : 'ul';
      renderedLines.push(
        <Tag key="list-flush" className={isOrdered ? 'list-decimal' : 'list-disc'} style={{ paddingLeft: '1.25rem', margin: '6px 0', color: '#3C4043', fontSize: '0.8125rem' }}>
          {listItems.map((item, idx) => <li key={idx} className="mb-0.5">{parseInlineMarkdown(item.text)}</li>)}
        </Tag>
      );
    }

    return <div key={index}>{renderedLines}</div>;
  });
}

export default function CoFounderPage() {
  const [cofounderName, setCofounderName] = useState('coFounder');
  const [cofounderInput, setCofounderInput] = useState('');
  const [cofounderMessages, setCofounderMessages] = useState<CofounderMessage[]>([]);
  const [cofounderLoading, setCofounderLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('openrouter/owl-alpha');
  const [activeThinkingTime, setActiveThinkingTime] = useState('0.0');
  const [activeDelegations, setActiveDelegations] = useState<{ agentType: string; agentLabel: string; task: string; status: 'running' | 'done' }[]>([]);
  const [promptQueue, setPromptQueue] = useState<string[]>([]);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [startupInfo, setStartupInfo] = useState<any>(null);
  const [activeToolLabel, setActiveToolLabel] = useState<string | null>(null);

  // Artifact Workspace States
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [workspaceWidth, setWorkspaceWidth] = useState(550);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [editedCodes, setEditedCodes] = useState<Record<string, string>>({});
  const [workspaceMode, setWorkspaceMode] = useState<'editor' | 'preview' | 'split'>('split');
  const [iframeKey, setIframeKey] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('');

  const isResizingRef = useRef(false);
  const gutterRef = useRef<HTMLDivElement>(null);
  const prevArtifactCountRef = useRef(0);

  // Drag Resizing Listeners
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth < 200) {
        setShowWorkspace(false);
      } else if (newWidth < window.innerWidth - 300) {
        setWorkspaceWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Sync scroll of gutter with textarea
  const handleEditorScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // Run TypeScript/JavaScript code or reload live preview
  const handleRunCode = () => {
    if (!activeArtifact) return;
    setConsoleOpen(true);
    const timestamp = new Date().toLocaleTimeString();
    
    if (workspaceMode === 'preview' || workspaceMode === 'split') {
      setTerminalLogs(prev => [...prev, `> [${timestamp}] Riavvio dell'anteprima web...`]);
      setIframeKey(prev => prev + 1);
    } else {
      setTerminalLogs(prev => [...prev, `> [${timestamp}] Avvio di ${activeArtifact.filename}...`]);
      setTimeout(() => {
        const logs = runCode(activeArtifact.code, activeArtifact.language);
        setTerminalLogs(prev => [
          ...prev,
          ...logs,
          `> [${new Date().toLocaleTimeString()}] Esecuzione terminata.`
        ]);
      }, 300);
    }
  };

  // Extract artifacts and update workspace contents
  useEffect(() => {
    const extracted = extractArtifacts(cofounderMessages);
    
    // Merge manual user edits
    const merged = extracted.map(art => {
      if (editedCodes[art.id] !== undefined) {
        return { ...art, code: editedCodes[art.id] };
      }
      return art;
    });

    setArtifacts(merged);

    if (merged.length > 0) {
      setActiveArtifact(prev => {
        if (!prev) return merged[merged.length - 1];
        const exists = merged.find(a => a.id === prev.id);
        if (!exists) return merged[merged.length - 1];
        // Keep active code synced with stream if not edited
        if (exists.code !== prev.code && editedCodes[prev.id] === undefined) {
          return exists;
        }
        return prev;
      });

      if (merged.length > prevArtifactCountRef.current) {
        setShowWorkspace(true);
        const lastArt = merged[merged.length - 1];
        setActiveArtifact(lastArt);
        // Rileva se è una web app per impostare la modalità di visualizzazione di default
        const isWeb = lastArt.filename.endsWith('.html') || 
                      lastArt.filename.endsWith('.css') || 
                      lastArt.filename.endsWith('.js') || 
                      lastArt.filename.endsWith('.ts') ||
                      lastArt.filename.endsWith('.jsx') ||
                      lastArt.filename.endsWith('.tsx');
        setWorkspaceMode(isWeb ? 'split' : 'editor');
      }
    } else {
      setActiveArtifact(null);
    }
    prevArtifactCountRef.current = merged.length;
  }, [cofounderMessages, editedCodes]);

  // Ascolta i log ed errori inviati dall'iframe dell'anteprima web
  useEffect(() => {
    const handleIframeMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'IFRAME_LOG') {
        const timestamp = new Date().toLocaleTimeString();
        setTerminalLogs(prev => [...prev, `[Anteprima Log ${timestamp}] ${event.data.message}`]);
      } else if (event.data && event.data.type === 'IFRAME_ERROR') {
        const timestamp = new Date().toLocaleTimeString();
        setTerminalLogs(prev => [...prev, `🔴 [Anteprima Errore ${timestamp}] ${event.data.message}`]);
      }
    };
    window.addEventListener('message', handleIframeMessage);
    return () => {
      window.removeEventListener('message', handleIframeMessage);
    };
  }, []);

  // Rigenera l'anteprima HTML con debounce all'aggiornamento dei sorgenti
  useEffect(() => {
    if (artifacts.length === 0) return;
    
    const handler = setTimeout(() => {
      const compiled = buildPreviewHtml(artifacts, activeArtifact);
      setPreviewUrl(compiled);
    }, 500);

    return () => clearTimeout(handler);
  }, [artifacts, activeArtifact, editedCodes]);

  // Programmatically collapse global sidebar when workspace is open
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('collapse-global-sidebar', { detail: showWorkspace }));
    return () => {
      window.dispatchEvent(new CustomEvent('collapse-global-sidebar', { detail: false }));
    };
  }, [showWorkspace]);

  const openArtifactInWorkspace = (code: string, language: string) => {
    const found = artifacts.find(a => a.code.trim() === code.trim());
    if (found) {
      setActiveArtifact(found);
    } else {
      const temp: Artifact = {
        id: `temp-${Date.now()}`,
        filename: `codice.${getFileExtension(language)}`,
        language,
        code,
        messageIndex: -1
      };
      setActiveArtifact(temp);
    }
    setShowWorkspace(true);
  };

  const chatEndRef = useRef<HTMLDivElement>(null);
  const thinkingTimerRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const promptQueueRef = useRef<string[]>([]);

  useEffect(() => {
    promptQueueRef.current = promptQueue;
  }, [promptQueue]);

  // Load startup info
  useEffect(() => {
    fetch('/api/demo/startup')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setStartupInfo(data[0]);
        }
      })
      .catch(console.error);
  }, []);

  // Load chat messages
  useEffect(() => {
    const storedChat = sessionStorage.getItem('agentfoundry_cofounder_chat');
    if (storedChat) {
      try {
        setCofounderMessages(JSON.parse(storedChat));
      } catch {}
    } else {
      setCofounderMessages([
        {
          role: 'assistant',
          content: `Ciao! Sono il tuo ${cofounderName}, l'assistente co-fondatore del tuo progetto. Posso aiutarti a gestire il team, creare agenti o aggiornare le metriche della startup in tempo reale. Cosa facciamo oggi?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [cofounderName]);

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [cofounderMessages, cofounderLoading, activeDelegations]);

  const saveChat = (msgs: CofounderMessage[]) => {
    sessionStorage.setItem('agentfoundry_cofounder_chat', JSON.stringify(msgs));
  };

  // Queue drain logic
  const prevLoadingRef = useRef(false);
  useEffect(() => {
    if (prevLoadingRef.current && !cofounderLoading) {
      const q = promptQueueRef.current;
      if (q.length > 0) {
        const [next, ...rest] = q;
        setPromptQueue(rest);
        setTimeout(() => handleSendMessage(undefined, next), 500);
      }
    }
    prevLoadingRef.current = cofounderLoading;
  }, [cofounderLoading]);

  // Timer logic for LLM thought
  const startThinkingTimer = () => {
    setActiveThinkingTime('0.0');
    const start = Date.now();
    thinkingTimerRef.current = setInterval(() => {
      setActiveThinkingTime(((Date.now() - start) / 1000).toFixed(1));
    }, 1000);
  };

  const stopThinkingTimer = () => {
    if (thinkingTimerRef.current) {
      clearInterval(thinkingTimerRef.current);
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    stopThinkingTimer();
    setCofounderLoading(false);
    setActiveDelegations([]);
    setActiveToolLabel(null);

    const interMsg: CofounderMessage = {
      role: 'assistant',
      content: '⏹ Generazione interrotta.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    const updated = [...cofounderMessages, interMsg];
    setCofounderMessages(updated);
    saveChat(updated);
  };

  const handleSendMessage = async (e?: React.FormEvent, customText?: string, displayText?: string) => {
    e?.preventDefault();
    const promptToSend = (customText || cofounderInput).trim();
    if (!promptToSend) return;

    if (!customText) {
      setCofounderInput('');
    }

    if (cofounderLoading) {
      setPromptQueue(prev => [...prev, promptToSend]);
      return;
    }

    const showText = displayText || promptToSend;
    const userMsg: CofounderMessage = {
      role: 'user',
      content: showText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedWithUser = [...cofounderMessages, userMsg];
    setCofounderMessages(updatedWithUser);
    saveChat(updatedWithUser);
    setCofounderLoading(true);
    setActiveDelegations([]);
    startThinkingTimer();

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const startTime = Date.now();

    try {
      const res = await fetch('/api/demo/cofounder/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedWithUser.map(m => ({ role: m.role, content: m.content })),
          cofounderName,
          modelId: selectedModel,
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No body stream reader');

      const decoder = new TextDecoder();
      let streamBuffer = '';
      let replyContent = '';
      let replyThinking = '';
      let replyTools: any[] = [];
      let replyDelegations: any[] = [];
      let replySuggestion: any = null;
      let thinkingTimeVal: string | undefined = undefined;

      // Temporary placeholder message while streaming
      const assistantPlaceholder: CofounderMessage = {
        role: 'assistant',
        content: '',
        thinking: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isStreaming: true,
      };
      setCofounderMessages(prev => [...prev, assistantPlaceholder]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split('\n');
        streamBuffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const payload = parsed.content;

            if (parsed.type === 'content') {
              replyContent += payload;
            } else if (parsed.type === 'thinking') {
              replyThinking += payload;
            } else if (parsed.type === 'tool_start') {
              setActiveToolLabel(payload.label);
            } else if (parsed.type === 'tool_run') {
              setActiveToolLabel(null);
            } else if (parsed.type === 'delegating') {
              const del = payload;
              setActiveDelegations(prev => [...prev, { agentType: del.agentType, agentLabel: del.agentLabel, task: del.task, status: 'running' }]);
            } else if (parsed.type === 'delegation_done') {
              const del = payload;
              replyDelegations.push(del);
              setActiveDelegations(prev => prev.map(d => d.agentType === del.agentType ? { ...d, status: 'done' } : d));
            } else if (parsed.type === 'agent_suggestion') {
              replySuggestion = payload;
            } else if (parsed.type === 'done') {
              replyContent = payload.content;
              replyTools = payload.executedTools || [];
              replyDelegations = payload.delegations || [];
              replySuggestion = payload.agentSuggestion;
              thinkingTimeVal = ((Date.now() - startTime) / 1000).toFixed(1);
              setActiveToolLabel(null);
            } else if (parsed.type === 'error') {
              setActiveToolLabel(null);
              throw new Error(payload);
            }

            // Update placeholder in real time
            setCofounderMessages(prev => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'assistant') {
                return [
                  ...prev.slice(0, -1),
                  {
                    ...last,
                    content: replyContent,
                    thinking: replyThinking,
                    tools: replyTools,
                    delegations: replyDelegations,
                    agentSuggestion: replySuggestion,
                    thinkingTime: thinkingTimeVal,
                    isStreaming: true,
                  }
                ];
              }
              return prev;
            });
          } catch (e) {
            console.error('Failed to parse SSE data line:', jsonStr, e);
          }
        }
      }

      // Finish streaming
      stopThinkingTimer();
      setCofounderLoading(false);
      setActiveDelegations([]);

      // Fetch agents list update in background to sync potential new agents
      window.dispatchEvent(new Event('startup-agents-updated'));

      // Final save and update message status (disable streaming flag)
      setCofounderMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          const finalMsg = { ...last, isStreaming: false };
          const newMessages = [...prev.slice(0, -1), finalMsg];
          saveChat(newMessages);
          return newMessages;
        }
        saveChat(prev);
        return prev;
      });

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('SSE connection error:', err);
      stopThinkingTimer();
      setCofounderLoading(false);
      setActiveDelegations([]);

      const errorMsg: CofounderMessage = {
        role: 'assistant',
        content: `❌ Si è verificato un errore durante la generazione: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      const finalErr = [...cofounderMessages, errorMsg];
      setCofounderMessages(finalErr);
      saveChat(finalErr);
    }
  };

  const applySlashCommand = (cmd: string) => {
    if (cmd === '/analizza') {
      setCofounderInput('');
      setShowSlashMenu(false);
      handleSendMessage(undefined, 'Analizza la mia startup a 360°: coinvolgi tutti gli agenti necessari e dammi un quadro completo.', cmd);
      return;
    }
    if (cmd === '/agenti') {
      setCofounderInput('');
      setShowSlashMenu(false);
      handleSendMessage(undefined, 'Quali agenti ho nel team? Mostrami il loro stato e le loro specializzazioni.', cmd);
      return;
    }
    if (cmd === '/metriche') {
      setCofounderInput('');
      setShowSlashMenu(false);
      handleSendMessage(undefined, "Mostrami le metriche attuali della startup e un'analisi rapida della salute finanziaria.", cmd);
      return;
    }
    if (cmd === '/piano') {
      setCofounderInput('');
      setShowSlashMenu(false);
      handleSendMessage(undefined, 'Crea un piano di crescita dettagliato per i prossimi 6 mesi, coinvolgendo gli agenti strategia, marketing e finance.', cmd);
      return;
    }
    if (cmd === '/clear') {
      setCofounderInput('');
      setShowSlashMenu(false);
      sessionStorage.removeItem('agentfoundry_cofounder_chat');
      setCofounderMessages([
        {
          role: 'assistant',
          content: `Chat svuotata. Sono pronto per una nuova sessione! Come posso aiutarti oggi?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCofounderInput(val);

    if (val.startsWith('/')) {
      setShowSlashMenu(true);
      setSlashFilter(val.slice(1).toLowerCase());
    } else {
      setShowSlashMenu(false);
    }
  };

  const slashCommands = [
    { cmd: '/analizza', desc: 'Analizza startup a 360° con tutti gli agenti' },
    { cmd: '/agenti', desc: 'Mostra il team ed il loro stato' },
    { cmd: '/metriche', desc: 'Overview metriche e salute finanziaria' },
    { cmd: '/piano', desc: 'Piano di crescita 6 mesi (strategy + marketing + finance)' },
    { cmd: '/clear', desc: 'Svuota la cronologia della chat corrente' },
  ].filter(c => c.cmd.toLowerCase().includes(slashFilter));

  const starterCards = [
    'Qual è il piano finanziario migliore per allungare la nostra runway?',
    'Fai un audit completo della nostra architettura tecnologica',
    'Preparami per un pitch davanti a degli investitori angel',
    'Ideiamo una campagna marketing di lancio virale a costo zero'
  ];

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden" style={{ background: '#F8F9FA' }}>
      {/* Left Column: Startup Panel & Tools info */}
      {!showWorkspace && (
        <div className="hidden lg:flex flex-col w-64 bg-white border-r border-[#E8EAED] p-4 space-y-5 flex-shrink-0 overflow-y-auto custom-scrollbar">
          {startupInfo ? (
            <div className="p-4 rounded-xl border border-[#E8EAED]" style={{ background: '#FAFAFA' }}>
              <h3 className="text-xs font-bold text-[#202124] uppercase tracking-wider mb-2">Startup in Analisi</h3>
              <p className="font-bold text-sm text-[#1A73E8] truncate">{startupInfo.name}</p>
              <p className="text-[11px] text-[#5F6368] mt-0.5">{startupInfo.sector} · {startupInfo.stage}</p>
              
              <div className="mt-4 pt-3 border-t border-[#E8EAED] space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#5F6368]">MRR:</span>
                  <span className="font-bold text-[#202124]">${(startupInfo.mrr ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5F6368]">Utenti:</span>
                  <span className="font-bold text-[#202124]">{(startupInfo.users ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5F6368]">Runway:</span>
                  <span className="font-bold text-[#EA4335]">{startupInfo.runway ?? 0} mesi</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-[#5F6368] rounded-xl border border-[#E8EAED]" style={{ background: '#FAFAFA' }}>
              Caricamento startup...
            </div>
          )}

          <div className="p-4 rounded-xl border border-[#E8EAED]" style={{ background: '#FAFAFA' }}>
            <h3 className="text-xs font-bold text-[#202124] uppercase tracking-wider mb-2">Comandi Rapidi</h3>
            <div className="space-y-1">
              {['/analizza', '/agenti', '/metriche', '/piano', '/clear'].map(cmd => (
                <button
                  key={cmd}
                  onClick={() => applySlashCommand(cmd)}
                  className="w-full text-left px-2 py-1 text-xs font-mono rounded hover:bg-[#F1F3F4] text-[#1A73E8]"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1" />

          <div className="p-3 text-[10px] text-[#9AA0AC] leading-normal border-t border-[#E8EAED]">
            Il Co-Founder AI ha accesso alla memoria centralizzata ed è in grado di delegare compiti specifici al team di collaboratori.
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 min-w-0 flex flex-col h-full bg-[#FAFAFA] relative">
        {/* Chat Header */}
        <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-[#E8EAED]">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white relative"
              style={{ background: 'linear-gradient(135deg, #1A73E8, #34A853)' }}
            >
              CF
            </div>
            <div>
              <h2 className="font-bold text-sm" style={{ color: '#202124' }}>{cofounderName}</h2>
              <p className="text-[10px] text-[#9AA0AC]">Co-Founder Partner AI</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {artifacts.length > 0 && (
              <button
                type="button"
                onClick={() => setShowWorkspace(!showWorkspace)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all focus:outline-none ${
                  showWorkspace
                    ? 'bg-[#E8F0FE] border-[#1A73E8] text-[#1A73E8]'
                    : 'bg-white border-[#E8EAED] text-[#3C4043] hover:bg-[#F1F3F4]'
                }`}
              >
                <span>💻</span> Workspace ({artifacts.length})
              </button>
            )}
            <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} />
          </div>
        </div>

        {/* Message Panel */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
          {cofounderMessages.map((msg, index) => (
            <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className="max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed"
                style={{
                  background: msg.role === 'user' ? '#E8F0FE' : '#FFFFFF',
                  color: '#202124',
                  border: msg.role === 'user' ? 'none' : '1px solid #E8EAED',
                  boxShadow: msg.role === 'user' ? 'none' : '0 1px 2px rgba(60,64,67,0.05)'
                }}
              >
                <div className="space-y-1">
                  {msg.content 
                    ? formatMessageContent(msg.content, openArtifactInWorkspace) 
                    : msg.isStreaming 
                      ? <span className="text-[#9AA0AC] animate-pulse italic">Il CoFounder sta elaborando la risposta...</span>
                      : null
                  }
                </div>

                {msg.role === 'assistant' && (msg.thinking || (msg.tools && msg.tools.length > 0)) && (
                  <details 
                    className="group mb-3 mt-3 border border-[#DADCE0] rounded-xl bg-[#F8F9FA]/80 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden w-full transition-all duration-300"
                    open={msg.isStreaming}
                  >
                    <summary className="list-none flex items-center justify-between px-4 py-2.5 text-[10px] font-mono text-[#5F6368] cursor-pointer select-none hover:bg-[#F1F3F4]/50 transition-colors focus:outline-none">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1A73E8] opacity-75 ${!msg.isStreaming && 'hidden'}`}></span>
                          <span className={`relative inline-flex rounded-full h-2 w-2 bg-[#1A73E8] ${!msg.isStreaming && 'bg-[#9AA0AC]'}`}></span>
                        </span>
                        <span className="font-semibold uppercase tracking-wider text-[10px]">
                          {msg.isStreaming ? 'Ragionamento in corso...' : `Ragionamento completato ${msg.thinkingTime ? `(${msg.thinkingTime}s)` : ''}`}
                        </span>
                      </div>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
                        className="w-3 h-3 transform group-open:rotate-180 transition-transform duration-200 text-[#70757a]"
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </summary>
                    <div className="p-4 border-t border-[#E8EAED]/60 bg-white/50 text-[10px] space-y-2.5 max-h-[400px] overflow-y-auto custom-scrollbar">
                      {msg.thinking && (
                        <div className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap text-[#3C4043] bg-white/60 p-3 rounded-lg border border-[#E8EAED] mb-3">
                          {msg.thinking}
                        </div>
                      )}
                      {msg.tools && msg.tools.map((t, i) => (
                        <div key={i} className={`border border-[#DADCE0] ${t.success ? 'border-l-[3px] border-l-[#34A853]' : 'border-l-[3px] border-l-[#EA4335]'} rounded-r-lg p-2.5 space-y-2 bg-white/60`}>
                          <div className="flex items-center justify-between font-mono text-[9px]">
                            <span className="text-[#1A73E8]">🔧 {t.name}</span>
                            <span className={t.success ? 'text-[#34A853]' : 'text-[#EA4335]'}>
                              {t.success ? 'SUCCESS' : 'FAILURE'}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#3C4043] font-medium">{t.details}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {msg.role === 'assistant' && msg.delegations && msg.delegations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#E8EAED] space-y-1.5">
                    <div className="text-[9px] font-bold text-[#5F6368] uppercase tracking-wider">Deleghe del Co-Founder:</div>
                    {msg.delegations.map((del, dIdx) => {
                      const color = AGENT_COLORS[del.agentType] || AGENT_COLORS.strategy;
                      return (
                        <div key={dIdx} className="rounded-lg p-2 border border-[#E8EAED] bg-[#FAFAFA]" style={{ borderLeft: `3px solid ${color.badge}` }}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs">{color.icon}</span>
                            <span className="font-bold text-[10px]" style={{ color: color.text }}>{del.agentLabel}</span>
                            <span className="text-[9px] text-[#9AA0AC] font-mono ml-auto">({del.duration})</span>
                          </div>
                          <p className="text-[10px] text-[#3C4043] font-medium font-mono bg-white p-1.5 rounded border border-[#E8EAED] mb-1.5">Task: {del.task}</p>
                          <div className="text-[10px] leading-relaxed text-[#202124] p-1.5 bg-white rounded border border-[#E8EAED]">{formatMessageContent(del.response, openArtifactInWorkspace)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {msg.role === 'assistant' && msg.agentSuggestion && (
                  <div className="mt-3 p-3 rounded-lg border border-[#FED7AA] bg-[#FFFBEB] animate-fade-in">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-xs">💡</span>
                      <span className="text-[10px] font-bold text-[#92400E]">Suggerimento Creazione Dipendente</span>
                    </div>
                    <p className="text-[10px] font-medium mb-1" style={{ color: '#202124' }}>
                      Crea l'agente <strong>{msg.agentSuggestion.agentName}</strong> ({msg.agentSuggestion.agentLabel})
                    </p>
                    <p className="text-[9px] mb-2.5" style={{ color: '#92400E' }}>{msg.agentSuggestion.reason}</p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleSendMessage(undefined, `Sì, crea l'agente ${msg.agentSuggestion!.agentName} di tipo ${msg.agentSuggestion!.agentType}`)}
                        className="px-2 py-1 rounded bg-[#F97316] text-[9px] font-semibold text-white hover:bg-[#EA580C] transition"
                      >
                        Approva Creazione
                      </button>
                      <button
                        onClick={() => handleSendMessage(undefined, `No grazie, non creare l'agente ${msg.agentSuggestion!.agentName} per ora.`)}
                        className="px-2 py-1 rounded bg-white border border-[#E8EAED] text-[9px] font-semibold text-[#5F6368] hover:bg-[#F1F3F4] transition"
                      >
                        Ignora
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Thinking / Streaming Indicator */}
          {cofounderLoading && (
            <div className="flex flex-col items-start space-y-2.5 p-4 rounded-2xl border border-white/40 bg-white/60 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.06)] max-w-md animate-pulse-soft ml-0">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#1A73E8]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1A73E8] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1A73E8]"></span>
                </span>
                <span>CoFounder attivo ({activeThinkingTime}s)</span>
              </div>

              {activeToolLabel && (
                <div className="flex items-center gap-2 text-[10px] text-[#34A853] bg-[#E6F4EA]/80 border border-[#34A853]/20 px-3 py-1 rounded-full font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34A853] animate-pulse" />
                  <span>{activeToolLabel}</span>
                </div>
              )}

              {activeDelegations.length > 0 && (
                <div className="space-y-1.5 w-full">
                  {activeDelegations.map((del, dIdx) => {
                    const color = AGENT_COLORS[del.agentType] || AGENT_COLORS.strategy;
                    return (
                      <div key={dIdx} className="flex items-center gap-2 text-[10px] bg-white/70 border border-[#E8EAED] px-3 py-1.5 rounded-xl max-w-sm shadow-xs">
                        <span className="text-xs">{color.icon}</span>
                        <span className="font-bold" style={{ color: color.text }}>{del.agentLabel}:</span>
                        <span className="text-[#5F6368] italic truncate max-w-[150px]">{del.task}</span>
                        <span className="ml-auto text-[9px] text-[#1A73E8] font-bold tracking-wider uppercase">
                          {del.status === 'running' ? '⏳ Delegato' : '✅ Completato'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Empty / Starter prompts view */}
          {cofounderMessages.length <= 1 && !cofounderLoading && (
            <div className="py-8 text-center max-w-md mx-auto space-y-6">
              <div className="space-y-1.5">
                <h3 className="font-bold text-sm text-[#202124]">Spunti di discussione con il Co-Founder</h3>
                <p className="text-[11px] text-[#5F6368]">Seleziona una delle domande suggerite per iniziare ad impostare la tua crescita.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-left">
                {starterCards.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(undefined, s)}
                    className="p-3.5 rounded-xl border border-[#E8EAED] bg-white text-xs leading-relaxed transition-all hover:border-[#1A73E8] hover:shadow-sm"
                    style={{ color: '#3C4043' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Coda Prompt */}
        {promptQueue.length > 0 && (
          <div className="mx-6 mb-2 px-3 py-1.5 bg-[#E6F4EA] border border-[#A7F3D0] rounded-lg flex items-center justify-between animate-fade-in z-20">
            <span className="text-[11px] text-[#065F46] font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-ping" />
              {promptQueue.length} {promptQueue.length === 1 ? 'prompt in attesa' : 'prompt in coda'}
            </span>
            <button
              onClick={() => setPromptQueue([])}
              className="text-[10px] text-[#065F46] hover:underline font-bold"
            >
              Svuota
            </button>
          </div>
        )}

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-[#E8EAED] flex items-center gap-3 relative z-30">
          {/* Slash Commands Dropdown */}
          {showSlashMenu && slashCommands.length > 0 && (
            <div className="absolute bottom-full left-4 mb-2 w-64 bg-white border border-[#E8EAED] rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in">
              <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-[#9AA0AC] bg-[#F8F9FA] border-b border-[#E8EAED]">
                Comandi rapidi
              </div>
              <div className="max-h-48 overflow-y-auto">
                {slashCommands.map(c => (
                  <button
                    key={c.cmd}
                    type="button"
                    onClick={() => applySlashCommand(c.cmd)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-[#F1F3F4] flex items-center justify-between border-b border-[#E8EAED]/40 last:border-0"
                  >
                    <span className="font-mono font-bold text-[#1A73E8]">{c.cmd}</span>
                    <span className="text-[10px] text-[#5F6368]">{c.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 relative">
            <input
              type="text"
              placeholder={cofounderLoading ? '⏳ In attesa della risposta...' : 'Scrivi un messaggio o digita / per i comandi...'}
              value={cofounderInput}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 rounded-xl border border-[#E8EAED] focus:outline-none focus:border-[#1A73E8] text-xs"
              style={{ background: '#FAFAFA', color: '#202124' }}
            />
          </div>

          {cofounderLoading && !cofounderInput.trim() ? (
            <button
              type="button"
              onClick={handleStopGeneration}
              className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#EA4335] text-white shadow-md hover:bg-[#D93025] transition"
              title="Interrompi generazione"
            >
              <div className="w-2.5 h-2.5 bg-white rounded-xs" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!cofounderInput.trim() && !cofounderLoading}
              className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#1A73E8] text-white shadow-md hover:bg-[#1557B0] transition disabled:opacity-40"
              title="Invia"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          )}
        </form>
      </div>

      {/* Vertical Resize Splitter */}
      {showWorkspace && (
        <div
          onMouseDown={handleResizeMouseDown}
          className="w-[8px] hover:w-[10px] cursor-col-resize select-none flex-shrink-0 flex items-center justify-center relative z-40 group transition-all"
          style={{ background: 'transparent' }}
        >
          {/* Visual Divider Line */}
          <div className="w-[1px] group-hover:w-[3px] h-full bg-[#E8EAED] group-hover:bg-[#1A73E8] transition-all" />
          
          {/* Centered Grab Handle */}
          <div className="absolute top-1/2 -translate-y-1/2 w-4 h-9 bg-white border border-[#DADCE0] rounded-lg shadow-md opacity-0 group-hover:opacity-100 flex flex-col gap-0.5 items-center justify-center transition-all duration-150 pointer-events-none">
            <div className="w-[1.5px] h-2.5 bg-[#9AA0AC] rounded-full" />
            <div className="w-[1.5px] h-2.5 bg-[#9AA0AC] rounded-full" />
          </div>
        </div>
      )}

      {/* Artifacts Workspace Panel */}
      {showWorkspace && (
        <div
          style={{ width: `${workspaceWidth}px` }}
          className="bg-[#181818] text-[#D4D4D4] border-l border-[#2D2D2D] h-full flex flex-col flex-shrink-0 relative overflow-hidden"
        >
          {/* Workspace Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-[#202020] border-b border-[#2d2d2d] flex-shrink-0">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-[#E3E6EB] tracking-wide uppercase">Workspace</span>
              
              {/* Workspace Mode Selection */}
              <div className="flex items-center bg-[#151515] p-0.5 rounded border border-[#2d2d2d] gap-0.5">
                <button
                  type="button"
                  onClick={() => setWorkspaceMode('editor')}
                  className={`px-2 py-0.5 text-[10px] rounded font-medium transition focus:outline-none ${
                    workspaceMode === 'editor'
                      ? 'bg-[#1A73E8] text-white'
                      : 'text-[#8e949e] hover:text-[#e3e6eb]'
                  }`}
                >
                  Codice
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspaceMode('preview')}
                  className={`px-2 py-0.5 text-[10px] rounded font-medium transition focus:outline-none ${
                    workspaceMode === 'preview'
                      ? 'bg-[#1A73E8] text-white'
                      : 'text-[#8e949e] hover:text-[#e3e6eb]'
                  }`}
                >
                  Anteprima
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspaceMode('split')}
                  className={`px-2 py-0.5 text-[10px] rounded font-medium transition focus:outline-none ${
                    workspaceMode === 'split'
                      ? 'bg-[#1A73E8] text-white'
                      : 'text-[#8e949e] hover:text-[#e3e6eb]'
                  }`}
                >
                  Split
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRunCode}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#00A86B] hover:bg-[#008F5A] text-white text-xs font-bold transition shadow-sm focus:outline-none"
              >
                <span>▶</span> Run
              </button>
              
              <button
                type="button"
                onClick={() => setShowWorkspace(false)}
                className="text-[#8e949e] hover:text-[#e3e6eb] text-sm font-semibold focus:outline-none"
                title="Collapse Workspace"
              >
                ✕
              </button>
            </div>
          </div>

          {/* File Tabs Bar */}
          <div className="flex items-center bg-[#151515] border-b border-[#2d2d2d] overflow-x-auto custom-scrollbar flex-shrink-0">
            {artifacts.map(art => {
              const isActive = activeArtifact?.id === art.id;
              return (
                <button
                  key={art.id}
                  type="button"
                  onClick={() => setActiveArtifact(art)}
                  className={`px-4 py-2 text-xs font-mono border-r border-[#2d2d2d] transition-all flex items-center gap-2 focus:outline-none ${
                    isActive
                      ? 'bg-[#1e1e1e] text-[#ffffff] border-t-2 border-t-[#1A73E8] font-semibold'
                      : 'text-[#8e949e] hover:bg-[#1c1c1c] hover:text-[#d4d4d4]'
                  }`}
                >
                  <span>📄</span>
                  {art.filename}
                </button>
              );
            })}
          </div>

          {/* Main workspace contents */}
          {activeArtifact ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Workspace Content Panels */}
              <div className="flex-1 flex min-h-0 border-b border-[#2d2d2d] overflow-hidden">
                {/* 1. CODE EDITOR (Visible in editor and split modes) */}
                {(workspaceMode === 'editor' || workspaceMode === 'split') && (
                  <div className="flex-1 flex overflow-hidden relative bg-[#1e1e1e] h-full min-w-0 border-r border-[#2d2d2d]">
                    {/* Line numbers gutter */}
                    <div
                      ref={gutterRef}
                      className="w-12 bg-[#181818] text-[#6e7681] py-3 text-right pr-3 select-none border-r border-[#2d2d2d] font-mono text-xs flex flex-col overflow-hidden"
                      style={{ lineHeight: '20px' }}
                    >
                      {Array.from({ length: (activeArtifact.code || '').split('\n').length || 1 }).map((_, i) => (
                        <div key={i}>{i + 1}</div>
                      ))}
                    </div>
                    
                    {/* Textarea code editor */}
                    <textarea
                      value={activeArtifact.code || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActiveArtifact(prev => prev ? { ...prev, code: val } : null);
                        setEditedCodes(prev => ({ ...prev, [activeArtifact.id]: val }));
                      }}
                      onScroll={handleEditorScroll}
                      className="flex-1 bg-[#1e1e1e] text-[#e3e6eb] py-3 px-4 outline-none resize-none font-mono text-xs overflow-auto custom-scrollbar border-0 focus:ring-0 focus:outline-none h-full"
                      style={{
                        lineHeight: '20px',
                        whiteSpace: 'pre',
                        overflowWrap: 'normal',
                      }}
                      spellCheck="false"
                    />
                  </div>
                )}

                {/* 2. IFRAME PREVIEW (Visible in preview and split modes) */}
                {(workspaceMode === 'preview' || workspaceMode === 'split') && (
                  <div className="flex-1 bg-white h-full relative min-w-0 flex flex-col">
                    {previewUrl ? (
                      <iframe
                        key={iframeKey}
                        srcDoc={previewUrl}
                        sandbox="allow-scripts allow-same-origin allow-modals"
                        className="w-full h-full border-0 bg-white"
                        title="Web App Preview"
                      />
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-[#8e949e] italic text-xs bg-[#151515]">
                        Compilazione in corso...
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Terminal / Console Console */}
              {consoleOpen && (
                <div className="h-[180px] bg-[#121212] border-t border-[#2d2d2d] flex flex-col flex-shrink-0 min-h-0">
                  {/* Console Header */}
                  <div className="flex items-center justify-between px-4 py-1.5 bg-[#1a1a1a] border-b border-[#2d2d2d] flex-shrink-0">
                    <span className="text-[10px] font-bold text-[#8e949e] uppercase tracking-wider font-mono">Console Output</span>
                    <button
                      type="button"
                      onClick={() => setTerminalLogs([])}
                      className="text-[9px] font-mono text-[#8e949e] hover:text-[#e3e6eb] focus:outline-none"
                    >
                      Clear
                    </button>
                  </div>
                  
                  {/* Console logs */}
                  <div className="flex-1 p-4 overflow-y-auto font-mono text-xs leading-relaxed text-[#00E676] bg-[#0c0c0c] custom-scrollbar selection:bg-[#00E676] selection:text-black">
                    {terminalLogs.length === 0 ? (
                      <div className="text-[#6e7681] italic">Nessun log generato.</div>
                    ) : (
                      terminalLogs.map((log, idx) => (
                        <div key={idx} className="whitespace-pre-wrap mb-1">
                          {log}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-[#6e7681] italic text-xs">
              Nessun file aperto. Apri un blocco di codice dalla chat.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
