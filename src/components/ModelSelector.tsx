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
    // Fetch models from API
    fetch('/api/demo/chat')
      .then(res => res.json())
      .then(data => {
        if (data.models) setModels(data.models);
        else setModels(AVAILABLE_MODELS);
      })
      .catch(() => setModels(AVAILABLE_MODELS));
  }, []);

  const currentModel = models.find(m => m.id === selectedModel) || models[0];
  const freeModels = models.filter(m => m.free);
  const paidModels = models.filter(m => !m.free);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-700 transition-colors"
      >
        <span className={`w-2 h-2 rounded-full ${currentModel?.free ? 'bg-green-500' : 'bg-yellow-500'}`} />
        <span className="truncate max-w-[180px]">{currentModel?.name || 'Select Model'}</span>
        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          {/* Free Models */}
          <div className="p-2">
            <div className="px-2 py-1 text-xs font-semibold text-green-400 uppercase tracking-wider">
              🆓 Free Models
            </div>
            {freeModels.map(model => (
              <button
                key={model.id}
                onClick={() => {
                  onModelChange(model.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedModel === model.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <div className="font-medium">{model.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{model.description}</div>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs px-1.5 py-0.5 bg-green-900 text-green-300 rounded">FREE</span>
                  <span className="text-xs px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded">
                    {(model.contextLength / 1000).toFixed(0)}K ctx
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    model.quality === 'excellent' ? 'bg-purple-900 text-purple-300' :
                    model.quality === 'good' ? 'bg-blue-900 text-blue-300' :
                    'bg-gray-800 text-gray-400'
                  }`}>
                    {model.quality}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Paid Models */}
          {paidModels.length > 0 && (
            <div className="p-2 border-t border-gray-800">
              <div className="px-2 py-1 text-xs font-semibold text-yellow-400 uppercase tracking-wider">
                💰 Paid Models
              </div>
              {paidModels.map(model => (
                <button
                  key={model.id}
                  onClick={() => {
                    onModelChange(model.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedModel === model.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <div className="font-medium">{model.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{model.description}</div>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs px-1.5 py-0.5 bg-yellow-900 text-yellow-300 rounded">PAID</span>
                    <span className="text-xs px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded">
                      {(model.contextLength / 1000).toFixed(0)}K ctx
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}
