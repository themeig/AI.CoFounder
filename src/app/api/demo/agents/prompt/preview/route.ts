import { NextResponse } from "next/server";

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
    headers: { ...supabaseHeaders, ...options.headers },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase REST error: ${response.status} - ${errorText}`);
  }
  return response.json();
}

async function getOrCreateStartup() {
  let users = await supabaseFetch(`/User?email=eq.demo@agentfoundry.ai&select=id`);
  let userId;
  if (users && users.length > 0) {
    userId = users[0].id;
  } else {
    // Default seed user
    const newUser = await supabaseFetch(`/User`, {
      method: "POST",
      body: JSON.stringify({
        email: "demo@agentfoundry.ai",
        name: "Demo Founder",
      }),
    });
    userId = newUser[0].id;
  }

  let startups = await supabaseFetch(`/Startup?userId=eq.${userId}&select=*`);
  if (startups && startups.length > 0) {
    return startups[0];
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
    return newStartup[0];
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

// GET /api/demo/agents/prompt/preview?agentId=xxx
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    const agents = await supabaseFetch(`/AgentConfig?id=eq.${agentId}&select=id,name,type,settings`);
    const agent = agents?.[0];

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const startup = await getOrCreateStartup();
    const settings = agent.settings || {};
    const agentType = agent.type;

    // 1. Base / Custom system prompt
    const basePrompt = settings.systemPrompt || getSystemPrompt(agentType);

    // 2. Startup Information
    const startupInfoSection = `Informazioni Startup (${startup.name}):
- Settore: ${startup.sector}
- Fase: ${startup.phase}
- MRR: $${startup.mrr}
- Utenti: ${startup.users}
- Burn Rate: $${startup.burnRate}/mese
- Runway: ${startup.runway} mesi`;

    // 3. Dynamic Context placeholders
    const dynamicContextSection = `[Indice Conoscenze/Pattern (Playbook) - Caricato dinamicamente a runtime]
[Contesto Playbook - Caricato dinamicamente a runtime]
[Memoria Cross-Agent - Caricata dinamicamente a runtime]
[Memoria Mnemosyne a lungo termine pertinenti - Caricata dinamicamente a runtime]`;

    // 4. Tools Section
    const enabledTools = settings.enabledTools || [
      "get_knowledge_pattern_details",
      "webSearch",
      "getStartupInfo",
      "getCustomMetrics",
      "readWebPage"
    ];
    const customDescriptions = settings.customDescriptions || {};

    const toolDescItems: string[] = [];
    if (enabledTools.includes("webSearch")) {
      toolDescItems.push(`- 'webSearch': ${customDescriptions.webSearch || "Esegue una ricerca in tempo reale su internet (tramite Tavily Search o DuckDuckGo come fallback) per trovare notizie recenti, trend, informazioni finanziarie e link utili."}`);
    }
    if (enabledTools.includes("readWebPage")) {
      toolDescItems.push(`- 'readWebPage': ${customDescriptions.readWebPage || "Scarica e legge il testo completo di una pagina web/URL specifico per estrarre articoli, notizie fresche o documentazioni dettagliate."}`);
    }
    if (enabledTools.includes("getStartupInfo")) {
      toolDescItems.push(`- 'getStartupInfo': ${customDescriptions.getStartupInfo || "Carica le informazioni generali e le metriche finanziarie base della startup."}`);
    }
    if (enabledTools.includes("getCustomMetrics")) {
      toolDescItems.push(`- 'getCustomMetrics': ${customDescriptions.getCustomMetrics || "Carica la lista di tutte le metriche personalizzate e i relativi grafici configurati per la dashboard."}`);
    }
    if (enabledTools.includes("get_knowledge_pattern_details")) {
      toolDescItems.push(`- 'get_knowledge_pattern_details': ${customDescriptions.get_knowledge_pattern_details || "Approfondisce i dettagli di una specifica conoscenza o pattern."}`);
    }
    toolDescItems.push(`- 'requestInformationForm': Crea un modulo (form) interattivo con domande mirate per raccogliere dati o preferenze mancanti.`);

    const toolsSection = toolDescItems.length > 0
      ? `Strumenti a tua disposizione:\n${toolDescItems.join("\n")}`
      : `Non hai strumenti a tua disposizione al momento.`;

    // 5. Rules Section
    let rulesSection = "";
    if (enabledTools.includes("webSearch") || enabledTools.includes("readWebPage")) {
      rulesSection = `Regole operative:
