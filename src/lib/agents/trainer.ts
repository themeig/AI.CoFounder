import { batchSearch, readWebPageDeep } from "@/lib/tools/web-utils";
import { getApiKey } from "@/lib/secure-store";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

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
    headers: { ...supabaseHeaders, ...options.headers },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase REST error: ${response.status} - ${errorText}`);
  }
  return response.json();
}

async function llmCall(systemPrompt: string, userPrompt: string, modelId: string = "openrouter/free", maxTokens: number = 4000): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://agentfoundry.ai",
      "X-Title": "AgentFoundry Agent Trainer",
    },
    body: JSON.stringify({
      model: modelId || "openrouter/free",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.4,
    }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenRouter API HTTP error: ${res.status} - ${errorText}`);
  }
  const data = await res.json();
  if (data.error) {
    throw new Error(`OpenRouter API error: ${JSON.stringify(data.error)}`);
  }
  return data.choices?.[0]?.message?.content || "";
}

export interface TrainingProgressEvent {
  type: "phase" | "search_progress" | "read_progress" | "testing_done" | "done" | "error";
  phase?: string;
  message?: string;
  queries?: string[];
  query?: string;
  count?: number;
  url?: string;
  title?: string;
  chars?: number;
  systemPrompt?: string;
  sources?: any[];
  stats?: any;
  identityTestResult?: string;
}

