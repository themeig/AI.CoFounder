'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AVAILABLE_MODELS, getClientModels, type ModelInfo } from '@/lib/models';
import { DEFAULT_APP_SETTINGS } from '@/lib/settings';

export default function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_APP_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [tavilyConfigured, setTavilyConfigured] = useState(false);
  const [tavilyKeyInput, setTavilyKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  // Custom models state
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newModelDesc, setNewModelDesc] = useState('');
  const [newModelContext, setNewModelContext] = useState(128000);
  const [newModelFree, setNewModelFree] = useState(false);
  const [newModelSpeed, setNewModelSpeed] = useState<'fast' | 'medium' | 'slow'>('medium');
  const [newModelQuality, setNewModelQuality] = useState<'basic' | 'good' | 'excellent'>('good');

  useEffect(() => {
    setModels(getClientModels());
    const stored = localStorage.getItem('agentfoundry_settings');
    if (stored) {
      try { setSettings({ ...DEFAULT_APP_SETTINGS, ...JSON.parse(stored) }); } catch {}
    }

    // Controlla se la chiave Tavily è configurata sul server
    fetch('/api/demo/keys?name=tavily')
      .then(res => res.json())
      .then(data => {
        if (data.configured) {
          setTavilyConfigured(true);
          setTavilyKeyInput('••••••••••••••••');
        }
      })
      .catch(err => console.error("Errore caricamento stato Tavily:", err));
  }, []);

  const handleAddCustomModel = () => {
    if (!newModelId || !newModelName) return;
    const newModel: ModelInfo = {
      id: newModelId.trim(),
      name: newModelName.trim(),
      description: newModelDesc.trim() || 'Modello personalizzato OpenRouter',
      contextLength: Number(newModelContext) || 128000,
      free: newModelFree,
      speed: newModelSpeed,
      quality: newModelQuality
    };

    const storedCustom = localStorage.getItem('agentfoundry_custom_models');
    let customList: ModelInfo[] = [];
    if (storedCustom) {
      try { customList = JSON.parse(storedCustom); } catch {}
    }
    // Evita duplicati
    if (!customList.some(m => m.id === newModel.id)) {
      customList.push(newModel);
    }
    localStorage.setItem('agentfoundry_custom_models', JSON.stringify(customList));

    // Ricarica e seleziona
    const updatedModels = getClientModels();
    setModels(updatedModels);
    setSettings(prev => ({ ...prev, defaultModel: newModel.id }));

    // Reset form
    setNewModelId('');
    setNewModelName('');
    setNewModelDesc('');
    setNewModelContext(128000);
    setNewModelFree(false);
    setNewModelSpeed('medium');
    setNewModelQuality('good');
    setShowAddCustom(false);
  };

  const handleDeleteCustomModel = (modelId: string) => {
    const storedCustom = localStorage.getItem('agentfoundry_custom_models');
    if (storedCustom) {
      try {
        let customList: ModelInfo[] = JSON.parse(storedCustom);
        customList = customList.filter(m => m.id !== modelId);
        localStorage.setItem('agentfoundry_custom_models', JSON.stringify(customList));
        
        // Ricarica
        setModels(getClientModels());
        
        // Se il modello rimosso era selezionato, ripiega sul default
        if (settings.defaultModel === modelId) {
          setSettings(prev => ({ ...prev, defaultModel: 'openrouter/owl-alpha' }));
        }
      } catch {}
    }
  };

  const saveSettings = async () => {
    localStorage.setItem('agentfoundry_settings', JSON.stringify(settings));

    if (tavilyKeyInput && tavilyKeyInput !== '••••••••••••••••') {
      setSavingKey(true);
      try {
        const res = await fetch('/api/demo/keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'tavily', key: tavilyKeyInput }),
        });
        if (res.ok) {
          setTavilyConfigured(true);
          setTavilyKeyInput('••••••••••••••••');
        }
      } catch (err) {
        console.error("Errore salvataggio API Key:", err);
      } finally {
        setSavingKey(false);
      }
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const removeTavilyKey = async () => {
    try {
      const res = await fetch('/api/demo/keys?name=tavily', {
        method: 'DELETE',
      });
      if (res.ok) {
        setTavilyConfigured(false);
        setTavilyKeyInput('');
      }
    } catch (err) {
      console.error("Errore rimozione API Key:", err);
    }
  };

  const currentModel = models.find(m => m.id === settings.defaultModel);

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-display">Impostazioni</h1>
        <p className="text-body mt-1">
          Configura il modello LLM e le preferenze generali della piattaforma.
          Le impostazioni di memoria e knowledge base si trovano nelle rispettive sezioni.
        </p>
      </div>

      {/* LLM Model */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8EAED', boxShadow: '0 1px 2px rgba(60,64,67,0.10)' }}>
        <div className="px-5 py-3.5 flex items-center gap-3" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#E8F0FE' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" style={{ color: '#1A73E8' }}>
              <path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3z"/>
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-sm" style={{ color: '#202124' }}>Modello LLM</h2>
            <p className="text-xs" style={{ color: '#5F6368' }}>Modello usato da tutti gli agenti per default (sovrascrivibile per agente)</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#5F6368' }}>Modello di default</label>
            <select
              value={settings.defaultModel}
              onChange={e => setSettings(prev => ({ ...prev, defaultModel: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
              style={{ background: '#F8F9FA', border: '1px solid #DADCE0', color: '#202124' }}
            >
              <optgroup label="Gratuiti">
                {models.filter(m => m.free).map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.description} ({(m.contextLength / 1000).toFixed(0)}K ctx)
                  </option>
                ))}
              </optgroup>
              <optgroup label="A pagamento">
                {models.filter(m => !m.free).map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.description} ({(m.contextLength / 1000).toFixed(0)}K ctx)
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {currentModel && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl" style={{ background: '#F8F9FA', border: '1px solid #E8EAED' }}>
              <div className="flex-1">
                <p className="text-xs font-medium mb-0.5" style={{ color: '#9AA0AC' }}>Modello selezionato</p>
                <p className="font-semibold text-sm" style={{ color: '#202124' }}>{currentModel.name}</p>
                <p className="text-xs mt-0.5" style={{ color: '#5F6368' }}>{currentModel.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`chip ${currentModel.free ? 'chip-green' : 'chip-yellow'}`}>
                  {currentModel.free ? 'Gratuito' : 'A pagamento'}
                </span>
                <span className="chip chip-gray">{(currentModel.contextLength / 1000).toFixed(0)}K ctx</span>
                {currentModel.quality && (
                  <span className={`chip ${currentModel.quality === 'excellent' ? 'chip-blue' : 'chip-gray'}`}>
                    {currentModel.quality}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Custom Models Actions */}
          <div className="pt-4 border-t border-[#F1F3F4] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: '#202124' }}>
                Modelli personalizzati
              </span>
              <button
                type="button"
                onClick={() => setShowAddCustom(!showAddCustom)}
                className="text-xs font-semibold text-[#1A73E8] hover:underline"
              >
                {showAddCustom ? 'Annulla' : '+ Aggiungi modello'}
              </button>
            </div>

            {/* List of custom models */}
            {models.filter(m => !AVAILABLE_MODELS.some(am => am.id === m.id)).length > 0 && (
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {models.filter(m => !AVAILABLE_MODELS.some(am => am.id === m.id)).map(m => (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded-lg text-xs animate-fade-in" style={{ background: '#F8F9FA', border: '1px solid #E8EAED' }}>
                    <div className="truncate flex-1 min-w-0 mr-2">
                      <span className="font-semibold block truncate" style={{ color: '#202124' }}>{m.name}</span>
                      <span className="text-[10px] block truncate" style={{ color: '#5F6368' }}>{m.id}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomModel(m.id)}
                      className="text-[10px] font-semibold text-[#EA4335] hover:underline px-2 py-1 rounded"
                    >
                      Rimuovi
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Custom Model Form */}
            {showAddCustom && (
              <div className="p-4 rounded-xl space-y-3 animate-fade-in text-left" style={{ background: '#F8F9FA', border: '1px solid #E8EAED' }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold mb-1" style={{ color: '#5F6368' }}>ID Modello OpenRouter</label>
                    <input
                      type="text"
                      placeholder="es: meta-llama/llama-3-8b-instruct"
                      value={newModelId}
                      onChange={e => setNewModelId(e.target.value)}
                      className="w-full px-2 py-1.5 rounded text-xs focus:outline-none"
                      style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold mb-1" style={{ color: '#5F6368' }}>Nome Visualizzato</label>
                    <input
                      type="text"
                      placeholder="es: Llama 3 8B"
                      value={newModelName}
                      onChange={e => setNewModelName(e.target.value)}
                      className="w-full px-2 py-1.5 rounded text-xs focus:outline-none"
                      style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold mb-1" style={{ color: '#5F6368' }}>Descrizione</label>
                  <input
                    type="text"
                    placeholder="Breve descrizione delle caratteristiche del modello..."
                    value={newModelDesc}
                    onChange={e => setNewModelDesc(e.target.value)}
                    className="w-full px-2 py-1.5 rounded text-xs focus:outline-none"
                    style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-[10px] font-semibold mb-1" style={{ color: '#5F6368' }}>Contesto (Tokens)</label>
                    <input
                      type="number"
                      value={newModelContext}
                      onChange={e => setNewModelContext(Number(e.target.value))}
                      className="w-full px-2 py-1.5 rounded text-xs focus:outline-none"
                      style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold mb-1" style={{ color: '#5F6368' }}>Velocità</label>
                    <select
                      value={newModelSpeed}
                      onChange={e => setNewModelSpeed(e.target.value as any)}
                      className="w-full px-2 py-1.5 rounded text-xs focus:outline-none"
                      style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }}
                    >
                      <option value="fast">Veloce</option>
                      <option value="medium">Media</option>
                      <option value="slow">Lenta</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold mb-1" style={{ color: '#5F6368' }}>Qualità</label>
                    <select
                      value={newModelQuality}
                      onChange={e => setNewModelQuality(e.target.value as any)}
                      className="w-full px-2 py-1.5 rounded text-xs focus:outline-none"
                      style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }}
                    >
                      <option value="basic">Base</option>
                      <option value="good">Buona</option>
                      <option value="excellent">Eccellente</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5 h-[32px]">
                    <input
                      type="checkbox"
                      id="newModelFree"
                      checked={newModelFree}
                      onChange={e => setNewModelFree(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="newModelFree" className="text-[10px] font-semibold cursor-pointer" style={{ color: '#5F6368', userSelect: 'none' }}>Gratuito</label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleAddCustomModel}
                    disabled={!newModelId || !newModelName}
                    className="px-3 py-1.5 rounded text-xs font-semibold text-white bg-[#1A73E8] hover:bg-[#1557B0] disabled:opacity-50"
                  >
                    Aggiungi
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Platform Assistant (coFounder) */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8EAED', boxShadow: '0 1px 2px rgba(60,64,67,0.10)' }}>
        <div className="px-5 py-3.5 flex items-center gap-3" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#FCE8E6' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" style={{ color: '#EA4335' }}>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-sm" style={{ color: '#202124' }}>Assistente coFounder</h2>
            <p className="text-xs" style={{ color: '#5F6368' }}>Configura il nome dell'assistente intelligente globale della piattaforma</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#5F6368' }}>Nome dell'assistente</label>
            <input
              type="text"
              value={settings.cofounderName || 'coFounder'}
              onChange={e => setSettings(prev => ({ ...prev, cofounderName: e.target.value }))}
              placeholder="coFounder"
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
              style={{ background: '#F8F9FA', border: '1px solid #DADCE0', color: '#202124' }}
            />
          </div>
        </div>
      </div>

      {/* Ricerca Web (Tavily) */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8EAED', boxShadow: '0 1px 2px rgba(60,64,67,0.10)' }}>
        <div className="px-5 py-3.5 flex items-center gap-3" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#E6F4EA' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" style={{ color: '#137333' }}>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-sm" style={{ color: '#202124' }}>Ricerca Web (Tavily)</h2>
            <p className="text-xs" style={{ color: '#5F6368' }}>Configura Tavily Search per abilitare le ricerche web in tempo reale più stabili ed evolute per gli agenti.</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-xs font-semibold" style={{ color: '#202124' }}>Abilita Tavily Search</label>
              <p className="text-xs" style={{ color: '#5F6368' }}>Se disattivato, gli agenti useranno DuckDuckGo come fallback per le ricerche.</p>
            </div>
            <button
              type="button"
              onClick={() => setSettings(prev => ({ ...prev, useTavily: !prev.useTavily }))}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${settings.useTavily ? 'bg-[#1A73E8]' : 'bg-[#DADCE0]'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.useTavily ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {settings.useTavily && (
            <div className="space-y-3 pt-3 border-t border-[#F1F3F4] animate-fade-in">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#5F6368' }}>Tavily API Key</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="password"
                      value={tavilyKeyInput}
                      onChange={e => setTavilyKeyInput(e.target.value)}
                      placeholder="Inserisci la tua Tavily API Key"
                      className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
                      style={{ background: '#F8F9FA', border: '1px solid #DADCE0', color: '#202124' }}
                    />
                    {tavilyConfigured && (
                      <span className="absolute right-3 top-2.5 text-xs font-medium text-[#137333] flex items-center gap-1">
                        Configurata ✅
                      </span>
                    )}
                  </div>
                  {tavilyConfigured && (
                    <button
                      type="button"
                      onClick={removeTavilyKey}
                      className="px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors focus:outline-none"
                      style={{ background: '#FCE8E6', color: '#C5221F', border: '1px solid #FAD2CF' }}
                    >
                      Rimuovi
                    </button>
                  )}
                </div>
                <p className="text-[10px] mt-1.5" style={{ color: '#5F6368' }}>
                  La chiave viene memorizzata in modo sicuro crittografata sul server e non sarà mai esposta nel browser.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Settings Links */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8EAED', boxShadow: '0 1px 2px rgba(60,64,67,0.10)' }}>
        <div className="px-5 py-3.5" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
          <h2 className="font-semibold text-sm" style={{ color: '#202124' }}>Impostazioni avanzate</h2>
          <p className="text-xs mt-0.5" style={{ color: '#5F6368' }}>Le impostazioni specifiche si trovano nelle rispettive sezioni</p>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              href: '/dashboard/memory',
              icon: (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" style={{ color: '#1A73E8' }}>
                  <path d="M12 2c-4.42 0-8 3.58-8 8 0 2.93 1.58 5.5 3.93 6.93V21h8.14v-4.07C18.42 15.5 20 12.93 20 10c0-4.42-3.58-8-8-8z"/>
                </svg>
              ),
              bg: '#E8F0FE',
              title: 'Impostazioni Memoria',
              desc: 'Mnemosyne, cronologia, recency bias',
            },
            {
              href: '/dashboard/memory',
              icon: (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" style={{ color: '#34A853' }}>
                  <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z"/>
                </svg>
              ),
              bg: '#E6F4EA',
              title: 'Impostazioni Knowledge Base',
              desc: 'Pattern, Playbook, success rate',
            },
          ].map(item => (
            <Link key={item.title} href={item.href} passHref legacyBehavior>
              <a
                className="group flex items-center gap-3 p-4 rounded-xl transition-all"
                style={{ background: '#F8F9FA', border: '1px solid #E8EAED', textDecoration: 'none' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#DADCE0'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(60,64,67,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E8EAED'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: item.bg }}>
                  {item.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: '#202124' }}>{item.title}</p>
                  <p className="text-xs" style={{ color: '#5F6368' }}>{item.desc}</p>
                </div>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0" style={{ color: '#DADCE0' }}>
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                </svg>
              </a>
            </Link>
          ))}
        </div>
      </div>

      {/* Platform Info */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8EAED', boxShadow: '0 1px 2px rgba(60,64,67,0.10)' }}>
        <div className="px-5 py-3.5" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
          <h2 className="font-semibold text-sm" style={{ color: '#202124' }}>Informazioni piattaforma</h2>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          {[
            { label: 'Versione', value: '1.0.0-demo' },
            { label: 'Ambiente', value: 'Demo Mode' },
            { label: 'Database', value: 'Supabase (PostgreSQL)' },
            { label: 'LLM Provider', value: 'OpenRouter' },
          ].map(item => (
            <div key={item.label}>
              <p className="text-xs font-medium mb-0.5" style={{ color: '#9AA0AC' }}>{item.label}</p>
              <p className="text-sm" style={{ color: '#202124' }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button onClick={saveSettings} className="btn-primary">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
          </svg>
          Salva impostazioni
        </button>
        {saved && (
          <span className="text-sm font-medium flex items-center gap-1" style={{ color: '#34A853' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            Salvato!
          </span>
        )}
      </div>
    </div>
  );
}
