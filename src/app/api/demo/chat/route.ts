import { NextResponse } from "next/server";
import { AVAILABLE_MODELS } from "@/lib/models";
import { recall, autoExtractMemories } from "@/lib/mnemosyne";
import { promises as fs } from "fs";
import * as path from "path";

const DEFAULT_MODEL = "openrouter/owl-alpha";
const METRICS_FILE_PATH = path.join(process.cwd(), "src/lib/custom-metrics.json");

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

// ─── Semantic Pattern Search ──────────────────────────────────────────────────
// Stopwords EN + IT to strip from query before scoring
const STOP_WORDS = new Set([
  // Italian basic prepositions and articles
  "il","lo","la","i","gli","le","un","una","uno","di","a","da","in","con","su","per","tra","fra",
  "del","dello","della","dei","degli","delle","al","allo","alla","ai","agli","alle",
  "dal","dallo","dalla","dai","dagli","dalle","nel","nello","nella","nei","negli","nelle",
  "col","coi","che","e","o","ma","se","anche","non","ho","ha","sono","è","mi","si","ci","vi",
  "the","an","and","of","to","is","for","with","on","at","by","from","that","this",
  "it","as","be","or","we","do","not","but","have","are","was","our","how","what","when","can",
  
  // Expanded Italian pronouns, auxiliary verbs, and structural words
  "siamo", "siete", "hanno", "avete", "abbiamo", "sto", "stai", "sta", "stiamo", "stanno",
  "nostro", "nostra", "nostri", "nostre", "vostro", "vostra", "vostri", "vostre",
  "mio", "mia", "miei", "mie", "tuo", "tua", "tuoi", "tue", "suo", "sua", "suoi", "sue", "loro",
  "fare", "fatto", "faremo", "facendo", "prima", "dopo", "sotto", "sopra", "dentro", "fuori",
  "molto", "poco", "troppo", "tanto", "bene", "male", "ciao", "salve", "oggi", "ieri", "domani",
  "questo", "questa", "questi", "queste", "quello", "quella", "quelli", "quelle",
  "quale", "quali", "quanti", "quante", "quanto", "quanta", "chi", "cosa", "dove", "perché", "perche",
  "quando", "come", "solo", "sola", "soli", "sole", "dire", "detto", "diciamo", "voglio", "vuoi", "vuole",
  "ne", "ci", "vi", "lo", "la", "li", "le", "gli",
  
  // Expanded English pronouns and structural words
  "us", "you", "they", "he", "she", "his", "her", "my", "mine", "ours", "yours", "their", "theirs",
  "doing", "done", "did", "does", "make", "made", "makes", "making", "first", "last", "after", "before",
  "under", "over", "inside", "outside", "very", "little", "too", "much", "many", "well", "bad", "hello",
  "hi", "today", "yesterday", "tomorrow", "which", "who", "what", "where", "why", "when", "how", "only",
  "just", "than", "then", "also", "about", "would", "should", "could", "will", "want", "think", "thinking"
]);

// Sector keyword mapping for boosting
const SECTOR_KEYWORDS: Record<string, string[]> = {
  ai: ["ai", "openai", "claude", "llm", "gpt", "artificial", "intelligence", "modello", "modelli", "copilot", "generative", "generativa", "prompt"],
  saas: ["saas", "software", "mrr", "arr", "nrr", "churn", "abbonamento", "abbonamenti", "sottoscrizione", "cloud", "b2b", "pricing", "prezzo", "prezzare"],
  fintech: ["fintech", "pagamento", "pagamenti", "stripe", "transazioni", "carte", "credito", "banca", "finanziario", "finance"],
  ecommerce: ["ecommerce", "e-commerce", "negozio", "shop", "carrello", "vendite", "prodotto", "prodotti", "shipping", "spedizione", "logistica"]
};

