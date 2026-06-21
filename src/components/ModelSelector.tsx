'use client';

import { useState, useEffect } from 'react';
import { AVAILABLE_MODELS, type ModelInfo } from '@/lib/models';

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}

export default function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);

  useEffect(() => {
    fetch('/api/demo/chat')
      .then(res => res.json())
      .then(data => { if (data.models) setModels(data.models); else setModels(AVAILABLE_MODELS); })
      .catch(() => setModels(AVAILABLE_MODELS));
  }, []);

  const currentModel = models.find(m => m.id === selectedModel) || models[0];
  const freeModels = models.filter(m => m.free);
  const paidModels = models.filter(m => !m.free);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        style={{ background: '#F8F9FA', border: '1px solid #E8EAED', color: '#5F6368' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#F1F3F4')}
        onMouseLeave={e => (e.currentTarget.style.background = '#F8F9FA')}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: currentModel?.free ? '#34A853' : '#F9AB00' }} />
        <span className="truncate max-w-[150px]" style={{ fontSize: '0.75rem' }}>
          {currentModel?.name || 'Seleziona modello'}
        </span>
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#9AA0AC' }}>
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute top-full right-0 mt-1.5 w-72 rounded-xl overflow-hidden z-50"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E8EAED',
            boxShadow: '0 4px 16px rgba(60,64,67,0.20)',
            maxHeight: '360px',
            overflowY: 'auto',
          }}
        >
          {/* Free Models */}
          <div className="p-1.5">
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#34A853' }}>
              Gratuiti
            </div>
            {freeModels.map(model => (
              <button
                key={model.id}
                onClick={() => { onModelChange(model.id); setIsOpen(false); }}
                className="w-full text-left px-3 py-2.5 rounded-lg transition-colors"
                style={{
                  background: selectedModel === model.id ? '#E8F0FE' : 'transparent',
                  color: selectedModel === model.id ? '#1A73E8' : '#202124',
                }}
                onMouseEnter={e => { if (selectedModel !== model.id) e.currentTarget.style.background = '#F8F9FA'; }}
                onMouseLeave={e => { if (selectedModel !== model.id) e.currentTarget.style.background = 'transparent'; }}
              >
                <div className="font-medium text-sm">{model.name}</div>
                <div className="text-xs mt-0.5" style={{ color: '#9AA0AC' }}>{model.description}</div>
                <div className="flex gap-1.5 mt-1.5">
                  <span className="chip chip-green" style={{ fontSize: '0.6rem' }}>Gratuito</span>
                  <span className="chip chip-gray" style={{ fontSize: '0.6rem' }}>{(model.contextLength / 1000).toFixed(0)}K ctx</span>
                  {model.quality && <span className="chip chip-blue" style={{ fontSize: '0.6rem' }}>{model.quality}</span>}
                </div>
              </button>
            ))}
          </div>

          {paidModels.length > 0 && (
            <div className="p-1.5" style={{ borderTop: '1px solid #F1F3F4' }}>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#F9AB00' }}>
                A pagamento
              </div>
              {paidModels.map(model => (
                <button
                  key={model.id}
                  onClick={() => { onModelChange(model.id); setIsOpen(false); }}
                  className="w-full text-left px-3 py-2.5 rounded-lg transition-colors"
                  style={{
                    background: selectedModel === model.id ? '#E8F0FE' : 'transparent',
                    color: selectedModel === model.id ? '#1A73E8' : '#202124',
                  }}
                  onMouseEnter={e => { if (selectedModel !== model.id) e.currentTarget.style.background = '#F8F9FA'; }}
                  onMouseLeave={e => { if (selectedModel !== model.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div className="font-medium text-sm">{model.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#9AA0AC' }}>{model.description}</div>
                  <div className="flex gap-1.5 mt-1.5">
                    <span className="chip chip-yellow" style={{ fontSize: '0.6rem' }}>A pagamento</span>
                    <span className="chip chip-gray" style={{ fontSize: '0.6rem' }}>{(model.contextLength / 1000).toFixed(0)}K ctx</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
    </div>
  );
}
