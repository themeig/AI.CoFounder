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
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase REST error: ${response.status} - ${errorText}`);
  }
  return response.json();
}

export async function analyzeStartupOutcome(startupId: string, status: string, notes: string) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !OPENROUTER_KEY) {
      throw new Error("Missing database or AI configurations.");
    }

    // 1. Fetch startup
    const startups = await supabaseFetch(`/Startup?id=eq.${startupId}&select=*`);
    if (!startups || startups.length === 0) {
      throw new Error("Startup not found.");
    }
    const startup = startups[0];

    // 2. Fetch agent configs and recent messages
    const agentConfigs = await supabaseFetch(`/AgentConfig?startupId=eq.${startupId}&select=id,type`);
    let chatHistory = "Nessuna conversazione trovata.";
    
    if (agentConfigs && agentConfigs.length > 0) {
      const agentIds = agentConfigs.map((a: any) => a.id);
      const agentIdsStr = agentIds.join(",");
      const messages = await supabaseFetch(
        `/Message?agentId=in.(${agentIdsStr})&order=createdAt.desc&limit=15`
      );

      if (messages && messages.length > 0) {
        chatHistory = messages.reverse().map((m: any) => {
          const agent = agentConfigs.find((a: any) => a.id === m.agentId);
          const name = agent ? agent.type.toUpperCase() : "AGENTE";
          return `[${name} - ${m.role === 'user' ? 'Founder' : 'AI'}]: ${m.content}`;
        }).join("\n");
      }
    }

    // 3. Prepare OpenRouter prompt
    const prompt = `Sei l'analista centrale della piattaforma AI.CoFounder (OmniMemory). Il tuo compito è analizzare le cause profonde (root causes) di un esito o di un pivot di una startup e generare un pattern generalizzato utile per l'intera piattaforma.

Dati Startup:
- Nome: ${startup.name}
- Settore: ${startup.sector}
- Fase attuale: ${startup.phase}
- MRR attuale: $${startup.mrr}
- Utenti attuali: ${startup.users}

Nuovo esito registrato:
- Stato/Esito: ${status.toUpperCase()}
- Note del founder: ${notes}

Storico chat recente con gli agenti:
${chatHistory}

Esegui un'analisi causale approfondita sul perché questo esito si sia verificato (in positivo o in negativo).
Rispondi esclusivamente con un oggetto JSON valido contenente la seguente struttura. Non aggiungere introduzioni o conclusioni di testo, solo il JSON:
{
  "patternTitle": "Titolo breve in italiano (max 6 parole)",
  "analysis": "Una spiegazione dettagliata in italiano (2 paragrafi) delle cause profonde che hanno portato a questo risultato.",
  "keyFactors": ["3-5 fattori chiave di successo o fallimento"],
  "failureModes": ["2-3 errori bloccanti commessi o da evitare"],
  "confidence": 0.85
}
`;

    // 4. Call OpenRouter
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + OPENROUTER_KEY,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "AgentFoundry-OmniMemory",
      },
      body: JSON.stringify({
        model: "openrouter/owl-alpha",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3, // low temperature for structured tasks
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter analyzer call failed: ${res.status} - ${errText}`);
    }

    const data = await res.json();
    const rawReply = data.choices?.[0]?.message?.content || "{}";
    
    // Clean response in case LLM wrapped it in markdown code block
    const cleanedReply = rawReply.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanedReply);

    // 5. Calculate success rate based on status
    let successRate = 0.5;
    if (status === "growing" || status === "acquired") {
      successRate = 0.85;
    } else if (status === "failed") {
      successRate = 0.15;
    } else if (status === "pivot") {
      successRate = 0.6;
    } else if (status === "stalled") {
      successRate = 0.35;
    }

    // 6. Create global pattern in DB
    const newPattern = await supabaseFetch(`/Pattern`, {
      method: "POST",
      body: JSON.stringify({
        title: parsed.patternTitle || `Pattern ${startup.sector} ${startup.phase}`,
        description: parsed.analysis || `Analisi dell'esito ${status} per ${startup.name}`,
        sector: startup.sector,
        phase: startup.phase,
        successRate: successRate,
        sampleSize: 1,
        confidence: parsed.confidence || 0.7,
        keyFactors: parsed.keyFactors || [],
        failureModes: parsed.failureModes || [],
        extractedBy: "hermes_analyzer",
        isActive: true,
      }),
    });

    // 7. Create recommendation for the startup
    await supabaseFetch(`/Recommendation`, {
      method: "POST",
      body: JSON.stringify({
        startupId: startupId,
        patternId: newPattern[0]?.id || null,
        type: "insight",
        title: `OmniMemory: ${parsed.patternTitle}`,
        content: parsed.analysis,
        priority: 3,
        isRead: false,
        isActedOn: false,
      }),
    });

    return {
      success: true,
      pattern: newPattern[0],
      analysis: parsed.analysis,
      title: parsed.patternTitle,
      keyFactors: parsed.keyFactors,
      failureModes: parsed.failureModes,
    };
  } catch (error: any) {
    console.error("[Analyzer Engine Error]:", error.message);
    throw error;
  }
}
