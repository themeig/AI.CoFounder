import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import * as path from "path";
import { getApiKey } from "@/lib/secure-store";
import { exec } from "child_process";
import * as os from "os";
import { getArtifacts, saveArtifacts, Artifact } from "@/lib/custom-artifacts";
import { recall, autoExtractMemories } from "@/lib/mnemosyne";
import { generateEmbedding } from "@/lib/embeddings";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const METRICS_FILE_PATH = path.join(process.cwd(), "src/lib/custom-metrics.json");

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
    throw new Error(`Supabase error: ${response.status} - ${errorText}`);
  }
  return response.json();
}

async function semanticSearchStories(userMessage: string, cap = 3): Promise<any[]> {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return [];
    const queryEmbedding = await generateEmbedding(userMessage);
    const response = await fetch(
      SUPABASE_URL + "/rest/v1/rpc/match_stories",
      {
        method: "POST",
        headers: {
          "apikey": SUPABASE_SERVICE_KEY,
          "Authorization": "Bearer " + SUPABASE_SERVICE_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query_embedding: queryEmbedding,
          match_threshold: 0.25,
          match_count: cap,
          filter_sector: "all",
          filter_status: "all"
        })
      }
    );
    if (response.ok) {
      return await response.json();
    }
    const errText = await response.text();
    console.warn("[Cofounder API] match_stories failed:", response.status, errText);
    return [];
  } catch (err: any) {
    console.error("[Cofounder API] error in semanticSearchStories:", err.message);
    return [];
  }
}

const CONNECTIONS_FILE_PATH = path.join(process.cwd(), "src/lib/custom-connections.json");

async function getConnectionsData() {
  try { return JSON.parse(await fs.readFile(CONNECTIONS_FILE_PATH, "utf-8")); } catch { return []; }
}
async function saveConnectionsData(data: any) {
  await fs.mkdir(path.dirname(CONNECTIONS_FILE_PATH), { recursive: true });
  await fs.writeFile(CONNECTIONS_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}
async function getMetricsData() {
  try { return JSON.parse(await fs.readFile(METRICS_FILE_PATH, "utf-8")); } catch { return []; }
}
async function saveMetricsData(data: any) {
  await fs.mkdir(path.dirname(METRICS_FILE_PATH), { recursive: true });
  await fs.writeFile(METRICS_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#x2F;/g, "/");
}

async function searchWeb(query: string): Promise<any[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" } });
    if (!response.ok) return [{ title: "Search Error", snippet: "Could not retrieve results.", link: "" }];
    const html = await response.text();
    const results: any[] = [];
    const aRegex = /<a [^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const sRegex = /<a [^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    while (results.length < 5) {
      const matchA = aRegex.exec(html);
      const matchS = sRegex.exec(html);
      if (!matchA || !matchS) break;
      let link = matchA[1].trim();
      if (link.includes("uddg=")) { const p = new URLSearchParams(link.split("?")[1]); link = p.get("uddg") || link; }
      results.push({ title: unescapeHtml(matchA[2].replace(/<[^>]*>/g, "").trim()), snippet: unescapeHtml(matchS[1].replace(/<[^>]*>/g, "").trim()), link });
    }
    return results;
  } catch (err: any) { return [{ title: "Search Failed", snippet: err.message, link: "" }]; }
}

async function searchTavily(query: string, apiKey: string): Promise<any[]> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        max_results: 5,
      }),
    });
    if (!res.ok) {
      throw new Error(`Tavily API responded with status ${res.status}`);
    }
    const data = await res.json();
    return (data.results || []).map((r: any) => ({
      title: r.title,
      snippet: r.content,
      link: r.url,
    }));
  } catch (err: any) {
    console.error("Tavily search error:", err);
    throw err;
  }
}

async function readWebPage(url: string): Promise<string> {
  try {
    if (!url.startsWith("http://") && !url.startsWith("https://")) return "Error: Invalid URL.";
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" } });
    if (!response.ok) return `Error: status ${response.status}`;
    let text = await response.text();
    text = text.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<\/p>/gi, "\n\n").replace(/<\/div>/gi, "\n").replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, "");
    text = unescapeHtml(text).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n");
    if (text.length > 5000) text = text.substring(0, 5000) + "\n\n...[troncato]";
    return text.trim() || "Empty page.";
  } catch (err: any) { return `Error: ${err.message}`; }
}

import { executePython, executeTypeScript } from "@/lib/sandbox-runner";

function getAgentSystemPrompt(agentType: string): string {
  const prompts: Record<string, string> = {
    strategy: "Sei un esperto di strategia startup. Analizza mercati, competitor e opportunità. Suggerisci strategie di crescita basate su dati. Rispondi in italiano, in modo actionable e specifico.",
    tech: "Sei un CTO AI esperto. Aiuti con architetture software, scelta di tech stack, code review e best practices. Conosci Next.js, Python, PostgreSQL, Vercel, Docker. Rispondi in italiano con esempi di codice quando utile.",
    finance: "Sei un esperto di finanza startup. Gestisci cash flow, proiezioni finanziarie, fundraising e metriche SaaS (MRR, ARR, CAC, LTV, burn rate). Rispondi in italiano con numeri e tabelle quando possibile.",
    marketing: "Sei un esperto di growth marketing. Crei strategie di acquisizione, campagne e contenuti. Conosci SEO, paid ads, content marketing, PLG. Rispondi in italiano con esempi concreti.",
    legal: "Sei un esperto legale per startup. Gestisci incorporazione, contratti, IP e compliance (GDPR). Rispondi in italiano in modo chiaro.",
    operations: "Sei un esperto di operazioni startup. Ottimizzi workflow, automatizzi processi e gestisci team. Conosci Notion, Linear, Slack, Zapier. Rispondi in italiano con checklist e template.",
  };
  return prompts[agentType] || "Sei un assistente AI per startup. Rispondi in italiano.";
}

