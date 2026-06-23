// Impostazioni globali dell'applicazione
// Si vedono in Settings page

export interface AppSettings {
  // Modello LLM di default per tutti gli agenti
  defaultModel: string;

  // Nome personalizzabile dell'assistente di piattaforma
  cofounderName: string;

  // Impostazioni di memoria
  memorySettings: MemorySettings;

  // Impostazioni knowledge base
  knowledgeSettings: KnowledgeSettings;

  // Abilita l'utilizzo di Tavily Search per le ricerche web
  useTavily?: boolean;
}

export interface MemorySettings {
  // Quanti messaggi di cronologia includere nel prompt
  // 0 = nessuna cronisto (solo system prompt)
  // 5-10 = contesto breve, risposte più veloci
  // 20-30 = bilanciato (default 20)
  // 40+ = contesto completo
  contextMessages: number;

  // Usa memoria a lungo termine (Mnemosyne)
  useLongTermMemory: boolean;

  // Salva automaticamente le interazioni per training
  autoSaveInteractions: boolean;

  // Quanto è importante la memoria recente vs vecchia
  // 0.0 = tutta uguale
  // 0.5 = bilanciata (default)
  // 1.0 = solo recente
  recencyBias: number;
}

export interface KnowledgeSettings {
  // Usa Pattern dal knowledge base
  usePatterns: boolean;

  // Usa Playbook dal knowledge base
  usePlaybooks: boolean;

  // Usa Outcome per tracking
  useOutcomes: boolean;

  // Success rate minima per includere un pattern (0-100)
  minSuccessRate: number;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultModel: 'openrouter/owl-alpha',
  cofounderName: 'coFounder',
  memorySettings: {
    contextMessages: 20,
    useLongTermMemory: true,  // Abilitato per default
    autoSaveInteractions: true,
    recencyBias: 0.5,
  },
  knowledgeSettings: {
    usePatterns: true,
    usePlaybooks: true,
    useOutcomes: true,
    minSuccessRate: 50,
  },
  useTavily: false,
};
