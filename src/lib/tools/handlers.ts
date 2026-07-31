import { registry } from "./registry";
import { promises as fs } from "fs";
import * as path from "path";
import { getApiKey } from "@/lib/secure-store";
import { getArtifacts, saveArtifacts } from "@/lib/custom-artifacts";
import { executePython, executeTypeScript } from "@/lib/sandbox-runner";
import { searchWeb, searchTavily, readWebPage, batchSearch, readWebPageDeep } from "./web-utils";
import { runAgentTraining } from "../agents/trainer";
import { getUpcomingCalendarEvents, createGoogleCalendarEvent } from "@/lib/connectors/gcal";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const METRICS_FILE_PATH = path.join(process.cwd(), "src/lib/custom-metrics.json");
const CONNECTIONS_FILE_PATH = path.join(process.cwd(), "src/lib/custom-connections.json");

const supabaseHeaders = {
  "apikey": SUPABASE_SERVICE_KEY,
  "Authorization": "Bearer " + SUPABASE_SERVICE_KEY,
  "Content-Type": "application/json",
  "Prefer": "return=representation",
};

async function supabaseFetch(pathStr: string, options: any = {}) {
  const url = `${SUPABASE_URL}/rest/v1${pathStr}`;
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

async function callAgentInternal(agentType: string, task: string, context: string, startup: any, modelId?: string): Promise<{ response: string; success: boolean }> {
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

    const fallbackModels = [
      modelId,
      "openrouter/free"
    ].filter((m): m is string => !!m);

    const uniqueModels = Array.from(new Set(fallbackModels));
    let lastError = "";

    for (const currentModel of uniqueModels) {
      try {
        let res: Response | null = null;
        let retryCount = 0;
        const maxRetries = 2;
        let delay = 500;

        while (retryCount < maxRetries) {
          try {
            res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://agentfoundry.ai",
                "X-Title": "AgentFoundry Internal Delegation"
              },
              body: JSON.stringify({
                model: currentModel,
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: task }
                ],
                temperature: 0.7,
                max_tokens: 1024,
              })
            });
            if (res.ok) break;
          } catch {}
          retryCount++;
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

        if (res && res.ok) {
          const data = await res.json();
          if (data.error) {
            lastError = `Model ${currentModel} returned error: ${data.error.message || JSON.stringify(data.error)}`;
            continue;
          }
          const content = data.choices?.[0]?.message?.content;
          if (content && content.trim().length > 0) {
            return { response: content, success: true };
          } else {
            lastError = `Model ${currentModel} returned empty response.`;
            continue;
          }
        } else {
          lastError = `Model ${currentModel} failed with status ${res ? res.status : "unknown"}.`;
        }
      } catch (err: any) {
        lastError = `Model ${currentModel} throwed: ${err.message}`;
      }
    }

    return { response: `Errore di delega. Ultimo errore: ${lastError}`, success: false };
  } catch (err: any) {
    return { response: `Errore delegatore: ${err.message}`, success: false };
  }
}

const AGENT_LABELS: Record<string, string> = {
  strategy: "Strategy Agent", tech: "Tech Agent", finance: "Finance Agent",
  marketing: "Marketing Agent", legal: "Legal Agent", operations: "Operations Agent",
};