function isPartialMatch(tok1: string, tok2: string): boolean {
  if (tok1.length < 4 || tok2.length < 4) return false;
  let commonPrefixLen = 0;
  const minLen = Math.min(tok1.length, tok2.length);
  for (let i = 0; i < minLen; i++) {
    if (tok1[i] === tok2[i]) {
      commonPrefixLen++;
    } else {
      break;
    }
  }
  return commonPrefixLen >= 4;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zàèéìòùa-z0-9\s]/gi, " ")
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOP_WORDS.has(w));
}

/**
 * Scores a single pattern against a query token set.
 * Uses weighted field matching:
 *   title      → weight 3.0  (most signal-dense)
 *   keyFactors → weight 2.0
 *   failureModes → weight 1.5
 *   description → weight 1.0
 * Bonus: +1.5 if query matches pattern sector keywords
 * Bonus: +0.8 if successRate < 0.4 (anti-patterns always surfaced for warnings)
 */
function scorePattern(pattern: any, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;

  const fields = [
    { text: pattern.title || "", weight: 3.0 },
    { text: (pattern.keyFactors || []).join(" "), weight: 2.0 },
    { text: (pattern.failureModes || []).join(" "), weight: 1.5 },
    { text: pattern.description || "", weight: 1.0 },
  ];

  let matchScore = 0;
  for (const { text, weight } of fields) {
    const fieldTokens = tokenize(text);
    for (const qt of queryTokens) {
      // Exact token match
      if (fieldTokens.includes(qt)) {
        matchScore += weight;
      } else {
        // Prefix-based partial match (4+ letters)
        if (fieldTokens.some(ft => isPartialMatch(ft, qt))) {
          matchScore += weight * 0.5;
        }
      }
    }
  }

  let finalScore = matchScore;

  // Sector boost: if the query contains keywords for the pattern's sector, add +1.5
  if (pattern.sector && SECTOR_KEYWORDS[pattern.sector]) {
    const hasSectorKeyword = queryTokens.some(qt => 
      SECTOR_KEYWORDS[pattern.sector].includes(qt) ||
      SECTOR_KEYWORDS[pattern.sector].some(sk => isPartialMatch(sk, qt))
    );
    if (hasSectorKeyword) {
      finalScore += 1.5;
    }
  }

  // Anti-pattern boost: always surface risk warnings
  if (pattern.successRate < 0.4) finalScore += 0.8;

  // Confidence boost: tie-break between equal-relevance patterns
  finalScore += (pattern.confidence || 0) * 0.3;

  return finalScore;
}

/**
 * Fetches ALL active patterns from Supabase and ranks them semantically.
 * @param userMessage  - raw user message text
 * @param minRate      - minimum successRate (0.0–1.0) from user settings (applied AFTER scoring)
 * @param threshold    - minimum relevance score to include (default 1.5)
 * @param cap          - maximum patterns to return (default 7)
 */
