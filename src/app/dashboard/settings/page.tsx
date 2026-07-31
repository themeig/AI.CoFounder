'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AVAILABLE_MODELS, getClientModels, type ModelInfo } from '@/lib/models';
import { DEFAULT_APP_SETTINGS } from '@/lib/settings';
import { useTranslation } from '@/lib/i18n/LanguageContext';

export default function SettingsPage() {
  const { language, setLanguage, t } = useTranslation();
  const [settings, setSettings] = useState(DEFAULT_APP_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [tavilyConfigured, setTavilyConfigured] = useState(false);
  const [tavilyKeyInput, setTavilyKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [testingTavily, setTestingTavily] = useState(false);
  const [tavilyTestResult, setTavilyTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showTavilyPassword, setShowTavilyPassword] = useState(false);

  // Custom models state
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [newModelProvider, setNewModelProvider] = useState<'openrouter' | 'openai' | 'ollama' | 'custom'>('openrouter');
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newModelDesc, setNewModelDesc] = useState('');
  const [newModelContext, setNewModelContext] = useState(128000);
  const [newModelFree, setNewModelFree] = useState(false);
  const [newModelBaseUrl, setNewModelBaseUrl] = useState('');
  const [newModelApiKey, setNewModelApiKey] = useState('');
  const [testingModel, setTestingModel] = useState(false);
  const [modelTestResult, setModelTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Stripe state
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [stripeKeyInput, setStripeKeyInput] = useState('');
  const [savingStripeKey, setSavingStripeKey] = useState(false);
  const [testingStripe, setTestingStripe] = useState(false);
  const [stripeTestResult, setStripeTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showStripePassword, setShowStripePassword] = useState(false);

  // Google Calendar state
  const [gcalConfigured, setGcalConfigured] = useState(false);
  const [gcalKeyInput, setGcalKeyInput] = useState('');
  const [savingGcalKey, setSavingGcalKey] = useState(false);
  const [testingGcal, setTestingGcal] = useState(false);
  const [gcalTestResult, setGcalTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showGcalPassword, setShowGcalPassword] = useState(false);

  // ── Load models and settings from localStorage on mount ────────────────────
  useEffect(() => {
    // Load all models (built-in + custom from localStorage)
    setModels(getClientModels());

    // Load saved settings
    const stored = localStorage.getItem('agentfoundry_settings');
    if (stored) {
      try { setSettings(prev => ({ ...prev, ...JSON.parse(stored) })); } catch {}
    }

    // Check Tavily API key status from server
    fetch('/api/demo/keys?name=tavily')
      .then(res => res.json())
      .then(data => {
        if (data.configured) {
          setTavilyConfigured(true);
          setTavilyKeyInput('••••••••••••••••');
        }
      })
      .catch(err => console.error('Error loading Tavily status:', err));

    // Check Stripe API key status from server
    fetch('/api/demo/keys?name=stripe')
      .then(res => res.json())
      .then(data => {
        if (data.configured) {
          setStripeConfigured(true);
          setStripeKeyInput('••••••••••••••••');
        }
      })
      .catch(err => console.error('Error loading Stripe status:', err));

    // Check Google Calendar API key status from server
    fetch('/api/demo/keys?name=google_calendar')
      .then(res => res.json())
      .then(data => {
        if (data.configured) {
          setGcalConfigured(true);
          setGcalKeyInput('••••••••••••••••');
        }
      })
      .catch(err => console.error('Error loading Google Calendar status:', err));
  }, []);

  const testCustomModelConnection = async () => {
    if (!newModelId) return;
    setTestingModel(true);
    setModelTestResult(null);
    try {
      const res = await fetch('/api/demo/models/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: newModelProvider,
          modelId: newModelId,
          baseUrl: newModelBaseUrl,
          apiKey: newModelApiKey,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setModelTestResult({ success: true, message: data.message });
      } else {
        setModelTestResult({ success: false, message: data.error || 'Connection test failed' });
      }
    } catch (err: any) {
      setModelTestResult({ success: false, message: err.message || 'Error testing model' });
    } finally {
      setTestingModel(false);
    }
  };

  const handleEditCustomModel = (model: ModelInfo) => {
    setEditingModelId(model.id);
    setNewModelProvider(model.provider || 'openrouter');
    setNewModelId(model.id);
    setNewModelName(model.name);
    setNewModelDesc(model.description || '');
    setNewModelContext(model.contextLength || 128000);
    setNewModelFree(model.free || false);
    setNewModelBaseUrl(model.baseUrl || '');
    setNewModelApiKey(model.apiKey || '');
    setModelTestResult(null);
    setShowAddCustom(true);
  };

  const handleAddCustomModel = () => {
    if (!newModelId || !newModelName) return;
    const newModel: ModelInfo = {
      id: newModelId.trim(),
      name: newModelName.trim(),
      description: newModelDesc.trim() || `${newModelProvider.toUpperCase()} Model`,
      contextLength: Number(newModelContext) || 128000,
      free: newModelFree,
      speed: 'medium',
      quality: 'good',
      provider: newModelProvider,
      baseUrl: newModelBaseUrl.trim() || undefined,
      apiKey: newModelApiKey.trim() || undefined,
    };

    const storedCustom = localStorage.getItem('agentfoundry_custom_models');
    let customList: ModelInfo[] = [];
    if (storedCustom) {
      try { customList = JSON.parse(storedCustom); } catch {}
    }

    if (editingModelId) {
      // Replace existing
      customList = customList.map(m => m.id === editingModelId ? newModel : m);
    } else {
      // Add new
      const existingIdx = customList.findIndex(m => m.id === newModel.id);
      if (existingIdx >= 0) {
        customList[existingIdx] = newModel;
      } else {
        customList.push(newModel);
      }
    }
    
    localStorage.setItem('agentfoundry_custom_models', JSON.stringify(customList));

    const updatedModels = getClientModels();
    setModels(updatedModels);
    setSettings(prev => ({ ...prev, defaultModel: newModel.id }));

    setEditingModelId(null);
    setNewModelId('');
    setNewModelName('');
    setNewModelDesc('');
    setNewModelBaseUrl('');
    setNewModelApiKey('');
    setNewModelContext(128000);
    setNewModelFree(false);
    setModelTestResult(null);
    setShowAddCustom(false);
  };

  const handleDeleteCustomModel = (modelId: string) => {
    const storedCustom = localStorage.getItem('agentfoundry_custom_models');
    if (storedCustom) {
      try {
        let customList: ModelInfo[] = JSON.parse(storedCustom);
        customList = customList.filter(m => m.id !== modelId);
        localStorage.setItem('agentfoundry_custom_models', JSON.stringify(customList));
        
        setModels(getClientModels());
        if (settings.defaultModel === modelId) {
          setSettings(prev => ({ ...prev, defaultModel: 'openrouter/free' }));
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
        console.error("Error saving API key:", err);
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
        setTavilyTestResult(null);
      }
    } catch (err) {
      console.error("Error removing API key:", err);
    }
  };

  const testTavilyKey = async () => {
    setTestingTavily(true);
    setTavilyTestResult(null);
    try {
      const res = await fetch('/api/demo/keys?name=tavily&test=true');
      const data = await res.json();
      if (res.ok && data.valid) {
        setTavilyTestResult({ success: true, message: data.message || 'Tavily API Key is valid and working!' });
      } else {
        setTavilyTestResult({ success: false, message: data.error || 'Failed to connect to Tavily API' });
      }
    } catch (err: any) {
      setTavilyTestResult({ success: false, message: err.message || 'Connection test error' });
    } finally {
      setTestingTavily(false);
    }
  };

  const handleSaveTavilyDirect = async () => {
    if (!tavilyKeyInput || tavilyKeyInput === '••••••••••••••••') return;
    setSavingKey(true);
    setTavilyTestResult(null);
    try {
      const res = await fetch('/api/demo/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'tavily', key: tavilyKeyInput }),
      });
      if (res.ok) {
        setTavilyConfigured(true);
        setTavilyKeyInput('••••••••••••••••');
        setTavilyTestResult({ success: true, message: 'Chiave Tavily salvata e cifrata (AES-256) con successo!' });
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Errore durante il salvataggio');
      }
    } catch (err: any) {
      setTavilyTestResult({ success: false, message: err.message || 'Errore salvataggio' });
    } finally {
      setSavingKey(false);
    }
  };

  const handleSaveStripeDirect = async () => {
    if (!stripeKeyInput || stripeKeyInput === '••••••••••••••••') return;
    setSavingStripeKey(true);
    setStripeTestResult(null);
    try {
      const res = await fetch('/api/demo/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'stripe', key: stripeKeyInput }),
      });
      if (res.ok) {
        setStripeConfigured(true);
        setStripeKeyInput('••••••••••••••••');
        setStripeTestResult({ success: true, message: 'Chiave Stripe salvata e cifrata (AES-256) con successo!' });
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Errore durante il salvataggio');
      }
    } catch (err: any) {
      setStripeTestResult({ success: false, message: err.message || 'Errore salvataggio' });
    } finally {
      setSavingStripeKey(false);
    }
  };

  const testStripeKey = async () => {
    setTestingStripe(true);
    setStripeTestResult(null);
    try {
      const res = await fetch('/api/demo/keys?name=stripe&test=true');
      const data = await res.json();
      if (res.ok && data.valid) {
        setStripeTestResult({ success: true, message: data.message || 'Connesso a Stripe API con successo!' });
      } else {
        setStripeTestResult({ success: false, message: data.error || 'Impossibile connettersi a Stripe API' });
      }
    } catch (err: any) {
      setStripeTestResult({ success: false, message: err.message || 'Errore test connessione Stripe' });
    } finally {
      setTestingStripe(false);
    }
  };

  const removeStripeKey = async () => {
    try {
      const res = await fetch('/api/demo/keys?name=stripe', { method: 'DELETE' });
      if (res.ok) {
        setStripeConfigured(false);
        setStripeKeyInput('');
        setStripeTestResult(null);
      }
    } catch (err) {
      console.error("Error removing Stripe key:", err);
    }
  };

  const handleSaveGcalDirect = async () => {
    if (!gcalKeyInput || gcalKeyInput === '••••••••••••••••') return;
    setSavingGcalKey(true);
    setGcalTestResult(null);
    try {
      const res = await fetch('/api/demo/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'google_calendar', key: gcalKeyInput }),
      });
      if (res.ok) {
        setGcalConfigured(true);
        setGcalKeyInput('••••••••••••••••');
        setGcalTestResult({ success: true, message: 'Chiave Google Calendar salvata e cifrata (AES-256) con successo!' });
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Errore durante il salvataggio');
      }
    } catch (err: any) {
      setGcalTestResult({ success: false, message: err.message || 'Errore salvataggio' });
    } finally {
      setSavingGcalKey(false);
    }
  };

  const testGcalKey = async () => {
    setTestingGcal(true);
    setGcalTestResult(null);
    try {
      const res = await fetch('/api/demo/calendar');
      const data = await res.json();
      if (res.ok) {
        setGcalTestResult({ success: true, message: `Connessione Google Calendar verificata! (${data.count} eventi recuperati)` });
      } else {
        setGcalTestResult({ success: false, message: data.error || 'Impossibile connettersi a Google Calendar API' });
      }
    } catch (err: any) {
      setGcalTestResult({ success: false, message: err.message || 'Errore test connessione Google Calendar' });
    } finally {
      setTestingGcal(false);
    }
  };

  const removeGcalKey = async () => {
    try {
      const res = await fetch('/api/demo/keys?name=google_calendar', { method: 'DELETE' });
      if (res.ok) {
        setGcalConfigured(false);
        setGcalKeyInput('');
        setGcalTestResult(null);
      }
    } catch (err) {
      console.error("Error removing Google Calendar key:", err);
    }
  };

  const currentModel = models.find(m => m.id === settings.defaultModel);

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-display">{t("settings.title", "Settings")}</h1>
        <p className="text-body mt-1">
          {t("settings.subtitle", "Configure LLM models, language preferences, and global platform options.")}
        </p>
      </div>

      {/* ── Platform Language Settings Card ── */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8EAED', boxShadow: '0 1px 2px rgba(60,64,67,0.10)' }}>
        <div className="px-5 py-3.5 flex items-center gap-3" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#E8F0FE' }}>
            <span className="text-base">🌐</span>
          </div>
          <div>
            <h2 className="font-semibold text-sm" style={{ color: '#202124' }}>
              {t("settings.languageSection", "Platform Language")}
            </h2>
            <p className="text-xs" style={{ color: '#5F6368' }}>
              {t("settings.languageSubtitle", "Choose your primary language for the user interface and AI agents")}
            </p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#5F6368' }}>
              {t("settings.selectLanguage", "Select Language")}
            </label>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                  language === "en"
                    ? "border-[#1A73E8] bg-[#E8F0FE] text-[#1A73E8] font-semibold shadow-xs"
                    : "border-[#DADCE0] bg-white text-[#202124] hover:bg-[#F8F9FA]"
                }`}
              >
                <span className="text-xl">🇬🇧</span>
                <div>
                  <div className="text-sm font-semibold">English</div>
                  <div className="text-[10px] opacity-75">Default Language</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setLanguage("it")}
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                  language === "it"
                    ? "border-[#1A73E8] bg-[#E8F0FE] text-[#1A73E8] font-semibold shadow-xs"
                    : "border-[#DADCE0] bg-white text-[#202124] hover:bg-[#F8F9FA]"
                }`}
              >
                <span className="text-xl">🇮🇹</span>
                <div>
                  <div className="text-sm font-semibold">Italiano</div>
                  <div className="text-[10px] opacity-75">Lingua Italiana</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── LLM Model Card ── */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8EAED', boxShadow: '0 1px 2px rgba(60,64,67,0.10)' }}>
        <div className="px-5 py-3.5 flex items-center gap-3" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#E8F0FE' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" style={{ color: '#1A73E8' }}>
              <path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3z"/>
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-sm" style={{ color: '#202124' }}>{t("settings.llmSection", "LLM Model")}</h2>
            <p className="text-xs" style={{ color: '#5F6368' }}>{t("settings.llmSubtitle", "Default model used by all employee agents")}</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#5F6368' }}>{t("settings.defaultModel", "Default Model")}</label>
            <select
              value={settings.defaultModel}
              onChange={e => setSettings(prev => ({ ...prev, defaultModel: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
              style={{ background: '#F8F9FA', border: '1px solid #DADCE0', color: '#202124' }}
            >
              {/* Free built-in models */}
              {models.filter(m => m.free && !m.provider).length > 0 && (
                <optgroup label={t("settings.freeModels", "Free Models")}>
                  {models.filter(m => m.free && !m.provider).map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.description} ({(m.contextLength / 1000).toFixed(0)}K ctx)
                    </option>
                  ))}
                </optgroup>
              )}

              {/* Paid built-in models */}
              {models.filter(m => !m.free && !m.provider).length > 0 && (
                <optgroup label={t("settings.paidModels", "Paid Models")}>
                  {models.filter(m => !m.free && !m.provider).map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.description} ({(m.contextLength / 1000).toFixed(0)}K ctx)
                    </option>
                  ))}
                </optgroup>
              )}

              {/* Custom user-added models */}
              {models.filter(m => !!m.provider).length > 0 && (
                <optgroup label={t("settings.customModels", "Custom Models")}>
                  {models.filter(m => !!m.provider).map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.provider?.toUpperCase()} ({(m.contextLength / 1000).toFixed(0)}K ctx)
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {currentModel && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl" style={{ background: '#F8F9FA', border: '1px solid #E8EAED' }}>
              <div className="flex-1">
                <p className="text-xs font-medium mb-0.5" style={{ color: '#9AA0AC' }}>{t("settings.selectedModel", "Selected Model")}</p>
                <p className="font-semibold text-sm" style={{ color: '#202124' }}>{currentModel.name}</p>
                <p className="text-xs mt-0.5" style={{ color: '#5F6368' }}>{currentModel.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`chip ${currentModel.free ? 'chip-green' : 'chip-yellow'}`}>
                  {currentModel.free ? t("settings.free", "Free") : t("settings.paid", "Paid")}
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
                {editingModelId ? t("settings.editCustomModel", "Edit Custom Model") : t("settings.customModels", "Custom Models")}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (showAddCustom) {
                    setShowAddCustom(false);
                    setEditingModelId(null);
                    setNewModelId('');
                    setNewModelName('');
                  } else {
                    setShowAddCustom(true);
                  }
                }}
                className="text-xs font-semibold text-[#1A73E8] hover:underline"
              >
                {showAddCustom ? t("common.cancel", "Cancel") : t("settings.addCustomModel", "+ Add Custom Model")}
              </button>
            </div>

            {showAddCustom && (
              <div className="p-4 rounded-xl space-y-3 bg-[#F8F9FA] border border-[#DADCE0] animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#5F6368' }}>{t("settings.providerLabel", "Provider / API Type")}</label>
                    <select
                      value={newModelProvider}
                      onChange={e => {
                        const prov = e.target.value as any;
                        setNewModelProvider(prov);
                        if (prov === 'ollama') setNewModelBaseUrl('http://localhost:11434/v1');
                        else if (prov === 'openai') setNewModelBaseUrl('https://api.openai.com/v1');
                        else if (prov === 'openrouter') setNewModelBaseUrl('https://openrouter.ai/api/v1');
                        else setNewModelBaseUrl('');
                      }}
                      className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                      style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }}
                    >
                      <option value="openrouter">OpenRouter (Default Router)</option>
                      <option value="openai">OpenAI Direct</option>
                      <option value="ollama">Ollama / Local LLM (localhost)</option>
                      <option value="custom">Custom OpenAI-Compatible Endpoint</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#5F6368' }}>{t("settings.modelIdLabel", "Model Identifier (ID)")}</label>
                    <input
                      type="text"
                      value={newModelId}
                      onChange={e => setNewModelId(e.target.value)}
                      disabled={!!editingModelId}
                      placeholder={t("settings.modelIdPlaceholder", "e.g. anthropic/claude-3-5-sonnet")}
                      className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none font-mono disabled:opacity-60"
                      style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#5F6368' }}>{t("settings.modelNameLabel", "Display Name")}</label>
                    <input
                      type="text"
                      value={newModelName}
                      onChange={e => setNewModelName(e.target.value)}
                      placeholder={t("settings.modelNamePlaceholder", "e.g. Claude 3.5 Sonnet (Custom)")}
                      className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                      style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#5F6368' }}>{t("settings.contextLengthLabel", "Context Window (Tokens)")}</label>
                    <input
                      type="number"
                      value={newModelContext}
                      onChange={e => setNewModelContext(Number(e.target.value))}
                      placeholder="128000"
                      className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none font-mono"
                      style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }}
                    />
                  </div>
                </div>

                {(newModelProvider === 'custom' || newModelProvider === 'ollama') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: '#5F6368' }}>{t("settings.baseUrlLabel", "Custom Base URL (Optional)")}</label>
                      <input
                        type="text"
                        value={newModelBaseUrl}
                        onChange={e => setNewModelBaseUrl(e.target.value)}
                        placeholder={t("settings.baseUrlPlaceholder", "http://localhost:11434/v1")}
                        className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none font-mono"
                        style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: '#5F6368' }}>{t("settings.modelApiKeyLabel", "Custom API Key (Optional)")}</label>
                      <input
                        type="password"
                        value={newModelApiKey}
                        onChange={e => setNewModelApiKey(e.target.value)}
                        placeholder={t("settings.modelApiKeyPlaceholder", "Leave blank to use default")}
                        className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none font-mono"
                        style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#202124' }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={newModelFree}
                      onChange={e => setNewModelFree(e.target.checked)}
                      className="rounded text-[#1A73E8]"
                    />
                    <span style={{ color: '#202124' }}>Free Model</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={testCustomModelConnection}
                      disabled={testingModel || !newModelId}
                      className="px-3 py-1.5 rounded-lg bg-[#E8F0FE] text-[#1A73E8] text-xs font-semibold hover:bg-[#D2E3FC] disabled:opacity-50 transition-all"
                    >
                      {testingModel ? t("settings.testingConnection", "Testing...") : t("settings.testModelBtn", "Test Model Connection")}
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCustomModel}
                      disabled={!newModelId || !newModelName}
                      className="px-4 py-1.5 rounded-lg bg-[#1A73E8] text-white text-xs font-medium hover:bg-[#1557B0] disabled:opacity-50 transition-all"
                    >
                      {editingModelId ? t("settings.saveChanges", "Save Changes") : t("settings.saveModelBtn", "Save & Add Model")}
                    </button>
                  </div>
                </div>

                {modelTestResult && (
                  <div className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 ${modelTestResult.success ? 'bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]' : 'bg-[#FCE8E6] text-[#C5221F] border border-[#FAD2CF]'}`}>
                    <span>{modelTestResult.success ? '✓' : '⚠️'}</span>
                    <span>{modelTestResult.message}</span>
                  </div>
                )}
              </div>
            )}

            {models.filter(m => !AVAILABLE_MODELS.some(am => am.id === m.id)).length > 0 && (
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {models.filter(m => !AVAILABLE_MODELS.some(am => am.id === m.id)).map(m => (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded-lg text-xs animate-fade-in" style={{ background: '#F8F9FA', border: '1px solid #E8EAED' }}>
                    <div className="truncate flex-1 min-w-0 mr-2">
                      <span className="font-semibold block truncate" style={{ color: '#202124' }}>{m.name}</span>
                      <span className="text-[10px] block truncate" style={{ color: '#5F6368' }}>
                        {m.id} {m.provider ? `(${m.provider.toUpperCase()})` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditCustomModel(m)}
                        className="text-[10px] font-semibold text-[#1A73E8] hover:underline px-2 py-1 rounded"
                      >
                        {t("settings.editModel", "Edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomModel(m.id)}
                        className="text-[10px] font-semibold text-[#EA4335] hover:underline px-2 py-1 rounded"
                      >
                        {t("common.remove", "Remove")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── CoFounder Assistant Card ── */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8EAED', boxShadow: '0 1px 2px rgba(60,64,67,0.10)' }}>
        <div className="px-5 py-3.5 flex items-center gap-3" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#FCE8E6' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" style={{ color: '#EA4335' }}>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-sm" style={{ color: '#202124' }}>{t("settings.cofounderAssistant", "CoFounder Assistant")}</h2>
            <p className="text-xs" style={{ color: '#5F6368' }}>{t("settings.cofounderSubtitle", "Configure the name of the main intelligent co-founder assistant")}</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#5F6368' }}>{t("settings.assistantName", "Assistant Name")}</label>
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

      {/* ── Web Search Card (Tavily) ── */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E8EAED', boxShadow: '0 1px 2px rgba(60,64,67,0.10)' }}>
        <div className="px-5 py-3.5 flex items-center justify-between" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#E6F4EA' }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" style={{ color: '#137333' }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-sm" style={{ color: '#202124' }}>{t("settings.webSearch", "Web Search (Tavily)")}</h2>
              <p className="text-xs" style={{ color: '#5F6368' }}>{t("settings.webSearchSubtitle", "Configure Tavily Search for reliable real-time web research capabilities")}</p>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${tavilyConfigured ? 'bg-[#E6F4EA] text-[#137333]' : 'bg-[#F1F3F4] text-[#5F6368]'}`}>
            <span className={`w-2 h-2 rounded-full ${tavilyConfigured ? 'bg-[#34A853]' : 'bg-[#9AA0A6]'}`}></span>
            {tavilyConfigured ? 'Chiave Salvata (AES-256)' : 'Non configurata'}
          </span>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-xl" style={{ background: '#F8F9FA', border: '1px solid #E8EAED' }}>
            <div>
              <label className="block text-xs font-semibold" style={{ color: '#202124' }}>{t("settings.enableTavily", "Enable Tavily Search")}</label>
              <p className="text-[11px] text-[#5F6368] mt-0.5">
                Abilita le ricerche web avanzate in tempo reale per tutti gli agenti AI.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSettings(prev => ({ ...prev, useTavily: !prev.useTavily }))}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${settings.useTavily ? 'bg-[#1A73E8]' : 'bg-[#DADCE0]'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.useTavily ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold" style={{ color: '#202124' }}>{t("settings.tavilyApiKey", "Tavily API Key")}</label>
              <a
                href="https://tavily.com"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#1A73E8] hover:underline font-medium flex items-center gap-1"
              >
                <span>Ottieni chiave API gratis</span>
                <span>↗</span>
              </a>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type={showTavilyPassword ? 'text' : 'password'}
                  value={tavilyKeyInput}
                  onChange={e => setTavilyKeyInput(e.target.value)}
                  placeholder={t("settings.tavilyPlaceholder", "Inserisci tvly-xxx...")}
                  className="w-full px-3 py-2.5 pr-9 rounded-lg text-xs focus:outline-none font-mono"
                  style={{ background: '#F8F9FA', border: '1px solid #DADCE0', color: '#202124' }}
                />
                <button
                  type="button"
                  onClick={() => setShowTavilyPassword(!showTavilyPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#5F6368] hover:text-[#202124]"
                  title={showTavilyPassword ? 'Nascondi la chiave' : 'Mostra la chiave'}
                >
                  {showTavilyPassword ? '🙈' : '👁️'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveTavilyDirect}
                  disabled={savingKey || !tavilyKeyInput || tavilyKeyInput === '••••••••••••••••'}
                  className="px-4 py-2 text-xs rounded-lg bg-[#1A73E8] text-white hover:bg-[#1557B0] transition-all font-semibold shadow-xs disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span>💾</span>
                  <span>{savingKey ? 'Salvataggio...' : 'Salva Chiave'}</span>
                </button>

                <button
                  type="button"
                  onClick={testTavilyKey}
                  disabled={testingTavily || (!tavilyConfigured && !tavilyKeyInput)}
                  className="px-3.5 py-2 text-xs rounded-lg bg-[#E8F0FE] text-[#1A73E8] hover:bg-[#D2E3FC] transition-colors font-medium border border-blue-200 disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
                >
                  <span>⚡</span>
                  <span>{testingTavily ? t("settings.testingConnection", "Testing...") : t("settings.testConnection", "Test Connessione")}</span>
                </button>

                {tavilyConfigured && (
                  <button
                    type="button"
                    onClick={removeTavilyKey}
                    className="px-3 py-2 text-xs rounded-lg text-[#D93025] hover:bg-red-50 border border-red-200 transition-colors font-medium whitespace-nowrap"
                    title="Rimuovi la chiave salvata"
                  >
                    Rimuovi
                  </button>
                )}
              </div>
            </div>

            {tavilyTestResult && (
              <div className={`mt-3 p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${tavilyTestResult.success ? 'bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]' : 'bg-[#FCE8E6] text-[#C5221F] border border-[#FAD2CF]'}`}>
                <span>{tavilyTestResult.success ? '✓' : '⚠️'}</span>
                <span>{tavilyTestResult.message}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Stripe Integration Card (Revenue & Billing Metrics) ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: `1px solid ${stripeConfigured ? '#CEEAD6' : '#E8EAED'}`, boxShadow: '0 1px 3px rgba(60,64,67,0.08)' }}>
        {/* Card Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ background: stripeConfigured ? '#F6FEF8' : '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: stripeConfigured ? '#CEEAD6' : '#E8EAED' }}>
              💳
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm" style={{ color: '#202124' }}>Stripe Revenue Connector</h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${stripeConfigured ? 'bg-[#34A853] text-white' : 'bg-[#9AA0A6] text-white'}`}>
                  {stripeConfigured ? '● Connesso' : '○ Non connesso'}
                </span>
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: '#5F6368' }}>
                Collega Stripe per calcolare automaticamente MRR, ARR, Churn Rate, LTV, ARPU e Clienti Attivi.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">

          {/* ── Step 1: Guida Permessi ── */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAED' }}>
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
              <span className="w-5 h-5 rounded-full bg-[#1A73E8] text-white text-[10px] font-bold flex items-center justify-center">1</span>
              <span className="text-xs font-bold" style={{ color: '#202124' }}>Crea una Restricted API Key su Stripe</span>
            </div>
            <div className="px-4 py-3 space-y-3">
              <p className="text-[11px]" style={{ color: '#5F6368' }}>
                Vai nella <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" className="text-[#1A73E8] hover:underline font-semibold">Stripe Dashboard → API Keys ↗</a> e crea una <strong className="text-[#202124]">Restricted Key</strong> con questi permessi di sola lettura:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { scope: 'Subscriptions', desc: 'Per calcolare MRR e ARR', icon: '🔄' },
                  { scope: 'Customers', desc: 'Per contare clienti attivi e nuovi', icon: '👥' },
                  { scope: 'Charges', desc: 'Per il revenue mensile effettivo', icon: '💰' },
                ].map((perm, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg flex items-start gap-2" style={{ background: '#F8F9FA', border: '1px solid #E8EAED' }}>
                    <span className="text-sm flex-shrink-0 mt-0.5">{perm.icon}</span>
                    <div>
                      <p className="text-[11px] font-bold" style={{ color: '#202124' }}>
                        <span className="font-mono text-[#1A73E8]">{perm.scope}</span>
                        <span className="ml-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#E6F4EA] text-[#137333]">READ</span>
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: '#9AA0A6' }}>{perm.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Step 2: Input Chiave ── */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAED' }}>
            <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#1A73E8] text-white text-[10px] font-bold flex items-center justify-center">2</span>
                <span className="text-xs font-bold" style={{ color: '#202124' }}>Inserisci la tua API Key</span>
              </div>
              {stripeConfigured && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-[#137333]">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg>
                  AES-256-GCM Encrypted
                </span>
              )}
            </div>
            <div className="px-4 py-3 space-y-3">
              <div className="relative">
                <input
                  type={showStripePassword ? 'text' : 'password'}
                  value={stripeKeyInput}
                  onChange={e => setStripeKeyInput(e.target.value)}
                  placeholder="rk_live_xxxxxxxxxxxxxxxx  oppure  rk_test_xxxxxxxxxxxxxxxx"
                  className="w-full px-3.5 py-3 pr-10 rounded-lg text-xs focus:outline-none font-mono transition-all"
                  style={{
                    background: stripeConfigured ? '#F6FEF8' : '#F8F9FA',
                    border: `1.5px solid ${stripeConfigured ? '#CEEAD6' : '#DADCE0'}`,
                    color: '#202124'
                  }}
                  onFocus={e => { e.target.style.borderColor = '#1A73E8'; e.target.style.boxShadow = '0 0 0 3px rgba(26,115,232,0.12)'; }}
                  onBlur={e => { e.target.style.borderColor = stripeConfigured ? '#CEEAD6' : '#DADCE0'; e.target.style.boxShadow = 'none'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowStripePassword(!showStripePassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#5F6368] hover:text-[#202124] transition"
                  title={showStripePassword ? 'Nascondi' : 'Mostra'}
                >
                  {showStripePassword ? '🙈' : '👁️'}
                </button>
              </div>

              {/* Hint sotto l'input */}
              <p className="text-[10px] flex items-center gap-1" style={{ color: '#9AA0A6' }}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 flex-shrink-0"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                La chiave viene cifrata localmente con AES-256-GCM e non lascia mai il tuo server. Formato accettato: <code className="font-mono text-[#1A73E8]">rk_live_*</code>, <code className="font-mono text-[#1A73E8]">rk_test_*</code>, <code className="font-mono text-[#1A73E8]">sk_live_*</code>, <code className="font-mono text-[#1A73E8]">sk_test_*</code>
              </p>
            </div>
          </div>

          {/* ── Step 3: Azioni ── */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAED' }}>
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
              <span className="w-5 h-5 rounded-full bg-[#1A73E8] text-white text-[10px] font-bold flex items-center justify-center">3</span>
              <span className="text-xs font-bold" style={{ color: '#202124' }}>Salva e Verifica</span>
            </div>
            <div className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Salva */}
                <button
                  type="button"
                  onClick={handleSaveStripeDirect}
                  disabled={savingStripeKey || !stripeKeyInput || stripeKeyInput === '••••••••••••••••'}
                  className="px-5 py-2.5 text-xs rounded-lg bg-[#1A73E8] text-white hover:bg-[#1557B0] transition-all font-bold shadow-sm disabled:opacity-40 flex items-center gap-2 whitespace-nowrap"
                >
                  {savingStripeKey ? (
                    <>
                      <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" /></svg>
                      <span>Salvataggio...</span>
                    </>
                  ) : (
                    <>
                      <span>💾</span>
                      <span>Salva Chiave</span>
                    </>
                  )}
                </button>

                {/* Test Connessione */}
                <button
                  type="button"
                  onClick={testStripeKey}
                  disabled={testingStripe || (!stripeConfigured && !stripeKeyInput)}
                  className="px-4 py-2.5 text-xs rounded-lg transition-all font-semibold disabled:opacity-40 flex items-center gap-2 whitespace-nowrap"
                  style={{ background: '#E8F0FE', color: '#1A73E8', border: '1px solid #C5D9F9' }}
                >
                  {testingStripe ? (
                    <>
                      <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" /></svg>
                      <span>Verifica in corso...</span>
                    </>
                  ) : (
                    <>
                      <span>⚡</span>
                      <span>Test Connessione</span>
                    </>
                  )}
                </button>

                {/* Rimuovi */}
                {stripeConfigured && (
                  <button
                    type="button"
                    onClick={removeStripeKey}
                    className="px-4 py-2.5 text-xs rounded-lg transition-all font-semibold flex items-center gap-1.5 whitespace-nowrap hover:bg-red-50"
                    style={{ color: '#D93025', border: '1px solid #FAD2CF' }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    <span>Rimuovi Chiave</span>
                  </button>
                )}
              </div>

              {/* Test Result */}
              {stripeTestResult && (
                <div className={`mt-3 p-3.5 rounded-xl text-xs font-medium flex items-start gap-2.5 ${stripeTestResult.success ? 'bg-[#E6F4EA] border border-[#CEEAD6]' : 'bg-[#FCE8E6] border border-[#FAD2CF]'}`}>
                  <span className="text-sm flex-shrink-0 mt-px">{stripeTestResult.success ? '✅' : '❌'}</span>
                  <div>
                    <p className={`font-bold ${stripeTestResult.success ? 'text-[#137333]' : 'text-[#C5221F]'}`}>
                      {stripeTestResult.success ? 'Connessione Stripe verificata!' : 'Connessione fallita'}
                    </p>
                    <p className={`mt-0.5 text-[11px] ${stripeTestResult.success ? 'text-[#137333]/80' : 'text-[#C5221F]/80'}`}>
                      {stripeTestResult.message}
                    </p>
                    {stripeTestResult.success && (
                      <p className="mt-1.5 text-[10px] text-[#5F6368]">
                        Vai in <a href="/dashboard/metrics" className="text-[#1A73E8] font-semibold hover:underline">Analytics & Metriche</a> e premi <strong>"🔄 Sincronizza Ora"</strong> per estrarre le KPI dal tuo account.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Google Calendar Integration Card ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: `1px solid ${gcalConfigured ? '#CEEAD6' : '#E8EAED'}`, boxShadow: '0 1px 3px rgba(60,64,67,0.08)' }}>
        {/* Card Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ background: gcalConfigured ? '#F6FEF8' : '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: gcalConfigured ? '#CEEAD6' : '#E8EAED' }}>
              📅
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm" style={{ color: '#202124' }}>Google Calendar Integration</h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${gcalConfigured ? 'bg-[#34A853] text-white' : 'bg-[#9AA0A6] text-white'}`}>
                  {gcalConfigured ? '● Connesso' : '○ Modalità Sandbox / Non connesso'}
                </span>
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: '#5F6368' }}>
                Sincronizza le riunioni del team, gli standup e gli incontri con investitori direttamente su Google Calendar.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Step 1: Guida */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAED' }}>
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
              <span className="w-5 h-5 rounded-full bg-[#1A73E8] text-white text-[10px] font-bold flex items-center justify-center">1</span>
              <span className="text-xs font-bold" style={{ color: '#202124' }}>Configurazione Google Cloud Console</span>
            </div>
            <div className="px-4 py-3 space-y-2 text-[11px]" style={{ color: '#5F6368' }}>
              <p>
                Crea una credenziale API su <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-[#1A73E8] font-semibold hover:underline">Google Cloud Console ↗</a> abilitando l'API <strong className="text-[#202124]">Google Calendar API</strong>.
              </p>
              <p>
                Supporta <strong>OAuth 2.0 Access Token</strong> o <strong>Service Account Key JSON</strong>.
              </p>
            </div>
          </div>

          {/* Step 2: Input */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAED' }}>
            <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#1A73E8] text-white text-[10px] font-bold flex items-center justify-center">2</span>
                <span className="text-xs font-bold" style={{ color: '#202124' }}>Inserisci il Token API / OAuth Key</span>
              </div>
              {gcalConfigured && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-[#137333]">
                  🔒 AES-256 Encrypted
                </span>
              )}
            </div>
            <div className="px-4 py-3 space-y-3">
              <div className="relative">
                <input
                  type={showGcalPassword ? 'text' : 'password'}
                  value={gcalKeyInput}
                  onChange={e => setGcalKeyInput(e.target.value)}
                  placeholder="ya29.a0Axxxxxxxxxxxxxxxx  oppure  Service Account Private Key"
                  className="w-full px-3.5 py-3 pr-10 rounded-lg text-xs focus:outline-none font-mono transition-all"
                  style={{
                    background: gcalConfigured ? '#F6FEF8' : '#F8F9FA',
                    border: `1.5px solid ${gcalConfigured ? '#CEEAD6' : '#DADCE0'}`,
                    color: '#202124'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowGcalPassword(!showGcalPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#5F6368] hover:text-[#202124]"
                  title={showGcalPassword ? 'Nascondi' : 'Mostra'}
                >
                  {showGcalPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          </div>

          {/* Step 3: Azioni */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAED' }}>
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
              <span className="w-5 h-5 rounded-full bg-[#1A73E8] text-white text-[10px] font-bold flex items-center justify-center">3</span>
              <span className="text-xs font-bold" style={{ color: '#202124' }}>Salva e Verifica</span>
            </div>
            <div className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveGcalDirect}
                  disabled={savingGcalKey || !gcalKeyInput || gcalKeyInput === '••••••••••••••••'}
                  className="px-5 py-2.5 text-xs rounded-lg bg-[#1A73E8] text-white hover:bg-[#1557B0] transition-all font-bold shadow-sm disabled:opacity-40 flex items-center gap-2 whitespace-nowrap"
                >
                  {savingGcalKey ? 'Salvataggio...' : '💾 Salva Chiave'}
                </button>

                <button
                  type="button"
                  onClick={testGcalKey}
                  disabled={testingGcal}
                  className="px-4 py-2.5 text-xs rounded-lg transition-all font-semibold flex items-center gap-2 whitespace-nowrap"
                  style={{ background: '#E8F0FE', color: '#1A73E8', border: '1px solid #C5D9F9' }}
                >
                  {testingGcal ? 'Verifica...' : '⚡ Test Connessione'}
                </button>

                {gcalConfigured && (
                  <button
                    type="button"
                    onClick={removeGcalKey}
                    className="px-4 py-2.5 text-xs rounded-lg transition-all font-semibold hover:bg-red-50"
                    style={{ color: '#D93025', border: '1px solid #FAD2CF' }}
                  >
                    Rimuovi Chiave
                  </button>
                )}
              </div>

              {gcalTestResult && (
                <div className={`mt-3 p-3.5 rounded-xl text-xs font-medium flex items-start gap-2.5 ${gcalTestResult.success ? 'bg-[#E6F4EA] border border-[#CEEAD6]' : 'bg-[#FCE8E6] border border-[#FAD2CF]'}`}>
                  <span className="text-sm flex-shrink-0">{gcalTestResult.success ? '✅' : '❌'}</span>
                  <div>
                    <p className={`font-bold ${gcalTestResult.success ? 'text-[#137333]' : 'text-[#C5221F]'}`}>
                      {gcalTestResult.message}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {saved && (
          <span className="text-xs font-semibold text-[#137333] animate-fade-in">
            {t("common.saved", "Settings Saved!")}
          </span>
        )}
        <button
          type="button"
          onClick={saveSettings}
          disabled={savingKey}
          className="px-5 py-2.5 rounded-xl font-medium text-sm text-white shadow-xs transition-all hover:shadow-md disabled:opacity-50"
          style={{ background: '#1A73E8' }}
        >
          {savingKey ? t("common.saving", "Saving...") : t("common.save", "Save Settings")}
        </button>
      </div>
    </div>
  );
}

