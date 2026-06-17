'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import ModelSelector from '@/components/ModelSelector';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const AGENTS = [
  { id: 'strategy', name: 'Strategy', icon: '🎯', color: 'from-purple-500 to-indigo-500', description: 'Analisi di mercato, competitor, strategie di crescita' },
  { id: 'tech', name: 'Tech', icon: '⚡', color: 'from-cyan-500 to-blue-500', description: 'Architettura, codice, infrastruttura, DevOps' },
  { id: 'finance', name: 'Finance', icon: '💰', color: 'from-green-500 to-emerald-500', description: 'Cash flow, fundraising, metriche SaaS' },
  { id: 'marketing', name: 'Marketing', icon: '📢', color: 'from-orange-500 to-red-500', description: 'Crazione utenti, campagne, content, SEO' },
  { id: 'legal', name: 'Legal', icon: '⚖️', color: 'from-gray-500 to-slate-500', description: 'Contratti, incorporazione, compliance' },
  { id: 'operations', name: 'Operations', icon: '⚙️', color: 'from-yellow-500 to-amber-500', description: 'Workflow, automazione, gestione team' },
];

export default function AgentsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('openrouter/owl-alpha');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load settings from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('agentfoundry_settings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSettings(parsed);
        if (parsed.defaultModel) {
          setSelectedModel(parsed.defaultModel);
        }
      } catch (e) {
        console.error('Error parsing settings:', e);
      }
    }
  }, []);

  // Fetch messages from DB when selectedAgent changes
  useEffect(() => {
    if (!selectedAgent) return;

    const fetchMessages = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/demo/chat?agentType=${selectedAgent}`);
        if (!res.ok) throw new Error('Impossibile caricare la cronologia della chat.');
        const data = await res.json();
        
        const mappedMessages = data.map((m: any) => ({
          role: m.role,
          content: m.content,
          timestamp: new Date(m.createdAt),
        }));
        setMessages(mappedMessages);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [selectedAgent]);

  const sendMessage = async () => {
    if (!input.trim() || !selectedAgent || loading) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);

    // Add user message locally for instant rendering
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);
    setLoading(true);

    try {
      const res = await fetch('/api/demo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: selectedAgent,
          message: userMessage,
          modelId: selectedModel,
          settings: settings,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.details || data.error || 'Errore sconosciuto');
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      }]);
    } catch (err: any) {
      setError(err.message);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Errore: ${err.message}`,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const currentAgent = AGENTS.find(a => a.id === selectedAgent);

  return (
    <div className="flex h-full bg-gray-950">
      {/* Sidebar - Agent List */}
      <div className="w-80 border-r border-gray-800 bg-gray-900 overflow-y-auto">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-lg font-bold text-white">🤖 AI Agents</h1>
          <p className="text-sm text-gray-500 mt-1">Seleziona un agente per iniziare</p>
        </div>
        <div className="p-2 space-y-1">
          {AGENTS.map(agent => (
            <button
              key={agent.id}
              onClick={() => {
                setSelectedAgent(agent.id);
                setMessages([]);
                setError(null);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                selectedAgent === agent.id
                  ? 'bg-gray-800 border border-gray-700'
                  : 'hover:bg-gray-800/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{agent.icon}</span>
                <div>
                  <div className="font-medium text-white">{agent.name}</div>
                  <div className="text-xs text-gray-500">{agent.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedAgent && currentAgent ? (
          <>
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-gray-800 bg-gray-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{currentAgent.icon}</span>
                <div>
                  <h2 className="font-bold text-white">{currentAgent.name} Agent</h2>
                  <p className="text-sm text-gray-500">{currentAgent.description}</p>
                </div>
              </div>
              <ModelSelector
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
              />
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-20">
                  <span className="text-6xl">{currentAgent.icon}</span>
                  <h3 className="text-xl font-semibold text-white mt-4">
                    Parla con {currentAgent.name}
                  </h3>
                  <p className="text-gray-500 mt-2 max-w-md mx-auto">
                    {currentAgent.description}. Fai una domanda per iniziare.
                  </p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-200'
                    }`}
                  >
                    <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                    <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-600'}`}>
                      {msg.timestamp.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Error display */}
            {error && (
              <div className="mx-6 mb-2 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
                ❌ {error}
              </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t border-gray-800 bg-gray-900">
              <div className="flex items-end gap-3">
                <div className="flex-1 relative">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Scrivi un messaggio..."
                    rows={1}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                    style={{ minHeight: '48px', maxHeight: '120px' }}
                  />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? '...' : 'Send'}
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                Model: {selectedModel} • Press Enter to send
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <span className="text-6xl">🤖</span>
              <h2 className="text-2xl font-bold text-white mt-4">Seleziona un Agente</h2>
              <p className="text-gray-500 mt-2">Scegli un agente dalla sidebar per iniziare a chattare</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