- Hai accesso in tempo reale a internet tramite Tavily Search (con DuckDuckGo come fallback). Quando l'utente ti chiede notizie recenti, trend, o events esterni, usa sempre 'webSearch' ed eventualmente 'readWebPage' per leggere la pagina di notizie e riportare i fatti esatti.
- Ottimizzazione ricerche (Tavily): Tavily è ottimizzato per ricerche semantiche ed LLM. Puoi formulare query espresse anche sotto forma di domande complete o frasi naturali (es: "Quali sono i principali competitor di Notion nel 2026?").
- Non dire mai all'utente che non hai accesso in tempo reale a internet o che non puoi leggere le notizie. Se ti viene chiesto di cercare notizie (es: ANSA o ultime novità), usa 'webSearch' per trovare i link pertinenti, e subito dopo usa 'readWebPage' sull'URL per estrarre e riportare i titoli delle notizie di oggi.`;
    }

    // 6. Mandatory Agentic Reasoning and Output formatting rules
    const reasoningAndFormattingSection = `- USO AUTONOMO MODULI (requestInformationForm): Decidi in autonomia quando ti mancano dati o metriche essenziali per completare un'analisi o un piano. In tal caso, invoca 'requestInformationForm' definendo le domande e i tipi di campo (text, number, boolean, select) più pertinenti. NON usarlo se hai già abbastanza informazioni o per domande banali.
- REASONING LOOP (OBBLIGATORIO): Prima di formulare qualsiasi risposta o prima di richiedere l'uso di uno strumento, devi analizzare la situazione ed elaborare il tuo ragionamento all'interno dei tag <thought>...</thought>.
- CONTROLLO OUTPUT (CRITICO): Se stai chiamando uno strumento (tool), NON scrivere nulla al di fuori dei tag <thought>...</thought>. Solo quando hai finito di usare gli strumenti e sei pronto per la risposta finale rivolta al founder, scriverai il testo della risposta finale al di fuori dei tag <thought>...</thought>. Tutto ciò che è ragionamento intermedio o spiegazione del tool deve stare dentro i tag di pensiero per non essere mostrato direttamente al founder.
- IDENTITÀ LLM ATTUALE: Stai girando sul modello LLM [Nome Modello Selezionato]. Se ti viene chiesto che modello sei o quale intelligenza artificiale stai usando, rispondi basandoti su queste informazioni.
- Fornisci consigli pratici e specifici per la situazione attuale della startup. Sii conciso ma esaustivo.`;

    const currentDateStr = new Date().toLocaleDateString("it-IT", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    const isoDateStr = new Date().toISOString().split("T")[0];

    // 7. Full Prompt Assembly
    const fullPrompt = `📅 DATA ODIERNA: ${currentDateStr} (ISO: ${isoDateStr})

${basePrompt}

${startupInfoSection}

${dynamicContextSection}

${toolsSection}

${rulesSection ? rulesSection + "\n" : ""}- DATA ODIERNA CORRENTE: La data di oggi è ${currentDateStr} (${isoDateStr}).
${reasoningAndFormattingSection}`;

    return NextResponse.json({
      fullPrompt,
      sections: {
        basePrompt,
        startupInfo: startupInfoSection,
        dynamicContextPlaceholder: dynamicContextSection,
        toolsSection,
        rulesSection,
        reasoningRules: reasoningAndFormattingSection,
      },
      metadata: {
        hasCustomPrompt: !!settings.systemPrompt,
        totalLength: fullPrompt.length,
        enabledToolsCount: enabledTools.length,
      }
    });
  } catch (err: any) {
    console.error("[AgentPromptPreview GET Error]:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
