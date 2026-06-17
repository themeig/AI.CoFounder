import { NextResponse } from "next/server";
import { AVAILABLE_MODELS } from "@/lib/models";
import { recall, autoExtractMemories } from "@/lib/mnemosyne";

const DEFAULT_MODEL = "openrouter/owl-alpha";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase REST error: ${response.status} - ${errorText}`);
  }
  return response.json();
}

function findModel(modelId: string) {
  return AVAILABLE_MODELS.find(m => m.id === modelId);
}

async function getOrCreateDemoEntities(agentType: string) {
  // 1. Get or create User
  let users = await supabaseFetch(`/User?email=eq.demo@agentfoundry.ai&select=id`);
  let userId;
  if (users && users.length > 0) {
    userId = users[0].id;
  } else {
    const newUser = await supabaseFetch(`/User`, {
      method: "POST",
      body: JSON.stringify({
        email: "demo@agentfoundry.ai",
        name: "Demo Founder",
      }),
    });
    userId = newUser[0].id;
  }

  // 2. Get or create Startup
  let startups = await supabaseFetch(`/Startup?userId=eq.${userId}&select=*`);
  let startup;
  if (startups && startups.length > 0) {
    startup = startups[0];
  } else {
    const newStartup = await supabaseFetch(`/Startup`, {
      method: "POST",
      body: JSON.stringify({
        userId: userId,
        name: "TechFlow",
        description: "AI-powered workflow automation for startups",
        sector: "saas",
        phase: "pre-seed",
        mrr: 1200,
        users: 150,
        burnRate: 800,
        runway: 18,
      }),
    });
    startup = newStartup[0];
  }

  // 3. Get or create AgentConfig
  let agentConfigs = await supabaseFetch(`/AgentConfig?startupId=eq.${startup.id}&type=eq.${agentType}&select=id`);
  let agentConfig;
  if (agentConfigs && agentConfigs.length > 0) {
    agentConfig = agentConfigs[0];
  } else {
    const newAgentConfig = await supabaseFetch(`/AgentConfig`, {
      method: "POST",
      body: JSON.stringify({
        startupId: startup.id,
        type: agentType,
        name: agentType.charAt(0).toUpperCase() + agentType.slice(1) + " Agent",
        isActive: true,
      }),
    });
    agentConfig = newAgentConfig[0];
  }

  return { userId, startup, agentConfig };
}

export async function GET(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json([]);
    }

    const url = new URL(req.url);
    const agentType = url.searchParams.get("agentType");

    if (!agentType) {
      return NextResponse.json({ error: "Missing agentType" }, { status: 400 });
    }

    const { agentConfig } = await getOrCreateDemoEntities(agentType);

    const messages = await supabaseFetch(`/Message?agentId=eq.${agentConfig.id}&order=createdAt.asc`);

    return NextResponse.json(messages);
  } catch (err: any) {
    console.error("[Chat GET] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { agentType, message, modelId, settings } = body;

    if (!message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_KEY) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    // 1. Get or create startup and agent config in DB
    const { startup, agentConfig } = await getOrCreateDemoEntities(agentType);

    // 2. Save incoming user message
    await supabaseFetch(`/Message`, {
      method: "POST",
      body: JSON.stringify({
        agentId: agentConfig.id,
        role: "user",
        content: message,
      }),
    });

    // Extract settings with fallbacks
    const memorySettings = settings?.memorySettings || {
      contextMessages: 20,
      useLongTermMemory: false,
      autoSaveInteractions: true,
      recencyBias: 0.5,
      temperature: 0.7
    };
    const knowledgeSettings = settings?.knowledgeSettings || {
      usePatterns: true,
      usePlaybooks: true,
      useOutcomes: true,
      minSuccessRate: 50
    };

    // 3. Retrieve single session memory (recent messages from this agent)
    const historyLimit = memorySettings.contextMessages;
    let historyMessages: any[] = [];
    if (historyLimit > 0) {
      const messagesFromDb = await supabaseFetch(
        `/Message?agentId=eq.${agentConfig.id}&order=createdAt.desc&limit=${historyLimit + 1}`
      );
      
      const olderMessages = (messagesFromDb || [])
        .filter((m: any) => m.content !== message || m.role !== "user")
        .slice(0, historyLimit);

      historyMessages = olderMessages.reverse().map((m: any) => ({
        role: m.role,
        content: m.content,
      }));
    }

    // 4. Retrieve cross-agent memory
    let crossAgentContext = "";
    const otherAgentConfigs = await supabaseFetch(
      `/AgentConfig?startupId=eq.${startup.id}&type=neq.${agentType}&select=id,type`
    );

    if (otherAgentConfigs && otherAgentConfigs.length > 0) {
      const otherAgentIds = otherAgentConfigs.map((a: any) => a.id);
      const otherAgentIdsStr = otherAgentIds.join(",");
      const otherMessages = await supabaseFetch(
        `/Message?agentId=in.(${otherAgentIdsStr})&order=createdAt.desc&limit=5`
      );

      if (otherMessages && otherMessages.length > 0) {
        crossAgentContext = "\n\n--- MEMORIA CONDIVISA TEAM (Interazioni recenti con altri agenti) ---\n" +
          otherMessages.reverse().map((m: any) => {
            const agent = otherAgentConfigs.find((a: any) => a.id === m.agentId);
            const agentName = agent ? agent.type.toUpperCase() : "AGENTE";
            return `[Agente ${agentName} - ${m.role === 'user' ? 'Founder' : 'AI'}]: ${m.content.slice(0, 150)}${m.content.length > 150 ? '...' : ''}`;
          }).join("\n") +
          "\n-------------------------------------------------------------";
      }
    }

    // 5. Retrieve Pattern Index (light titles & IDs for tool calling)
    let patternIndex = "";
    if (knowledgeSettings.usePatterns) {
      const sector = startup.sector;
      const phase = startup.phase;
      const orQuery = `or=(and(sector.eq.${sector},phase.eq.${phase}),and(sector.eq.${sector},phase.is.null),and(sector.is.null,phase.eq.${phase}),and(sector.is.null,phase.is.null))`;
      
      const patterns = await supabaseFetch(
        `/Pattern?isActive=eq.true&${orQuery}&order=confidence.desc,successRate.desc&limit=15`
      );

      const minRate = (knowledgeSettings.minSuccessRate || 0) / 100;
      const filteredPatterns = (patterns || []).filter((p: any) => p.successRate >= minRate);

      if (filteredPatterns.length > 0) {
        patternIndex = `\n\nCONOSCENZE/PATTERN DI PIATTAFORMA DISPONIBILI:
