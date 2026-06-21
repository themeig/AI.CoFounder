import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import * as path from "path";
import { exec } from "child_process";
import * as os from "os";

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

async function executePython(code: string): Promise<string> {
  const tempDir = os.tmpdir();
  const fileName = `script_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.py`;
  const filePath = path.join(tempDir, fileName);
  
  try {
    await fs.writeFile(filePath, code, "utf-8");
    
    return new Promise((resolve) => {
      exec(`python "${filePath}"`, { timeout: 15000 }, (error, stdout, stderr) => {
        if (error && (error.message.includes("not found") || error.message.includes("is not recognized"))) {
          // Fallback to 'py' command on Windows if 'python' isn't explicitly found
          exec(`py "${filePath}"`, { timeout: 15000 }, (error2, stdout2, stderr2) => {
            fs.unlink(filePath).catch(() => {});
            if (error2) {
              resolve(`Error executing Python: is Python installed on the host?\n${stderr2 || error2.message}`);
            } else {
              resolve(stdout2 || "Execution finished with no output.");
            }
          });
        } else {
          fs.unlink(filePath).catch(() => {});
          if (error) {
            resolve(`Error:\n${stderr || error.message}`);
          } else {
            resolve(stdout || "Execution finished with no output.");
          }
        }
      });
    });
  } catch (err: any) {
    return `Error creating script: ${err.message}`;
  }
}

async function executeTypeScript(code: string): Promise<string> {
  const tempDir = os.tmpdir();
  const fileName = `script_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.js`;
  const filePath = path.join(tempDir, fileName);
  
  try {
    // Rimuovi tipi ed interfacce typescript per eseguirlo come JS in node
    const cleanCode = code
      .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
      .replace(/type\s+\w+\s*=[^;]+/g, '')
      .replace(/\b(private|public|protected|readonly)\b/g, '')
      .replace(/:\s*(number|string|boolean|any|void|object|unknown|never|undefined|null|Function|Array<[^>]+>|[A-Z]\w*(?!\.)(?:\[\])?)\b(?!['"`])/g, '')
      .replace(/\s+as\s+(number|string|boolean|any|void|object|unknown|never|undefined|null|[A-Z]\w*)/g, '')
      .replace(/<[A-Z]>/g, '')
      .replace(/export\s+/g, '')
      .replace(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?/g, '')
      .replace(/import\s+['"][^'"]+['"];?/g, '');

    await fs.writeFile(filePath, cleanCode, "utf-8");
    
    return new Promise((resolve) => {
      exec(`node "${filePath}"`, { timeout: 15000 }, (error, stdout, stderr) => {
        fs.unlink(filePath).catch(() => {});
        if (error) {
          resolve(`Error:\n${stderr || error.message}`);
        } else {
          resolve(stdout || "Execution finished with no output.");
        }
      });
    });
  } catch (err: any) {
    return `Error creating script: ${err.message}`;
  }
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

async function callAgentInternal(agentType: string, task: string, context: string, startup: any): Promise<{ response: string; success: boolean }> {
  try {
    const systemPrompt = `${getAgentSystemPrompt(agentType)}

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
          context: { type: "string", description: "Contesto aggiuntivo opzionale." }
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
      description: "Crea un nuovo agente nel team. Usa SOLO dopo conferma esplicita del fondatore.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string", enum: ["strategy", "tech", "finance", "marketing", "legal", "operations"] }
        },
        required: ["name", "type"]
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
      description: "Ricerca web in tempo reale su DuckDuckGo.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
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
  }
];

export async function POST(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const push = (type: string, content: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, content })}\n\n`));
        } catch {}
      };

      try {
        if (!OPENROUTER_API_KEY) { push("error", "OpenRouter non configurato"); controller.close(); return; }

        const { messages, cofounderName = "coFounder", modelId } = await req.json();

        // Load startup
        const users = await supabaseFetch(`/User?email=eq.demo@agentfoundry.ai&select=id`);
        if (!users?.length) { push("error", "Utente demo non trovato"); controller.close(); return; }
        const startups = await supabaseFetch(`/Startup?userId=eq.${users[0].id}&select=*`);
        if (!startups?.length) { push("error", "Startup demo non trovata"); controller.close(); return; }
        const startup = startups[0];
        const startupId = startup.id;

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
- 'delegateToAgent' → Attiva un agente specializzato su un task specifico. Fornisci task dettagliato e contesto.
- 'suggestCreateAgent' → Proponi la creazione di un agente mancante (con nome e motivazione).
- 'getActiveAgents' → Recupera la lista completa del team con stato attivo/inattivo.

**Gestione Startup:**
- 'getStartupInfo' → Carica il profilo completo della startup (settore, fase, metriche base).
- 'updateStartupMetrics' → Aggiorna MRR, utenti, burn rate, runway — dati in tempo reale.
- 'createAgent' → Crea un nuovo agente nel team (SOLO dopo conferma esplicita del fondatore).

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
- 'webSearch' → Ricerca in tempo reale su DuckDuckGo: trend, competitor, notizie, dati di mercato.
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
- Non menzionare mai all'utente i nomi tecnici dei tool interni (es: non dire "uso runPythonScript" o "ho chiamato getActiveAgents"). Parla invece di "ho fatto girare una simulazione nella sandbox", "ho controllato il team", "ho delegato l'agente finanziario", ecc.
- Usa elenchi puntati e tabelle per strutturare i dati, evitando muri di testo.
- Sii conciso ma completo: ogni risposta deve essere immediatamente actionable.
- Se non conosci un dato o un trend di mercato, non inventarlo: usa lo strumento 'webSearch'.
- Non chiedere mai il permesso al fondatore per usare gli strumenti o delegare: agisci in autonomia, esegui i task e mostra direttamente i risultati dell'elaborazione.
- **SVILUPPO NEL WORKSPACE (Client-side):** Quando crei componenti di interfaccia utente interattivi (HTML, CSS, JS) o script client-side (TypeScript/JavaScript) da visualizzare o testare nel Workspace, inseriscili all'interno di blocchi di codice markdown. Inserisci SEMPRE un commento nella primissima riga del codice col nome del file (es: \`// app.js\`, \`/* styles.css */\` o \`<!-- index.html -->\`) così che la console/workspace client possa caricarli ed eseguirli. Il Workspace agisce come un compilatore ed anteprima live per web app (Hot Reload): combina i file HTML, CSS e JS/TS generati in un'unica anteprima interattiva iframe con supporto split-screen, catturando anche tutti i log di console emessi.
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

        let apiMessages: any[] = [{ role: "system", content: systemPrompt }, ...messages];
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
                    currentAssistantText += text;
                    push("content", text);
                  }
                } catch (e) {
                  // Partial JSON chunk
                }
              }
            }
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
                const newAgent = await supabaseFetch(`/AgentConfig`, {
                  method: "POST",
                  body: JSON.stringify({ startupId, type: args.type.toLowerCase(), name: args.name, isActive: true })
                });
                result = newAgent?.[0] || { success: true };
                executedTools.push({ name: functionName, success: true, details: `Agente creato: ${args.name}`, arguments: args, result });

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
                result = await searchWeb(args.query);
                executedTools.push({ name: functionName, success: true, details: `Ricerca "${args.query}" completata.`, arguments: args, result });

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

        push("done", { content: finalContent, executedTools, delegations, agentSuggestion });
        controller.close();

      } catch (err: any) {
        console.error("coFounder Orchestrator Stream Error:", err);
        push("error", err.message);
        controller.close();
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