async function semanticSearchPatterns(
  userMessage: string,
  minRate: number,
  threshold = 1.5,
  cap = 7
): Promise<any[]> {
  // Fetch ALL patterns once (cached by Next.js fetch if same request)
  const all = await supabaseFetch(
    `/Pattern?isActive=eq.true&order=confidence.desc`,
    { headers: { "Range": "0-499", "Range-Unit": "items", "Prefer": "count=none" } }
  );

  if (!Array.isArray(all) || all.length === 0) return [];

  const queryTokens = tokenize(userMessage);

  // Score every pattern
  const scored = all.map((p: any) => ({ pattern: p, score: scorePattern(p, queryTokens) }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Keep patterns above threshold that also meet the min success rate filter
  // (anti-patterns are exempt from the minRate filter — we always want risk warnings)
  const results = scored
    .filter(({ pattern, score }) => {
      if (score < threshold) return false;
      if (pattern.successRate < 0.4) return true; // anti-patterns bypass minRate
      return pattern.successRate >= minRate;
    })
    .slice(0, cap)
    .map(({ pattern }) => pattern);

  // Fallback: if semantic search returns nothing, give top-5 by confidence
  if (results.length === 0) {
    return scored
      .filter(({ pattern }) => pattern.successRate >= minRate || pattern.successRate < 0.4)
      .slice(0, 5)
      .map(({ pattern }) => pattern);
  }

  return results;
}

async function getMetricsData() {
  try {
    const data = await fs.readFile(METRICS_FILE_PATH, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

async function searchWeb(query: string): Promise<any[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!response.ok) {
      return [{ title: "Search Error", snippet: "Could not retrieve search results.", link: "" }];
    }
    const html = await response.text();
    const results: any[] = [];
    const aRegex = /<a [^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const sRegex = /<a [^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    
    while (results.length < 5) {
      const matchA = aRegex.exec(html);
      const matchS = sRegex.exec(html);
      if (!matchA || !matchS) break;
      
      let link = matchA[1].trim();
      if (link.includes("uddg=")) {
        const params = new URLSearchParams(link.split("?")[1]);
        link = params.get("uddg") || link;
      }
      const title = matchA[2].replace(/<[^>]*>/g, "").trim();
      const snippet = matchS[1].replace(/<[^>]*>/g, "").trim();
      
      results.push({
        title: unescapeHtml(title),
        snippet: unescapeHtml(snippet),
        link
      });
    }
    return results;
  } catch (err: any) {
    console.error("Search web error:", err);
    return [{ title: "Search Failed", snippet: `Failed to search the web: ${err.message}`, link: "" }];
  }
}

async function readWebPage(url: string): Promise<string> {
  try {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return "Error: Invalid URL. Must start with http:// or https://";
    }
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!response.ok) {
      return `Error: Failed to fetch webpage (status: ${response.status})`;
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const json = await response.json();
      return JSON.stringify(json, null, 2);
    }
    
    let text = await response.text();
    text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
    text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
    text = text.replace(/<\/p>/gi, "\n\n");
    text = text.replace(/<\/div>/gi, "\n");
    text = text.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/<[^>]*>/g, "");
    text = unescapeHtml(text);
    text = text.replace(/[ \t]+/g, " ");
    text = text.replace(/\n\s*\n+/g, "\n\n");
    
    if (text.length > 5000) {
      text = text.substring(0, 5000) + "\n\n...[Testo troncato per lunghezza]";
    }
    return text.trim() || "Empty page content.";
  } catch (err: any) {
    console.error("Read webpage error:", err);
    return `Error: Failed to read webpage content: ${err.message}`;
  }
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
  let agentConfigs = await supabaseFetch(`/AgentConfig?startupId=eq.${startup.id}&type=eq.${agentType}&select=*`);
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
        settings: { enabledTools: ["get_knowledge_pattern_details", "webSearch", "getStartupInfo", "getCustomMetrics", "readWebPage"] }
      }),
    });
    agentConfig = newAgentConfig[0];
  }

  return { userId, startup, agentConfig };
}

function parseLongcat(buffer: string) {
  const match = buffer.match(/<longcat_tool_call>([\s\S]*?)(?:<\/longcat_tool_call>|$)/);
  if (!match) return null;
  const inner = match[1].trim();
  
  // Extract function name
  const nameMatch = inner.match(/^([a-zA-Z0-9_]+)/);
  if (!nameMatch) return null;
  const name = nameMatch[1];
  
  // Extract key-values
  const args: any = {};
  const keyValRegex = /<longcat_arg_key>([\s\S]*?)<\/longcat_arg_key>\s*<longcat_arg_value>([\s\S]*?)<\/longcat_arg_value>/g;
  let kvMatch;
  while ((kvMatch = keyValRegex.exec(inner)) !== null) {
    const key = kvMatch[1].trim();
    const value = kvMatch[2].trim();
    args[key] = value;
  }
  
  return { name, arguments: JSON.stringify(args) };
}