CRITICAL: Non spiegare all'utente che possiedi strumenti di ricerca, non menzionare mai i tool e non chiedere mai al founder di fornirti un ID. Se una delle seguenti conoscenze o pattern è pertinente alla conversazione o alla domanda, sei OBBLIGATO ad invocare AUTOMATICAMENTE lo strumento 'get_knowledge_pattern_details' in background per caricarne i dettagli prima di rispondere.
${filteredPatterns.map((p: any) => `- ID: [${p.id}] | Titolo: "${p.title}" (Tasso di successo: ${(p.successRate * 100).toFixed(0)}%)`).join("\n")}`;
      }
    }

    // 6. Retrieve Playbooks
    let playbookContext = "";
    if (knowledgeSettings.usePlaybooks) {
      const sector = startup.sector;
      const phase = startup.phase;
      const orQuery = `or=(and(sector.eq.${sector},phase.eq.${phase}),and(sector.eq.${sector},phase.is.null),and(sector.is.null,phase.eq.${phase}))`;
      
      const playbooks = await supabaseFetch(
        `/Playbook?isActive=eq.true&${orQuery}&limit=2`
      );

      if (playbooks && playbooks.length > 0) {
        playbookContext = `\n\nApplicable Playbooks:\n${playbooks
          .map((pb: any) => `- ${pb.title}: ${pb.description}\n  Steps: ${JSON.stringify(pb.steps)}`)
          .join("\n")}`;
      }
    }

    // 7. Define Tools
    const tools = [
      {
        type: "function",
        function: {
          name: "get_knowledge_pattern_details",
          description: "Recupera i dettagli completi (analisi qualitativa, fattori di successo, checklist errori) di una specifica conoscenza o pattern inserendo il suo ID.",
          parameters: {
            type: "object",
            properties: {
              patternId: {
                type: "string",
                description: "L'ID del pattern da approfondire (es: pat_001)."
              }
            },
            required: ["patternId"]
          }
        }
      }
    ];

    // Retrieve long-term memories (Mnemosyne)
    let mnemosyneContext = "";
    if (memorySettings.useLongTermMemory) {
      try {
        const recalled = await recall(agentConfig.id, message, 3, memorySettings.recencyBias ?? 0.5);
        if (recalled && recalled.length > 0) {
          mnemosyneContext = "\n\n--- RICORDI MNEMOSYNE (Memoria a lungo termine pertinente) ---\n" +
            recalled.map(m => `- [Ricordo (${m.scope}) - importanza: ${m.importance}]: ${m.content}`).join("\n") +
            "\n------------------------------------------------------------";
        }
      } catch (memErr: any) {
        console.error("Error recalling from Mnemosyne:", memErr.message);
      }
    }

    // 8. Compile system prompt
    const systemPrompt = `${getSystemPrompt(agentType)}

