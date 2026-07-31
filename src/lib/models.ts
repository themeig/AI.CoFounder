// OpenRouter models configuration

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  contextLength: number;
  free: boolean;
  speed: 'fast' | 'medium' | 'slow';
  quality: 'basic' | 'good' | 'excellent';
  provider?: 'openrouter' | 'openai' | 'ollama' | 'custom';
  baseUrl?: string;
  apiKey?: string;
}

export const AVAILABLE_MODELS: ModelInfo[] = [
  // === FREE MODELS ===
  {
    id: 'openrouter/free',
    name: 'Auto Free',
    description: 'OpenRouter automatically selects the best available free model',
    contextLength: 200000,
    free: true,
    speed: 'medium',
    quality: 'good',
  },
  // === PAID / HIGH PERFORMANCE MODELS ===
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    description: 'State-of-the-art open reasoning model',
    contextLength: 64000,
    free: false,
    speed: 'medium',
    quality: 'excellent',
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3',
    description: 'Fast, high performance general-purpose model',
    contextLength: 64000,
    free: false,
    speed: 'fast',
    quality: 'excellent',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    description: 'Meta Flagship open model for complex logic and coding',
    contextLength: 128000,
    free: false,
    speed: 'fast',
    quality: 'excellent',
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Fast and versatile OpenAI model',
    contextLength: 128000,
    free: false,
    speed: 'fast',
    quality: 'good',
  },
  {
    id: 'anthropic/claude-3.5-haiku',
    name: 'Claude 3.5 Haiku',
    description: 'Anthropic fast and intelligent model',
    contextLength: 200000,
    free: false,
    speed: 'fast',
    quality: 'excellent',
  },
];

export const DEFAULT_MODEL = 'openrouter/free';

export function getModelInfo(id: string): ModelInfo | undefined {
  if (typeof window !== 'undefined') {
    const all = getClientModels();
    return all.find(m => m.id === id);
  }
  return AVAILABLE_MODELS.find(m => m.id === id);
}

export function getClientModels(): ModelInfo[] {
  if (typeof window === 'undefined') return AVAILABLE_MODELS;
  try {
    const custom = window.localStorage.getItem('agentfoundry_custom_models');
    if (custom) {
      const parsed = JSON.parse(custom);
      if (Array.isArray(parsed)) {
        return [...AVAILABLE_MODELS, ...parsed];
      }
    }
  } catch {}
  return AVAILABLE_MODELS;
}

// ============================================================
// Agent Settings — configurazione memoria e comportamento
// ============================================================
export interface AgentSettings {
  // Quanti messaggi di cronologia includere nel prompt (0-50)
  // 0 = nessuna cronologia, solo system prompt
  // 5-10 = contesto breve, risposte più veloce
  // 20-30 = bilanciato
  // 40+ = contesto completo, più lento
  contextMessages: number;

  // Temperatura del LLM (0.0-2.0)
  // 0.0-0.3 = preciso, focalizzato, ripetitivo
  // 0.5-0.8 = bilanciato (default 0.7)
  // 1.0-2.0 = creativo, imprevedibile
  temperature: number;

  // Usa memoria a lungo termine (Mnemosyne)
  useMemory: boolean;

  // Usa Pattern/Playbook dal knowledge base
  useKnowledgeBase: boolean;

  // Lingua di risposta
  language: 'it' | 'en' | 'auto';
}

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  contextMessages: 20,
  temperature: 0.7,
  useMemory: true,
  useKnowledgeBase: true,
  language: 'it',
};