async function callAgentInternal(agentType: string, task: string, context: string, startup: any): Promise<{ response: string; success: boolean }> {
  try {
    let basePrompt = getAgentSystemPrompt(agentType);
    try {
      const dbConfigs = await supabaseFetch(`/AgentConfig?startupId=eq.${startup.id}&type=eq.${agentType}&isActive=eq.true`);
      if (dbConfigs && dbConfigs.length > 0 && dbConfigs[0].settings?.systemPrompt) {
        basePrompt = dbConfigs[0].settings.systemPrompt;
      }
    } catch (dbErr) {
      console.error("Error loading agent settings for internal call:", dbErr);
    }

    const systemPrompt = `${basePrompt}

Informazioni Startup (${startup.name}):
- Settore: ${startup.sector} | Fase: ${startup.phase}
- MRR: $${startup.mrr} | Utenti: ${startup.users}
- Burn Rate: $${startup.burnRate}/mese | Runway: ${startup.runway} mesi
${context ? `\nContesto dal CoFounder:\n${context}` : ""}

Sei un agente delegato dall'orchestratore CoFounder. Fornisci una risposta esperta, pratica e concisa. Sii diretto e actionable.`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://agentfoundry.ai",
        "X-Title": "AgentFoundry Internal Delegation"
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: task }
        ],
        temperature: 0.7,
        max_tokens: 1024,
      })
    });

    if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`);
    const data = await res.json();
    return { response: data.choices?.[0]?.message?.content || "Nessuna risposta.", success: true };
  } catch (err: any) {
    return { response: `Errore: ${err.message}`, success: false };
  }
}

const AGENT_LABELS: Record<string, string> = {
  strategy: "Strategy Agent", tech: "Tech Agent", finance: "Finance Agent",
  marketing: "Marketing Agent", legal: "Legal Agent", operations: "Operations Agent",
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "delegateToAgent",
      description: "Delega un task specifico ad uno degli agenti specializzati del team. Usa questo tool quando la richiesta richiede expertise specifica di un dipartimento. Max 3 deleghe per risposta.",
      parameters: {
        type: "object",
        properties: {
          agentType: { type: "string", enum: ["strategy", "tech", "finance", "marketing", "legal", "operations"] },
          task: { type: "string", description: "Task specifico da assegnare all'agente." },
          context: { type: "string", description: "Contesto aggiuntivo opzionale." },
          visibleToUser: { type: "boolean", description: "Imposta su true se la risposta dettagliata e completa del subagente deve essere mostrata al founder. Imposta su false se la risposta serve solo a te internamente per formulare la risposta finale e non deve essere visualizzata direttamente in chiaro dal founder." }
        },
        required: ["agentType", "task"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "suggestCreateAgent",
      description: "Propone al fondatore di creare un agente specializzato mancante nel team. Usa questo quando l'agente richiesto NON esiste.",
      parameters: {
        type: "object",
        properties: {
          agentType: { type: "string", enum: ["strategy", "tech", "finance", "marketing", "legal", "operations"] },
          reason: { type: "string", description: "Perché questo agente sarebbe utile." },
          agentName: { type: "string", description: "Nome suggerito per il nuovo agente." }
        },
        required: ["agentType", "reason", "agentName"]
      }
    }
  },
  {
    type: "function",
    function: { name: "getStartupInfo", description: "Recupera info e metriche finanziarie della startup.", parameters: { type: "object", properties: {} } }
  },
  {
    type: "function",
    function: {
      name: "getActiveAgents",
      description: "Recupera l'elenco degli agenti AI configurati. Usa SEMPRE prima di delegare o suggerire nuovi agenti.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "updateStartupMetrics",
      description: "Aggiorna metriche della startup (mrr, users, burnRate, runway).",
      parameters: { type: "object", properties: { mrr: { type: "number" }, users: { type: "number" }, burnRate: { type: "number" }, runway: { type: "number" } } }
    }
  },
  {
    type: "function",
    function: {
      name: "createAgent",
      description: "Crea un nuovo agente specializzato nel team con istruzioni personalizzate (systemPrompt), personalità e competenze specifiche. Usa SOLO dopo conferma esplicita del fondatore.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Il nome dell'agente (es: 'Michele Boldrin' o 'CTO Advisor')." },
          type: { type: "string", enum: ["strategy", "tech", "finance", "marketing", "legal", "operations"], description: "La categoria / dipartimento dell'agente." },
          systemPrompt: { type: "string", description: "Prompt di sistema / istruzioni dettagliate per definire il comportamento, focus, tono e stile di risposta (es: 'Sei Michele Boldrin...')." },
          persona: { type: "string", description: "Profilo descrittivo, background ed attitudine dell'agente." },
          expertise: { type: "string", description: "Elenco di competenze chiave (es: ' fundraising, unit economics')." }
        },
        required: ["name", "type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "deleteAgent",
      description: "Elimina permanentemente un agente specializzato dal team inserendo il suo ID. Usa questo tool per rimuovere duplicati o agenti non più necessari. Chiama sempre getActiveAgents prima per recuperare l'ID esatto dell'agente.",
      parameters: {
        type: "object",
        properties: {
          agentId: { type: "string", description: "L'ID univoco dell'agente da eliminare (es: clx123456789)." }
        },
        required: ["agentId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "addCustomMetric",
      description: "Aggiunge una nuova metrica/grafico alla dashboard Analytics.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" }, value: { type: "string" },
          type: { type: "string", enum: ["currency", "percentage", "ratio", "integer"] },
          chartType: { type: "string", enum: ["line", "bar", "gauge", "cohort", "value"] },
          formula: { type: "string" },
          data: { type: "array", items: { type: "number" } },
          labels: { type: "array", items: { type: "string" } }
        },
        required: ["title", "value"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "updateCustomMetric",
      description: "Modifica una metrica personalizzata esistente.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" }, title: { type: "string" }, value: { type: "string" },
          chartType: { type: "string", enum: ["line", "bar", "gauge", "cohort", "value"] },
          data: { type: "array", items: { type: "number" } },
          labels: { type: "array", items: { type: "string" } }, formula: { type: "string" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "deleteCustomMetric",
      description: "Elimina una metrica personalizzata.",
      parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }
    }
  },
  {
    type: "function",
    function: { name: "getCustomConnections", description: "Recupera le connessioni API personalizzate.", parameters: { type: "object", properties: {} } }
  },
  {
    type: "function",
    function: {
      name: "addCustomConnection",
      description: "Crea una nuova integrazione API esterna.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" }, url: { type: "string" },
          method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
          headers: { type: "object" }, bodyPayload: { type: "string" },
          targetMetric: { type: "string" }, jsonPath: { type: "string" },
          responseType: { type: "string", enum: ["json", "text"] }, timeout: { type: "integer" }
        },
        required: ["name", "url", "targetMetric"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "updateCustomConnection",
      description: "Modifica o disattiva una connessione API.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" }, name: { type: "string" }, url: { type: "string" },
          method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
          headers: { type: "object" }, bodyPayload: { type: "string" },
          targetMetric: { type: "string" }, jsonPath: { type: "string" },
          responseType: { type: "string", enum: ["json", "text"] },
          timeout: { type: "integer" }, isActive: { type: "boolean" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "deleteCustomConnection",
      description: "Elimina una connessione API.",
      parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }
    }
  },
  {
    type: "function",
    function: {
      name: "webSearch",
      description: "Esegue una ricerca web in tempo reale tramite Tavily Search (con DuckDuckGo in fallback) per reperire informazioni aggiornate, competitor, trend e dati finanziari.",
      parameters: { type: "object", properties: { query: { type: "string", description: "La query o domanda naturale di ricerca (es: 'Competitori Notion 2026', 'Qual è la valutazione media seed AI in Italia?')." } }, required: ["query"] }
    }
  },
  {
    type: "function",
    function: { name: "getCustomMetrics", description: "Lista metriche personalizzate della dashboard.", parameters: { type: "object", properties: {} } }
  },
  {
    type: "function",
    function: {
      name: "runPythonScript",
      description: "Esegue uno script Python nella sandbox locale per fare calcoli complessi, analisi dati o elaborazioni. Ritorna l'output dello script (stdout/stderr).",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "Il codice Python completo da eseguire." }
        },
        required: ["code"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "runTypeScriptScript",
      description: "Esegue uno script TypeScript/JavaScript nella sandbox backend locale per far girare calcoli complessi, prioritizzazioni RICE, proiezioni o logica di business. Ritorna l'output dello script (stdout/stderr).",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "Il codice TypeScript/JavaScript completo da eseguire." }
        },
        required: ["code"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "createOrUpdateArtifact",
      description: "Crea o aggiorna un artefatto persistente di codice (es. script Python, pagina HTML interattiva, codice TS) per far calcoli, simulazioni o creare interfacce utente. L'artefatto sarà mostrato in chat come scheda interattiva.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "L'id univoco dell'artefatto (opzionale per la creazione, obbligatorio per l'aggiornamento)." },
          title: { type: "string", description: "Il titolo descrittivo dell'artefatto (es: 'Simulazione CAGR', 'Grafico Runway')." },
          filename: { type: "string", description: "Il nome del file (es: 'cagr.py', 'dashboard.html', 'priorities.ts')." },
          code: { type: "string", description: "Il codice sorgente completo." },
          language: { type: "string", description: "Il linguaggio di programmazione (es: 'python', 'html', 'typescript')." },
          type: { type: "string", enum: ["code", "web", "data"], description: "Il tipo di artefatto: 'web' per HTML/CSS/JS interattivo, 'code' per script eseguibili, 'data' per file JSON/CSV." }
        },
        required: ["title", "filename", "code", "language", "type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "runArtifact",
      description: "Manda in esecuzione un artefatto di codice (Python/JS/TS) esistente e memorizza i log di console e gli output di esecuzione. Utilizza getActiveArtifacts o crea prima l'artefatto.",
      parameters: {
        type: "object",
        properties: {
          artifactId: { type: "string", description: "L'ID univoco dell'artefatto da eseguire." }
        },
        required: ["artifactId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getActiveArtifacts",
      description: "Recupera la lista di tutti gli artefatti salvati finora nel workspace per visualizzarne gli ID, i titoli e i codici.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "renameDiscussion",
      description: "Rinomina la conversazione/discussione corrente con un nuovo titolo descrittivo. Usa questo tool per dare alla conversazione un nome pertinente al tema trattato o per aggiornarlo man mano che l'argomento si focalizza.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Il nuovo titolo descrittivo della conversazione (es: 'Analisi Runway e Costi' o 'Ideazione Campagna Marketing')." }
        },
        required: ["title"]
      }
    }
  }
];

export async function POST(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const push = (type: string, content: any) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, content })}\n\n`));
        } catch {
          closed = true;
        }
      };

      try {
        if (!OPENROUTER_API_KEY) {
          push("error", "OpenRouter non configurato");
          closed = true;
          try { controller.close(); } catch {}
          return;
        }

        const { messages, cofounderName = "coFounder", modelId, settings, discussionId } = await req.json();

        // Load startup
        const users = await supabaseFetch(`/User?email=eq.demo@agentfoundry.ai&select=id`);
        if (!users?.length) {
          push("error", "Utente demo non trovato");
          closed = true;
          try { controller.close(); } catch {}
          return;
        }
        const startups = await supabaseFetch(`/Startup?userId=eq.${users[0].id}&select=*`);
        if (!startups?.length) {
          push("error", "Startup demo non trovata");
          closed = true;
          try { controller.close(); } catch {}
          return;
        }
        const startup = startups[0];
        const startupId = startup.id;

        // Load or create cofounder AgentConfig
        let cofounderConfig;
        try {
          const cofounderConfigs = await supabaseFetch(
            `/AgentConfig?startupId=eq.${startupId}&type=eq.cofounder&select=*`
          );
          if (cofounderConfigs && cofounderConfigs.length > 0) {
            cofounderConfig = cofounderConfigs[0];
          } else {
            push("debug", "🧠 Creazione configurazione memoria per Co-Founder...");
            const newConfigs = await supabaseFetch(`/AgentConfig`, {
              method: "POST",
              body: JSON.stringify({
                startupId,
                type: "cofounder",
                name: cofounderName,
                isActive: true,
                settings: {
                  enabledTools: [
                    "webSearch", "readWebPage", "getStartupInfo", "getCustomMetrics",
                    "runPythonScript", "runTypeScriptScript", "createOrUpdateArtifact",
                    "runArtifact", "getActiveArtifacts", "renameDiscussion"
                  ],
                  useLongTermMemory: true,
                  recencyBias: 0.5,
                  autoSaveInteractions: true
                }
              })
            });
            if (newConfigs && newConfigs.length > 0) {
              cofounderConfig = newConfigs[0];
            }
          }
        } catch (dbErr: any) {
          console.error("Error fetching/creating cofounder config:", dbErr.message);
        }

        // Retrieve long-term memories (Mnemosyne)
        const userMessage = messages[messages.length - 1]?.content || "";
        let mnemosyneContext = "";
        if (cofounderConfig && userMessage) {
          push("debug", "🧠 Ricerca ricordi mnemonici (Mnemosyne) per Co-Founder...");
          try {
            const recalled = await recall(cofounderConfig.id, userMessage, 3, 0.5);
            if (recalled && recalled.length > 0) {
              mnemosyneContext = "\n\n--- RICORDI MNEMOSYNE (Memoria a lungo termine pertinente) ---\n" +
                recalled.map(m => `- [Ricordo (${m.scope}) - importanza: ${m.importance}]: ${m.content}`).join("\n") +
                "\n------------------------------------------------------------";
              push("debug", `🧠 Caricati ${recalled.length} ricordi pertinenti dalla memoria semantica.`);
            } else {
              push("debug", "🧠 Nessun ricordo pertinente trovato per questa richiesta.");
            }
          } catch (memErr: any) {
            console.error("Error recalling from Mnemosyne (cofounder):", memErr.message);
          }
        }

        // Retrieve relevant case studies (Stories)
        let storiesContext = "";
        if (userMessage) {
          push("debug", "📊 Ricerca casi di studio (Storie) pertinenti per Co-Founder...");
          try {
            const matchedStories = await semanticSearchStories(userMessage, 3);
            if (matchedStories && matchedStories.length > 0) {
              storiesContext = "\n\n--- CASI DI STUDIO E STORIE PERTINENTI (Esempi di successo/fallimento reali) ---\n" +
                matchedStories.map(s => {
                  const statusLabel = s.status === 'success' ? 'SUCCESSO' : 'FALLIMENTO';
                  return `- **${s.title}** (${s.sector} - ${statusLabel}):\n  Descrizione: ${s.description}\n  Takeaway: ${s.takeaway}`;
                }).join("\n\n") +
                "\n------------------------------------------------------------";
              push("debug", `📊 Caricate ${matchedStories.length} storie pertinenti dal database.`);
            } else {
              push("debug", "📊 Nessuna storia pertinente trovata.");
            }
          } catch (storyErr: any) {
            console.error("Error matching stories (cofounder):", storyErr.message);
          }
        }

        const systemPrompt = `Sei ${cofounderName}, il Co-Founder AI di AgentFoundry — l'intelligenza centrale e orchestratore supremo di un team di agenti specializzati.
Non sei un semplice chatbot. Sei un co-fondatore digitale, un general manager strategico e un ingegnere di sistema — tutto in uno.
Il tuo superpotere è la capacità di spezzare qualsiasi problema complesso in sotto-task specializzati, delegarli agli agenti giusti, raccogliere le loro analisi esperte e sintetizzarle in una risposta unitaria, coerente e immediatamente actionable per il fondatore.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🧠 IDENTITÀ E FILOSOFIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pensa come un CEO che ha un board di advisors al telefono in ogni momento:
- Non tenti di fare tutto da solo: sai **quando delegare** e **a chi**.
- Non ti limiti a rispondere: proponi, anticipa, identifica rischi prima che il fondatore li veda.
- Non sei passivo: se noti un problema nelle metriche o nel team, lo segnali spontaneamente.
- La tua risposta finale deve sempre valere più della somma delle parti — non limitarti a collazionare le risposte degli agenti, **aggiungici il tuo layer di visione strategica**.
- **Pianificazione e Ragionamento (Obbligatorio)**: Prima di fare qualsiasi chiamata a un tool (es: delegateToAgent, webSearch, ecc.) o prima di formulare la risposta finale, devi aprire e chiudere una fase di ragionamento inserita tra i tag <thought>...</thought>.
- **Controllo dell'Output (CRITICO)**: Tutto ciò che non è la risposta finale e strutturata rivolta al founder DEVE essere inserito all'interno dei tag <thought>...</thought>. Se stai chiamando uno strumento (come delegateToAgent, webSearch, ecc.), NON scrivere assolutamente nulla al di fuori dei tag <thought>...</thought> (nessuna spiegazione all'utente, nessuna introduzione). La risposta fuori dai tag <thought> deve essere vuota in quel turno. Solo nell'ultimo turno, quando hai tutte le informazioni necessarie e non chiami alcun tool, scriverai la risposta finale pulita e strutturata al founder al di fuori del tag di pensiero. Questo ti permette di decidere cosa mostrare al founder (fuori dai tag) e cosa nascondere (dentro i tag di ragionamento).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 👥 IL TUO TEAM DI AGENTI SPECIALIZZATI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Hai a disposizione fino a 6 agenti esperti, ciascuno con una mente specializzata:

🎯 **strategy** — Visione di mercato, analisi competitor, OKR, go-to-market, pivot, posizionamento.
⚙️  **tech** — Architettura software, tech stack, scalabilità, debito tecnico, roadmap prodotto, sicurezza.
💰 **finance** — Cash flow, proiezioni MRR/ARR, unit economics (CAC/LTV), fundraising, burn rate, runway, term sheet.
📣 **marketing** — Acquisizione clienti, growth hacking, SEO/SEM, content, brand, community, PLG.
⚖️  **legal** — Incorporazione, contratti, equity, GDPR, IP, vesting, co-founder agreements.
🔧 **operations** — Processi interni, hiring, tool stack, OKR operativi, team management, automazioni.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🔄 PROTOCOLLO DI ORCHESTRAZIONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**STEP 1 — Ricognizione del team**
Prima di qualsiasi delega, chiama 'getActiveAgents' per sapere esattamente quali agenti esistono.
Non assumere mai: verifica sempre il team disponibile.

**STEP 2 — Decomposizione del problema**
Per ogni richiesta complessa, spezzala mentalmente in domini:
- Cosa richiede expertise di strategia?
- Cosa richiede expertise finanziaria?
- Cosa richiede expertise tecnica?
- Cosa richiede expertise legale/marketing/operativa?
Poi delega ciascun domain all'agente corretto.

**STEP 3 — Delega multipla e sequenziale**
Puoi delegare fino a 3 agenti per risposta. Usa la delega quando:
✅ La richiesta è multidisciplinare (es: "lancia un nuovo prodotto" → strategy + marketing + finance)
✅ Serve analisi approfondita da un esperto di dominio (es: "come strutturiamo l'equity?" → legal)
✅ La risposta corretta richiederebbe conoscenze specialistiche (es: "architetta il backend" → tech)
✅ Il fondatore chiede un piano completo su qualsiasi aspetto della startup
✅ Vuoi fornire al fondatore prospettive multiple su una decisione critica

NON delegare quando:
❌ È una domanda semplice e rapida (es: "qual è il mio MRR?")
❌ Stai solo aggiornando dati nel sistema (usa direttamente updateStartupMetrics, createAgent, ecc.)
❌ È una ricerca web generica (usa webSearch + readWebPage direttamente)
❌ Hai già tutte le informazioni necessarie per rispondere

**STEP 4 — Agenti mancanti**
Se la richiesta richiederebbe un agente che NON esiste nel team, usa 'suggestCreateAgent'.
Spiega al fondatore perché quell'agente sarebbe prezioso e proponi un nome specifico.
Non cercare di improvvisare expertise che non hai: meglio ammettere il gap e colmarlo.

**STEP 5 — Sintesi e visione**
Dopo aver ricevuto le analisi degli agenti:
1. Non limitarti a riportarle: **sintetizza** le convergenze e segnala le divergenze
2. Aggiungi il tuo punto di vista come co-fondatore: quale strada prenderesti?
3. Indica le **prossime 3 azioni concrete** che il fondatore dovrebbe fare
4. Segnala i **rischi principali** e come mitigarli
5. Mantieni un tono diretto, da partner, non da consulente

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🛠️ ARSENAL COMPLETO DI TOOL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Orchestrazione:**
- 'delegateToAgent' → Attiva un agente specializzato su un task specifico. Fornisci task dettagliato, contesto, e imposta 'visibleToUser' a false se la risposta serve solo a te internamente per sintetizzare la risposta finale (consigliato per non sovraccaricare il founder), oppure a true se vuoi che il founder veda il report completo generato dall'agente.
- 'suggestCreateAgent' → Proponi la creazione di un agente mancante (con nome e motivazione).
- 'getActiveAgents' → Recupera la lista completa del team con stato attivo/inattivo.

**Gestione Startup:**
- 'getStartupInfo' → Carica il profilo completo della startup (settore, fase, metriche base).
- 'updateStartupMetrics' → Aggiorna MRR, utenti, burn rate, runway — dati in tempo reale.
- 'createAgent' → Crea un nuovo agente nel team (SOLO dopo conferma esplicita del fondatore).
- 'deleteAgent' → Rimuove permanentemente un agente dal team tramite il suo ID.

**Dashboard Metriche:**
- 'getCustomMetrics' → Lista di tutti gli indicatori personalizzati configurati.
- 'addCustomMetric' → Crea un nuovo KPI con grafico (line/bar/gauge/cohort/value).
- 'updateCustomMetric' → Aggiorna dati o configurazione di una metrica esistente.
- 'deleteCustomMetric' → Rimuove una metrica dalla dashboard.

**Connessioni API:**
- 'getCustomConnections' → Lista delle integrazioni API attive (Shopify, HubSpot, ecc.).
- 'addCustomConnection' → Collega una nuova API esterna per sync automatico dati.
- 'updateCustomConnection' → Modifica o attiva/disattiva una connessione esistente.
- 'deleteCustomConnection' → Rimuove un'integrazione.

**Intelligence esterna:**
- 'webSearch' → Esegue una ricerca in tempo reale tramite Tavily Search (con DuckDuckGo in fallback): ottima per trend, competitor, notizie, dati di mercato. Puoi anche fare ricerche semantiche a domanda intera.
- 'readWebPage' → Legge e analizza il contenuto di una pagina web specifica.

**Esecuzione Codice Sandbox:**
- 'runPythonScript' → Esegue script in codice Python nel backend sicuro e restituisce l'output della console. Utilizzalo quando devi calcolare simulazioni finanziarie complesse (come Monte Carlo), proiezioni di fatturato, runway, metriche o fare analisi di dati numerici. Leggi il risultato dello script per formulare la tua risposta finale strategica.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 💡 ESEMPI DI ORCHESTRAZIONE AVANZATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**"Voglio lanciare una nuova feature premium a pagamento"**
→ Delegare a: finance (pricing/unit economics), marketing (go-to-market), tech (architettura/timeline), strategy (posizionamento)

**"Siamo in crisi di liquidità, abbiamo 3 mesi di runway"**
→ Delegare a: finance (piano di emergenza, opzioni fundraising), strategy (pivot o cut?), operations (dove tagliare i costi)

**"Devo assumere i primi 3 dipendenti"**
→ Delegare a: operations (hiring process, job description), legal (contratti lavoro, stock options), finance (impatto sul burn rate)

**"Un competitor ha lanciato qualcosa di simile"**
→ Prima webSearch per capire cos'hanno lanciato, poi delegare a: strategy (risposta competitiva), marketing (differenziazione), tech (gap analysis prodotto)

**"Preparami per un incontro con un VC"**
→ Delegare a: finance (metriche da presentare, proiezioni), strategy (pitch narrative, market size), legal (data room, term sheet awareness)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📐 REGOLE DI COMUNICAZIONE E CODICE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Rispondi SEMPRE in italiano, con un tono diretto e da partner strategico, mai da assistente servile.
- Cita gli esempi reali delle startup forniti nel contesto (es. Figma, Salesforce, Melio, ecc. presenti nella sezione \`--- CASI DI STUDIO E STORIE PERTINENTI ---\`) per supportare i tuoi consigli e le tue analisi, menzionando dati concreti (metriche chiave di ricavi, valutazioni e investimenti iniziali) e lezioni apprese.
- Non menzionare mai all'utente i nomi tecnici dei tool interni (es: non dire "uso runPythonScript" o "ho chiamato getActiveAgents"). Parla invece di "ho fatto girare una simulazione nella sandbox", "ho controllato il team", "ho delegato l'agente finanziario", ecc.
- Usa elenchi puntati e tabelle per strutturare i dati, evitando muri di testo.
- Sii conciso ma completo: ogni risposta deve essere immediatamente actionable.
- Se non conosci un dato o un trend di mercato, non inventarlo: usa lo strumento 'webSearch'. Ricorda che 'webSearch' interroga Tavily Search ed è ottimizzato per queries semantiche ed LLM. Puoi formulare domande complete in linguaggio naturale per ottenere risposte precise.
- Non chiedere mai il permesso al fondatore per usare gli strumenti o delegare: agisci in autonomia, esegui i task e mostra direttamente i risultati dell'elaborazione.
- **SVILUPPO NEL WORKSPACE (Client-side):** Quando crei o modifichi file di codice (es. HTML, CSS, JS, TS, Python) o interi siti web per mostrarli nel Workspace dell'utente, **devi SEMPRE invocare il tool 'createOrUpdateArtifact'**. Non limitarti a scrivere il codice in chat come testo o blocchi di markdown. Se deleghi la scrittura di codice ad un agente (come l'agente tech) e questo ti restituisce del codice o una pagina web, devi **tu stesso invocare il tool 'createOrUpdateArtifact'** per salvare quel codice nel workspace, in modo che il founder possa vederlo e testarlo. Imposta i parametri richiesti (\`title\`, \`filename\`, \`code\`, \`language\`, \`type\`). Per codice interattivo/siti web, imposta il tipo su \`'web'\` e il linguaggio su \`'html'\` o \`'javascript'\`. Se crei file CSS o JS separati da collegare all'HTML principale, usa lo stesso strumento creando file separati (es. \`styles.css\`, \`app.js\`). Inserisci SEMPRE un commento nella primissima riga del codice col nome del file (es: \`// app.js\`, \`/* styles.css */\` o \`<!-- index.html -->\`) così che la console/workspace client possa caricarli ed eseguirli. Il Workspace combinerà i file HTML, CSS e JS/TS generati in un'unica anteprima interattiva iframe con supporto split-screen.
- **ESECUZIONE IN SANDBOX (Backend-side):** Per qualsiasi calcolo numerico, formula complessa, prioritizzazione RICE, proiezione finanziaria (es: CAGR, runway, burn rate), simulazione statistica (es: Monte Carlo) o analisi di dati numerici, **NON scrivere solo il codice in chat e non limitarti ad un blocco markdown**. Devi invece **INVOCARE lo strumento corretto ('runPythonScript' per Python o 'runTypeScriptScript' per TypeScript/JavaScript)** per eseguirlo in background nella tua sandbox backend. Leggi l'output del terminale restituito dal tool per formulare la risposta finale e presenta al fondatore solo i risultati numerici/strategici. Se il fondatore ti chiede esplicitamente uno script, forniscilo pure (cosicché sia caricato nel Workspace), ma devi **comunque** eseguirlo prima nella sandbox per validarne il funzionamento e ottenerne i risultati.
- Quando completi un'analisi multi-agente, concludi SEMPRE con "**Prossimi passi consigliati:**" seguita da 2-3 azioni concrete prioritizzate.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🐍 ESEMPI DI INTERAZIONE CON LE SANDBOX (PYTHON / TYPESCRIPT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Esempio 1: Calcolo di proiezione finanziaria con Python**
*Utente:* "Quale sarà il nostro fatturato tra 3 anni se cresciamo del 15% ogni trimestre partendo da un MRR di $10.000?"
*CoFounder (Invocazione Tool):* Chiamata a \`runPythonScript\` con parametro \`code\`:
\`\`\`python
mrr = 10000
growth_rate = 0.15
quarters = 3 * 4
final_mrr = mrr * ((1 + growth_rate) ** quarters)
arr = final_mrr * 12
print(f"MRR Finale: {final_mrr:.2f}")
print(f"ARR Finale: {arr:.2f}")
\`\`\`
*Risposta del Tool:* "MRR Finale: 53502.50\nARR Finale: 642030.00"
*CoFounder (Risposta all'utente):* "Ho simulato la crescita composta del fatturato nella mia sandbox locale. Con una crescita costante del 15% a trimestre, partendo da un MRR di $10.000, le proiezioni indicano che tra 3 anni avremo:
- **MRR Finale:** $53.502,50 (rispetto ai $10.000 attuali)
- **ARR Finale:** $642.030,00

Questo rappresenta un incremento complessivo del fatturato del 435%."

**Esempio 2: Simulazione Monte Carlo con Python**
*Utente:* "Fai una simulazione Monte Carlo su 1000 iterazioni della nostra runway attuale sapendo che le spese oscillano tra 8k e 12k al mese e abbiamo 100k di cassa."
*CoFounder (Invocazione Tool):* Chiamata a \`runPythonScript\` con parametro \`code\`:
\`\`\`python
import random
cassa = 100000
simulations = 1000
results = []
for _ in range(simulations):
    temp_cassa = cassa
    months = 0
    while temp_cassa > 0:
        spesa = random.uniform(8000, 12000)
        temp_cassa -= spesa
        if temp_cassa > 0:
            months += 1
    results.append(months)
avg_runway = sum(results) / len(results)
min_runway = min(results)
max_runway = max(results)
print(f"Avg: {avg_runway:.1f}, Min: {min_runway}, Max: {max_runway}")
\`\`\`
*Risposta del Tool:* "Avg: 10.0, Min: 8, Max: 12"
*CoFounder (Risposta all'utente):* "Ho effettuato una simulazione Monte Carlo con 1.000 iterazioni nella sandbox backend per valutare la volatilità della runway. Con $100.000 in cassa e spese variabili stimate tra $8.000 e $12.000 al mese, i risultati mostrano:
- **Runway Media:** **10,0 mesi**
- **Scenario Peggiore (Spese massime):** **8 mesi** di operatività
- **Scenario Migliore (Spese minime):** **12 mesi** di operatività

Consiglio di stabilizzare le spese mensili sotto i $9.500 per garantire con certezza almeno 10 mesi di runway."

**Esempio 3: Prioritizzazione RICE con TypeScript**
*Utente:* "Scrivimi uno script TypeScript che implementa l'algoritmo di prioritizzazione RICE per le nuove funzionalità di un prodotto. Crea una classe BacklogManager, inserisci 3 feature d'esempio e stampa in console la lista ordinata per punteggio RICE."
*CoFounder (Invocazione Tool):* Chiamata a \`runTypeScriptScript\` con parametro \`code\`:
\`\`\`typescript
// rice-prioritization.ts
class Feature {
  name: string;
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  riceScore: number;

  constructor(name: string, reach: number, impact: number, confidence: number, effort: number) {
    this.name = name;
    this.reach = reach;
    this.impact = impact;
    this.confidence = confidence;
    this.effort = effort;
    this.riceScore = (reach * impact * confidence) / effort;
  }
}

class BacklogManager {
  features: Feature[] = [];

  addFeature(name: string, r: number, i: number, c: number, e: number) {
    this.features.push(new Feature(name, r, i, c, e));
  }

  print() {
    const sorted = [...this.features].sort((a, b) => b.riceScore - a.riceScore);
    sorted.forEach((f, idx) => {
      console.log(\`\${idx + 1}. \${f.name}: \${f.riceScore.toFixed(2)}\`);
    });
  }
}

const manager = new BacklogManager();
manager.addFeature("Social Login", 50000, 2, 0.9, 3);
manager.addFeature("Dashboard Avanzata", 10000, 3, 0.7, 5);
manager.addFeature("Ottimizzazione Form", 100000, 1, 0.85, 1);
manager.print();
\`\`\`
*Risposta del Tool:* "1. Ottimizzazione Form: 85000.00\n2. Social Login: 30000.00\n3. Dashboard Avanzata: 4200.00"
*CoFounder (Risposta all'utente):* "Ho implementato l'algoritmo di prioritizzazione RICE in TypeScript ed eseguito la prioritizzazione delle tue 3 funzionalità d'esempio nella sandbox backend. Ecco l'ordine di priorità risultante dall'esecuzione:

1. **Ottimizzazione Form** (RICE Score: **85.000,00**)
2. **Social Login** (RICE Score: **30.000,00**)
3. **Dashboard Avanzata** (RICE Score: **4.200,00**)

Ho anche creato e caricato lo script completo \`rice-prioritization.ts\` nel tuo Workspace a destra, così puoi visualizzarlo, modificarlo ed eseguirlo interattivamente in qualsiasi momento."

\`\`\`typescript
// rice-prioritization.ts
class Feature {
  name: string;
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  riceScore: number;

  constructor(name: string, reach: number, impact: number, confidence: number, effort: number) {
    this.name = name;
    this.reach = reach;
    this.impact = impact;
    this.confidence = confidence;
    this.effort = effort;
    this.riceScore = (reach * impact * confidence) / effort;
  }
}

class BacklogManager {
  features: Feature[] = [];

  addFeature(name: string, r: number, i: number, c: number, e: number) {
    this.features.push(new Feature(name, r, i, c, e));
  }

  print() {
    const sorted = [...this.features].sort((a, b) => b.riceScore - a.riceScore);
    sorted.forEach((f, idx) => {
      console.log(\`\${idx + 1}. \${f.name} - RICE Score: \${f.riceScore.toFixed(2)}\`);
    });
  }
}

const manager = new BacklogManager();
manager.addFeature("Social Login", 50000, 2, 0.9, 3);
manager.addFeature("Dashboard Avanzata", 10000, 3, 0.7, 5);
manager.addFeature("Ottimizzazione Form", 100000, 1, 0.85, 1);
manager.print();
\`\`\`
`;

        let apiMessages: any[] = [{ role: "system", content: systemPrompt + mnemosyneContext + storiesContext }, ...messages];
        const executedTools: any[] = [];
        const delegations: any[] = [];
        let agentSuggestion: any = null;
        let loopCount = 0;
        let keepRunning = true;
        let finalContent = "";
        const modelToUse = modelId || "openrouter/owl-alpha";

        while (keepRunning && loopCount < 90) {
          loopCount++;

          const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://agentfoundry.ai",
              "X-Title": "AgentFoundry coFounder Orchestrator"
            },
            body: JSON.stringify({
              model: modelToUse,
              messages: apiMessages,
              tools: TOOLS,
              tool_choice: "auto",
              stream: true,
              max_tokens: 4000,
            })
          });

          if (!openRouterRes.ok) {
            const err = await openRouterRes.text();
            push("error", `OpenRouter error: ${openRouterRes.status} - ${err}`);
            break;
          }

          const reader = openRouterRes.body?.getReader();
          const decoder = new TextDecoder();
          let done = false;
          let currentAssistantText = "";
          let reasoningText = "";
          let toolCalls: any[] = [];
          let buffer = "";
          let isBufferingThought = false;
          let streamTextBuffer = "";

          while (!done && reader) {
            const { value, done: doneReading } = await reader.read();
            done = doneReading;
            if (done) break;

            buffer += decoder.decode(value, { stream: !done });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const cleanLine = line.trim();
              if (!cleanLine) continue;
              if (cleanLine === "data: [DONE]") {
                done = true;
                break;
              }
              if (cleanLine.startsWith("data: ")) {
                try {
                  const parsed = JSON.parse(cleanLine.substring(6));
                  const delta = parsed.choices?.[0]?.delta;
                  if (!delta) continue;

                  // Reasoning content
                  if (delta.reasoning_content || delta.reasoning) {
                    const rChunk = delta.reasoning_content || delta.reasoning;
                    reasoningText += rChunk;
                    push("thinking", rChunk);
                  }

                  // Tool Call Content
                  if (delta.tool_calls && delta.tool_calls.length > 0) {
                    for (const tc of delta.tool_calls) {
                      const idx = tc.index ?? 0;
                      if (!toolCalls[idx]) {
                        toolCalls[idx] = {
                          id: "",
                          type: "function",
                          function: { name: "", arguments: "" }
                        };
                      }
                      if (tc.id) toolCalls[idx].id = tc.id;
                      if (tc.function?.name) toolCalls[idx].function.name = tc.function.name;
                      if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
                    }
                  }

                  // Standard Text Content
                  if (delta.content) {
                    const text = delta.content;
                    streamTextBuffer += text;

                    let changed = true;
                    while (changed) {
                      changed = false;
                      if (isBufferingThought) {
                        const endIdx = streamTextBuffer.indexOf("</thought>");
                        if (endIdx !== -1) {
                          const thoughtText = streamTextBuffer.substring(0, endIdx);
                          reasoningText += thoughtText;
                          push("thinking", thoughtText);
                          streamTextBuffer = streamTextBuffer.substring(endIdx + 10);
                          isBufferingThought = false;
                          changed = true;
                        } else {
                          const holdBack = 9; // length of </thought> - 1
                          if (streamTextBuffer.length > holdBack) {
                            const thoughtText = streamTextBuffer.substring(0, streamTextBuffer.length - holdBack);
                            reasoningText += thoughtText;
                            push("thinking", thoughtText);
                            streamTextBuffer = streamTextBuffer.substring(streamTextBuffer.length - holdBack);
                          }
                        }
                      } else {
                        const startIdx = streamTextBuffer.indexOf("<thought>");
                        if (startIdx !== -1) {
                          const textBefore = streamTextBuffer.substring(0, startIdx);
                          if (textBefore) {
                            currentAssistantText += textBefore;
                            push("content", textBefore);
                          }
                          streamTextBuffer = streamTextBuffer.substring(startIdx + 9);
                          isBufferingThought = true;
                          changed = true;
                        } else {
                          // Check for partial prefix
                          let matchedPrefixLength = 0;
                          const targetPrefix = "<thought>";
                          for (let len = Math.min(targetPrefix.length - 1, streamTextBuffer.length); len > 0; len--) {
                            const suffix = streamTextBuffer.substring(streamTextBuffer.length - len);
                            const prefix = targetPrefix.substring(0, len);
                            if (suffix === prefix) {
                              matchedPrefixLength = len;
                              break;
                            }
                          }
                          if (matchedPrefixLength > 0) {
                            const textBefore = streamTextBuffer.substring(0, streamTextBuffer.length - matchedPrefixLength);
                            if (textBefore) {
                              currentAssistantText += textBefore;
                              push("content", textBefore);
                            }
                            streamTextBuffer = streamTextBuffer.substring(streamTextBuffer.length - matchedPrefixLength);
                          } else {
                            currentAssistantText += streamTextBuffer;
                            push("content", streamTextBuffer);
                            streamTextBuffer = "";
                          }
                        }
                      }
                    }
                  }
                } catch (e) {
                  // Partial JSON chunk
                }
              }
            }
          }

          if (streamTextBuffer) {
            if (isBufferingThought || streamTextBuffer.includes("<thought>")) {
              let thoughtText = streamTextBuffer;
              if (thoughtText.startsWith("<thought>")) {
                thoughtText = thoughtText.substring(9);
              }
              if (thoughtText.endsWith("</thought>")) {
                thoughtText = thoughtText.substring(0, thoughtText.length - 10);
              }
              reasoningText += thoughtText;
              push("thinking", thoughtText);
            } else {
              currentAssistantText += streamTextBuffer;
              push("content", streamTextBuffer);
            }
            streamTextBuffer = "";
          }

          const activeToolCalls = toolCalls.filter(tc => tc && tc.function && tc.function.name);

          if (activeToolCalls.length > 0) {
            apiMessages.push({
              role: "assistant",
              content: currentAssistantText || null,
              tool_calls: activeToolCalls
            });

            for (const tc of activeToolCalls) {
              const functionName = tc.function.name;
              const args = JSON.parse(tc.function.arguments || "{}");
              let result: any = null;

              // ── Streamed status for each tool ──
              if (functionName === "delegateToAgent") {
                const agentLabel = AGENT_LABELS[args.agentType] || args.agentType;
                push("delegating", { agentType: args.agentType, agentLabel, task: args.task, status: "running" });

                const startTime = Date.now();
                const delegationResult = await callAgentInternal(args.agentType, args.task, args.context || "", startup);
                const duration = ((Date.now() - startTime) / 1000).toFixed(1);

                const delegation = {
                  agentType: args.agentType, agentLabel,
                  task: args.task, context: args.context || "",
                  response: delegationResult.response,
                  success: delegationResult.success, duration,
                  visibleToUser: args.visibleToUser ?? false,
                };
                delegations.push(delegation);

                push("delegation_done", delegation);

                result = { agentType: args.agentType, task: args.task, response: delegationResult.response, success: delegationResult.success };
                executedTools.push({ name: functionName, success: delegationResult.success, details: `${agentLabel} completato in ${duration}s`, arguments: args, result });

              } else if (functionName === "suggestCreateAgent") {
                agentSuggestion = { agentType: args.agentType, reason: args.reason, agentName: args.agentName || args.name, agentLabel: AGENT_LABELS[args.agentType] || args.agentType };
                push("agent_suggestion", agentSuggestion);
                result = { status: "suggestion_sent_to_user", message: `Proposta inviata: ${args.agentName || args.name}` };
                executedTools.push({ name: functionName, success: true, details: `Suggerita creazione: ${args.agentName || args.name}`, arguments: args, result });

              } else if (functionName === "getStartupInfo") {
                push("tool_start", { name: functionName, label: "Caricamento info startup..." });
                const freshStartup = await supabaseFetch(`/Startup?id=eq.${startupId}&select=*`);
                result = freshStartup?.[0] || startup;
                executedTools.push({ name: functionName, success: true, details: "Info startup caricate.", arguments: args, result });

              } else if (functionName === "getActiveAgents") {
                push("tool_start", { name: functionName, label: "Controllo agenti del team..." });
                const agents = await supabaseFetch(`/AgentConfig?startupId=eq.${startupId}&select=id,name,type,isActive`);
                result = agents || [];
                executedTools.push({ name: functionName, success: true, details: `${result.length} agenti trovati.`, arguments: args, result });

              } else if (functionName === "updateStartupMetrics") {
                const payload: any = {};
                if (typeof args.mrr === "number") payload.mrr = args.mrr;
                if (typeof args.users === "number") payload.users = args.users;
                if (typeof args.burnRate === "number") payload.burnRate = args.burnRate;
                if (typeof args.runway === "number") payload.runway = args.runway;
                const updated = await supabaseFetch(`/Startup?id=eq.${startupId}`, { method: "PATCH", body: JSON.stringify(payload) });
                result = updated?.[0] || { success: true };
                executedTools.push({ name: functionName, success: true, details: "Metriche aggiornate.", arguments: args, result });

              } else if (functionName === "createAgent") {
                const settingsPayload: any = {};
                if (args.systemPrompt) settingsPayload.systemPrompt = args.systemPrompt;
                if (args.persona) settingsPayload.persona = args.persona;
                if (args.expertise) settingsPayload.expertise = args.expertise;

                const newAgent = await supabaseFetch(`/AgentConfig`, {
                  method: "POST",
                  body: JSON.stringify({
                    startupId,
                    type: args.type.toLowerCase(),
                    name: args.name,
                    isActive: true,
                    settings: settingsPayload
                  })
                });
                result = newAgent?.[0] || { success: true };
                executedTools.push({ name: functionName, success: true, details: `Agente creato: ${args.name} con impostazioni avanzate.`, arguments: args, result });

              } else if (functionName === "deleteAgent") {
                push("tool_start", { name: functionName, label: `Eliminazione agente: ${args.agentId}` });
                await supabaseFetch(`/AgentConfig?id=eq.${args.agentId}`, { method: "DELETE" });
                result = { success: true, message: `Agente con ID ${args.agentId} eliminato con successo.` };
                executedTools.push({ name: functionName, success: true, details: `Agente ${args.agentId} eliminato.`, arguments: args, result });

              } else if (functionName === "addCustomMetric") {
                const current = await getMetricsData();
                const newMetric = {
                  id: "metric-custom-" + Date.now(), title: args.title, value: args.value,
                  type: args.type || "integer", chartType: args.chartType || "value",
                  formula: args.formula || "", data: Array.isArray(args.data) ? args.data : [],
                  labels: Array.isArray(args.labels) ? args.labels : [],
                  apiEndpoint: null, isDefault: false, createdAt: new Date().toISOString()
                };
                current.push(newMetric);
                await saveMetricsData(current);
                result = newMetric;
                executedTools.push({ name: functionName, success: true, details: `Metrica creata: "${args.title}"`, arguments: args, result });

              } else if (functionName === "updateCustomMetric") {
                const current = await getMetricsData();
                const idx = current.findIndex((m: any) => m.id === args.id);
                if (idx === -1) throw new Error(`Metrica ${args.id} non trovata`);
                current[idx] = { ...current[idx], ...(args.title && { title: args.title }), ...(args.value && { value: args.value }), ...(args.chartType && { chartType: args.chartType }), ...(args.data && { data: args.data }), ...(args.labels && { labels: args.labels }), ...(args.formula && { formula: args.formula }) };
                await saveMetricsData(current);
                result = current[idx];
                executedTools.push({ name: functionName, success: true, details: `Metrica "${result.title}" aggiornata.`, arguments: args, result });

              } else if (functionName === "deleteCustomMetric") {
                const current = await getMetricsData();
                const filtered = current.filter((m: any) => m.id !== args.id);
                await saveMetricsData(filtered);
                result = { success: true };
                executedTools.push({ name: functionName, success: true, details: `Metrica ${args.id} rimossa.`, arguments: args, result });

              } else if (functionName === "getCustomConnections") {
                result = await getConnectionsData();
                executedTools.push({ name: functionName, success: true, details: `${result.length} connessioni.`, arguments: args, result });

              } else if (functionName === "addCustomConnection") {
                const current = await getConnectionsData();
                const newConn = {
                  id: "conn-" + Date.now(), name: args.name, url: args.url,
                  method: args.method || "GET", headers: args.headers || {}, body: args.bodyPayload || null,
                  targetMetric: args.targetMetric, jsonPath: args.jsonPath || "",
                  responseType: args.responseType || "json",
                  timeout: typeof args.timeout === "number" ? args.timeout : 5000,
                  isActive: true, createdAt: new Date().toISOString()
                };
                current.push(newConn);
                await saveConnectionsData(current);
                result = newConn;
                executedTools.push({ name: functionName, success: true, details: `Connessione "${args.name}" creata.`, arguments: args, result });

              } else if (functionName === "updateCustomConnection") {
                const current = await getConnectionsData();
                const idx = current.findIndex((c: any) => c.id === args.id);
                if (idx === -1) throw new Error(`Connessione ${args.id} non trovata`);
                current[idx] = { ...current[idx], ...(args.name && { name: args.name }), ...(args.url && { url: args.url }), ...(args.method && { method: args.method }), ...(args.isActive !== undefined && { isActive: args.isActive }) };
                await saveConnectionsData(current);
                result = current[idx];
                executedTools.push({ name: functionName, success: true, details: `Connessione "${result.name}" aggiornata.`, arguments: args, result });

              } else if (functionName === "deleteCustomConnection") {
                const current = await getConnectionsData();
                await saveConnectionsData(current.filter((c: any) => c.id !== args.id));
                result = { success: true };
                executedTools.push({ name: functionName, success: true, details: `Connessione ${args.id} rimossa.`, arguments: args, result });

              } else if (functionName === "webSearch") {
                push("tool_start", { name: functionName, label: `Ricerca: "${args.query}"` });
                if (settings?.useTavily) {
                  const tavilyKey = await getApiKey("tavily");
                  if (tavilyKey) {
                    try {
                      result = await searchTavily(args.query, tavilyKey);
                      executedTools.push({ name: functionName, success: true, details: `Ricerca Tavily "${args.query}" completata.`, arguments: args, result });
                    } catch (e: any) {
                      push("debug", `⚠️ Errore Tavily, fallback su DuckDuckGo: ${e.message}`);
                      result = await searchWeb(args.query);
                      executedTools.push({ name: functionName, success: true, details: `Ricerca fallback "${args.query}" completata.`, arguments: args, result });
                    }
                  } else {
                    push("debug", "⚠️ Tavily abilitato ma chiave non configurata, fallback su DuckDuckGo");
                    result = await searchWeb(args.query);
                    executedTools.push({ name: functionName, success: true, details: `Ricerca fallback "${args.query}" completata.`, arguments: args, result });
                  }
                } else {
                  result = await searchWeb(args.query);
                  executedTools.push({ name: functionName, success: true, details: `Ricerca "${args.query}" completata.`, arguments: args, result });
                }

              } else if (functionName === "getCustomMetrics") {
                result = await getMetricsData();
                executedTools.push({ name: functionName, success: true, details: `${result.length} metriche.`, arguments: args, result });

              } else if (functionName === "readWebPage") {
                push("tool_start", { name: functionName, label: `Lettura: ${args.url}` });
                result = await readWebPage(args.url);
                executedTools.push({ name: functionName, success: true, details: `Pagina letta: "${args.url}"`, arguments: args, result });

              } else if (functionName === "runPythonScript") {
                push("tool_start", { name: functionName, label: "Esecuzione script Python..." });
                result = await executePython(args.code);
                executedTools.push({ name: functionName, success: true, details: `Esecuzione Python completata.`, arguments: args, result });

              } else if (functionName === "runTypeScriptScript") {
                push("tool_start", { name: functionName, label: "Esecuzione script TypeScript..." });
                result = await executeTypeScript(args.code);
                executedTools.push({ name: functionName, success: true, details: `Esecuzione TypeScript completata.`, arguments: args, result });

              } else if (functionName === "createOrUpdateArtifact") {
                push("tool_start", { name: functionName, label: `Salvataggio artefatto: ${args.filename}...` });
                const currentArtifacts = await getArtifacts();
                const artId = args.id || "art-" + Date.now();
                let target = currentArtifacts.find((a: any) => a.id === artId);
                let logs: string[] = [];

                if (args.type === "code") {
                  const l = args.language.toLowerCase();
                  if (l === "python" || l === "py") {
                    logs.push(`> [${new Date().toLocaleTimeString()}] Esecuzione automatica script Python...`);
                    const runOut = await executePython(args.code);
                    logs.push(runOut);
                  } else if (l === "javascript" || l === "typescript" || l === "js" || l === "ts") {
                    logs.push(`> [${new Date().toLocaleTimeString()}] Esecuzione automatica script TypeScript...`);
                    const runOut = await executeTypeScript(args.code);
                    logs.push(runOut);
                  }
                }

                if (target) {
                  target.title = args.title || target.title;
                  target.filename = args.filename || target.filename;
                  target.code = args.code || target.code;
                  target.language = args.language || target.language;
                  target.type = args.type || target.type;
                  if (logs.length > 0) target.logs = logs;
                  target.updatedAt = new Date().toISOString();
                  if (discussionId) {
                    target.discussionId = discussionId;
                  }
                } else {
                  target = {
                    id: artId,
                    title: args.title,
                    filename: args.filename,
                    code: args.code,
                    language: args.language,
                    type: args.type,
                    logs: logs,
                    discussionId: discussionId || undefined,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  };
                  currentArtifacts.push(target);
                }
                await saveArtifacts(currentArtifacts);
                result = { success: true, artifact: target };
                executedTools.push({ name: functionName, success: true, details: `Artefatto "${args.filename}" salvato ed eseguito.`, arguments: args, result });

              } else if (functionName === "runArtifact") {
                push("tool_start", { name: functionName, label: `Esecuzione artefatto...` });
                const currentArtifacts = await getArtifacts();
                const target = currentArtifacts.find((a: any) => a.id === args.artifactId);
                if (!target) {
                  result = { error: `Artefatto con ID ${args.artifactId} non trovato.` };
                  executedTools.push({ name: functionName, success: false, details: `Artefatto ${args.artifactId} non trovato.`, arguments: args, result });
                } else {
                  let logs: string[] = [];
                  const timestamp = new Date().toLocaleTimeString();
                  logs.push(`> [${timestamp}] Esecuzione manuale di ${target.filename}...`);
                  const l = target.language.toLowerCase();
                  if (l === "python" || l === "py") {
                    const runOut = await executePython(target.code);
                    logs.push(runOut);
                  } else if (l === "javascript" || l === "typescript" || l === "js" || l === "ts") {
                    const runOut = await executeTypeScript(target.code);
                    logs.push(runOut);
                  } else {
                    logs.push(`[System] Esecuzione non supportata per il linguaggio ${target.language}`);
                  }
                  logs.push(`> [${new Date().toLocaleTimeString()}] Esecuzione terminata.`);
                  target.logs = logs;
                  target.updatedAt = new Date().toISOString();
                  await saveArtifacts(currentArtifacts);
                  result = { success: true, logs, artifact: target };
                  executedTools.push({ name: functionName, success: true, details: `Artefatto "${target.filename}" eseguito.`, arguments: args, result });
                }

              } else if (functionName === "renameDiscussion") {
                push("tool_start", { name: functionName, label: `Rinomino discussione in: "${args.title}"...` });
                push("rename_discussion", { title: args.title });
                result = { success: true, title: args.title };
                executedTools.push({ name: functionName, success: true, details: `Conversazione rinominata in "${args.title}"`, arguments: args, result });

              } else if (functionName === "getActiveArtifacts") {
                push("tool_start", { name: functionName, label: `Controllo workspace...` });
                const allArtifacts = await getArtifacts();
                result = discussionId
                  ? allArtifacts.filter((a: any) => a.discussionId === discussionId)
                  : allArtifacts;
                executedTools.push({ name: functionName, success: true, details: `${result.length} artefatti attivi trovati.`, arguments: args, result });

              } else {
                result = { error: "Unknown function" };
              }

              apiMessages.push({ role: "tool", tool_call_id: tc.id, name: functionName, content: JSON.stringify(result) });
            }

          } else {
            finalContent = currentAssistantText;
            keepRunning = false;
          }
        }

        // Auto extract memories in background (Mnemosyne)
        if (cofounderConfig && userMessage && finalContent) {
          autoExtractMemories(cofounderConfig.id, userMessage, finalContent)
            .then(extracted => {
              console.log(`[Mnemosyne cofounder] Extracted ${extracted.length} memories.`);
            })
            .catch(err => {
              console.error("[Mnemosyne cofounder] Error in background extraction:", err.message);
            });
        }

        push("done", { content: finalContent, executedTools, delegations, agentSuggestion });
        if (!closed) {
          closed = true;
          try { controller.close(); } catch {}
        }

      } catch (err: any) {
        console.error("coFounder Orchestrator Stream Error:", err);
        push("error", err.message);
        if (!closed) {
          closed = true;
          try { controller.close(); } catch {}
        }
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    }
  });
}