function processStreamBuffer(
  buffer: string,
  isBuffering: boolean
): {
  flushText: string;
  newBuffer: string;
  newIsBuffering: boolean;
  toolCallFound: { name: string; arguments: string } | null;
} {
  const TARGET_START = "<longcat_tool_call>";
  const TARGET_END = "</longcat_tool_call>";

  let currentBuffer = buffer;
  let currentIsBuffering = isBuffering;
  let flushText = "";
  let toolCallFound: { name: string; arguments: string } | null = null;

  let changed = true;
  while (changed) {
    changed = false;

    if (currentIsBuffering) {
      const endIdx = currentBuffer.indexOf(TARGET_END);
      if (endIdx !== -1) {
        const fullBlockEnd = endIdx + TARGET_END.length;
        const xmlBlock = currentBuffer.substring(0, fullBlockEnd);
        const parsed = parseLongcat(xmlBlock);
        if (parsed) {
          toolCallFound = parsed;
        }
        currentBuffer = currentBuffer.substring(fullBlockEnd);
        currentIsBuffering = false;
        changed = true;
      }
    } else {
      const startIdx = currentBuffer.indexOf(TARGET_START);
      if (startIdx !== -1) {
        flushText += currentBuffer.substring(0, startIdx);
        currentBuffer = currentBuffer.substring(startIdx);
        currentIsBuffering = true;
        changed = true;
      } else {
        let matchedPrefixLength = 0;
        for (let len = Math.min(TARGET_START.length - 1, currentBuffer.length); len > 0; len--) {
          const suffix = currentBuffer.substring(currentBuffer.length - len);
          const prefix = TARGET_START.substring(0, len);
          if (suffix === prefix) {
            matchedPrefixLength = len;
            break;
          }
        }

        if (matchedPrefixLength > 0) {
          flushText += currentBuffer.substring(0, currentBuffer.length - matchedPrefixLength);
          currentBuffer = currentBuffer.substring(currentBuffer.length - matchedPrefixLength);
        } else {
          flushText += currentBuffer;
          currentBuffer = "";
        }
      }
    }
  }

  return {
    flushText,
    newBuffer: currentBuffer,
    newIsBuffering: currentIsBuffering,
    toolCallFound,
  };
}