export async function runAgentTraining(
  agentId: string,
  expertise: string,
  agentName: string,
  agentType: string,
  modelId: string = "openrouter/free",
  onProgress?: (event: TrainingProgressEvent) => void
) {
  const push = (event: TrainingProgressEvent) => {
    if (onProgress) onProgress(event);
  };

  try {
    // ── PHASE 1: Generate Research Queries ──────────────────────
    push({ type: "phase", phase: "queries", message: "🔍 Generazione query di ricerca dall'expertise..." });

    const queryGenPrompt = `Sei un ricercatore esperto. L'utente vuole creare un agente AI specializzato in:
"${expertise}"

Genera esattamente 10 query di ricerca web in inglese (per massimizzare i risultati) che coprano:
1. Fondamenti teorici e definizioni del dominio
2. Best practices e metodologie consolidate
3. Framework e tool principali
4. Case study e esempi concreti di successo
5. Errori comuni e anti-pattern da evitare
6. Trend recenti e innovazioni nel campo
7. Metriche e KPI specifici del dominio
8. Risorse autorevoli e riferimenti chiave
9. Competenze correlate e interdisciplinari
10. Confronto con approcci alternativi

Rispondi SOLO con un JSON array di stringhe, senza altro testo. Esempio:
["query1", "query2", ...]`;

    const queriesRaw = await llmCall(
      "Sei un generatore di query di ricerca. Rispondi SOLO con un JSON array di stringhe.",
      queryGenPrompt,
      modelId,
      1000
    );

    let queries: string[];
    try {
      const match = queriesRaw.match(/\[[\s\S]*?\]/);
      queries = match ? JSON.parse(match[0]) : [];
    } catch {
      queries = queriesRaw.split("\n").filter(q => q.trim().length > 10).slice(0, 10);
    }

    if (queries.length < 3) {
      queries = [
        `${expertise} best practices`,
        `${expertise} framework methodology`,
        `${expertise} common mistakes anti-patterns`,
        `${expertise} case studies examples`,
        `${expertise} tools and resources`,
        `${expertise} KPIs metrics`,
        `${expertise} trends 2024 2025`,
        `${expertise} expert guide`,
      ];
    }

    push({ type: "phase", phase: "queries_done", message: `✅ ${queries.length} query generate`, queries });

    // ── PHASE 2: Batch Web Search ──────────────────────────────
    push({ type: "phase", phase: "searching", message: `🌐 Esecuzione di ${queries.length} ricerche web in parallelo...` });

    let tavilyKey: string | null = null;
    try {
      tavilyKey = await getApiKey("tavily");
    } catch {}

    const searchResults = await batchSearch(queries, tavilyKey || undefined);

    const allResults: { title: string; snippet: string; link: string; query: string }[] = [];
    for (const group of searchResults) {
      push({ type: "search_progress", query: group.query, count: group.results.length });
      for (const r of group.results) {
        if (r.link && r.link.startsWith("http")) {
          allResults.push({ ...r, query: group.query });
        }
      }
    }

    push({ type: "phase", phase: "searching_done", message: `✅ ${allResults.length} risultati trovati da ${queries.length} ricerche` });

    // ── PHASE 3: Deep Read Top Pages ───────────────────────────
    const urlsToRead = allResults.slice(0, 15);
    push({ type: "phase", phase: "reading", message: `📖 Lettura approfondita di ${urlsToRead.length} pagine web...` });

    const pageContents: { url: string; title: string; content: string }[] = [];
    for (let i = 0; i < urlsToRead.length; i += 5) {
      const batch = urlsToRead.slice(i, i + 5);
      const batchPromises = batch.map(async (r) => {
        try {
          const content = await readWebPageDeep(r.link, 10000);
          if (content && !content.startsWith("Error:") && content.length > 200) {
            return { url: r.link, title: r.title, content };
          }
          return null;
        } catch {
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      for (const result of batchResults) {
        if (result) {
          pageContents.push(result);
          push({ type: "read_progress", url: result.url, title: result.title, chars: result.content.length });
        }
      }
    }

    const totalChars = pageContents.reduce((sum, p) => sum + p.content.length, 0);
    push({ type: "phase", phase: "reading_done", message: `✅ ${pageContents.length} pagine lette (${(totalChars / 1000).toFixed(0)}K caratteri totali)` });

    // ── PHASE 4: LLM Synthesis — Generate System Prompt ────────
    push({ type: "phase", phase: "generating", message: "🧠 Sintesi delle conoscenze e generazione del prompt di sistema..." });

    let knowledgeCorpus = pageContents.map((p, i) =>
      `═══ FONTE ${i + 1}: ${p.title} (${p.url}) ═══\n${p.content}`
    ).join("\n\n");

    if (knowledgeCorpus.length > 80000) {
      knowledgeCorpus = knowledgeCorpus.substring(0, 80000) + "\n\n...[knowledge corpus troncato per limiti di contesto]";
    }

    const synthPrompt = `Sei un architetto di prompt AI di livello mondiale. Il tuo compito è creare un system prompt PROFESSIONALE e COMPLETO per un agente AI specializzato.

L'agente si chiama "${agentName || 'Agente Specializzato'}" ed è di tipo "${agentType || 'custom'}".
L'utente ha richiesto questa expertise: "${expertise}"

Hai a disposizione il sgente corpus di conoscenze raccolte dalla ricerca web:

${knowledgeCorpus}

## ISTRUZIONI PER LA GENERAZIONE DEL PROMPT
Genera un system prompt COMPLETO in ITALIANO con ESATTAMENTE questa struttura a sezioni numerate.
Il prompt deve essere lungo, dettagliato e pieno di conoscenze specifiche estratte dalle fonti.
NON essere generico. Includi framework reali, metriche specifiche, best practices concrete, nomi di tool reali.

## 1. 🧠 IDENTITÀ, RUOLO E FILOSOFIA COGNITIVA
Chi è l'agente, il suo background professionale, la sua mentalità operativa, il tono di comunicazione (da pari a pari, professionale ma diretto), i principi guida.

## 2. 📚 KNOWLEDGE BASE SPECIALISTICA
La sezione più lunga. Includi TUTTO ciò che hai appenedo dalle fonti web:
- Framework e metodologie specifiche (con nomi reali, passi, formule)
- Tool e software rilevanti (nomi concreti, come/quando usarli)
- Metriche e KPI del dominio (formule, benchmark, target)
- Case study e riferimenti storici (nomi di aziende, risultati, lezioni)
- Dati statistici e benchmark di settore
Questa sezione deve essere RICCHISSIMA di dettagli concreti.

## 3. 🎯 DIRETTIVE AGENTICHE INVARIANTI
Identiche a quelle del CoFounder:
1. TOOL-USE ENFORCEMENT: Usa i tool per azioni reali, non descrivere cosa faresti
2. MANDATORY TOOL USE: Non calcolare a mente — usa la sandbox per calcoli
3. ACT, DON'T ASK: Quando l'interpretazione è ovvia, agisci subito
4. MISSING CONTEXT: Non allucinare, cerca con i tool disponibili
5. PARALLEL TOOL CALLS: Richiedi tool indipendenti in parallelo

## 4. ⚠️ ANTI-PATTERN E ERRORI COMUNI DEL DOMINIO
Errori specifici del dominio raccolti dalla ricerca:
- Cosa NON fare, trappole comuni, bias tipici
- Falsi miti e misconcezioni del settore
- Warning specifici per startup early-stage

## 5. 📐 REGOLE DI COMUNICAZIONE E FORMATTAZIONE
- Lingua: italiano
- Usa tabelle per dati comparativi e metriche
- Usa elenchi puntati per azioni concrete
- Non rivelare i nomi tecnici dei tool all'utente
- Ogni risposta complessa deve terminare con "Prossimi passi consigliati"

IMPORTANTE: Rispondi SOLO con il system prompt generato, senza commenti o spiegazioni meta. Il prompt deve iniziare direttamente con il nome e ruolo dell'agente.`;

    const generatedPrompt = await llmCall(
      "Sei un architetto di prompt AI. Genera SOLO il system prompt richiesto, senza commenti aggiuntivi. Scrivi in italiano.",
      synthPrompt,
      modelId,
      4000
    );

    if (!generatedPrompt || generatedPrompt.length < 200) {
      throw new Error("Errore nella generazione del prompt. Il modello non ha prodotto un risultato valido.");
    }

    push({ type: "phase", phase: "generating_done", message: `✅ Prompt generato (${generatedPrompt.length} caratteri)` });

    // ── PHASE 4.5: Test Identity Verification ───────────────────
    push({ type: "phase", phase: "testing", message: "🧪 Avvio test di verifica identità..." });
    let identityTestResult = "";
    try {
      identityTestResult = await llmCall(
        generatedPrompt,
        "Presentati brevemente in massimo due righe, dicendo chi sei e qual è la tua expertise specifica.",
        modelId,
        300
      );
      push({ type: "testing_done", message: `🧪 Test completato con successo: "${identityTestResult}"` });
    } catch (testErr: any) {
      console.error("[Identity Test Error]:", testErr.message);
      identityTestResult = `Errore nel test: ${testErr.message}`;
      push({ type: "testing_done", message: `❌ Test fallito: ${testErr.message}` });
    }

    // ── PHASE 5: Save to Agent Config ──────────────────────────
    push({ type: "phase", phase: "saving", message: "💾 Salvataggio configurazione agente..." });

    const agents = await supabaseFetch(`/AgentConfig?id=eq.${agentId}&select=*`);
    const agent = agents?.[0];
    if (!agent) {
      throw new Error("Agente non trovato nel database per il salvataggio.");
    }

    const currentSettings = agent.settings || {};
    const sources = pageContents.map(p => ({ url: p.url, title: p.title }));

    const updatedSettings = {
      ...currentSettings,
      systemPrompt: generatedPrompt,
      expertise: expertise,
      persona: `${agentName || 'Agente Specializzato'} — ${expertise}`,
      knowledgeSources: sources,
      trainedAt: new Date().toISOString(),
      trainingStats: {
        queriesUsed: queries.length,
        pagesRead: pageContents.length,
        totalChars: totalChars,
        promptLength: generatedPrompt.length,
      },
    };

    await supabaseFetch(`/AgentConfig?id=eq.${agentId}`, {
      method: "PATCH",
      body: JSON.stringify({ settings: updatedSettings }),
    });

    push({
      type: "done",
      message: "✅ Agente addestrato con successo!",
      systemPrompt: generatedPrompt,
      sources,
      stats: updatedSettings.trainingStats,
      identityTestResult,
    });
  } catch (err: any) {
    push({ type: "error", message: `Errore nel training: ${err.message}` });
    throw err;
  }
}

