import { generateEmbedding } from "./embeddings";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";

const supabaseHeaders = {
  "apikey": SUPABASE_SERVICE_KEY,
  "Authorization": "Bearer " + SUPABASE_SERVICE_KEY,
  "Content-Type": "application/json",
  "Prefer": "return=representation",
};

async function supabaseFetch(path: string, options: any = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...supabaseHeaders,
      ...options.headers,
      ...options.headers,
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase REST error: ${response.status} - ${errorText}`);
  }
  return response.json();
}

export interface MemoryEntry {
  id: string;
  content: string;
  importance: number; // 1 to 5
  scope: 'local' | 'global';
  source: string; // agent type (e.g., 'tech', 'strategy')
  category: string; // auto-categorization
  createdAt: string;
}

/**
 * Saves a new fact/memory into the AgentConfig JSONB settings field (for backup)
 * and additionally into the VectorMemory pgvector table.
 */
export async function remember(
  agentConfigId: string,
  content: string,
  options: { importance?: number; scope?: 'local' | 'global'; source?: string; category?: string } = {}
): Promise<MemoryEntry> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Missing Supabase credentials for Mnemosyne.");
  }

  // 1. Fetch agent configuration
  const configs = await supabaseFetch(`/AgentConfig?id=eq.${agentConfigId}&select=*`);
  if (!configs || configs.length === 0) {
    throw new Error(`AgentConfig with ID ${agentConfigId} not found.`);
  }
  const config = configs[0];
  let settings = config.settings || {};
  if (typeof settings === 'string') {
    try {
      settings = JSON.parse(settings);
    } catch {
      settings = {};
    }
  }

  if (!settings.mnemosyne || !Array.isArray(settings.mnemosyne)) {
    settings.mnemosyne = [];
  }

  // 2. Create the new memory entry
  const newEntry: MemoryEntry = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
    content: content.trim(),
    importance: options.importance ?? 3,
    scope: options.scope ?? 'local',
    source: options.source ?? config.type ?? 'unknown',
    category: options.category ?? 'general',
    createdAt: new Date().toISOString(),
  };

  settings.mnemosyne.push(newEntry);

  // 3. Patch settings back to the DB (classic JSONB backup)
  try {
    await supabaseFetch(`/AgentConfig?id=eq.${agentConfigId}`, {
      method: "PATCH",
      body: JSON.stringify({ settings }),
    });
  } catch (err: any) {
    console.error("[Mnemosyne] JSONB patch failed:", err.message);
  }

  // 4. Save to VectorMemory table (pgvector)
  try {
    let embeddingVector: number[] | null = null;
    try {
      embeddingVector = await generateEmbedding(content);
    } catch (embErr: any) {
      console.warn("[Mnemosyne] Could not generate embedding for memory:", embErr.message);
    }

    await supabaseFetch(`/VectorMemory`, {
      method: "POST",
      body: JSON.stringify({
        id: newEntry.id,
        agentConfigId: agentConfigId,
        content: content.trim(),
        embedding: embeddingVector,
        importance: newEntry.importance,
        scope: newEntry.scope,
        category: newEntry.category,
        createdAt: newEntry.createdAt,
        updatedAt: newEntry.createdAt,
      }),
    });
    console.log(`[Mnemosyne] Saved vector memory in VectorMemory table.`);
  } catch (vecErr: any) {
    console.error("[Mnemosyne] Error saving memory in VectorMemory table:", vecErr.message);
  }

  console.log(`[Mnemosyne] Saved memory in agent ${agentConfigId}: "${newEntry.content}" (scope: ${newEntry.scope}, importance: ${newEntry.importance})`);
  return newEntry;
}

/**
 * Retrieves the most relevant memories for a query using semantic vector search,
 * falling back to keyword-based similarity if not configured.
 */
export async function recall(
  agentConfigId: string,
  query: string,
  top_k: number = 3,
  recencyBias: number = 0.5
): Promise<MemoryEntry[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn("[Mnemosyne] Missing Supabase credentials; recall returning empty.");
    return [];
  }

  // --- 1. Try Vector Semantic Recall (Supabase pgvector RPC) ---
  try {
    console.log(`[Mnemosyne] Attempting vector semantic recall for: "${query}"`);
    const queryEmbedding = await generateEmbedding(query);
    
    const results = await supabaseFetch(`/rpc/match_memories`, {
      method: "POST",
      body: JSON.stringify({
        query_embedding: queryEmbedding,
        match_threshold: 0.35, // Minimum similarity threshold
        match_count: top_k,
        filter_agent_config_id: agentConfigId,
        filter_scope: "all"
      })
    });

    if (Array.isArray(results) && results.length > 0) {
      console.log(`[Mnemosyne] Vector recall matched ${results.length} memories.`);
      return results.map((r: any) => ({
        id: r.id,
        content: r.content,
        importance: r.importance,
        scope: r.scope as 'local' | 'global',
        source: agentConfigId,
        category: r.category || 'general',
        createdAt: r.createdAt,
      }));
    }
    console.log("[Mnemosyne] Vector recall returned 0 matches; falling back to lexical search.");
  } catch (vecErr: any) {
    console.warn("[Mnemosyne] Vector recall failed or not set up yet:", vecErr.message, "; falling back to lexical search.");
  }

  // --- 2. Fallback: Classic Lexical Search (Keyword-based recall from JSONB) ---
  // 1. Get current AgentConfig to retrieve startupId
  const configs = await supabaseFetch(`/AgentConfig?id=eq.${agentConfigId}&select=startupId`);
  if (!configs || configs.length === 0) return [];
  const targetConfig = configs[0];
  const startupId = targetConfig.startupId;

  // 2. Fetch all AgentConfigs in the same startup
  const allConfigs = await supabaseFetch(`/AgentConfig?startupId=eq.${startupId}&select=id,type,settings`);
  if (!allConfigs || allConfigs.length === 0) return [];

  const candidates: MemoryEntry[] = [];

  // 3. Gather candidate memory entries
  for (const config of allConfigs) {
    let settings = config.settings || {};
    if (typeof settings === 'string') {
      try {
        settings = JSON.parse(settings);
      } catch {
        settings = {};
      }
    }
    const mnemosyne = settings.mnemosyne || [];
    if (Array.isArray(mnemosyne)) {
      for (const entry of mnemosyne) {
        if (config.id === agentConfigId) {
          // Retrieve both local and global memories for the active agent
          candidates.push(entry);
        } else if (entry.scope === 'global') {
          // Retrieve only global memories for other agents
          candidates.push(entry);
        }
      }
    }
  }

  if (candidates.length === 0) return [];

  // 4. Tokenize the query
  const stopWords = new Set([
    "il", "lo", "la", "i", "gli", "le", "un", "una", "uno", "di", "a", "da", "in", "con", "su", "per", "tra", "fra",
    "del", "dello", "della", "dei", "degli", "delle", "al", "allo", "alla", "ai", "agli", "alle",
    "dal", "dallo", "dalla", "dai", "dagli", "dalle", "nel", "nello", "nella", "nei", "negli", "nelle",
    "sul", "sullo", "sulla", "sui", "sugli", "sulle", "col", "coi", "che", "e", "o", "ma", "se", "anche",
    "the", "a", "an", "and", "of", "to", "in", "is", "for", "with", "on", "at", "by", "from", "that", "this", "it"
  ]);

  const queryWords = query
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  if (queryWords.length === 0) {
    return candidates
      .sort((a, b) => b.importance - a.importance || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, top_k);
  }

  // 5. Score candidates
  const scored = candidates.map(entry => {
    const contentLower = entry.content.toLowerCase();
    let matchCount = 0;

    for (const qWord of queryWords) {
      if (contentLower.includes(qWord)) {
        matchCount += 1.0;
        const regex = new RegExp(`\\b${qWord}\\b`, 'i');
        if (regex.test(contentLower)) {
          matchCount += 0.5;
        }
      }
    }

    if (matchCount === 0) {
      return { entry, score: 0 };
    }

    const elapsedMs = Date.now() - new Date(entry.createdAt).getTime();
    const elapsedDays = Math.max(0, elapsedMs / (1000 * 60 * 60 * 24));
    const recencyFactor = 1 / (1 + elapsedDays * recencyBias);
    const importanceFactor = 1 + (entry.importance - 1) * 0.15;
    const score = matchCount * importanceFactor * recencyFactor;
    return { entry, score };
  });

  // 6. Filter matches and sort
  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.entry)
    .slice(0, top_k);
}


/**
 * Uses LLM to extract new key facts and preferences from a chat completion turn and remembers them.
 */
export async function autoExtractMemories(
  agentConfigId: string,
  userMessage: string,
  assistantReply: string
): Promise<MemoryEntry[]> {
  if (!OPENROUTER_KEY) {
    console.warn("[Mnemosyne] Missing OpenRouter key; autoExtractMemories skipped.");
    return [];
  }

  try {
    // 1. Fetch config to get agent type
    const configs = await supabaseFetch(`/AgentConfig?id=eq.${agentConfigId}&select=type`);
    if (!configs || configs.length === 0) return [];
    const agentType = configs[0].type;

    const prompt = `Sei un estrattore di memoria a lungo termine chiamato Mnemosyne.
Il tuo compito è analizzare la seguente conversazione tra un Founder di una startup e un Assistente AI e identificare informazioni chiave, fatti stabili, decisioni prese o preferenze del Founder che meritano di essere ricordati a lungo termine.

CRITERI DI SELEZIONE:
1. Memorizza solo fatti concreti (es. "Il team usa Next.js per il frontend", "L'indirizzo email di contatto è info@techflow.ai", "Il budget attuale è $10.000").
2. Evita di memorizzare dettagli temporanei, saluti o risposte/consigli teorici dell'assistente (es. "Il Founder ha detto ciao", "L'agente ha consigliato di fare ricerche di mercato").
3. Assegna a ciascun fatto un punteggio di importanza da 1 a 5 (5 = critico per tutte le conversazioni future, 1 = dettaglio marginale).
4. Determina lo scope:
   - "global": informazioni che sono utili a tutto il team di agenti (es. dati finanziari, email, tech stack globale, settore della startup).
   - "local": preferenze o dettagli specifici per il tipo di agente corrente "${agentType}" (es. preferenza per lo stile del codice o architettura per l'agente Tech, o preferenza per specifici canali di marketing per l'agente Marketing).
5. Assegna una categoria (category) tra le seguenti:
   - "identity": nomi, ruoli, informazioni personali del founder o del team
   - "business": modello di business, settore, mercato, target, strategia, vision, mission
   - "tech": tech stack, architettura, strumenti di sviluppo, infrastruttura
   - "finance": budget, investimenti, revenue, spese, fundraising
   - "contacts": email, numeri di telefono, link social, contatti importanti
   - "preferences": gusti, preferenze operative, stile di lavoro, scelte ricorrenti
   - "decisions": decisioni prese, milestone raggiunte, pivot effettuati
   - "milestones": date chiave, scadenze, obiettivi temporali, launch dates
   - "general": qualsiasi altra informazione che non rientra nelle categorie sopra

Conversazione:
Founder: "${userMessage}"
Assistente: "${assistantReply}"

Rispondi ESCLUSIVAMENTE con un array JSON valido, senza blocchi di codice markdown, markdown o spiegazioni aggiuntive.
Esempio di output:
[
  {"content": "Il founder si chiama Marco Rossi", "importance": 5, "scope": "global", "category": "identity"},
  {"content": "Il founder preferisce l'architettura a microservizi", "importance": 4, "scope": "local", "category": "tech"},
  {"content": "Il lancio della beta è pianificato per settembre 2026", "importance": 5, "scope": "global", "category": "milestones"}
]
Se non c'è nulla da memorizzare, rispondi con un array vuoto: []`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + OPENROUTER_KEY,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "AgentFoundry",
      },
      body: JSON.stringify({
        model: "openrouter/owl-alpha",
        messages: [
          { role: "system", content: "Sei un assistente di memoria per agenti AI. Rispondi solo in formato JSON." },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      console.error("[Mnemosyne] LLM extraction request failed:", res.status, await res.text());
      return [];
    }

    const data = await res.json();
    let text = data.choices?.[0]?.message?.content || "";

    // Cleanup potential markdown codeblock formatting
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    if (!text || text === "[]") return [];

    let items: any[] = [];
    try {
      items = JSON.parse(text);
    } catch (parseErr) {
      console.error("[Mnemosyne] Failed to parse extracted JSON:", text, parseErr);
      return [];
    }

    if (!Array.isArray(items)) return [];

    const savedEntries: MemoryEntry[] = [];
    for (const item of items) {
      if (item.content && typeof item.content === 'string') {
        const entry = await remember(agentConfigId, item.content, {
          importance: typeof item.importance === 'number' ? item.importance : 3,
          scope: item.scope === 'global' ? 'global' : 'local',
          source: agentType,
          category: typeof item.category === 'string' ? item.category : 'general',
        });
        savedEntries.push(entry);
      }
    }

    return savedEntries;
  } catch (err: any) {
    console.error("[Mnemosyne] Error in autoExtractMemories:", err.message);
    return [];
  }
}
