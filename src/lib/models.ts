// OpenRouter models configuration

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  contextLength: number;
  free: boolean;
  speed: 'fast' | 'medium' | 'slow';
  quality: 'basic' | 'good' | 'excellent';
}

export const AVAILABLE_MODELS: ModelInfo[] = [
  // === FREE MODELS ===
  {
    id: 'openrouter/owl-alpha',
    name: 'OWL Alpha (Free)',
    description: 'Modello versatile gratuito, ottimo per chat e ragionamento',
    contextLength: 1048576,
    free: true,
    speed: 'medium',
    quality: 'excellent',
  },
  {
    id: 'openrouter/free',
    name: 'Auto Free',
    description: 'OpenRouter sceglie automaticamente il miglior modello gratuito',
    contextLength: 200000,
    free: true,
    speed: 'medium',
    quality: 'good',
  },
  {
    id: 'nex-agi/nex-n2-pro:free',
    name: 'Nex N2 Pro (Free)',
    description: 'Modello multilingua con buon ragionamento',
    contextLength: 262144,
    free: true,
    speed: 'fast',
    quality: 'good',
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    name: 'Gemma 4 26B (Free)',
    description: 'Modello Google, buono per analisi e ragionamento',
    contextLength: 262144,
    free: true,
    speed: 'medium',
    quality: 'good',
  },
  // === PAID MODELS ===
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3',
    description: 'Modello cinese eccezionale, ottimo rapporto qualità/prezzo',
    contextLength: 65536,
    free: false,
    speed: 'fast',
    quality: 'excellent',
  },
  {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3.5 Haiku',
    description: 'Modello Anthropic veloce ed economico',
    contextLength: 200000,
    free: false,
    speed: 'fast',
    quality: 'good',
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Modello OpenAI economico e versatile',
    contextLength: 131072,
    free: false,
    speed: 'fast',
    quality: 'good',
  },
];

export const DEFAULT_MODEL = 'openrouter/owl-alpha';

export function getModelInfo(id: string): ModelInfo | undefined {
  return AVAILABLE_MODELS.find(m => m.id === id);
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
