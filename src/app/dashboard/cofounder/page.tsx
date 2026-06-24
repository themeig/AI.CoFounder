'use client';

import { useState, useRef, useEffect } from 'react';
import ModelSelector from '@/components/ModelSelector';
import Link from 'next/link';
import { DEFAULT_APP_SETTINGS } from '@/lib/settings';

interface AgentDelegation {
  agentType: string;
  agentLabel: string;
  task: string;
  context?: string;
  response: string;
  success: boolean;
  duration: string;
  visibleToUser?: boolean;
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

interface Discussion {
  id: string;
  title: string;
  messages: CofounderMessage[];
  createdAt: string;
  updatedAt: string;
  isGenerating?: boolean;
  generationStartTime?: number;
  activeThinkingTime?: string;
  activeToolLabel?: string | null;
  activeDelegations?: { agentType: string; agentLabel: string; task: string; status: 'running' | 'done' }[];
  abortController?: AbortController | null;
  promptQueue?: string[];
  draftInput?: string;
}

interface Artifact {
  id: string;
  title: string;
  filename: string;
  code: string;
  language: string;
  type: 'code' | 'web' | 'data';
  logs?: string[];
  messageIndex?: number;
  discussionId?: string;
  createdAt?: string;
  updatedAt?: string;
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
          title: filename,
          filename,
          language: language.split(' ')[0] || 'text',
          code,
          type: filename.endsWith('.html') || filename.endsWith('.htm') ? 'web' : 'code',
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
              title: filename,
              filename,
              language: language.split(' ')[0] || 'text',
              code,
              type: filename.endsWith('.html') || filename.endsWith('.htm') ? 'web' : 'code',
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

function renderList(items: any[], key: string) {
  const isOrdered = items[0]?.ordered;
  const Tag = isOrdered ? 'ol' : 'ul';
  return (
    <Tag key={key} className={isOrdered ? 'list-decimal' : ''} style={{ paddingLeft: isOrdered ? '1.25rem' : '0.25rem', margin: '6px 0', color: '#3C4043', fontSize: '0.8125rem' }}>
      {items.map((item, idx) => {
        const isCheckbox = item.checkbox !== null && item.checkbox !== undefined;
        return (
          <li key={idx} className="mb-1 flex items-start gap-1.5" style={{ listStyleType: isOrdered ? undefined : 'none' }}>
            {item.checkbox === 'checked' && (
              <span className="text-green-600 font-bold select-none cursor-default" style={{ color: '#137333', fontSize: '0.95rem', lineHeight: '1.2' }}>☑</span>
            )}
            {item.checkbox === 'unchecked' && (
              <span className="text-gray-400 select-none cursor-default" style={{ color: '#9AA0AC', fontSize: '0.95rem', lineHeight: '1.2' }}>☐</span>
            )}
            {!isCheckbox && !isOrdered && (
              <span className="text-gray-400 select-none mr-1.5" style={{ color: '#9AA0AC', fontSize: '0.5rem', alignSelf: 'center', lineHeight: '1' }}>•</span>
            )}
            <span className="flex-1 leading-relaxed">{parseInlineMarkdown(item.text)}</span>
          </li>
        );
      })}
    </Tag>
  );
}

function formatMessageContent(
  content: string, 
  onOpenInWorkspace?: (code: string, language: string) => void,
  hideCodeBlocks?: boolean
) {
  if (!content) return null;
  let processedContent = content;
  const codeBlockCount = (content.match(/```/g) || []).length;
  if (codeBlockCount % 2 !== 0) processedContent += '\n```';

  const parts = processedContent.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      if (hideCodeBlocks) return null;
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

    const rawLines = part.split('\n');
    // Preprocess to remove empty lines inside tables
    const lines: string[] = [];
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const trimmed = line.trim();
      if (trimmed === "") {
        let prevStarts = false;
        let nextStarts = false;
        for (let j = lines.length - 1; j >= 0; j--) {
          if (lines[j].trim() !== "") {
            prevStarts = lines[j].trim().startsWith('|');
            break;
          }
        }
        for (let j = i + 1; j < rawLines.length; j++) {
          if (rawLines[j].trim() !== "") {
            nextStarts = rawLines[j].trim().startsWith('|');
            break;
          }
        }
        if (prevStarts && nextStarts) {
          continue;
        }
      }
      lines.push(line);
    }

    let tableRows: any[] = [];
    let listItems: any[] = [];
    let inList = false;
    let inTable = false;
    const renderedLines: any[] = [];

    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      const trimmed = line.trim();

      if (trimmed.startsWith('|')) {
        if (inList && listItems.length > 0) {
          renderedLines.push(renderList(listItems, `list-${l}`));
          listItems = [];
          inList = false;
        }
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

      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        inList = true;
        let itemText = trimmed.slice(2);
        let checkbox: 'checked' | 'unchecked' | null = null;
        if (itemText.startsWith('[ ] ')) {
          checkbox = 'unchecked';
          itemText = itemText.slice(4);
        } else if (itemText.startsWith('[x] ') || itemText.startsWith('[X] ')) {
          checkbox = 'checked';
          itemText = itemText.slice(4);
        }
        listItems.push({ text: itemText, ordered: false, checkbox });
      } else if (/^\d+\.\s/.test(trimmed)) {
        inList = true;
        listItems.push({ text: trimmed.replace(/^\d+\.\s/, ''), ordered: true, checkbox: null });
      } else {
        if (inList && listItems.length > 0) {
          renderedLines.push(renderList(listItems, `list-${l}`));
          listItems = [];
          inList = false;
        }

        if (trimmed.startsWith('### ')) {
          renderedLines.push(<h4 key={l} className="text-sm font-bold mt-3 mb-1" style={{ color: '#202124' }}>{parseInlineMarkdown(trimmed.slice(4))}</h4>);
        } else if (trimmed.startsWith('## ')) {
          renderedLines.push(<h3 key={l} className="text-base font-bold mt-4 mb-2" style={{ color: '#202124', borderBottom: '1px solid #E8EAED', paddingBottom: '2px' }}>{parseInlineMarkdown(trimmed.slice(3))}</h3>);
        } else if (trimmed.startsWith('# ')) {
          renderedLines.push(<h2 key={l} className="text-lg font-bold mt-5 mb-3" style={{ color: '#202124' }}>{parseInlineMarkdown(trimmed.slice(2))}</h2>);
        } else if (trimmed === '---' || trimmed === '***' || trimmed === '___' || trimmed.startsWith('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')) {
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

    if (inList && listItems.length > 0) {
      renderedLines.push(renderList(listItems, "list-flush"));
    }

    return <div key={index}>{renderedLines}</div>;
  });
}

function InlineArtifactCard({ 
  artifact, 
  onOpenInWorkspace 
}: { 
  artifact: Artifact; 
  onOpenInWorkspace: (code: string, language: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'code' | 'logs' | 'preview'>('code');
  const [terminalLogs, setTerminalLogs] = useState<string[]>(artifact.logs || []);
  const [running, setRunning] = useState(false);

  const hasLogs = terminalLogs.length > 0;
  const isWeb = artifact.type === 'web' || artifact.filename.endsWith('.html') || artifact.filename.endsWith('.htm');

  useEffect(() => {
    if (artifact.logs) {
      setTerminalLogs(artifact.logs);
    }
  }, [artifact.logs]);

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
    <div className="my-4 rounded-xl border border-[#DADCE0] overflow-hidden bg-white shadow-xs max-w-full text-xs font-sans text-[#202124]">
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-[#E8EAED]" style={{ background: '#F8F9FA' }}>
        <div className="flex items-center gap-2">
          <span className="text-base">📦</span>
          <div>
            <h4 className="font-bold text-xs" style={{ color: '#202124' }}>{artifact.title}</h4>
            <p className="text-[10px] text-[#5F6368] font-mono">{artifact.filename}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Run Button (for non-web runnable code) */}
          {(artifact.language === 'python' || artifact.language === 'py' || artifact.language === 'typescript' || artifact.language === 'ts' || artifact.language === 'javascript' || artifact.language === 'js') && (
            <button
              type="button"
              onClick={handleRun}
              disabled={running}
              className="text-[10px] font-semibold text-white bg-[#34A853] hover:bg-[#2C8C47] px-2 py-0.5 rounded transition disabled:opacity-50"
            >
              {running ? 'Esecuzione...' : '▶ Esegui'}
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenInWorkspace(artifact.code, artifact.language)}
            className="text-[10px] font-semibold text-[#1A73E8] hover:text-[#1557B0] border border-[#DADCE0] bg-white px-2 py-0.5 rounded transition"
          >
            🖥️ Workspace
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E8EAED] px-4" style={{ background: '#F8F9FA' }}>
        <button
          type="button"
          onClick={() => setActiveTab('code')}
          className={`py-2 px-3 border-b-2 font-medium text-[10px] uppercase tracking-wider transition ${
            activeTab === 'code' ? 'border-[#1A73E8] text-[#1A73E8]' : 'border-transparent text-[#5F6368] hover:text-[#202124]'
          }`}
        >
          Codice
        </button>
        {hasLogs && (
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`py-2 px-3 border-b-2 font-medium text-[10px] uppercase tracking-wider transition ${
              activeTab === 'logs' ? 'border-[#1A73E8] text-[#1A73E8]' : 'border-transparent text-[#5F6368] hover:text-[#202124]'
            }`}
          >
            Console Output
          </button>
        )}
        {isWeb && (
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`py-2 px-3 border-b-2 font-medium text-[10px] uppercase tracking-wider transition ${
              activeTab === 'preview' ? 'border-[#1A73E8] text-[#1A73E8]' : 'border-transparent text-[#5F6368] hover:text-[#202124]'
            }`}
          >
            Anteprima
          </button>
        )}
      </div>

      {/* Tab Contents */}
      <div className="p-3 bg-[#FAFAFA]">
        {activeTab === 'code' && (
          <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed p-2.5 rounded border border-[#E8EAED] bg-[#FFFFFF] max-h-64 text-[#202124]">
            <code>{artifact.code}</code>
          </pre>
        )}
        {activeTab === 'logs' && (
          <div className="bg-black text-[#00E676] font-mono text-[11px] p-3 rounded overflow-y-auto max-h-64 selection:bg-[#00E676] selection:text-black">
            {terminalLogs.map((log, idx) => (
              <div key={idx} className="whitespace-pre-wrap">{log}</div>
            ))}
          </div>
        )}
        {activeTab === 'preview' && (
          <div className="bg-white rounded border border-[#E8EAED] overflow-hidden" style={{ height: '220px' }}>
            <iframe
              srcDoc={artifact.code}
              sandbox="allow-scripts allow-same-origin allow-modals"
              className="w-full h-full border-0 bg-white"
              title="Inline Web App Preview"
            />
          </div>
        )}
      </div>
    </div>
  );
}
export default function CoFounderPage() {
  const [cofounderName, setCofounderName] = useState('coFounder');
  const [cofounderInput, setCofounderInput] = useState('');
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [activeDiscussionId, setActiveDiscussionId] = useState<string | null>(null);
  const [editingDiscussionId, setEditingDiscussionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [selectedModel, setSelectedModel] = useState('openrouter/owl-alpha');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [startupInfo, setStartupInfo] = useState<any>(null);

  // Track active discussion ID in a ref to keep stream completion callbacks aligned
  const activeDiscussionIdRef = useRef(activeDiscussionId);
  useEffect(() => {
    activeDiscussionIdRef.current = activeDiscussionId;
  }, [activeDiscussionId]);

  // Derived Active Discussion States
  const activeDiscussion = discussions.find(d => d.id === activeDiscussionId);
  const cofounderMessages = activeDiscussion ? activeDiscussion.messages : [];
  const cofounderLoading = activeDiscussion ? !!activeDiscussion.isGenerating : false;
  const activeThinkingTime = activeDiscussion ? activeDiscussion.activeThinkingTime || '0.0' : '0.0';
  const activeToolLabel = activeDiscussion ? activeDiscussion.activeToolLabel || null : null;
  const activeDelegations = activeDiscussion ? activeDiscussion.activeDelegations || [] : [];
  const [settings, setSettings] = useState<any>(DEFAULT_APP_SETTINGS);

  // Load app settings
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

  // Artifact Workspace States
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [workspaceWidth, setWorkspaceWidth] = useState(550);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [editedCodes, setEditedCodes] = useState<Record<string, string>>({});
  const [workspaceMode, setWorkspaceMode] = useState<'editor' | 'preview' | 'split'>('preview');
  const [iframeKey, setIframeKey] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isWorkspaceFullScreen, setIsWorkspaceFullScreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const workspaceRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const gutterRef = useRef<HTMLDivElement>(null);
  const prevArtifactCountRef = useRef(0);

  const discussionWorkspaceStatesRef = useRef<Record<string, {
    showWorkspace: boolean;
    workspaceMode: 'editor' | 'preview' | 'split';
    activeArtifactId: string | null;
    isWorkspaceFullScreen: boolean;
  }>>({});

  const prevDiscussionIdRef = useRef<string | null>(null);
  const shouldAutoOpenWorkspaceRef = useRef(false);

  // Sync workspace states on discussion switch
  useEffect(() => {
    const newId = activeDiscussionId;
    if (newId && prevDiscussionIdRef.current !== newId) {
      const saved = discussionWorkspaceStatesRef.current[newId];
      if (saved) {
        setShowWorkspace(saved.showWorkspace);
        setWorkspaceMode(saved.workspaceMode);
        setIsWorkspaceFullScreen(saved.isWorkspaceFullScreen);
      } else {
        setShowWorkspace(false);
        setWorkspaceMode('preview');
        setIsWorkspaceFullScreen(false);
        setActiveArtifact(null);
      }
      prevDiscussionIdRef.current = newId;
    }
  }, [activeDiscussionId]);

  // Save workspace states when they change
  useEffect(() => {
    if (activeDiscussionId) {
      discussionWorkspaceStatesRef.current[activeDiscussionId] = {
        showWorkspace,
        workspaceMode,
        activeArtifactId: activeArtifact ? activeArtifact.id : null,
        isWorkspaceFullScreen,
      };
    }
  }, [activeDiscussionId, showWorkspace, workspaceMode, activeArtifact, isWorkspaceFullScreen]);

  const fetchArtifacts = async (discId?: string) => {
    const targetId = discId || activeDiscussionIdRef.current;
    if (!targetId) return;
    try {
      const res = await fetch(`/api/demo/artifacts?discussionId=${targetId}`);
      if (res.ok) {
        const data = await res.json();
        if (targetId === activeDiscussionIdRef.current) {
          setArtifacts(data);
        }
      }
    } catch (err) {
      console.error("Errore fetch artifacts:", err);
    }
  };

  const handleArtifactChange = async (newCode: string) => {
    if (!activeArtifact) return;
    const updated = { ...activeArtifact, code: newCode };
    setActiveArtifact(updated);
    setArtifacts(prev => prev.map(a => a.id === activeArtifact.id ? updated : a));
    
    try {
      await fetch('/api/demo/artifacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updated, discussionId: activeDiscussionId })
      });
    } catch (err) {
      console.error("Errore salvataggio modifica:", err);
    }
  };

  // Drag Resizing Listeners
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    setIsDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 200 && newWidth < window.innerWidth - 300) {
        if (workspaceRef.current) {
          workspaceRef.current.style.width = `${newWidth}px`;
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth < 200) {
          setShowWorkspace(false);
        } else if (newWidth < window.innerWidth - 300) {
          setWorkspaceWidth(newWidth);
        }
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

  // Synchronize active artifact when artifacts list changes
  useEffect(() => {
    if (artifacts.length > 0) {
      const savedState = activeDiscussionId ? discussionWorkspaceStatesRef.current[activeDiscussionId] : null;
      const savedId = savedState?.activeArtifactId;

      setActiveArtifact(prev => {
        if (savedId) {
          const savedArt = artifacts.find(a => a.id === savedId);
          if (savedArt) return savedArt;
        }
        if (!prev) return artifacts[artifacts.length - 1];
        const exists = artifacts.find(a => a.id === prev.id);
        return exists || artifacts[artifacts.length - 1];
      });

      const isGenerating = activeDiscussion ? !!activeDiscussion.isGenerating : false;
      if (artifacts.length > prevArtifactCountRef.current && (prevArtifactCountRef.current > 0 || isGenerating || shouldAutoOpenWorkspaceRef.current)) {
        setShowWorkspace(true);
        const lastArt = artifacts[artifacts.length - 1];
        setActiveArtifact(lastArt);
        setWorkspaceMode('preview');
        shouldAutoOpenWorkspaceRef.current = false;
      }
    } else {
      setActiveArtifact(null);
    }
    prevArtifactCountRef.current = artifacts.length;
  }, [artifacts, activeDiscussionId, activeDiscussion]);

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
      const filename = `codice.${getFileExtension(language)}`;
      const temp: Artifact = {
        id: `temp-${Date.now()}`,
        title: filename,
        filename,
        language,
        code,
        type: filename.endsWith('.html') || filename.endsWith('.htm') ? 'web' : 'code',
        messageIndex: -1
      };
      setActiveArtifact(temp);
    }
    setShowWorkspace(true);
  };

