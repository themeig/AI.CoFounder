import { NextResponse } from "next/server";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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
Hai accesso ad alcuni strumenti/funzioni per interrogare e modificare il database in tempo reale.
Puoi:
1. Vedere le info della startup (getStartupInfo).
2. Vedere gli agenti attivi (getActiveAgents).
3. Modificare le metriche (updateStartupMetrics).
4. Creare nuovi agenti specializzati (createAgent).

Se l'utente ti chiede di creare un agente, fallo usando lo strumento 'createAgent'.
Se ti chiede di aggiornare le metriche (es: "imposta il burn rate a 2000"), fallo usando lo strumento 'updateStartupMetrics'.
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
              executedTools.push({ name: functionName, success: true, details: "Info startup caricate con successo." });
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
              executedTools.push({ name: functionName, success: true, details: `Metriche aggiornate: ${Object.keys(payload).map(k => `${k}=${payload[k]}`).join(", ")}` });
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
              executedTools.push({ name: functionName, success: true, details: `Agente creato: ${args.name} (${args.type})` });
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