// 1. delegateToAgent
registry.register({
  name: "delegateToAgent",
  emoji: "🤝",
  schema: {
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
  handler: async (args, context) => {
    const agentLabel = AGENT_LABELS[args.agentType] || args.agentType;
    if (context.push) {
      context.push("delegating", { agentType: args.agentType, agentLabel, task: args.task, status: "running" });
    }

    const startTime = Date.now();
    const delegationResult = await callAgentInternal(args.agentType, args.task, args.context || "", context.startup, context.modelId);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    const delegation = {
      agentType: args.agentType, agentLabel,
      task: args.task, context: args.context || "",
      response: delegationResult.response,
      success: delegationResult.success, duration,
      visibleToUser: args.visibleToUser ?? false,
    };
    if (context.delegations) {
      context.delegations.push(delegation);
    }
    if (context.push) {
      context.push("delegation_done", delegation);
    }

    const result = { agentType: args.agentType, task: args.task, response: delegationResult.response, success: delegationResult.success };
    return { result, success: delegationResult.success, details: `${agentLabel} completato in ${duration}s` };
  }
});

// 2. suggestCreateAgent
registry.register({
  name: "suggestCreateAgent",
  emoji: "💡",
  schema: {
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
  handler: async (args, context) => {
    const agentSuggestion = {
      agentType: args.agentType,
      reason: args.reason,
      agentName: args.agentName || args.name,
      agentLabel: AGENT_LABELS[args.agentType] || args.agentType
    };
    if (context.setAgentSuggestion) {
      context.setAgentSuggestion(agentSuggestion);
    }
    if (context.push) {
      context.push("agent_suggestion", agentSuggestion);
    }
    const result = { status: "suggestion_sent_to_user", message: `Proposta inviata: ${args.agentName || args.name}` };
    return { result, success: true, details: `Suggerita creazione: ${args.agentName || args.name}` };
  }
});

// 3. getStartupInfo
registry.register({
  name: "getStartupInfo",
  emoji: "ℹ️",
  schema: {
    type: "function",
    function: { name: "getStartupInfo", description: "Recupera info e metriche finanziarie della startup.", parameters: { type: "object", properties: {} } }
  },
  handler: async (args, context) => {
    if (context.push) {
      context.push("tool_start", { name: "getStartupInfo", label: "Caricamento info startup..." });
    }
    const freshStartup = await supabaseFetch(`/Startup?id=eq.${context.startupId}&select=*`);
    const result = freshStartup?.[0] || context.startup;
    return { result, success: true, details: "Info startup caricate." };
  }
});

// 4. getActiveAgents
registry.register({
  name: "getActiveAgents",
  emoji: "👥",
  schema: {
    type: "function",
    function: {
      name: "getActiveAgents",
      description: "Recupera l'elenco degli agenti AI configurati. Usa SEMPRE prima di delegare o suggerire nuovi agenti.",
      parameters: { type: "object", properties: {} }
    }
  },
  handler: async (args, context) => {
    if (context.push) {
      context.push("tool_start", { name: "getActiveAgents", label: "Controllo agenti del team..." });
    }
    const agents = await supabaseFetch(`/AgentConfig?startupId=eq.${context.startupId}&select=id,name,type,isActive`);
    const result = agents || [];
    return { result, success: true, details: `${result.length} agenti trovati.` };
  }
});

// 5. updateStartupMetrics
registry.register({
  name: "updateStartupMetrics",
  emoji: "📊",
  schema: {
    type: "function",
    function: {
      name: "updateStartupMetrics",
      description: "Aggiorna metriche della startup (mrr, users, burnRate, runway).",
      parameters: { type: "object", properties: { mrr: { type: "number" }, users: { type: "number" }, burnRate: { type: "number" }, runway: { type: "number" } } }
    }
  },
  handler: async (args, context) => {
    const payload: any = {};
    if (typeof args.mrr === "number") payload.mrr = args.mrr;
    if (typeof args.users === "number") payload.users = args.users;
    if (typeof args.burnRate === "number") payload.burnRate = args.burnRate;
    if (typeof args.runway === "number") payload.runway = args.runway;
    const updated = await supabaseFetch(`/Startup?id=eq.${context.startupId}`, { method: "PATCH", body: JSON.stringify(payload) });
    const result = updated?.[0] || { success: true };
    return { result, success: true, details: "Metriche aggiornate." };
  }
});

// 6. createAgent
registry.register({
  name: "createAgent",
  emoji: "➕",
  schema: {
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
          expertise: { type: "string", description: "Elenco di competenze chiave (es: ' fundraising, unit economics')." },
          autoTrain: { type: "boolean", description: "Se true, dopo la creazione avvia automaticamente il training con ricerca web profonda sull'expertise specificata." }
        },
        required: ["name", "type"]
      }
    }
  },
  handler: async (args, context) => {
    const settingsPayload: any = {
      enabledTools: ["get_knowledge_pattern_details", "webSearch", "getStartupInfo", "getCustomMetrics", "readWebPage"]
    };
    if (args.systemPrompt) settingsPayload.systemPrompt = args.systemPrompt;
    if (args.persona) settingsPayload.persona = args.persona;
    if (args.expertise) settingsPayload.expertise = args.expertise;

    const newAgent = await supabaseFetch(`/AgentConfig`, {
      method: "POST",
      body: JSON.stringify({
        startupId: context.startupId,
        type: args.type.toLowerCase(),
        name: args.name,
        isActive: true,
        settings: settingsPayload
      })
    });
    
    const agent = newAgent?.[0];
    if (!agent) {
      throw new Error("Impossibile creare l'agente specializzato.");
    }

    let trainingStarted = false;
    if (args.autoTrain && args.expertise) {
      trainingStarted = true;
      if (context.push) {
        context.push("debug", `🧠 [Training] Avvio addestramento automatico in background per l'agente ${args.name}...`);
      }
      // Eseguiamo in background senza attendere il completamento sincrono
      runAgentTraining(agent.id, args.expertise, args.name, args.type, context.modelId || "openrouter/free", (event) => {
        if (context.push) {
          if (event.type === "phase") {
            context.push("debug", `🧠 [Training - ${args.name}] Stato: ${event.message}`);
          } else if (event.type === "testing_done") {
            context.push("debug", `🧪 [Training - ${args.name}] Test identità: ${event.message}`);
          } else if (event.type === "done") {
            context.push("debug", `✅ [Training - ${args.name}] Addestramento completato con successo!`);
          } else if (event.type === "error") {
            context.push("debug", `❌ [Training - ${args.name}] Errore: ${event.message}`);
          }
        }
      }).catch(err => {
        console.error(`Errore addestramento agente ${agent.id}:`, err);
      });
    }

    const details = trainingStarted
      ? `Agente ${args.name} creato e addestramento avviato in background.`
      : `Agente ${args.name} creato con successo.`;

    return { result: agent, success: true, details };
  }
});