Informazioni Startup (${startup.name}):
- Settore: ${startup.sector}
- Fase: ${startup.phase}
- MRR: $${startup.mrr}
- Utenti: ${startup.users}
- Burn Rate: $${startup.burnRate}/mese
- Runway: ${startup.runway} mesi

${patternIndex}${playbookContext}${crossAgentContext}${mnemosyneContext}

Fornisci consigli pratici e specifici per la situazione attuale della startup. Sii conciso ma esaustivo.`;

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...historyMessages,
      { role: "user", content: message },
    ];

    const selectedModel = modelId || DEFAULT_MODEL;
    const modelInfo = findModel(selectedModel);
    const modelToUse = modelInfo ? modelInfo.id : DEFAULT_MODEL;

    console.log("[Chat Tools] calling OpenRouter. Model:", modelToUse, "history size:", historyMessages.length);

    // 9. Call OpenRouter
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + OPENROUTER_KEY,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "AgentFoundry",
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: apiMessages,
        tools: tools,
        temperature: memorySettings.temperature ?? 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Chat API Error]:", res.status, errText);

      const isToolError = 
        res.status === 400 && 
        (errText.toLowerCase().includes("tool") || 
         errText.toLowerCase().includes("function") || 
         errText.toLowerCase().includes("parameter"));

      if (isToolError) {
        return NextResponse.json(
          { 
            error: "ToolCallingNotSupported", 
            details: "Il modello selezionato non supporta la tool calling. Selezionare un altro modello (es. OWL Alpha)." 
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "LLM error", details: errText, model: modelToUse },
        { status: 500 }
      );
    }

    const data = await res.json();
    let assistantMessage = data.choices?.[0]?.message;

    if (!assistantMessage) {
      throw new Error("Completamento vuoto da parte dell'LLM.");
    }

    // 10. Handle Tool Call (Standard or XML format)
    let isToolCallRequested = false;
    let patternId = "";
    let toolCallId = "";
    let isXmlFormat = false;

    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      isToolCallRequested = true;
      const toolCall = assistantMessage.tool_calls[0];
      toolCallId = toolCall.id;
      try {
        const args = JSON.parse(toolCall.function.arguments);
        patternId = args.patternId;
      } catch (e) {
        console.error("Failed to parse tool arguments:", toolCall.function.arguments);
      }
    } 
    else if (assistantMessage.content && assistantMessage.content.includes("<longcat_tool_call>")) {
      isToolCallRequested = true;
      isXmlFormat = true;
      const match = assistantMessage.content.match(/<longcat_arg_value>([\s\S]*?)<\/longcat_arg_value>/);
      if (match && match[1]) {
        patternId = match[1].trim();
      }
    }

    if (isToolCallRequested && patternId) {
      console.log(`[Chat Tools] Tool call received (XML: ${isXmlFormat}) for pattern ID: ${patternId}`);

      let toolContent = "Pattern non trovato o ID errato.";
      const patterns = await supabaseFetch(`/Pattern?id=eq.${patternId}&select=*`);
      if (patterns && patterns.length > 0) {
        const p = patterns[0];
        toolContent = `Dettagli completi Pattern:
Titolo: ${p.title}
Descrizione/Analisi: ${p.description}
Tasso di successo: ${(p.successRate * 100).toFixed(0)}%
Confidenza: ${(p.confidence * 100).toFixed(0)}%
Fattori chiave successo: ${p.keyFactors?.join(", ") || "nessuno"}
Fattori di fallimento / errori da evitare: ${p.failureModes?.join(", ") || "nessuno"}`;
      }

      console.log("[Chat Tools] Executed tool. Fetching final answer...");

      let secondPassMessages: any[] = [];
      if (isXmlFormat) {
        secondPassMessages = [
          ...apiMessages,
          assistantMessage,
          {
            role: "user",
            content: `<longcat_tool_response>\n${toolContent}\n</longcat_tool_response>`
          }
        ];
      } else {
        secondPassMessages = [
          ...apiMessages,
          assistantMessage,
          {
            role: "tool",
            tool_call_id: toolCallId,
            name: "get_knowledge_pattern_details",
            content: toolContent,
          }
        ];
      }

      const secondRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + OPENROUTER_KEY,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "AgentFoundry",
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: secondPassMessages,
          temperature: memorySettings.temperature ?? 0.7,
        }),
      });

      if (!secondRes.ok) {
        const errText = await secondRes.text();
        console.error("[Chat Second Pass Error]:", secondRes.status, errText);
        throw new Error(`Second pass LLM failed: ${errText}`);
      }

      const secondData = await secondRes.json();
      assistantMessage = secondData.choices?.[0]?.message;
    }

    const reply = assistantMessage?.content || "Nessuna risposta.";

    // 11. Save assistant response
    await supabaseFetch(`/Message`, {
      method: "POST",
      body: JSON.stringify({
        agentId: agentConfig.id,
        role: "assistant",
        content: reply,
      }),
    });

    // 12. Optionally save interaction log
    if (memorySettings.autoSaveInteractions) {
      await supabaseFetch(`/Interaction`, {
        method: "POST",
        body: JSON.stringify({
          startupId: startup.id,
          agentType,
          category: "chat",
          advice: reply,
          context: {
            userMessage: message,
            modelUsed: modelToUse,
            startupPhase: startup.phase,
            startupSector: startup.sector,
          },
        }),
      });
    }

    // 13. Auto extract memories in background (Mnemosyne)
    if (memorySettings.useLongTermMemory) {
      // Run asynchronously in the background so it doesn't block the chat API response
      autoExtractMemories(agentConfig.id, message, reply)
        .then(extracted => {
          if (extracted.length > 0) {
            console.log(`[Mnemosyne] Automatically extracted and saved ${extracted.length} memories.`);
          } else {
            console.log(`[Mnemosyne] No memories extracted.`);
          }
        })
        .catch(err => {
          console.error("[Mnemosyne] Error in background extraction:", err.message);
        });
    }

    return NextResponse.json({
      response: reply,
      sessionId: agentConfig.id,
      model: modelToUse,
    });
  } catch (err: any) {
    console.error("[Chat Error]:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function getSystemPrompt(agentType: string): string {
  const prompts: Record<string, string> = {
    strategy: "Sei un esperto di strategia startup. Analizza mercati, competitor e opportunità. Suggerisci strategie di crescita basate su dati. Rispondi in italiano, in modo actionable e specifico.",
    tech: "Sei un CTO AI esperto. Aiuti con architetture software, scelta di tech stack, code review e best practices. Conosci Next.js, Python, PostgreSQL, Vercel, Docker. Rispondi in italiano con esempi di codice quando utile.",
    finance: "Sei un esperto di finanza startup. Gestisci cash flow, proiezioni finanziarie, fundraising e metriche SaaS (MRR, ARR, CAC, LTV, burn rate). Rispondi in italiano con numeri e tabelle quando possibile.",
    marketing: "Sei un esperto di growth marketing. Crei strategie di acquisizione, campagne e contenuti. Conosci SEO, paid ads, content marketing, PLG. Rispondi in italiano con esempi concreti.",
    legal: "Sei un esperto legale per startup. Gestisci incorporazione, contratti, IP e compliance (GDPR). Rispondi in italiano in modo chiaro, specificando quando è necessario un avvocato.",
    operations: "Sei un esperto di operazioni startup. Ottimizzi workflow, automatizzi processi e gestisci team. Conosci tool come Notion, Linear, Slack, Zapier. Rispondi in italiano con checklist e template.",
  };
  return prompts[agentType] || "Sei un assistente AI per startup. Rispondi in italiano in modo utile e specifico.";
}
