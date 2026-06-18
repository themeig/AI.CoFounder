import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

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

// Helper to query database
async function supabaseFetch(path: string, options: any = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...supabaseHeaders,
      ...options.headers,
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase error: ${response.status} - ${errorText}`);
  }
  return response.json();
}

// Helpers for Metrics file DB
async function getMetricsData() {
  try {
    const data = await fs.readFile(METRICS_FILE_PATH, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

async function saveMetricsData(data: any) {
  await fs.mkdir(path.dirname(METRICS_FILE_PATH), { recursive: true });
  await fs.writeFile(METRICS_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

// Tool definitions for coFounder
const TOOLS = [
  {
    type: "function",
    function: {
      name: "getStartupInfo",
      description: "Recupera le informazioni generali e le metriche finanziarie chiave della startup (nome, settore, fase, MRR, utenti, burn rate, runway).",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "getActiveAgents",
      description: "Recupera l'elenco di tutti gli agenti AI configurati nella startup con il loro stato (attivo/inattivo).",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "updateStartupMetrics",
      description: "Aggiorna le metriche della startup (mrr, users, burnRate, runway) nel database.",
      parameters: {
        type: "object",
        properties: {
          mrr: { type: "number", description: "Nuovo valore MRR" },
          users: { type: "number", description: "Nuovo numero di utenti" },
          burnRate: { type: "number", description: "Nuovo burn rate mensile" },
          runway: { type: "number", description: "Nuovo runway in mesi" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "createAgent",
      description: "Crea e configura un nuovo agente specializzato nel team della startup.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome dell'agente (es. Strategist Growth, Tech Architect)" },
          type: { type: "string", enum: ["strategy", "tech", "finance", "marketing", "legal", "operations"], description: "Ruolo dell'agente" }
        },
        required: ["name", "type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "addCustomMetric",
      description: "Aggiunge una nuova metrica personalizzata o un grafico (line, bar, gauge, cohort, value) alla dashboard Analytics.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Titolo della metrica (es: Costo Acquisizione Clienti, LTV/CAC)" },
          value: { type: "string", description: "Valore corrente visualizzato (es: 150€, 3.4x, 12%)" },
          type: { type: "string", enum: ["currency", "percentage", "ratio", "integer"], description: "Tipo di dato dell'indicatore" },
          chartType: { type: "string", enum: ["line", "bar", "gauge", "cohort", "value"], description: "Tipo di grafico visivo" },
          formula: { type: "string", description: "Formula o logica di calcolo descrittiva" },
          data: { type: "array", items: { type: "number" }, description: "Valori numerici sequenziali per l'andamento del grafico (es: [200, 180, 150])" },
          labels: { type: "array", items: { type: "string" }, description: "Etichette temporali (es: ['Apr', 'Mag', 'Giu'])" }
        },
        required: ["title", "value"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "updateCustomMetric",
      description: "Modifica i dati o le impostazioni di una metrica personalizzata già presente nel dashboard.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID univoco dell'indicatore da modificare" },
          title: { type: "string", description: "Nuovo titolo" },
          value: { type: "string", description: "Nuovo valore corrente" },
          chartType: { type: "string", enum: ["line", "bar", "gauge", "cohort", "value"], description: "Nuovo tipo di visualizzazione" },
          data: { type: "array", items: { type: "number" }, description: "Nuova serie di dati numerici" },
          labels: { type: "array", items: { type: "string" }, description: "Nuova serie di etichette temporali" },
          formula: { type: "string", description: "Nuova formula" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "deleteCustomMetric",
      description: "Elimina una metrica personalizzata dal dashboard utilizzando il suo ID.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID della metrica da eliminare" }
        },
        required: ["id"]
      }
    }
  }
];

export async function POST(req: Request) {
  try {
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "OpenRouter non configurato sul server" }, { status: 500 });
    }

    const { messages, cofounderName = "coFounder" } = await req.json();

    // 1. Get demo user and startup
    const users = await supabaseFetch(`/User?email=eq.demo@agentfoundry.ai&select=id`);
    if (!users || users.length === 0) {
      return NextResponse.json({ error: "Utente demo non trovato" }, { status: 404 });
    }
    const userId = users[0].id;

    const startups = await supabaseFetch(`/Startup?userId=eq.${userId}&select=*`);
    if (!startups || startups.length === 0) {
      return NextResponse.json({ error: "Startup demo non trovata" }, { status: 404 });
    }
    const startup = startups[0];
    const startupId = startup.id;

    // 2. Prepare Agent Loop context
    const systemPrompt = `Sei ${cofounderName}, l'assistente co-fondatore intelligente integrato all'interno di AgentFoundry.
Il tuo compito è aiutare l'utente a gestire la sua startup ("${startup.name}") e il suo team di agenti AI.
Hai accesso ad alcuni strumenti/funzioni per interrogare e modificare il database e i grafici in tempo reale.
Puoi:
1. Vedere le info della startup (getStartupInfo).
2. Vedere gli agenti attivi (getActiveAgents).
3. Modificare le metriche della startup (updateStartupMetrics).
4. Creare nuovi agenti specializzati (createAgent).
5. Aggiungere metriche o grafici al dashboard Metriche (addCustomMetric).
6. Aggiornare metriche/grafici esistenti (updateCustomMetric).
7. Eliminare metriche o grafici (deleteCustomMetric).

Se l'utente ti chiede di aggiungere o creare un grafico/metrica, usa 'addCustomMetric'.
Se ti chiede di aggiornare un grafico/metrica (es: "imposta il valore di metric-mrr-growth a $18000"), usa 'updateCustomMetric'.
Se ti chiede di rimuovere una metrica, usa 'deleteCustomMetric'.
Fornisci risposte concise, professionali ed empatiche in lingua italiana. Parla come un vero partner di business.
Mantieni traccia delle azioni eseguite. Spiega chiaramente cosa hai fatto una volta che lo strumento ha avuto successo.`;

    let apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    let executedTools: any[] = [];
    let loopCount = 0;
    let keepRunning = true;
    let finalContent = "";

    while (keepRunning && loopCount < 3) {
      loopCount++;
      
      const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://agentfoundry.ai",
          "X-Title": "AgentFoundry coFounder Assistant"
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: apiMessages,
          tools: TOOLS,
          tool_choice: "auto",
        })
      });

      if (!openRouterRes.ok) {
        const errorText = await openRouterRes.text();
        throw new Error(`OpenRouter API error: ${openRouterRes.status} - ${errorText}`);
      }

      const responseData = await openRouterRes.json();
      const choice = responseData.choices[0];
      const message = choice.message;

      // Check for tool calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        // Add assistant response with tool calls to the thread
        apiMessages.push(message);

        for (const tc of message.tool_calls) {
          const functionName = tc.function.name;
          const args = JSON.parse(tc.function.arguments || "{}");
          let result: any = null;

          console.log(`[coFounder Agent] Executing tool ${functionName} with args:`, args);

          try {
            if (functionName === "getStartupInfo") {
              const freshStartup = await supabaseFetch(`/Startup?id=eq.${startupId}&select=*`);
              result = freshStartup && freshStartup.length > 0 ? freshStartup[0] : startup;
              executedTools.push({ name: functionName, success: true, details: "Info startup caricate." });
            } else if (functionName === "getActiveAgents") {
              const agents = await supabaseFetch(`/AgentConfig?startupId=eq.${startupId}&select=id,name,type,isActive`);
              result = agents || [];
              executedTools.push({ name: functionName, success: true, details: `Elenco agenti caricato (${agents.length} trovati).` });
            } else if (functionName === "updateStartupMetrics") {
              const payload: any = {};
              if (typeof args.mrr === "number") payload.mrr = args.mrr;
              if (typeof args.users === "number") payload.users = args.users;
              if (typeof args.burnRate === "number") payload.burnRate = args.burnRate;
              if (typeof args.runway === "number") payload.runway = args.runway;

              const updated = await supabaseFetch(`/Startup?id=eq.${startupId}`, {
                method: "PATCH",
                body: JSON.stringify(payload)
              });
              result = updated && updated.length > 0 ? updated[0] : { success: true };
              executedTools.push({ name: functionName, success: true, details: `Metriche base aggiornate: mrr=${args.mrr || ''}` });
            } else if (functionName === "createAgent") {
              const newAgent = await supabaseFetch(`/AgentConfig`, {
                method: "POST",
                body: JSON.stringify({
                  startupId: startupId,
                  type: args.type.toLowerCase(),
                  name: args.name,
                  isActive: true
                })
              });
              result = newAgent && newAgent.length > 0 ? newAgent[0] : { success: true };
              executedTools.push({ name: functionName, success: true, details: `Agente creato: ${args.name}` });
            } else if (functionName === "addCustomMetric") {
              const current = await getMetricsData();
              const newMetric = {
                id: "metric-custom-" + Date.now(),
                title: args.title,
                value: args.value,
                type: args.type || "integer",
                chartType: args.chartType || "value",
                formula: args.formula || "",
                data: Array.isArray(args.data) ? args.data : [],
                labels: Array.isArray(args.labels) ? args.labels : [],
                apiEndpoint: null,
                isDefault: false,
                createdAt: new Date().toISOString()
              };
              current.push(newMetric);
              await saveMetricsData(current);
              result = newMetric;
              executedTools.push({ name: functionName, success: true, details: `Metrica creata: "${args.title}" (${args.value})` });
            } else if (functionName === "updateCustomMetric") {
              const current = await getMetricsData();
              const idx = current.findIndex((m: any) => m.id === args.id);
              if (idx === -1) throw new Error(`Metrica con ID ${args.id} non trovata`);
              
              const updated = {
                ...current[idx],
                ...(args.title !== undefined && { title: args.title }),
                ...(args.value !== undefined && { value: args.value }),
                ...(args.chartType !== undefined && { chartType: args.chartType }),
                ...(args.data !== undefined && { data: args.data }),
                ...(args.labels !== undefined && { labels: args.labels }),
                ...(args.formula !== undefined && { formula: args.formula }),
              };
              current[idx] = updated;
              await saveMetricsData(current);
              result = updated;
              executedTools.push({ name: functionName, success: true, details: `Metrica "${updated.title}" aggiornata a ${updated.value}` });
            } else if (functionName === "deleteCustomMetric") {
              const current = await getMetricsData();
              const filtered = current.filter((m: any) => m.id !== args.id);
              if (current.length === filtered.length) throw new Error(`Metrica con ID ${args.id} non trovata`);
              
              await saveMetricsData(filtered);
              result = { success: true };
              executedTools.push({ name: functionName, success: true, details: `Metrica rimossa (ID: ${args.id})` });
            } else {
              result = { error: "Unknown function" };
            }
          } catch (toolErr: any) {
            result = { error: toolErr.message };
            executedTools.push({ name: functionName, success: false, details: `Errore: ${toolErr.message}` });
          }

          // Append tool response to thread
          apiMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            name: functionName,
            content: JSON.stringify(result)
          });
        }
      } else {
        finalContent = message.content || "";
        keepRunning = false;
      }
    }

    if (!finalContent && apiMessages[apiMessages.length - 1].role === "assistant") {
      finalContent = apiMessages[apiMessages.length - 1].content || "";
    }

    return NextResponse.json({
      content: finalContent,
      executedTools
    });
  } catch (err: any) {
    console.error("coFounder Chat API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