  const chatEndRef = useRef<HTMLDivElement>(null);
  const cofounderTextareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const handleScroll = () => {
    const c = chatContainerRef.current;
    if (!c) return;
    isAtBottomRef.current = c.scrollHeight - c.scrollTop - c.clientHeight <= 150;
  };

  useEffect(() => {
    if (cofounderTextareaRef.current) {
      cofounderTextareaRef.current.style.height = 'auto';
      cofounderTextareaRef.current.style.height = `${cofounderTextareaRef.current.scrollHeight}px`;
    }
  }, [cofounderInput]);
  // No longer using global page-wide prompt queue

  // Thinking timer ticker for all active generating discussions in parallel
  useEffect(() => {
    const interval = setInterval(() => {
      setDiscussions(prev => {
        const hasGenerating = prev.some(d => d.isGenerating);
        if (!hasGenerating) return prev;
        
        return prev.map(d => {
          if (d.isGenerating && d.generationStartTime) {
            return {
              ...d,
              activeThinkingTime: ((Date.now() - d.generationStartTime) / 1000).toFixed(1)
            };
          }
          return d;
        });
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Fetch discussions
  const fetchDiscussions = async (activeIdToSelect?: string) => {
    try {
      const res = await fetch('/api/demo/cofounder/discussions');
      if (res.ok) {
        const list: Discussion[] = await res.json();
        setDiscussions(list);
        
        if (list.length > 0) {
          let selectedId = activeIdToSelect;
          if (!selectedId) {
            selectedId = localStorage.getItem('agentfoundry_active_discussion_id') || undefined;
          }
          if (!selectedId || !list.some(d => d.id === selectedId)) {
            selectedId = list[0].id;
          }
          
          setActiveDiscussionId(selectedId);
          localStorage.setItem('agentfoundry_active_discussion_id', selectedId);
        } else {
          handleCreateNewDiscussion();
        }
      } else {
        handleCreateNewDiscussion();
      }
    } catch (err) {
      console.error('Error fetching discussions:', err);
      handleCreateNewDiscussion();
    }
  };

  const handleSwitchDiscussion = (id: string) => {
    // Save current input to previous active discussion draft
    setDiscussions(prev => prev.map(d => {
      if (d.id === activeDiscussionId) {
        return { ...d, draftInput: cofounderInput };
      }
      return d;
    }));

    // Switch
    setActiveDiscussionId(id);
    localStorage.setItem('agentfoundry_active_discussion_id', id);

    // Clear workspace state for the new active discussion while loading
    setArtifacts([]);

    // Fetch artifacts for the new active discussion
    fetchArtifacts(id);

    // Load new input draft
    const target = discussions.find(d => d.id === id);
    setCofounderInput(target?.draftInput || '');
  };

  const handleCreateNewDiscussion = async () => {
    // Save current input to previous active discussion draft
    setDiscussions(prev => prev.map(d => {
      if (d.id === activeDiscussionId) {
        return { ...d, draftInput: cofounderInput };
      }
      return d;
    }));

    const newId = 'disc_' + Math.random().toString(36).substring(2, 15);
    const welcomeMsg: CofounderMessage = {
      role: 'assistant',
      content: `Ciao! Sono il tuo coFounder, l'assistente co-fondatore del tuo progetto. Posso aiutarti a gestire il team, creare agenti o aggiornare le metriche della startup in tempo reale. Cosa facciamo oggi?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    const newDiscussion: Discussion = {
      id: newId,
      title: 'Nuova Conversazione',
      messages: [welcomeMsg],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setDiscussions(prev => [newDiscussion, ...prev]);
    setActiveDiscussionId(newId);
    localStorage.setItem('agentfoundry_active_discussion_id', newId);

    // Clear workspace for the new empty discussion
    setArtifacts([]);

    // Clear input
    setCofounderInput('');
    
    try {
      await fetch('/api/demo/cofounder/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDiscussion)
      });
    } catch (err) {
      console.error('Error creating new discussion:', err);
    }
  };

  const handleDeleteDiscussion = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    const updatedDiscussions = discussions.filter(d => d.id !== id);
    setDiscussions(updatedDiscussions);
    
    try {
      await fetch(`/api/demo/cofounder/discussions?id=${id}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Error deleting discussion:', err);
    }
    
    if (activeDiscussionId === id) {
      if (updatedDiscussions.length > 0) {
        const nextId = updatedDiscussions[0].id;
        setActiveDiscussionId(nextId);
        localStorage.setItem('agentfoundry_active_discussion_id', nextId);
      } else {
        handleCreateNewDiscussion();
      }
    }
  };

  const handleRenameDiscussionSubmit = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) {
      setEditingDiscussionId(null);
      return;
    }
    
    setDiscussions(prev => prev.map(d => {
      if (d.id === id) {
        return { ...d, title: newTitle };
      }
      return d;
    }));
    setEditingDiscussionId(null);

    const target = discussions.find(d => d.id === id);
    const msgs = target ? target.messages : [];

    try {
      await fetch('/api/demo/cofounder/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          title: newTitle,
          messages: msgs
        })
      });
    } catch (err) {
      console.error('Error renaming discussion:', err);
    }
  };

  // Load startup info and discussions
  useEffect(() => {
    fetch('/api/demo/startup')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setStartupInfo(data[0]);
        }
      })
      .catch(console.error);