// 7. deleteAgent
registry.register({
  name: "deleteAgent",
  emoji: "➖",
  schema: {
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
  handler: async (args, context) => {
    if (context.push) {
      context.push("tool_start", { name: "deleteAgent", label: `Eliminazione agente: ${args.agentId}` });
    }
    await supabaseFetch(`/AgentConfig?id=eq.${args.agentId}`, { method: "DELETE" });
    const result = { success: true, message: `Agente con ID ${args.agentId} eliminato con successo.` };
    return { result, success: true, details: `Agente ${args.agentId} eliminato.` };
  }
});

// 7.5. trainAgent
registry.register({
  name: "trainAgent",
  emoji: "🔄",
  schema: {
    type: "function",
    function: {
      name: "trainAgent",
      description: "Avvia l'addestramento (auto-training con ricerca web profonda) di un agente specializzato esistente per aggiornare o definire le sue competenze. Richiede l'ID dell'agente e l'expertise di specializzazione.",
      parameters: {
        type: "object",
        properties: {
          agentId: { type: "string", description: "L'ID dell'agente da addestrare. Usa getActiveAgents per trovarlo." },
          expertise: { type: "string", description: "L'expertise specifica da insegnare all'agente (es: 'esperto di crypto taxation e ERC20')." }
        },
        required: ["agentId", "expertise"]
      }
    }
  },
  handler: async (args, context) => {
    if (context.push) {
      context.push("tool_start", { name: "trainAgent", label: `Avvio addestramento agente...` });
    }
    const agents = await supabaseFetch(`/AgentConfig?id=eq.${args.agentId}&select=id,name,type`);
    const agent = agents?.[0];
    if (!agent) {
      throw new Error(`Agente con ID ${args.agentId} non trovato.`);
    }

    if (context.push) {
      context.push("debug", `🧠 [Training] Avvio addestramento in background per l'agente ${agent.name}...`);
    }

    // Eseguiamo in background
    runAgentTraining(agent.id, args.expertise, agent.name, agent.type, context.modelId || "openrouter/free", (event) => {
      if (context.push) {
        if (event.type === "phase") {
          context.push("debug", `🧠 [Training - ${agent.name}] Stato: ${event.message}`);
        } else if (event.type === "testing_done") {
          context.push("debug", `🧪 [Training - ${agent.name}] Test identità: ${event.message}`);
        } else if (event.type === "done") {
          context.push("debug", `✅ [Training - ${agent.name}] Addestramento completato con successo!`);
        } else if (event.type === "error") {
          context.push("debug", `❌ [Training - ${agent.name}] Errore: ${event.message}`);
        }
      }
    }).catch(err => {
      console.error(`Errore addestramento agente ${agent.id}:`, err);
    });

    const result = { success: true, message: `Addestramento avviato in background per l'agente "${agent.name}".` };
    return { result, success: true, details: `Addestramento avviato per ${agent.name}` };
  }
});

// 8. addCustomMetric
registry.register({
  name: "addCustomMetric",
  emoji: "📈",
  schema: {
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
  handler: async (args, context) => {
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
    const result = newMetric;
    return { result, success: true, details: `Metrica creata: "${args.title}"` };
  }
});

// 9. updateCustomMetric
registry.register({
  name: "updateCustomMetric",
  emoji: "✏️",
  schema: {
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
  handler: async (args, context) => {
    const current = await getMetricsData();
    const idx = current.findIndex((m: any) => m.id === args.id);
    if (idx === -1) throw new Error(`Metrica ${args.id} non trovata`);
    current[idx] = { ...current[idx], ...(args.title && { title: args.title }), ...(args.value && { value: args.value }), ...(args.chartType && { chartType: args.chartType }), ...(args.data && { data: args.data }), ...(args.labels && { labels: args.labels }), ...(args.formula && { formula: args.formula }) };
    await saveMetricsData(current);
    const result = current[idx];
    return { result, success: true, details: `Metrica "${result.title}" aggiornata.` };
  }
});

// 10. deleteCustomMetric
registry.register({
  name: "deleteCustomMetric",
  emoji: "🗑️",
  schema: {
    type: "function",
    function: {
      name: "deleteCustomMetric",
      description: "Elimina una metrica personalizzata.",
      parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }
    }
  },
  handler: async (args, context) => {
    const current = await getMetricsData();
    const filtered = current.filter((m: any) => m.id !== args.id);
    await saveMetricsData(filtered);
    const result = { success: true };
    return { result, success: true, details: `Metrica ${args.id} rimossa.` };
  }
});

// 11. getCustomConnections
registry.register({
  name: "getCustomConnections",
  emoji: "🔌",
  schema: {
    type: "function",
    function: { name: "getCustomConnections", description: "Recupera le connessioni API personalizzate.", parameters: { type: "object", properties: {} } }
  },
  handler: async (args, context) => {
    const result = await getConnectionsData();
    return { result, success: true, details: `${result.length} connessioni.` };
  }
});

// 12. addCustomConnection
registry.register({
  name: "addCustomConnection",
  emoji: "🔗",
  schema: {
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
  handler: async (args, context) => {
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
    const result = newConn;
    return { result, success: true, details: `Connessione "${args.name}" creata.` };
  }
});

// 13. updateCustomConnection
registry.register({
  name: "updateCustomConnection",
  emoji: "⚙️",
  schema: {
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
  handler: async (args, context) => {
    const current = await getConnectionsData();
    const idx = current.findIndex((c: any) => c.id === args.id);
    if (idx === -1) throw new Error(`Connessione ${args.id} non trovata`);
    current[idx] = { ...current[idx], ...(args.name && { name: args.name }), ...(args.url && { url: args.url }), ...(args.method && { method: args.method }), ...(args.isActive !== undefined && { isActive: args.isActive }) };
    await saveConnectionsData(current);
    const result = current[idx];
    return { result, success: true, details: `Connessione "${result.name}" aggiornata.` };
  }
});

// 14. deleteCustomConnection
registry.register({
  name: "deleteCustomConnection",
  emoji: "❌",
  schema: {
    type: "function",
    function: {
      name: "deleteCustomConnection",
      description: "Elimina una connessione API.",
      parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }
    }
  },
  handler: async (args, context) => {
    const current = await getConnectionsData();
    await saveConnectionsData(current.filter((c: any) => c.id !== args.id));
    const result = { success: true };
    return { result, success: true, details: `Connessione ${args.id} rimossa.` };
  }
});

// 15. webSearch
registry.register({
  name: "webSearch",
  emoji: "🔍",
  schema: {
    type: "function",
    function: {
      name: "webSearch",
      description: "Esegue una ricerca web in tempo reale tramite Tavily Search (con DuckDuckGo in fallback) per reperire informazioni aggiornate, competitor, trend e dati finanziari.",
      parameters: { type: "object", properties: { query: { type: "string", description: "La query o domanda naturale di ricerca (es: 'Competitori Notion 2026', 'Qual è la valutazione media seed AI in Italia?')." } }, required: ["query"] }
    }
  },
  handler: async (args, context) => {
    if (context.push) {
      context.push("tool_start", { name: "webSearch", label: `Ricerca: "${args.query}"` });
    }
    let result;
    let isTavily = false;
    const tavilyKey = await getApiKey("tavily");
    const useTavily = context.settings?.useTavily !== false;

    if (useTavily && tavilyKey) {
      try {
        result = await searchTavily(args.query, tavilyKey);
        isTavily = true;
      } catch (e: any) {
        if (context.push) context.push("debug", `⚠️ Errore Tavily, fallback su DuckDuckGo: ${e.message}`);
        result = await searchWeb(args.query);
      }
    } else {
      result = await searchWeb(args.query);
    }
    const details = isTavily
      ? `Ricerca Tavily "${args.query}" completata.`
      : `Ricerca "${args.query}" completata.`;
    return { result, success: true, details };
  }
});

// 16. getCustomMetrics
registry.register({
  name: "getCustomMetrics",
  emoji: "📋",
  schema: {
    type: "function",
    function: { name: "getCustomMetrics", description: "Lista metriche personalizzate della dashboard.", parameters: { type: "object", properties: {} } }
  },
  handler: async (args, context) => {
    const result = await getMetricsData();
    return { result, success: true, details: `${result.length} metriche.` };
  }
});

// 17. readWebPage
registry.register({
  name: "readWebPage",
  emoji: "📖",
  schema: {
    type: "function",
    function: {
      name: "readWebPage",
      description: "Legge il contenuto testuale di una pagina web fornendo l'URL completo.",
      parameters: { type: "object", properties: { url: { type: "string", description: "L'URL completo della pagina web da leggere." } }, required: ["url"] }
    }
  },
  handler: async (args, context) => {
    if (context.push) {
      context.push("tool_start", { name: "readWebPage", label: `Lettura: ${args.url}` });
    }
    const result = await readWebPage(args.url);
    return { result, success: true, details: `Pagina letta: "${args.url}"` };
  }
});

// 18. runPythonScript
registry.register({
  name: "runPythonScript",
  emoji: "🐍",
  schema: {
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
  handler: async (args, context) => {
    if (context.push) {
      context.push("tool_start", { name: "runPythonScript", label: "Esecuzione script Python..." });
    }
    const result = await executePython(args.code);
    return { result, success: true, details: "Esecuzione Python completata." };
  }
});

// 19. runTypeScriptScript
registry.register({
  name: "runTypeScriptScript",
  emoji: "📜",
  schema: {
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
  handler: async (args, context) => {
    if (context.push) {
      context.push("tool_start", { name: "runTypeScriptScript", label: "Esecuzione script TypeScript..." });
    }
    const result = await executeTypeScript(args.code);
    return { result, success: true, details: "Esecuzione TypeScript completata." };
  }
});

// 20. createOrUpdateArtifact
registry.register({
  name: "createOrUpdateArtifact",
  emoji: "🎨",
  schema: {
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
  handler: async (args, context) => {
    if (context.push) {
      context.push("tool_start", { name: "createOrUpdateArtifact", label: `Salvataggio artefatto: ${args.filename}...` });
    }
    const currentArtifacts = await getArtifacts();
    const artId = args.id || "art-" + Date.now();
    let target = currentArtifacts.find((a: any) => a.id === artId);
    let logs: string[] = [];

    if (args.type === "code") {
      const timestamp = new Date().toLocaleTimeString();
      logs.push(`> [${timestamp}] Compilazione automatica di ${args.filename}...`);
      const l = args.language.toLowerCase();
      if (l === "python" || l === "py") {
        const runOut = await executePython(args.code);
        logs.push(runOut);
      } else if (l === "javascript" || l === "typescript" || l === "js" || l === "ts") {
        const runOut = await executeTypeScript(args.code);
        logs.push(runOut);
      } else {
        logs.push(`[System] Compilazione non supportata per il linguaggio ${args.language}`);
      }
      logs.push(`> [${new Date().toLocaleTimeString()}] Compilazione terminata.`);
    }

    if (target) {
      target.title = args.title || target.title;
      target.filename = args.filename || target.filename;
      target.code = args.code || target.code;
      target.language = args.language || target.language;
      target.type = args.type || target.type;
      if (logs.length > 0) target.logs = logs;
      target.updatedAt = new Date().toISOString();
      if (context.discussionId) {
        target.discussionId = context.discussionId;
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
        discussionId: context.discussionId || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      currentArtifacts.push(target);
    }
    await saveArtifacts(currentArtifacts);
    const result = { success: true, artifact: target };
    return { result, success: true, details: `Artefatto "${args.filename}" salvato ed eseguito.` };
  }
});

// 21. runArtifact
registry.register({
  name: "runArtifact",
  emoji: "🚀",
  schema: {
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
  handler: async (args, context) => {
    if (context.push) {
      context.push("tool_start", { name: "runArtifact", label: `Esecuzione artefatto...` });
    }
    const currentArtifacts = await getArtifacts();
    const target = currentArtifacts.find((a: any) => a.id === args.artifactId);
    let result;
    if (!target) {
      result = { error: `Artefatto con ID ${args.artifactId} non trovato.` };
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
    }
    const success = !result.error;
    const details = result.error
      ? `Artefatto ${args.artifactId} non trovato.`
      : `Artefatto "${target!.filename}" eseguito.`;
    return { result, success, details };
  }
});

// 22. getActiveArtifacts
registry.register({
  name: "getActiveArtifacts",
  emoji: "📁",
  schema: {
    type: "function",
    function: {
      name: "getActiveArtifacts",
      description: "Recupera la lista di tutti gli artefatti salvati finora nel workspace per visualizzarne gli ID, i titoli e i codici.",
      parameters: { type: "object", properties: {} }
    }
  },
  handler: async (args, context) => {
    if (context.push) {
      context.push("tool_start", { name: "getActiveArtifacts", label: `Controllo workspace...` });
    }
    const allArtifacts = await getArtifacts();
    const result = context.discussionId
      ? allArtifacts.filter((a: any) => a.discussionId === context.discussionId)
      : allArtifacts;
    return { result, success: true, details: `${result.length} artefatti attivi trovati.` };
  }
});

// 23. renameDiscussion
registry.register({
  name: "renameDiscussion",
  emoji: "🏷️",
  schema: {
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
  },
  handler: async (args, context) => {
    if (context.push) {
      context.push("tool_start", { name: "renameDiscussion", label: `Rinomino discussione in: "${args.title}"...` });
      context.push("rename_discussion", { title: args.title });
    }
    const result = { success: true, title: args.title };
    return { result, success: true, details: `Conversazione rinominata in "${args.title}"` };
  }
});

// 24. todo
registry.register({
  name: "todo",
  emoji: "📝",
  schema: {
    type: "function",
    function: {
      name: "todo",
      description: "Gestisce la roadmap e la checklist dei task per la sessione di lavoro corrente. Permette di inizializzare, aggiornare lo stato (pending, in_progress, completed, cancelled) o aggiungere task. La lista viene mostrata in tempo reale al fondatore.",
      parameters: {
        type: "object",
        properties: {
          todos: {
            type: "array",
            description: "Lista di compiti da aggiungere, inizializzare o aggiornare.",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "ID univoco del task (es. 'task-1', 'task-2')." },
                content: { type: "string", description: "La descrizione del compito (es. 'Analisi di mercato')." },
                status: { type: "string", enum: ["pending", "in_progress", "completed", "cancelled"], description: "Stato corrente del task." }
              },
              required: ["id"]
            }
          },
          action: {
            type: "string",
            enum: ["initialize", "update", "add"],
            description: "L'operazione da eseguire: 'initialize' sovrascrive l'intera lista; 'update' aggiorna i task con ID corrispondenti; 'add' aggiunge nuovi task senza cancellare gli esistenti."
          }
        },
        required: ["todos"]
      }
    }
  },
  handler: async (args, context) => {
    const action = args.action || "update";
    let updatedTodos = [...context.todos];
    const incoming = args.todos || [];

    if (action === "initialize") {
      updatedTodos = incoming.map((t: any) => ({
        id: t.id,
        content: t.content || "",
        status: t.status || "pending"
      }));
    } else if (action === "add") {
      for (const t of incoming) {
        if (!updatedTodos.some((x: any) => x.id === t.id)) {
          updatedTodos.push({
            id: t.id,
            content: t.content || "",
            status: t.status || "pending"
          });
        }
      }
    } else { // "update"
      for (const t of incoming) {
        const existing = updatedTodos.find((x: any) => x.id === t.id);
        if (existing) {
          if (t.status !== undefined) {
            existing.status = t.status;
          }
          if (t.content !== undefined) {
            existing.content = t.content;
          }
        } else {
          updatedTodos.push({
            id: t.id,
            content: t.content || "",
            status: t.status || "pending"
          });
        }
      }
    }

    const result = { success: true, todos: updatedTodos };
    return { result, updatedTodos, success: true, details: `Roadmap della sessione aggiornata con ${updatedTodos.length} task.` };
  }
});

// 25. trainAgent
registry.register({
  name: "trainAgent",
  emoji: "🧠",
  schema: {
    type: "function",
    function: {
      name: "trainAgent",
      description: "Addestra un agente esistente rendendolo un vero esperto di dominio. Esegue 8-12 ricerche web approfondite, legge fino a 15 pagine complete, e genera automaticamente un system prompt professionale con knowledge base, best practices, anti-pattern e direttive agentiche. Il training richiede ~2 minuti.",
      parameters: {
        type: "object",
        properties: {
          agentId: { type: "string", description: "L'ID dell'agente da addestrare (ottenibile da getActiveAgents)." },
          expertise: { type: "string", description: "Descrizione dettagliata dell'area di competenza in cui addestrare l'agente (es: 'growth hacking per SaaS B2B, Product-Led Growth, viral loops, ottimizzazione funnel di conversione')." },
        },
        required: ["agentId", "expertise"]
      }
    }
  },
  handler: async (args, context) => {
    const { agentId, expertise } = args;

    // Fetch agent info
    const agents = await supabaseFetch(`/AgentConfig?id=eq.${agentId}&select=id,name,type,settings`);
    const agent = agents?.[0];
    if (!agent) {
      return { result: { error: "Agente non trovato" }, success: false, details: `Agente con ID ${agentId} non trovato.` };
    }

    if (context.push) context.push("debug", `🧠 Avvio training per "${agent.name}" — expertise: "${expertise}"`);

    // Phase 1: Generate search queries
    if (context.push) context.push("debug", "🔍 Fase 1: Generazione query di ricerca...");
    const queryTopics = [
      `${expertise} best practices guide`,
      `${expertise} framework methodology`,
      `${expertise} common mistakes anti-patterns`,
      `${expertise} case studies examples success`,
      `${expertise} tools resources software`,
      `${expertise} KPIs metrics benchmarks`,
      `${expertise} trends 2024 2025`,
      `${expertise} expert comprehensive guide`,
      `${expertise} startup strategy`,
      `${expertise} advanced techniques`,
    ];

    // Phase 2: Batch search
    if (context.push) context.push("debug", `🌐 Fase 2: Esecuzione ${queryTopics.length} ricerche web in parallelo...`);
    let tavilyKey: string | null = null;
    try { tavilyKey = await getApiKey("tavily"); } catch {}
    
    const searchResults = await batchSearch(queryTopics, tavilyKey || undefined);
    const allUrls: { title: string; link: string }[] = [];
    for (const group of searchResults) {
      for (const r of group.results) {
        if (r.link && r.link.startsWith("http")) {
          allUrls.push({ title: r.title, link: r.link });
        }
      }
    }
    if (context.push) context.push("debug", `✅ ${allUrls.length} risultati trovati`);

    // Phase 3: Read top 15 pages
    const urlsToRead = allUrls.slice(0, 15);
    if (context.push) context.push("debug", `📖 Fase 3: Lettura approfondita di ${urlsToRead.length} pagine...`);

    const pageContents: { url: string; title: string; content: string }[] = [];
    for (let i = 0; i < urlsToRead.length; i += 5) {
      const batch = urlsToRead.slice(i, i + 5);
      const results = await Promise.all(batch.map(async (r) => {
        try {
          const content = await readWebPageDeep(r.link, 10000);
          if (content && !content.startsWith("Error:") && content.length > 200) {
            return { url: r.link, title: r.title, content };
          }
          return null;
        } catch { return null; }
      }));
      for (const r of results) {
        if (r) pageContents.push(r);
      }
    }

    const totalChars = pageContents.reduce((sum, p) => sum + p.content.length, 0);
    if (context.push) context.push("debug", `✅ ${pageContents.length} pagine lette (${(totalChars / 1000).toFixed(0)}K caratteri)`);

    // Phase 4: LLM Synthesis
    if (context.push) context.push("debug", "🧠 Fase 4: Sintesi conoscenze e generazione prompt...");

    let knowledgeCorpus = pageContents.map((p, i) =>
      `═══ FONTE ${i + 1}: ${p.title} (${p.url}) ═══\n${p.content}`
    ).join("\n\n");
    if (knowledgeCorpus.length > 80000) {
      knowledgeCorpus = knowledgeCorpus.substring(0, 80000) + "\n...[troncato]";
    }

    const synthResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://agentfoundry.ai",
        "X-Title": "AgentFoundry Agent Trainer",
      },
      body: JSON.stringify({
        model: context.modelId || "openrouter/free",
        messages: [
          { role: "system", content: "Sei un architetto di prompt AI. Genera SOLO il system prompt richiesto, senza commenti aggiuntivi. Scrivi in italiano." },
          { role: "user", content: `Crea un system prompt PROFESSIONALE per un agente AI chiamato "${agent.name}" (tipo: ${agent.type}), specializzato in: "${expertise}".\n\nConoscenze dalla ricerca web:\n${knowledgeCorpus}\n\nGenera un prompt con queste sezioni:\n1. 🧠 IDENTITÀ, RUOLO E FILOSOFIA COGNITIVA\n2. 📚 KNOWLEDGE BASE SPECIALISTICA (la più lunga — includi framework reali, tool concreti, metriche, case study)\n3. 🎯 DIRETTIVE AGENTICHE INVARIANTI (tool-use enforcement, act-don't-ask, anti-hallucination, parallel batching)\n4. ⚠️ ANTI-PATTERN E ERRORI COMUNI\n5. 📐 REGOLE DI COMUNICAZIONE (italiano, tabelle, prossimi passi)\n\nIl prompt deve essere LUNGO e RICCHISSIMO di dettagli concreti estratti dalle fonti.` },
        ],
        max_tokens: 4000,
        temperature: 0.4,
      }),
    });
    if (!synthResponse.ok) {
      const errText = await synthResponse.text();
      return { result: { error: `HTTP ${synthResponse.status}: ${errText}` }, success: false, details: `Errore chiamata LLM: ${errText}` };
    }
    const synthData = await synthResponse.json();
    if (synthData.error) {
      return { result: { error: synthData.error }, success: false, details: `Errore OpenRouter: ${JSON.stringify(synthData.error)}` };
    }
    const generatedPrompt = synthData.choices?.[0]?.message?.content || "";

    if (!generatedPrompt || generatedPrompt.length < 200) {
      return { result: { error: "Generazione prompt fallita o testo vuoto" }, success: false, details: "Il modello non ha prodotto un prompt valido." };
    }

    // Phase 5: Save
    if (context.push) context.push("debug", "💾 Fase 5: Salvataggio configurazione...");
    const currentSettings = agent.settings || {};
    const sources = pageContents.map(p => ({ url: p.url, title: p.title }));
    const updatedSettings = {
      ...currentSettings,
      systemPrompt: generatedPrompt,
      expertise,
      persona: `${agent.name} — ${expertise}`,
      knowledgeSources: sources,
      trainedAt: new Date().toISOString(),
      trainingStats: {
        queriesUsed: queryTopics.length,
        pagesRead: pageContents.length,
        totalChars,
        promptLength: generatedPrompt.length,
      },
    };

    await supabaseFetch(`/AgentConfig?id=eq.${agentId}`, {
      method: "PATCH",
      body: JSON.stringify({ settings: updatedSettings }),
    });

    if (context.push) context.push("debug", `✅ Training completato! Prompt: ${generatedPrompt.length} caratteri, ${pageContents.length} fonti`);

    return {
      result: {
        success: true,
        agentName: agent.name,
        promptLength: generatedPrompt.length,
        sourcesCount: sources.length,
        pagesRead: pageContents.length,
        totalKnowledgeChars: totalChars,
        promptPreview: generatedPrompt.substring(0, 500) + "...",
      },
      success: true,
      details: `Agente "${agent.name}" addestrato con successo: ${generatedPrompt.length} caratteri di prompt, ${pageContents.length} fonti web analizzate (${(totalChars / 1000).toFixed(0)}K caratteri di conoscenze).`
    };
  }
});

// requestInformationForm
registry.register({
  name: "requestInformationForm",
  emoji: "📋",
  schema: {
    type: "function",
    function: {
      name: "requestInformationForm",
      description: "Crea un modulo (form) interattivo per richiedere informazioni o preferenze al founder. VALUTA AUTONOMAMENTE: usalo quando ti mancano dati o parametri critici indispensabili per l'analisi o l'esecuzione del task. Scegli le domande e i tipi di input più appropriati (text, number, boolean, select). NON usarlo se hai già abbastanza contesto o per domande semplici.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Il titolo del modulo (es. 'Dati Finanziari Dettagliati' o 'Scelte Tecnologiche')"
          },
          description: {
            type: "string",
            description: "Spiegazione o istruzioni per l'utente sul perché sono richieste queste informazioni."
          },
          fields: {
            type: "array",
            description: "Elenco dei campi che l'utente deve compilare nel modulo.",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  description: "Identificativo univoco del campo (es. 'target_mrr', 'database_choice')"
                },
                label: {
                  type: "string",
                  description: "Etichetta del campo visibile all'utente (es. 'MRR Obiettivo', 'Scelta Database')"
                },
                type: {
                  type: "string",
                  enum: ["text", "number", "boolean", "select"],
                  description: "Tipo di input."
                },
                placeholder: {
                  type: "string",
                  description: "Suggerimento / esempio di inserimento."
                },
                required: {
                  type: "boolean",
                  description: "Se il campo è obbligatorio."
                },
                options: {
                  type: "array",
                  items: { "type": "string" },
                  "description": "Opzioni selezionabili se il tipo è 'select'."
                }
              },
              required: ["id", "label", "type"]
            }
          }
        },
        required: ["title", "description", "fields"]
      }
    }
  },
  handler: async (args, context) => {
    return {
      success: true,
      details: `Modulo '${args.title}' creato con successo. In attesa delle risposte dell'utente.`,
      result: {
        title: args.title,
        description: args.description,
        fields: args.fields
      }
    };
  }
});