export async function GET(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json([]);
    }

    const url = new URL(req.url);
    const agentId = url.searchParams.get("agentId");
    const agentType = url.searchParams.get("agentType");

    let finalAgentId = agentId;

    if (!finalAgentId) {
      if (!agentType) {
        return NextResponse.json({ error: "Missing agentId or agentType" }, { status: 400 });
      }
      const { agentConfig } = await getOrCreateDemoEntities(agentType);
      finalAgentId = agentConfig.id;
    }

    const messages = await supabaseFetch(`/Message?agentId=eq.${finalAgentId}&order=createdAt.asc`);

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

    const encoder = new TextEncoder();

    // Create the ReadableStream to stream SSE chunks
    const stream = new ReadableStream({
      async start(controller) {
        const push = (type: string, content: any) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, content })}\n\n`));
          } catch (e) {
            // Stream might be closed
          }
        };

        try {
          // 1. Get or create startup and agent config in DB
          push("debug", "🔌 Connessione a Supabase in corso...");
          let startup;
          let agentConfig;

          if (body.agentId) {
            try {
              const configs = await supabaseFetch(`/AgentConfig?id=eq.${body.agentId}&select=*`);
              if (configs && configs.length > 0) {
                agentConfig = configs[0];
                const startups = await supabaseFetch(`/Startup?id=eq.${agentConfig.startupId}&select=*`);
                if (startups && startups.length > 0) {
                  startup = startups[0];
                }
              }
            } catch (err: any) {
              console.error("Error retrieving agentConfig by agentId:", err.message);
            }
          }

          if (!agentConfig || !startup) {
            const entities = await getOrCreateDemoEntities(agentType);
            startup = entities.startup;
            agentConfig = entities.agentConfig;
          }

          // 2. Save incoming user message
          push("debug", "💾 Salvataggio messaggio utente...");
          await supabaseFetch(`/Message`, {
            method: "POST",
            body: JSON.stringify({
              agentId: agentConfig.id,
              role: "user",
              content: message,
            }),
          });

          // Extract settings with fallbacks
          const memorySettings = {
            contextMessages: 20,
            useLongTermMemory: true,
            autoSaveInteractions: true,
            recencyBias: 0.5,
            temperature: 0.7,
            ...(settings?.memorySettings || {})
          };
          const knowledgeSettings = {
            usePatterns: true,
            usePlaybooks: true,
            useOutcomes: true,
            minSuccessRate: 50,
            ...(settings?.knowledgeSettings || {})
          };

          // 3. Retrieve single session memory
          push("debug", "🧠 Caricamento cronologia della chat...");
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
          push("debug", "🧠 Sincronizzazione memoria condivisa del team...");
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

          // 5. Semantic Pattern Search
          push("debug", "📊 Ricerca semantica pattern di successo pertinenti...");
          let patternIndex = "";
          if (knowledgeSettings.usePatterns) {
            const minRate = (knowledgeSettings.minSuccessRate || 0) / 100;

            // Semantic search: score ALL patterns against the user message
            // Returns top-7 above relevance threshold (1.5), anti-patterns always included
            const matchedPatterns = await semanticSearchPatterns(
              message,          // raw user query
              minRate,          // success rate floor from settings
              1.5,              // relevance threshold — must score at least this to appear
              7                 // max patterns injected (keeps context lean)
            );

            if (matchedPatterns.length > 0) {
              const antiCount = matchedPatterns.filter((p: any) => p.successRate < 0.4).length;
              const successCount = matchedPatterns.length - antiCount;
              push("debug", `📊 ${matchedPatterns.length} pattern pertinenti trovati (${successCount} successo, ${antiCount} anti-pattern)`);

              patternIndex = `\n\nCONOSCENZE/PATTERN DI PIATTAFORMA (selezionati per rilevanza semantica con il messaggio attuale):
CRITICAL: Non spiegare all'utente che possiedi strumenti di ricerca, non menzionare mai i tool e non chiedere mai al founder di fornirti un ID. Per ogni pattern che è pertinente alla risposta, sei OBBLIGATO ad invocare AUTOMATICAMENTE lo strumento 'get_knowledge_pattern_details' per caricarne i dettagli completi PRIMA di rispondere. Puoi invocare il tool più volte se più pattern sono rilevanti.
${matchedPatterns.map((p: any) => {
  const rateLabel = p.successRate < 0.4 ? "⚠️ ANTI-PATTERN" : `✅ ${(p.successRate * 100).toFixed(0)}% successo`;
  return `- ID: [${p.id}] | "${p.title}" | ${rateLabel}`;
}).join("\n")}`;
            } else {
              push("debug", "📊 Nessun pattern sufficientemente pertinente trovato per questo messaggio");
            }
          }

          // 6. Retrieve Playbooks
          push("debug", "📋 Scansione dei Playbooks attivi...");
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

          // Retrieve long-term memories (Mnemosyne)
          let mnemosyneContext = "";
          if (memorySettings.useLongTermMemory) {
            push("debug", "🧠 Ricerca ricordi mnemonici (Mnemosyne)...");
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

          // Compile system prompt
          const enabledTools = (agentConfig.settings as any)?.enabledTools || [
            "get_knowledge_pattern_details",
            "webSearch",
            "getStartupInfo",
            "getCustomMetrics",
            "readWebPage"
          ];
          const customDescriptions = (agentConfig.settings as any)?.customDescriptions || {};

          // Construct tools description for system prompt dynamically
          const toolDescItems: string[] = [];
          if (enabledTools.includes("webSearch")) {
            toolDescItems.push(`- 'webSearch': ${customDescriptions.webSearch || "Esegue una ricerca in tempo reale su internet tramite DuckDuckGo per trovare notizie recenti, trend, informazioni finanziarie e link utili."}`);
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

          const toolsSection = toolDescItems.length > 0
            ? `Strumenti a tua disposizione:\n${toolDescItems.join("\n")}`
            : `Non hai strumenti a tua disposizione al momento.`;

          let rulesSection = "";
          if (enabledTools.includes("webSearch") || enabledTools.includes("readWebPage")) {
            rulesSection = `\nRegole operative:
