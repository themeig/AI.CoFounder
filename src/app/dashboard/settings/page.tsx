'use client';

import { useState, useEffect } from 'react';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '@/lib/models';
import { DEFAULT_APP_SETTINGS } from '@/lib/settings';

export default function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_APP_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'model' | 'memory' | 'knowledge'>('model');

  const [memories, setMemories] = useState<any[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'local' | 'global'>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');

  const fetchMemories = async () => {
    setLoadingMemories(true);
    try {
      const res = await fetch('/api/demo/mnemosyne');
      if (res.ok) {
        const data = await res.json();
        setMemories(data);
      }
    } catch (err) {
      console.error("Failed to fetch memories:", err);
    } finally {
      setLoadingMemories(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'memory') {
      fetchMemories();
    }
  }, [activeTab]);

  const deleteMemory = async (agentConfigId: string, id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo ricordo permanentemente?")) return;
    try {
      const res = await fetch(`/api/demo/mnemosyne?agentConfigId=${agentConfigId}&id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMemories(prev => prev.filter(m => m.id !== id));
      } else {
        alert("Errore durante l'eliminazione del ricordo.");
      }
    } catch (err) {
      console.error("Error deleting memory:", err);
    }
  };

  // Load settings from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('agentfoundry_settings');
    if (stored) {
      try {
        setSettings({ ...DEFAULT_APP_SETTINGS, ...JSON.parse(stored) });
      } catch {}
    }
  }, []);

  const saveSettings = () => {
    localStorage.setItem('agentfoundry_settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateMemory = (key: string, value: number | boolean) => {
    setSettings(prev => ({
      ...prev,
      memorySettings: { ...prev.memorySettings, [key]: value }
    }));
  };

  const updateKnowledge = (key: string, value: number | boolean) => {
    setSettings(prev => ({
      ...prev,
      knowledgeSettings: { ...prev.knowledgeSettings, [key]: value }
    }));
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-white mb-2">⚙️ Impostazioni</h1>
      <p className="text-gray-500 mb-8">Configura il comportamento degli agenti e della memoria</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-800 pb-2">
        {[
          { id: 'model', label: '🤖 Modello LLM', desc: 'Modello e temperatura' },
          { id: 'memory', label: '🧠 Memoria', desc: 'Cronologia e long-term' },
          { id: 'knowledge', label: '📚 Knowledge', desc: 'Pattern e Playbook' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-gray-800 text-white border-t-2 border-blue-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <div>{tab.label}</div>
            <div className="text-xs text-gray-600">{tab.desc}</div>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">

        {/* ==================== MODEL TAB ==================== */}
        {activeTab === 'model' && (
          <div className="space-y-6">
            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Modello LLM di default
              </label>
              <select
                value={settings.defaultModel}
                onChange={(e) => setSettings(prev => ({ ...prev, defaultModel: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <optgroup label="🆓 Gratuiti">
                  {AVAILABLE_MODELS.filter(m => m.free).map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.description} (ctx: {(m.contextLength/1000).toFixed(0)}K)
                    </option>
                  ))}
                </optgroup>
                <optgroup label="💰 A pagamento">
                  {AVAILABLE_MODELS.filter(m => !m.free).map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.description} (ctx: {(m.contextLength/1000).toFixed(0)}K)
                    </option>
                  ))}
                </optgroup>
              </select>
              <p className="text-xs text-gray-600 mt-1">
                Modello usato da tutti gli agenti. Puoi cambiarlo per agente singolo nella chat.
              </p>
            </div>

            {/* Current model info */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Modello attuale:</div>
              <div className="text-white font-medium">
                {AVAILABLE_MODELS.find(m => m.id === settings.defaultModel)?.name || settings.defaultModel}
              </div>
              <div className="flex gap-2 mt-2">
                {(() => {
                  const model = AVAILABLE_MODELS.find(m => m.id === settings.defaultModel);
                  if (!model) return null;
                  return (
                    <>
                      <span className={`text-xs px-2 py-1 rounded ${model.free ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>
                        {model.free ? 'GRATIS' : 'A PAGAMENTO'}
                      </span>
                      <span className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded">
                        {(model.contextLength/1000).toFixed(0)}K context
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        model.quality === 'excellent' ? 'bg-purple-900 text-purple-300' :
                        model.quality === 'good' ? 'bg-blue-900 text-blue-300' :
                        'bg-gray-700 text-gray-400'
                      }`}>
                        {model.quality}
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ==================== MEMORY TAB ==================== */}
        {activeTab === 'memory' && (
          <div className="space-y-6">
            {/* Context Messages */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <span className="flex items-center justify-between">
                  <span>Messaggi di cronologia nel prompt</span>
                  <span className="text-blue-400 font-bold">{settings.memorySettings.contextMessages}</span>
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                value={settings.memorySettings.contextMessages}
                onChange={(e) => updateMemory('contextMessages', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>0 (solo system prompt)</span>
                <span>25</span>
                <span>50 (tutta la cronologia)</span>
              </div>
              <div className="mt-3 p-3 bg-gray-800 rounded-lg text-sm text-gray-400">
                {settings.memorySettings.contextMessages === 0 && (
                  <>❌ <strong>Nessuna cronologia.</strong> L'agente non ricorderà i messaggi precedenti nella sessione.</>
                )}
                {settings.memoryMessages > 0 && settings.memorySettings.contextMessages <= 10 && (
                  <>⚡ <strong>Contesto breve.</strong> Risposte più veloci, meno memoria. Buono per domande semplici.</>
                )}
                {settings.memorySettings.contextMessages > 10 && settings.memorySettings.contextMessages <= 30 && (
                  <>✅ <strong>Bilanciato.</strong> Buona memoria senza troppi token. Consigliato per la maggior parte degli usi.</>
                )}
                {settings.memorySettings.contextMessages > 30 && (
                  <>📚 <strong>Contesto completo.</strong> L'agente vede tutta la cronologia. Più lento e costoso ma massima continuità.</>
                )}
              </div>
            </div>

            {/* Long-term Memory */}
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div>
                <div className="text-sm font-medium text-white">🧠 Memoria a lungo termine</div>
                <div className="text-xs text-gray-500 mt-1">
                  Usa Mnemosyne per salvare ricordi tra le sessioni
                </div>
              </div>
              <button
                onClick={() => updateMemory('useLongTermMemory', !settings.memorySettings.useLongTermMemory)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.memorySettings.useLongTermMemory ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.memorySettings.useLongTermMemory ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Auto-save Interactions */}
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div>
                <div className="text-sm font-medium text-white">💾 Salva interazioni automaticamente</div>
                <div className="text-xs text-gray-500 mt-1">
                  Salva ogni interazione per futura analisi e training
                </div>
              </div>
              <button
                onClick={() => updateMemory('autoSaveInteractions', !settings.memorySettings.autoSaveInteractions)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.memorySettings.autoSaveInteractions ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.memorySettings.autoSaveInteractions ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Recency Bias */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <span className="flex items-center justify-between">
                  <span>Peso memoria recente vs vecchia</span>
                  <span className="text-blue-400 font-bold">{settings.memorySettings.recencyBias.toFixed(1)}</span>
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.memorySettings.recencyBias}
                onChange={(e) => updateMemory('recencyBias', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>Tutta uguale</span>
                <span>Balanciata</span>
                <span>Solo recente</span>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-800 my-6 pt-6" />

            {/* Mnemosyne Memory list */}
            <div>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    🧠 Ricordi Consolidati (Mnemosyne)
                  </h3>
                  <p className="text-xs text-gray-500">
                    Fatti ed informazioni estratti automaticamente dalle conversazioni per ciascun agente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchMemories}
                  className="px-3 py-1.5 bg-gray-800 text-gray-300 hover:text-white rounded-lg text-xs font-medium border border-gray-700 transition-colors flex items-center gap-1.5"
                >
                  🔄 Aggiorna
                </button>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Cerca nei ricordi..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-800/80 backdrop-blur border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                  <span className="absolute left-3 top-2.5 text-gray-500 text-sm">🔍</span>
                </div>

                {/* Scope filter */}
                <select
                  value={scopeFilter}
                  onChange={(e: any) => setScopeFilter(e.target.value)}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="all">Tutti gli scope (Locale & Globale)</option>
                  <option value="local">Solo Locale (Specifica dell'agente)</option>
                  <option value="global">Solo Globale (Condivisa con il team)</option>
                </select>

                {/* Agent filter */}
                <select
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="all">Tutti gli agenti</option>
                  <option value="strategy">Strategy Agent</option>
                  <option value="tech">Tech Agent</option>
                  <option value="finance">Finance Agent</option>
                  <option value="marketing">Marketing Agent</option>
                  <option value="legal">Legal Agent</option>
                  <option value="operations">Operations Agent</option>
                </select>
              </div>

              {/* Memory Cards / Table */}
              {loadingMemories ? (
                <div className="flex justify-center items-center py-12">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : memories.length === 0 ? (
                <div className="p-8 bg-gray-800/30 rounded-xl border border-gray-800 text-center">
                  <span className="text-3xl">📭</span>
                  <p className="text-gray-400 text-sm mt-2">Nessun ricordo salvato finora.</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Attiva la memoria a lungo termine e avvia una chat con gli agenti per iniziare ad accumulare fatti.
                  </p>
                </div>
              ) : (
                (() => {
                  const filtered = memories.filter(m => {
                    const matchesSearch = m.content.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesScope = scopeFilter === 'all' || m.scope === scopeFilter;
                    const matchesAgent = agentFilter === 'all' || m.agentType === agentFilter;
                    return matchesSearch && matchesScope && matchesAgent;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="p-8 bg-gray-800/30 rounded-xl border border-gray-800 text-center">
                        <p className="text-gray-500 text-sm">Nessun ricordo corrisponde ai filtri selezionati.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-950/40 backdrop-blur">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-900/60 border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase">
                            <th className="p-3">Agente / Fonte</th>
                            <th className="p-3">Ricordo</th>
                            <th className="p-3">Scope</th>
                            <th className="p-3">Importanza</th>
                            <th className="p-3 text-right">Azioni</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50 text-sm text-gray-300">
                          {filtered.map((m) => (
                            <tr key={m.id} className="hover:bg-gray-800/20 transition-colors">
                              <td className="p-3 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                                  m.agentType === 'strategy' ? 'bg-indigo-900/50 text-indigo-300 border border-indigo-700/50' :
                                  m.agentType === 'tech' ? 'bg-cyan-900/50 text-cyan-300 border border-cyan-700/50' :
                                  m.agentType === 'finance' ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50' :
                                  m.agentType === 'marketing' ? 'bg-pink-900/50 text-pink-300 border border-pink-700/50' :
                                  m.agentType === 'legal' ? 'bg-amber-900/50 text-amber-300 border border-amber-700/50' :
                                  'bg-gray-800 text-gray-300 border border-gray-700'
                                }`}>
                                  {m.agentType}
                                </span>
                                <div className="text-[10px] text-gray-500 mt-1">
                                  {new Date(m.createdAt).toLocaleDateString('it-IT')}
                                </div>
                              </td>
                              <td className="p-3 pr-6 font-normal text-white">
                                {m.content}
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                                  m.scope === 'global' ? 'bg-purple-900/60 text-purple-300' : 'bg-blue-900/60 text-blue-300'
                                }`}>
                                  {m.scope === 'global' ? '🌐 global' : '🔒 local'}
                                </span>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <div className="flex gap-0.5 text-yellow-500">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <span key={i} className={i < m.importance ? 'text-yellow-500' : 'text-gray-700'}>
                                      ★
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => deleteMemory(m.agentConfigId, m.id)}
                                  className="p-1 text-gray-500 hover:text-red-400 rounded transition-colors"
                                  title="Elimina ricordo"
                                >
                                  🗑️
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        )}

        {/* ==================== KNOWLEDGE TAB ==================== */}
        {activeTab === 'knowledge' && (
          <div className="space-y-6">
            {/* Use Patterns */}
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div>
                <div className="text-sm font-medium text-white">📊 Usa Pattern</div>
                <div className="text-xs text-gray-500 mt-1">
                  Includi i pattern dal knowledge base nel prompt dell'agente
                </div>
              </div>
              <button
                onClick={() => updateKnowledge('usePatterns', !settings.knowledgeSettings.usePatterns)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.knowledgeSettings.usePatterns ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.knowledgeSettings.usePatterns ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Use Playbooks */}
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div>
                <div className="text-sm font-medium text-white">📋 Usa Playbook</div>
                <div className="text-xs text-gray-500 mt-1">
                  Includi i playbook (step-by-step) nel prompt dell'agente
                </div>
              </div>
              <button
                onClick={() => updateKnowledge('usePlaybooks', !settings.knowledgeSettings.usePlaybooks)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.knowledgeSettings.usePlaybooks ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.knowledgeSettings.usePlaybooks ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Use Outcomes */}
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div>
                <div className="text-sm font-medium text-white">🎯 Usa Outcome</div>
                <div className="text-xs text-gray-500 mt-1">
                  Traccia i risultati delle azioni degli agenti
                </div>
              </div>
              <button
                onClick={() => updateKnowledge('useOutcomes', !settings.knowledgeSettings.useOutcomes)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.knowledgeSettings.useOutcomes ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.knowledgeSettings.useOutcomes ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Min Success Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <span className="flex items-center justify-between">
                  <span>Success Rate minima per Pattern</span>
                  <span className="text-blue-400 font-bold">{settings.knowledgeSettings.minSuccessRate}%</span>
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={settings.knowledgeSettings.minSuccessRate}
                onChange={(e) => updateKnowledge('minSuccessRate', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>0% (tutti)</span>
                <span>50%</span>
                <span>100% (solo top)</span>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Solo pattern con success rate ≥ {settings.knowledgeSettings.minSuccessRate}% verranno inclusi nel prompt.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={saveSettings}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-500 transition-colors"
        >
          💾 Salva Impostazioni
        </button>
        {saved && (
          <span className="text-green-400 text-sm font-medium animate-pulse">
            ✅ Salvato!
          </span>
        )}
      </div>

      {/* Memory Architecture Info */}
      <div className="mt-8 p-4 bg-gray-900 rounded-xl border border-gray-800">
        <h3 className="text-sm font-bold text-gray-300 mb-3">🏗️ Architettura Memoria</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-gray-800 rounded-lg">
            <div className="font-bold text-blue-400 mb-1">📝 Sessione</div>
            <div className="text-gray-500">
              Cronologia messaggi della chat corrente. Salvata in Supabase (Message table).
              Configurabile: 0-50 messaggi.
            </div>
          </div>
          <div className="p-3 bg-gray-800 rounded-lg">
            <div className="font-bold text-purple-400 mb-1">🧠 Mnemosyne</div>
            <div className="text-gray-500">
              Memoria a lungo termine per agente. Salva ricordi, preferenze, fatti.
              Locale (SQLite), persistente tra sessioni.
            </div>
          </div>
          <div className="p-3 bg-gray-800 rounded-lg">
            <div className="font-bold text-green-400 mb-1">📚 Knowledge Base</div>
            <div className="text-gray-500">
              Pattern, Playbook, Outcome. Condivisa tra tutti gli agenti.
              Filtrabile per success rate.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