    fetchDiscussions();
  }, []);

  // Scroll to bottom only if user was already at the bottom
  useEffect(() => {
    if (isAtBottomRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [cofounderMessages, cofounderLoading, activeDelegations]);

  const saveChatForId = async (id: string, msgs: CofounderMessage[], updatedTitle?: string) => {
    try {
      await fetch('/api/demo/cofounder/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          messages: msgs,
          title: updatedTitle
        })
      });
    } catch (err) {
      console.error('Error saving discussion:', err);
    }
  };

  const saveChat = async (msgs: CofounderMessage[], updatedTitle?: string) => {
    if (!activeDiscussionId) return;
    
    setDiscussions(prev => prev.map(d => {
      if (d.id === activeDiscussionId) {
        return {
          ...d,
          messages: msgs,
          title: updatedTitle || d.title,
          updatedAt: new Date().toISOString()
        };
      }
      return d;
    }));

    await saveChatForId(activeDiscussionId, msgs, updatedTitle);
  };

  // Queuing is handled inside each discussion independently

  const handleStopGeneration = (id: string) => {
    const target = discussions.find(d => d.id === id);
    if (target?.abortController) {
      target.abortController.abort();
    }

    const interMsg: CofounderMessage = {
      role: 'assistant',
      content: '⏹ Generazione interrotta.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    const updatedMessages = [...(target?.messages || []), interMsg];

    setDiscussions(prev => prev.map(d => {
      if (d.id === id) {
        return {
          ...d,
          isGenerating: false,
          activeToolLabel: null,
          activeDelegations: [],
          abortController: null,
          messages: updatedMessages
        };
      }
      return d;
    }));

    saveChatForId(id, updatedMessages);
  };

  const handleSendMessage = async (e?: React.FormEvent, customText?: string, displayText?: string, targetId?: string) => {
    e?.preventDefault();
    const currentActiveId = targetId || activeDiscussionId;
    if (!currentActiveId) return;

    const promptToSend = (customText || cofounderInput).trim();
    if (!promptToSend) return;

    shouldAutoOpenWorkspaceRef.current = true;

    if (!customText && !targetId) {
      setCofounderInput('');
    }

    const activeDisc = discussions.find(d => d.id === currentActiveId);
    if (!activeDisc) return;
    if (activeDisc.isGenerating) {
      setDiscussions(prev => prev.map(d => {
        if (d.id === currentActiveId) {
          return {
            ...d,
            promptQueue: [...(d.promptQueue || []), promptToSend]
          };
        }
        return d;
      }));
      return;
    }

    const showText = displayText || promptToSend;
    const userMsg: CofounderMessage = {
      role: 'user',
      content: showText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedWithUser = [...activeDisc.messages, userMsg];

    // Auto-generate title if this is the first user prompt or title is still default
    let updatedTitle = undefined;
    if (activeDisc.title === 'Nuova Conversazione' || !activeDisc.title) {
      updatedTitle = promptToSend.length > 30 ? promptToSend.slice(0, 30) + '...' : promptToSend;
    }

    const controller = new AbortController();

    setDiscussions(prev => prev.map(d => {
      if (d.id === currentActiveId) {
        return {
          ...d,
          messages: updatedWithUser,
          title: updatedTitle || d.title,
          isGenerating: true,
          generationStartTime: Date.now(),
          activeThinkingTime: '0.0',
          activeToolLabel: null,
          activeDelegations: [],
          abortController: controller
        };
      }
      return d;
    }));

    saveChatForId(currentActiveId, updatedWithUser, updatedTitle);

    const startTime = Date.now();

    try {
      const res = await fetch('/api/demo/cofounder/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedWithUser.map(m => ({ role: m.role, content: m.content })),
          cofounderName,
          modelId: selectedModel,
          settings,
          discussionId: currentActiveId,
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
      let streamRenamedTitle: string | null = null;

      // Temporary placeholder message while streaming
      const assistantPlaceholder: CofounderMessage = {
        role: 'assistant',
        content: '',
        thinking: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isStreaming: true,
      };
      
      setDiscussions(prev => prev.map(d => {
        if (d.id === currentActiveId) {
          return {
            ...d,
            messages: [...d.messages, assistantPlaceholder]
          };
        }
        return d;
      }));

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
            } else if (parsed.type === 'rename_discussion') {
              const newTitle = payload.title;
              streamRenamedTitle = newTitle;
              setDiscussions(prev => prev.map(d => {
                if (d.id === currentActiveId) {
                  return { ...d, title: newTitle };
                }
                return d;
              }));
            } else if (parsed.type === 'tool_start') {
              setDiscussions(prev => prev.map(d => d.id === currentActiveId ? { ...d, activeToolLabel: payload.label } : d));
            } else if (parsed.type === 'tool_run') {
              setDiscussions(prev => prev.map(d => d.id === currentActiveId ? { ...d, activeToolLabel: null } : d));
            } else if (parsed.type === 'delegating') {
              const del = payload;
              setDiscussions(prev => prev.map(d => d.id === currentActiveId ? { ...d, activeDelegations: [...(d.activeDelegations || []), { agentType: del.agentType, agentLabel: del.agentLabel, task: del.task, status: 'running' }] } : d));
            } else if (parsed.type === 'delegation_done') {
              const del = payload;
              replyDelegations.push(del);
              setDiscussions(prev => prev.map(d => d.id === currentActiveId ? { ...d, activeDelegations: (d.activeDelegations || []).map((ad: any) => ad.agentType === del.agentType ? { ...ad, status: 'done' } : ad) } : d));
            } else if (parsed.type === 'agent_suggestion') {
              replySuggestion = payload;
            } else if (parsed.type === 'done') {
              replyContent = payload.content;
              replyTools = payload.executedTools || [];
              replyDelegations = payload.delegations || [];
              replySuggestion = payload.agentSuggestion;
              thinkingTimeVal = ((Date.now() - startTime) / 1000).toFixed(1);
              setDiscussions(prev => prev.map(d => d.id === currentActiveId ? { ...d, activeToolLabel: null } : d));
            } else if (parsed.type === 'error') {
              setDiscussions(prev => prev.map(d => d.id === currentActiveId ? { ...d, activeToolLabel: null } : d));
              throw new Error(payload);
            }

            // Update placeholder in real time
            setDiscussions(prev => prev.map(d => {
              if (d.id === currentActiveId) {
                const messages = [...d.messages];
                const last = messages[messages.length - 1];
                if (last && last.role === 'assistant') {
                  messages[messages.length - 1] = {
                    ...last,
                    content: replyContent,
                    thinking: replyThinking,
                    tools: replyTools,
                    delegations: replyDelegations,
                    agentSuggestion: replySuggestion,
                    thinkingTime: thinkingTimeVal,
                    isStreaming: true,
                  };
                }
                return { ...d, messages };
              }
              return d;
            }));
          } catch (e) {
            console.error('Failed to parse SSE data line:', jsonStr, e);
          }
        }
      }

      // Fetch agents list update in background to sync potential new agents
      window.dispatchEvent(new Event('startup-agents-updated'));

      // Fetch any new artifacts generated
      if (currentActiveId === activeDiscussionIdRef.current) {
        fetchArtifacts(currentActiveId);
      }

      // Final save and update message status (disable streaming flag)
      setDiscussions(prev => {
        const dIndex = prev.findIndex(d => d.id === currentActiveId);
        if (dIndex === -1) return prev;

        const d = prev[dIndex];
        const messages = [...d.messages];
        const last = messages[messages.length - 1];
        let finalMessages = messages;
        if (last && last.role === 'assistant') {
          const finalMsg = { ...last, isStreaming: false };
          finalMessages = [...messages.slice(0, -1), finalMsg];
        }

        saveChatForId(currentActiveId, finalMessages, streamRenamedTitle || undefined);

        const queue = d.promptQueue || [];
        const hasQueued = queue.length > 0;
        const nextPrompt = queue[0];
        const updatedQueue = queue.slice(1);

        const updatedDiscussion = {
          ...d,
          isGenerating: hasQueued,
          generationStartTime: hasQueued ? Date.now() : undefined,
          activeThinkingTime: hasQueued ? '0.0' : '0.0',
          activeToolLabel: null,
          activeDelegations: [],
          abortController: hasQueued ? d.abortController : null,
          messages: finalMessages,
          promptQueue: updatedQueue
        };

        if (hasQueued && nextPrompt) {
          setTimeout(() => {
            handleSendMessage(undefined, nextPrompt, undefined, currentActiveId);
          }, 500);
        }

        return prev.map(item => item.id === currentActiveId ? updatedDiscussion : item);
      });

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('SSE connection error:', err);

      const errorMsg: CofounderMessage = {
        role: 'assistant',
        content: `❌ Si è verificato un errore durante la generazione: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setDiscussions(prev => {
        const dIndex = prev.findIndex(d => d.id === currentActiveId);
        if (dIndex === -1) return prev;

        const d = prev[dIndex];
        const finalErr = [...d.messages, errorMsg];
        saveChatForId(currentActiveId, finalErr);

        const queue = d.promptQueue || [];
        const hasQueued = queue.length > 0;
        const nextPrompt = queue[0];
        const updatedQueue = queue.slice(1);

        const updatedDiscussion = {
          ...d,
          isGenerating: hasQueued,
          generationStartTime: hasQueued ? Date.now() : undefined,
          activeThinkingTime: hasQueued ? '0.0' : '0.0',
          activeToolLabel: null,
          activeDelegations: [],
          abortController: null,
          messages: finalErr,
          promptQueue: updatedQueue
        };

        if (hasQueued && nextPrompt) {
          setTimeout(() => {
            handleSendMessage(undefined, nextPrompt, undefined, currentActiveId);
          }, 500);
        }

        return prev.map(item => item.id === currentActiveId ? updatedDiscussion : item);
      });
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
      const welcomeMsg: CofounderMessage = {
        role: 'assistant',
        content: `Chat svuotata. Sono pronto per una nuova sessione! Come posso aiutarti oggi?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setDiscussions(prev => prev.map(d => {
        if (d.id === activeDiscussionId) {
          return { ...d, messages: [welcomeMsg] };
        }
        return d;
      }));
      saveChat([welcomeMsg]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCofounderInput(val);

    if (val.startsWith('/')) {
      setShowSlashMenu(true);
      setSlashFilter(val.slice(1).toLowerCase());
    } else {
      setShowSlashMenu(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
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
          {/* New Discussion Button */}
          <button
            type="button"
            onClick={handleCreateNewDiscussion}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl font-semibold text-xs text-white transition-all duration-200 hover:shadow-md hover:brightness-105 active:scale-98"
            style={{
              background: 'linear-gradient(135deg, #1A73E8, #1557B0)',
              boxShadow: '0 2px 4px rgba(26,115,232,0.2)'
            }}
          >
            <span className="text-sm font-bold">＋</span> Nuova Conversazione
          </button>

          {/* Discussions Section */}
          <div className="flex flex-col space-y-2">
            <h3 className="text-xs font-bold text-[#202124] uppercase tracking-wider px-1">Discussioni</h3>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {discussions.map(d => {
                const isActive = d.id === activeDiscussionId;
                return (
                  <div
                    key={d.id}
                    onClick={() => handleSwitchDiscussion(d.id)}
                    className={`group flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all border ${
                      isActive
                        ? 'bg-[#E8F0FE] border-[#1A73E8] text-[#1A73E8]'
                        : 'bg-white border-[#E8EAED] hover:bg-[#F8F9FA] hover:border-[#DADCE0] text-[#3C4043]'
                    }`}
                  >
                    {editingDiscussionId === d.id ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={e => setEditingTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            handleRenameDiscussionSubmit(d.id, editingTitle);
                          } else if (e.key === 'Escape') {
                            setEditingDiscussionId(null);
                          }
                        }}
                        onBlur={() => handleRenameDiscussionSubmit(d.id, editingTitle)}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                        className="w-full text-xs px-2 py-1 rounded border border-[#1A73E8] focus:outline-none bg-white text-[#202124] font-medium"
                      />
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-xs flex-shrink-0 flex items-center justify-center">
                            {d.isGenerating ? (
                              <span className="relative flex h-2.5 w-2.5 mr-0.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1A73E8] opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#1A73E8]"></span>
                              </span>
                            ) : (
                              '💬'
                            )}
                          </span>
                          <span className="text-xs font-medium truncate">{d.title}</span>
                          {d.isGenerating && (
                            <span className="text-[9px] font-semibold text-[#1A73E8] animate-pulse uppercase ml-auto pr-1.5 flex-shrink-0">Genera...</span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingDiscussionId(d.id);
                              setEditingTitle(d.title);
                            }}
                            className={`p-1 rounded-md text-[#5F6368] hover:text-[#1A73E8] hover:bg-white/80 transition-all focus:outline-none ${
                              isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}
                            title="Rinomina conversazione"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                              <path d="M12 20h9"></path>
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                            </svg>
                          </button>
                          
                          <button
                            type="button"
                            onClick={(e) => handleDeleteDiscussion(d.id, e)}
                            className={`p-1 rounded-md text-[#5F6368] hover:text-[#EA4335] hover:bg-white/80 transition-all focus:outline-none ${
                              isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}
                            title="Elimina discussione"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

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
      {(!showWorkspace || !isWorkspaceFullScreen) && (
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
                onClick={() => {
                  if (showWorkspace) {
                    setIsWorkspaceFullScreen(false);
                  }
                  setShowWorkspace(!showWorkspace);
                }}
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
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar"
          style={{ background: '#F8F9FA' }}
        >
          <div className="max-w-3xl mx-auto space-y-6 py-4">
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
                    ? formatMessageContent(msg.content, openArtifactInWorkspace, msg.role === 'assistant') 
                    : msg.isStreaming 
                      ? <span className="text-[#9AA0AC] animate-pulse italic">Il CoFounder sta elaborando la risposta...</span>
                      : null
                  }
                </div>

                {msg.role === 'assistant' && (msg.thinking || (msg.tools && msg.tools.length > 0)) && (
                  <details 
                    key={msg.isStreaming ? 'open' : 'closed'}
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
                          {del.visibleToUser ? (
                            <div className="text-[10px] leading-relaxed text-[#202124] p-1.5 bg-white rounded border border-[#E8EAED]">{formatMessageContent(del.response, openArtifactInWorkspace)}</div>
                          ) : (
                            <details className="mt-1.5 group">
                              <summary className="list-none flex items-center gap-1.5 text-[9px] text-[#5F6368] font-bold uppercase tracking-wider cursor-pointer select-none hover:text-[#1A73E8] transition-colors">
                                <span>📄 Risposta interna (Clicca per mostrare)</span>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" 
                                  className="w-2.5 h-2.5 transform group-open:rotate-180 transition-transform duration-200 text-[#70757a]"
                                >
                                  <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                              </summary>
                              <div className="mt-2 text-[10px] leading-relaxed text-[#202124] p-2 bg-white rounded border border-[#E8EAED] max-h-[250px] overflow-y-auto custom-scrollbar">
                                {formatMessageContent(del.response, openArtifactInWorkspace)}
                              </div>
                            </details>
                          )}
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
                  {activeDelegations.map((del: any, dIdx: number) => {
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
        </div>

        {/* Coda Prompt */}
        {(activeDiscussion?.promptQueue || []).length > 0 && (
          <div className="mx-6 mb-2 px-3 py-1.5 bg-[#E6F4EA] border border-[#A7F3D0] rounded-lg flex items-center justify-between animate-fade-in z-20">
            <span className="text-[11px] text-[#065F46] font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-ping" />
              {(activeDiscussion?.promptQueue || []).length} {(activeDiscussion?.promptQueue || []).length === 1 ? 'prompt in attesa' : 'prompt in coda'}
            </span>
            <button
              onClick={() => {
                setDiscussions(prev => prev.map(d => {
                  if (d.id === activeDiscussionId) {
                    return { ...d, promptQueue: [] };
                  }
                  return d;
                }));
              }}
              className="text-[10px] text-[#065F46] hover:underline font-bold"
            >
              Svuota
            </button>
          </div>
        )}

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="px-5 pb-5 pt-2 relative z-30 w-full"
          style={{ background: '#F8F9FA' }}
        >
          <div className="flex items-end gap-3 max-w-3xl mx-auto w-full relative">
            {/* Slash Commands Dropdown */}
            {showSlashMenu && slashCommands.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-[#E8EAED] rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in">
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

            <div
              className="flex-1 flex items-end rounded-[28px] overflow-hidden transition-all bg-[#F0F4F9] border border-transparent shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
              style={{ minHeight: '52px' }}
              onFocusCapture={e => {
                e.currentTarget.style.borderColor = '#E8EAED';
                e.currentTarget.style.background = '#FFFFFF';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)';
              }}
              onBlurCapture={e => {
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.background = '#F0F4F9';
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
              }}
            >
              <textarea
                ref={cofounderTextareaRef}
                placeholder={cofounderLoading ? '⏳ In attesa della risposta...' : 'Scrivi un messaggio o digita / per i comandi...'}
                value={cofounderInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                rows={1}
                className="flex-1 pl-6 pr-4 py-3.5 bg-transparent resize-none focus:outline-none text-xs placeholder-gray-500 font-medium"
                style={{ color: '#202124', minHeight: '52px', maxHeight: '160px', lineHeight: '20px' }}
              />
              {cofounderLoading && !cofounderInput.trim() ? (
                <button
                  type="button"
                  onClick={() => handleStopGeneration(activeDiscussionId!)}
                  className="m-2 w-9 h-9 rounded-full flex items-center justify-center bg-[#EA4335] text-white shadow-md hover:bg-[#D93025] transition flex-shrink-0"
                  title="Interrompi generazione"
                >
                  <div className="w-2.5 h-2.5 bg-white rounded-xs" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!cofounderInput.trim() && !cofounderLoading}
                  className="m-2 w-9 h-9 rounded-full flex items-center justify-center text-white transition-all disabled:opacity-40 disabled:bg-[#DADCE0] disabled:shadow-none flex-shrink-0"
                  style={{ background: '#1A73E8', boxShadow: '0 2px 4px rgba(26,115,232,0.2)' }}
                  title="Invia"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
      )}

      {/* Vertical Resize Splitter */}
      {showWorkspace && !isWorkspaceFullScreen && (
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
          ref={workspaceRef}
          style={{ width: isWorkspaceFullScreen ? '100%' : `${workspaceWidth}px` }}
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
                onClick={() => setConsoleOpen(!consoleOpen)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition shadow-sm focus:outline-none ${
                  consoleOpen
                    ? 'bg-[#1A73E8] text-white hover:bg-[#1557B0]'
                    : 'bg-[#2d2d2d] text-[#e3e6eb] hover:bg-[#3d3d3d] border border-[#3d3d3d]'
                }`}
              >
                <span>🖥️</span> Console
              </button>

              <button
                type="button"
                onClick={handleRunCode}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#00A86B] hover:bg-[#008F5A] text-white text-xs font-bold transition shadow-sm focus:outline-none"
              >
                <span>▶</span> Run
              </button>

              <button
                type="button"
                onClick={() => setIsWorkspaceFullScreen(!isWorkspaceFullScreen)}
                className="p-1 rounded-md text-[#8e949e] hover:text-[#e3e6eb] transition focus:outline-none flex items-center justify-center"
                title={isWorkspaceFullScreen ? "Metà Schermo" : "Schermo Intero"}
              >
                {isWorkspaceFullScreen ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M4 14h6v6m0-6l-6 6m16-6h-6v6m0-6l6 6M4 10h6V4m0 6L4 4m16 6h-6V4m0 6l6-6"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                  </svg>
                )}
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setShowWorkspace(false);
                  setIsWorkspaceFullScreen(false);
                }}
                className="text-[#8e949e] hover:text-[#e3e6eb] text-sm font-semibold focus:outline-none"
                title="Collapse Workspace"
              >
                ✕
              </button>
            </div>
          </div>

          {/* File Selector Dropdown */}
          <div className="flex items-center px-4 py-2 bg-[#151515] border-b border-[#2d2d2d] flex-shrink-0 gap-3">
            <span className="text-[10px] font-bold text-[#8e949e] uppercase tracking-wider font-mono flex items-center gap-1.5">
              <span>📁</span> File Attivo:
            </span>
            <div className="relative flex-1 max-w-[280px]">
              <select
                value={activeArtifact?.id || ''}
                onChange={(e) => {
                  const art = artifacts.find(a => a.id === e.target.value);
                  if (art) setActiveArtifact(art);
                }}
                className="w-full bg-[#1e1e1e] text-xs font-mono text-[#e3e6eb] border border-[#2d2d2d] rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8] cursor-pointer appearance-none"
              >
                {artifacts.map(art => (
                  <option key={art.id} value={art.id} className="bg-[#1e1e1e] text-[#e3e6eb] py-2">
                    {art.filename}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#8e949e]">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
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
                      onChange={(e) => handleArtifactChange(e.target.value)}
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
                        className={`w-full h-full border-0 bg-white ${isDragging ? 'pointer-events-none' : ''}`}
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