- Hai accesso in tempo reale a internet: quando l'utente ti chiede notizie recenti, trend, o eventi esterni, usa sempre 'webSearch' ed eventualmente 'readWebPage' per leggere la pagina di notizie e riportare i fatti esatti.
- Non dire mai all'utente che non hai accesso in tempo reale a internet o che non puoi leggere le notizie. Se ti viene chiesto di cercare notizie (es: ANSA o ultime novità), usa 'webSearch' per trovare i link pertinenti, e subito dopo usa 'readWebPage' sull'URL per estrarre e riportare i titoli delle notizie di oggi.`;
          }

          const systemPrompt = `${getSystemPrompt(agentType)}

Informazioni Startup (${startup.name}):
- Settore: ${startup.sector}
- Fase: ${startup.phase}
- MRR: $${startup.mrr}
- Utenti: ${startup.users}
- Burn Rate: $${startup.burnRate}/mese
- Runway: ${startup.runway} mesi

${patternIndex}${playbookContext}${crossAgentContext}${mnemosyneContext}

${toolsSection}
${rulesSection}
- Fornisci consigli pratici e specifici per la situazione attuale della startup. Sii conciso ma esaustivo.`;

          const apiMessages = [
            { role: "system", content: systemPrompt },
            ...historyMessages,
            { role: "user", content: message },
          ];

          const selectedModel = modelId || DEFAULT_MODEL;
          const modelInfo = findModel(selectedModel);
          const modelToUse = modelInfo ? modelInfo.id : DEFAULT_MODEL;

          // Define Tools dynamically
          const tools: any[] = [];

          if (enabledTools.includes("get_knowledge_pattern_details")) {
            tools.push({
              type: "function",
              function: {
                name: "get_knowledge_pattern_details",
                description: customDescriptions.get_knowledge_pattern_details || "Recupera i dettagli completi (analisi qualitativa, fattori di successo, checklist errori) di una specifica conoscenza o pattern inserendo il suo ID.",
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
            });
          }

          if (enabledTools.includes("webSearch")) {
            tools.push({
              type: "function",
              function: {
                name: "webSearch",
                description: customDescriptions.webSearch || "Esegue una ricerca web su Internet in tempo reale per reperire informazioni aggiornate, notizie, trend di mercato e dati finanziari utili.",
                parameters: {
                  type: "object",
                  properties: {
                    query: { type: "string", description: "La query di ricerca testuale (es: 'trend SaaS 2026', 'valutazione media seed AI')." }
                  },
                  required: ["query"]
                }
              }
            });
          }

          if (enabledTools.includes("getStartupInfo")) {
            tools.push({
              type: "function",
              function: {
                name: "getStartupInfo",
                description: customDescriptions.getStartupInfo || "Recupera le informazioni generali e le metriche finanziarie chiave della startup (nome, settore, fase, MRR, utenti, burn rate, runway).",
                parameters: { type: "object", properties: {} }
              }
            });
          }

          if (enabledTools.includes("getCustomMetrics")) {
            tools.push({
              type: "function",
              function: {
                name: "getCustomMetrics",
                description: customDescriptions.getCustomMetrics || "Recupera l'elenco di tutte le metriche personalizzate e i relativi grafici configurati per la dashboard (titolo, valore, formula, andamento dati).",
                parameters: { type: "object", properties: {} }
              }
            });
          }

          if (enabledTools.includes("readWebPage")) {
            tools.push({
              type: "function",
              function: {
                name: "readWebPage",
                description: customDescriptions.readWebPage || "Scarica e legge il testo contenuto in una pagina web/URL specificato per estrarne notizie, articoli o informazioni dettagliate.",
                parameters: {
                  type: "object",
                  properties: {
                    url: { type: "string", description: "L'indirizzo URL completo della pagina da leggere (es: 'https://www.ansa.it/sito/notizie/topnews/index.shtml')." }
                  },
                  required: ["url"]
                }
              }
            });
          }

          console.log("[Chat Stream] starting ReAct loop. Model:", modelToUse);
          push("debug", `🖥️ Generazione risposta in corso con il modello: ${modelInfo?.name || modelToUse}...`);

          let loopCount = 0;
          const maxLoops = 90; // Hermes Agent maximum iterations limit
          let keepRunning = true;
          let replyText = "";
          const currentMessages = [...apiMessages];

          while (keepRunning && loopCount < maxLoops) {
            loopCount++;
            
            if (loopCount > 1) {
              push("debug", `🖥️ Esecuzione passaggi di ragionamento successivi (iterazione ${loopCount}/${maxLoops})...`);
            }

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
                messages: currentMessages,
                tools: tools,
                temperature: memorySettings.temperature ?? 0.7,
                stream: true,
                max_tokens: 4000,
              }),
            });

            if (!res.ok) {
              const errText = await res.text();
              push("error", `OpenRouter API Error: ${errText}`);
              controller.close();
              return;
            }

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            let done = false;
            let currentAssistantText = "";
            let reasoningText = "";
            let isToolCallRequested = false;
            let toolCallId = "";
            let toolArguments = "";
            let toolFunctionName = "";
            let buffer = "";

            let streamTextBuffer = "";
            let isBufferingLongcat = false;

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
                      isToolCallRequested = true;
                      const tc = delta.tool_calls[0];
                      if (tc.id) toolCallId = tc.id;
                      if (tc.function?.name) toolFunctionName = tc.function.name;
                      if (tc.function?.arguments) toolArguments += tc.function.arguments;
                    }

                    // Standard Text Content
                    if (delta.content) {
                      const text = delta.content;
                      streamTextBuffer += text;
                      const streamRes = processStreamBuffer(streamTextBuffer, isBufferingLongcat);
                      streamTextBuffer = streamRes.newBuffer;
                      isBufferingLongcat = streamRes.newIsBuffering;
                      if (streamRes.flushText) {
                        currentAssistantText += streamRes.flushText;
                        replyText += streamRes.flushText;
                        push("text", streamRes.flushText);
                      }
                      if (streamRes.toolCallFound) {
                        isToolCallRequested = true;
                        toolCallId = "call_" + Date.now();
                        toolFunctionName = streamRes.toolCallFound.name;
                        toolArguments = streamRes.toolCallFound.arguments;
                      }
                    }
                  } catch (e) {
                    // Partial JSON chunk
                  }
                }
              }
            }

            // Handle if there's leftover in streamTextBuffer
            if (streamTextBuffer) {
              if (isBufferingLongcat || streamTextBuffer.includes("<longcat_tool_call>")) {
                const fullText = streamTextBuffer.includes("</longcat_tool_call>") 
                  ? streamTextBuffer 
                  : streamTextBuffer + "</longcat_tool_call>";
                const parsedTool = parseLongcat(fullText);
                if (parsedTool) {
                  isToolCallRequested = true;
                  toolCallId = "call_" + Date.now();
                  toolFunctionName = parsedTool.name;
                  toolArguments = parsedTool.arguments;
                }
              } else {
                currentAssistantText += streamTextBuffer;
                replyText += streamTextBuffer;
                push("text", streamTextBuffer);
              }
              streamTextBuffer = "";
            }

            // Se è stato richiesto un tool call, lo eseguiamo ed iteriamo
            if (isToolCallRequested && toolArguments) {
              // Salva la richiesta dell'assistente nello storico
              currentMessages.push({
                role: "assistant",
                content: currentAssistantText || null,
                tool_calls: [{
                  id: toolCallId,
                  type: "function",
                  function: { name: toolFunctionName, arguments: toolArguments }
                }]
              });

              let toolContent = "";
              let args: any = {};
              try {
                args = JSON.parse(toolArguments);
              } catch (e) {
                console.error("Failed to parse tool arguments:", toolArguments);
              }

              push("debug", `⚙️ Esecuzione automatica tool ${toolFunctionName}...`);

              if (toolFunctionName === "get_knowledge_pattern_details") {
                const patternId = args.patternId;
                let content = "Pattern non trovato o ID errato.";
                if (patternId) {
                  const patterns = await supabaseFetch(`/Pattern?id=eq.${patternId}&select=*`);
                  if (patterns && patterns.length > 0) {
                    const p = patterns[0];
                    content = `Dettagli completi Pattern:
Titolo: ${p.title}
Descrizione/Analisi: ${p.description}
Tasso di successo: ${(p.successRate * 100).toFixed(0)}%
Confidenza: ${(p.confidence * 100).toFixed(0)}%
Fattori chiave successo: ${p.keyFactors?.join(", ") || "nessuno"}
Fattori di fallimento / errori da evitare: ${p.failureModes?.join(", ") || "nessuno"}`;
                  }
                }
                toolContent = content;
              } else if (toolFunctionName === "webSearch") {
                const searchResults = await searchWeb(args.query || "");
                toolContent = JSON.stringify(searchResults);
              } else if (toolFunctionName === "getStartupInfo") {
                const freshStartup = await supabaseFetch(`/Startup?id=eq.${startup.id}&select=*`);
                const finalStartup = freshStartup && freshStartup.length > 0 ? freshStartup[0] : startup;
                toolContent = JSON.stringify(finalStartup);
              } else if (toolFunctionName === "getCustomMetrics") {
                const metrics = await getMetricsData();
                toolContent = JSON.stringify(metrics);
              } else if (toolFunctionName === "readWebPage") {
                const textContent = await readWebPage(args.url || "");
                toolContent = textContent;
              } else {
                toolContent = `Unknown function: ${toolFunctionName}`;
              }

              // Salva l'output del tool nello storico dei messaggi ed esegui la prossima iterazione
              currentMessages.push({
                role: "tool",
                tool_call_id: toolCallId,
                name: toolFunctionName,
                content: toolContent
              });
            } else {
              // Nessun tool richiesto, risposta finale ricevuta, terminiamo il loop
              keepRunning = false;
            }
          }


          // 9. Save assistant response
          push("debug", "💾 Salvataggio risposta finale nel database...");
          await supabaseFetch(`/Message`, {
            method: "POST",
            body: JSON.stringify({
              agentId: agentConfig.id,
              role: "assistant",
              content: replyText,
            }),
          });

          // 10. Optionally save interaction log
          if (memorySettings.autoSaveInteractions) {
            await supabaseFetch(`/Interaction`, {
              method: "POST",
              body: JSON.stringify({
                startupId: startup.id,
                agentType,
                category: "chat",
                advice: replyText,
                context: {
                  userMessage: message,
                  modelUsed: modelToUse,
                  startupPhase: startup.phase,
                  startupSector: startup.sector,
                },
              }),
            });
          }

          // 11. Auto extract memories in background (Mnemosyne)
          if (memorySettings.useLongTermMemory) {
            autoExtractMemories(agentConfig.id, message, replyText)
              .then(extracted => {
                console.log(`[Mnemosyne] Extracted ${extracted.length} memories.`);
              })
              .catch(err => {
                console.error("[Mnemosyne] Error in background extraction:", err.message);
              });
          }

          push("done", { sessionId: agentConfig.id, model: modelToUse });
          controller.close();
        } catch (err: any) {
          console.error("Stream execution error:", err.message);
          push("error", err.message);
          try { controller.close(); } catch (_) {}
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
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