// 27. getUpcomingEvents (Google Calendar)
registry.register({
  name: "getUpcomingEvents",
  emoji: "📅",
  schema: {
    type: "function",
    function: {
      name: "getUpcomingEvents",
      description: "Recupera i prossimi eventi e riunioni programmati nel Google Calendar della startup.",
      parameters: { type: "object", properties: { maxResults: { type: "integer", description: "Numero massimo di eventi da recuperare (default 10)." } } }
    }
  },
  handler: async (args, context) => {
    if (context.push) {
      context.push("tool_start", { name: "getUpcomingEvents", label: "Lettura eventi Google Calendar..." });
    }
    const events = await getUpcomingCalendarEvents(args.maxResults || 10);
    return {
      success: true,
      result: events,
      details: `${events.length} eventi trovati in Google Calendar.`
    };
  }
});

// 28. createCalendarEvent (Google Calendar)
registry.register({
  name: "createCalendarEvent",
  emoji: "📆",
  schema: {
    type: "function",
    function: {
      name: "createCalendarEvent",
      description: "Pianifica e crea un nuovo evento o riunione nel Google Calendar della startup.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Titolo dell'evento (es: 'Incontro Investor Angel', 'Sprint Review Tech')." },
          description: { type: "string", description: "Descrizione dettagliata dell'ordine del giorno o argomenti da trattare." },
          startIso: { type: "string", description: "Orario d'inizio in formato ISO string (es: '2026-07-31T14:30:00Z')." },
          durationMinutes: { type: "integer", description: "Durata dell'evento in minuti (default 30)." },
          location: { type: "string", description: "Luogo o link del meeting (es: 'Google Meet', 'Milano HQ')." },
          attendees: { type: "array", items: { type: "string" }, description: "Lista delle email dei partecipanti." }
        },
        required: ["summary", "startIso"]
      }
    }
  },
  handler: async (args, context) => {
    if (context.push) {
      context.push("tool_start", { name: "createCalendarEvent", label: `Creazione evento: "${args.summary}"...` });
    }
    const event = await createGoogleCalendarEvent({
      summary: args.summary,
      description: args.description,
      startIso: args.startIso,
      durationMinutes: args.durationMinutes,
      location: args.location,
      attendees: args.attendees
    });
    return {
      success: true,
      result: event,
      details: `Evento '${event.summary}' pianificato con successo per il ${new Date(event.start).toLocaleString('it-IT')}.`
    };
  }
});

export { registry };

