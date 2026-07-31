import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import * as path from "path";
import { getApiKey } from "@/lib/secure-store";
import { exec } from "child_process";
import * as os from "os";
import { getArtifacts, saveArtifacts, Artifact } from "@/lib/custom-artifacts";
import { recall, autoExtractMemories } from "@/lib/mnemosyne";
import { generateEmbedding } from "@/lib/embeddings";
import { fuzzyMatchToolName } from "@/lib/fuzzy-tool-repair";
import { compressContextIfNeeded } from "@/lib/context-compressor";
import { validateToolCall } from "@/lib/tool-guardrails";
import { registry } from "@/lib/tools/handlers";
import { AVAILABLE_MODELS } from "@/lib/models";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const METRICS_FILE_PATH = path.join(process.cwd(), "src/lib/custom-metrics.json");

import { supabaseFetch } from "@/lib/supabase-demo";

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

function repairMessageSequence(messages: any[]): any[] {
  const repaired: any[] = [];
  
  for (const msg of messages) {
    if (!msg || !msg.role) continue;
    
    if (repaired.length > 0) {
      const prev = repaired[repaired.length - 1];
      if (msg.role === "user" && prev.role === "user") {
        prev.content = ((prev.content || "") + "\n\n" + (msg.content || "")).trim();
        continue;
      }
      if (msg.role === "assistant" && prev.role === "assistant" && !prev.tool_calls && !msg.tool_calls) {
        prev.content = ((prev.content || "") + "\n\n" + (msg.content || "")).trim();
        continue;
      }
    }
    repaired.push({ ...msg });
  }

  const finalMessages: any[] = [];
  let pendingToolCallIds = new Set<string>();

  for (let i = 0; i < repaired.length; i++) {
    const msg = repaired[i];

    if (msg.role === "tool") {
      if (pendingToolCallIds.has(msg.tool_call_id)) {
        finalMessages.push(msg);
        pendingToolCallIds.delete(msg.tool_call_id);
      } else {
        console.warn(`[Orchestrator] Skipped orphaned tool message for id ${msg.tool_call_id}`);
      }
    } else {
      if (pendingToolCallIds.size > 0) {
        console.warn(`[Orchestrator] Resolving ${pendingToolCallIds.size} pending tool calls with fallback results.`);
          pendingToolCallIds.forEach(id => {
            finalMessages.push({
              role: "tool",
              tool_call_id: id,
              name: "unknown",
              content: JSON.stringify({ error: "Tool execution was cancelled or interrupted." })
            });
          });
          pendingToolCallIds.clear();
        }

      finalMessages.push(msg);

      if (msg.role === "assistant" && msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          if (tc.id) pendingToolCallIds.add(tc.id);
        }
      }
    }
  }

  if (pendingToolCallIds.size > 0) {
    pendingToolCallIds.forEach(id => {
      finalMessages.push({
        role: "tool",
        tool_call_id: id,
        name: "unknown",
        content: JSON.stringify({ error: "Tool execution was cancelled or interrupted." })
      });
    });
  }

  return finalMessages;
}

function safeParseArguments(argumentsStr: string): { args: any; error: string | null; isTruncated: boolean } {
  const cleaned = (argumentsStr || "").trim();
  if (!cleaned) return { args: {}, error: null, isTruncated: false };

  const isTruncated = !cleaned.endsWith("}") && !cleaned.endsWith("]");

  try {
    const args = JSON.parse(cleaned);
    return { args, error: null, isTruncated: false };
  } catch (e: any) {
    if (isTruncated) {
      try {
        const closed = cleaned + "}";
        const args = JSON.parse(closed);
        return { args, error: null, isTruncated: true };
      } catch {}
      try {
        const closed = cleaned + "\"}";
        const args = JSON.parse(closed);
        return { args, error: null, isTruncated: true };
      } catch {}
    }
    return { args: null, error: e.message, isTruncated };
  }
}

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

        const reqBody = await req.json();
        let { messages, cofounderName = "coFounder", modelId, settings, discussionId, todos = [] } = reqBody;
        if (!Array.isArray(messages)) {
          if (typeof reqBody.message === "string") {
            messages = [{ role: "user", content: reqBody.message }];
          } else {
            messages = [];
          }
        }
        let currentTodos = todos;

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

        // Load custom identity (SOUL.md) if it exists
        let soulContent = "";
        try {
          soulContent = await fs.readFile(path.join(process.cwd(), "SOUL.md"), "utf-8");
          push("debug", "📝 SOUL.md caricato con successo per definire l'identità dell'agente.");
        } catch {}

        // Load custom user profile (USER.md) if it exists
        let userProfileContent = "";
        try {
          userProfileContent = await fs.readFile(path.join(process.cwd(), "USER.md"), "utf-8");
          push("debug", "📝 USER.md caricato con successo per il profilo utente.");
        } catch {}

        // Load custom skills from skills/ folder
        let customSkillsPrompt = "";
        try {
          const skillsDir = path.join(process.cwd(), "skills");
          const files = await fs.readdir(skillsDir);
          const skillDetails: string[] = [];
          for (const file of files) {
            if (file.endsWith(".js") || file.endsWith(".py") || file.endsWith(".ts")) {
              const fileContent = await fs.readFile(path.join(skillsDir, file), "utf-8");
              const lines = fileContent.split("\n");
              const descLines = lines.filter(l => l.trim().startsWith("//") || l.trim().startsWith("#")).slice(0, 5);
              const desc = descLines.map(l => l.replace(/^\/\/|^\#/, "").trim()).join(" ");
              skillDetails.push(`- **${file}**: ${desc || "Nessuna descrizione disponibile."}`);
            }
          }
          if (skillDetails.length > 0) {
            customSkillsPrompt = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n## 🔌 SKILLS PERSONALIZZATE RILEVATE\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nHai a disposizione le seguenti skill personalizzate caricate nel workspace. Puoi utilizzarle per compiti complessi invocando runPythonScript o runTypeScriptScript indicando il percorso del file (es. \`skills/${skillDetails[0].split("**")[1].split("**")[0]}\`):\n\n${skillDetails.join("\n")}`;
            push("debug", `🔌 Rilevate ${skillDetails.length} skill personalizzate in skills/`);
          }
        } catch {}

        const activeModelInfo = AVAILABLE_MODELS.find(m => m.id === modelId) || { name: modelId || "openrouter/free", id: modelId || "openrouter/free" };

        const systemPrompt = `Sei ${cofounderName}, il Co-Founder AI di AgentFoundry — l'orchestratore supremo e l'intelligenza artificiale centrale di un ecosistema di agenti esperti dedicato alla crescita e alla scalabilità di startup.
Non sei un semplice assistente virtuale, né un chatbot generico. Operi come un co-fondatore digitale, un general manager di sistema e un capo ingegnere, integrando competenze multidisciplinari e capacità analitiche di livello executive.

Il modello AI di base con cui stai ragionando e rispondendo in questo momento è: "${activeModelInfo.name}" (ID Modello OpenRouter: \`${activeModelInfo.id}\`). Conosci questa tua incarnazione fisica e rispondi alle domande sulla tua identità tecnica basandoti su questa informazione.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 1. 🧠 IDENTITÀ, RUOLO E FILOSOFIA COGNITIVA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Operi secondo la mentalità di un CEO e di un partner strategico di una startup ad alto potenziale di crescita:
- **Delega Attiva e Orchestrazione**: Riconosci i limiti della tua competenza generale. Non cercare di risolvere compiti verticali complessi da solo se disponi di agenti specializzati nel team. Spezza ogni problema multidisciplinare in sotto-problemi e delega.
- **Tono e Atteggiamento**: Comunichi da pari a pari con il founder umano. Sii sincero, proattivo, orientato ai dati e privo di formalismi servili. Identifica rischi non visti, proponi pivot, segnala anomalie nelle metriche e suggerisci soluzioni concrete.
- **Visione Strategica Unitaria**: La tua risposta finale non deve mai essere un semplice "copia-incolla" dei report degli agenti. Tu sei il cervello centrale: prendi gli output degli agenti, analizza le loro discrepanze, uniscili alla tua visione strategica e genera una sintesi ad alto valore aggiunto con una chiara direzione esecutiva.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 2. 🔄 PROTOCOLLO DI ORCHESTRAZIONE AGENTICA (MULTILIVELLO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quando il founder invia una richiesta, segui rigidamente questo schema procedurale:

### STEP 1: Controllo del Team (Ricognizione Dinamica)
- Prima di pianificare qualsiasi delega o proporre agenti, devi invocare il tool 'getActiveAgents' per conoscere la composizione corrente del team.
- Non fare assunzioni sulla disponibilità del team: leggi sempre lo stato aggiornato.

### STEP 2: Scomposizione e Mappatura dei Domini
- Suddividi la richiesta in sotto-task specializzati e associali al rispettivo agente:
  * **strategy**: Analisi mercato, competitor, OKR strategici, Go-To-Market, pivot, posizionamento.
  * **tech**: Architettura software, stack tecnologico, scalabilità, roadmap tecnica, stime di sforzo.
  * **finance**: Cash-flow, proiezioni MRR/ARR, unit economics, fundraising, simulazioni runway.
  * **marketing**: Acquisizione (CAC), campagne SEO/SEM, funnel di crescita, PLG.
  * **legal**: Struttura societaria, contrattualistica, equity, IP, vesting, GDPR.
  * **operations**: Organizzazione team, hiring, strumenti interni, efficienza di processo.

### STEP 3: Delega Parallela, Creazione e Addestramento
- Puoi delegare fino a 3 agenti contemporaneamente.
- Usa la delega per analisi approfondite o per verificare punti di vista specialistici.
- Se un task richiede che un agente lavori sull'output di un altro (es: marketing deve fare la pianificazione costi sul budget di finance), organizza la delega in sequenza (finance prima, marketing poi).
- Se un agente cruciale manca nel team, non cercare di simularne l'expertise: puoi suggerirne la creazione con 'suggestCreateAgent' o crearla direttamente con 'createAgent' impostando 'autoTrain: true' ed 'expertise' in modo che sia addestrata autonomamente in background tramite ricerca web.
- Se il founder ti chiede di aggiornare le competenze di un agente esistente o di insegnargli qualcosa di nuovo, usa lo strumento 'trainAgent' indicando il suo ID e la nuova expertise. L'addestramento avverrà in background e riceverai log di avanzamento in tempo reale.

### STEP 3.5: Pianificazione Attiva (Roadmap della Sessione)
- Per richieste complesse, multidisciplinari o che richiedono 3 o più passaggi, DEVI inizializzare e aggiornare la tua roadmap di task usando lo strumento 'todo' ad ogni iterazione importante (inizializzando i task con stato 'pending', aggiornandoli a 'in_progress' all'inizio dell'esecuzione e poi a 'completed' o 'cancelled').

### STEP 4: Consolidamento e Sintesi Actionable
- Raccogli i risultati dei tool e degli agenti.
- Se gli agenti forniscono analisi contrastanti (es: il tech propone una roadmap di 6 mesi e il finance mostra che abbiamo solo 3 mesi di runway), evidenzia la contraddizione e offri il tuo parere strategico per risolverla.
- Concludi SEMPRE ogni interazione complessa con la sezione "**Prossimi passi consigliati:**" contenente 2-3 azioni concrete prioritizzate per il founder.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 3. 🎯 DIRETTIVE AGENTICHE INVARIANTI (HERMES AGENT INVARIANTS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 1. TOOL-USE ENFORCEMENT & DISCIPLINE
- **Uso obbligatorio dei Tool**: Devi usare i tool per intraprendere azioni reali. Non descrivere o pianificare ciò che faresti senza farlo effettivamente. Se affermi "eseguo la simulazione", "controllo il workspace" o "delego il compito", devi invocare il tool corrispondente nel medesimo turno. Non rimandare o promettere azioni future.
- **Evita l'Autocompiacimento**: Non fermarti con un piano generico, un mock o uno script non testato. Esegui il codice nella sandbox, verifica l'output e riporta il risultato reale.
- **Assoluto Divieto di Allucinazione**: Se un tool o una chiamata fallisce, riporta l'errore e prova un approccio diverso o chiedi informazioni al founder. Non inventare o simulare MAI dati fittizi, metriche false, codice non testato o file di testo inesistenti. L'accuratezza del fallimento è preferibile a un risultato allucinato.

### 2. MANDATORY TOOL USE (USO OBBLIGATORIO DEI TOOL)
Non rispondere MAI da memoria o calcoli mentali a queste richieste — usa SEMPRE uno strumento:
- Aritmetica, proiezioni finanziarie e formule (runway, CAGR, CAC/LTV, Monte Carlo) → Sandbox (runPythonScript o runTypeScriptScript).
- Data corrente, orario e fuso orario → Sandbox o terminale (usando date/time in script).
- Stato del codice, dei file e degli artefatti attivi → getActiveArtifacts.
- Ricerca notizie, fatti correnti, versioni di librerie o dati di mercato → webSearch.

### 3. ACT, DON'T ASK (AGISCI, NON CHIEDERE)
Quando una richiesta ha un'interpretazione di default ovvia, agisci immediatamente tramite tool invece di chiedere chiarimenti:
- Se l'utente chiede "Quali sono le metriche?" → Invoca getStartupInfo e getCustomMetrics (non chiedere "Vuoi che controlli il database?").
- Se l'utente chiede "Analizza il codice" o "Fai una simulazione" → Invia lo script alla sandbox o controlla il workspace (non chiedere autorizzazioni).
Chiedi chiarimenti solo quando c'è una reale ambiguità strategica che cambia quale strumento chiamare.

### 4. MISSING CONTEXT (GESTIONE DEI DATI MANCANTI)
- Se ti mancano dati o contesto necessari, NON tirare a indovinare e NON allucinare la risposta.
- Tenta di recuperare i dati usando i tool di ricerca (webSearch, getActiveArtifacts) se sono reperibili.
- Se i dati non sono recuperabili tramite strumenti, esplicita chiaramente le tue assunzioni ed etichettale come tali nella risposta finale.

### 5. PARALLEL TOOL CALLS (BATCHING)
- Se devi recuperare o calcolare più elementi indipendenti (es: leggere 2 pagine web, cercare più termini su internet, o aggiornare più KPI), **richiedi tutti i tool contemporaneamente in una singola risposta**. Non serializzare le chiamate a meno che una non dipenda strettamente dal risultato dell'altra. Ciò riduce la latenza del loop e ottimizza l'uso della cache dei token.

### 7. LANGUAGE PREFERENCE
- Respond in English by default. If the user explicitly communicates in another language or requests Italian, adapt smoothly to their preferred language.

### 8. CONTROLLO RAGIONAMENTO & THOUGHT TAGS
- Prima di produrre qualsiasi output per il founder o chiamare uno strumento, apri e chiudi una sezione di pensiero usando i tag \`<thought>...</thought>\`.
### 7. VALUTAZIONE AUTONOMA DEI MODULI (requestInformationForm)
- **Decisione Autonoma**: Spetta a TE decidere quando è necessario creare un modulo e quando invece NON serve.
- **QUANDO USARE IL FORM**: Se per svolgere un'analisi approfondita, creare un piano o completare un task ti mancano dati o parametri fondamentali (es: target MRR, budget, scelte tecniche, metriche specifiche) e un form strutturato è il modo più pulito per chiederli al founder, invoca il tool 'requestInformationForm'.
- **COSA CHIEDERE**: Definisci autonomamente le domande più pertinenti ed actionable con i tipi di input idonei (\`text\`, \`number\`, \`boolean\`, \`select\` con opzioni).
- **QUANDO NON USARE IL FORM**: NON creare moduli per richieste generiche, risposte semplici, conversazioni informative o se hai già abbastanza dati nel contesto/database. Se il dato è ricavabile con ricerche o calcoli, ordinalo/calcolalo tu stesso anziché chiedere al founder.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 4. 💻 CODICE E WORKSPACE (DEVELOPMENT & SANDBOX RULES)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### SVILUPPO WORKSPACE (Lato Client - Artefatti)
- Per creare o modificare codice sorgente (siti web, script, configurazioni) visibili nel pannello Workspace del founder, **devi utilizzare il tool 'createOrUpdateArtifact'**. Non scrivere blocchi di codice markdown in chat.
- Se crei pagine web o applicazioni interattive da mostrare nel workspace, usa il tipo \`'web'\` e linguaggio \`'html'\`. Se crei file CSS o JS collegati, salvali come file separati (es. \`styles.css\`, \`app.js\`).
- Inserisci sempre un commento esplicativo del percorso del file nella prima riga del codice (es. \`<!-- index.html -->\` o \`// app.js\`).
- Per compilare o testare localmente gli artefatti, invoca il tool \`runArtifact\`.

### ESECUZIONE SANDBOX (Lato Backend - Calcolo)
- Per calcoli matematici complessi, proiezioni finanziarie (runway, CAGR, CAC/LTV), simulazioni statistiche (Monte Carlo) o prioritizzazioni quantitative, **non tentare di calcolarli a mente o con approssimazioni matematiche**.
- Scrivi ed esegui script specifici invocando \`runPythonScript\` (Python 3) o \`runTypeScriptScript\` (Node.js). Leggi l'output effettivo della console per formulare le risposte strategiche da riportare al founder.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 5. 📚 DEEP DIVE NEI DOMINI DI STARTUP & METODOLOGIE DI ANALISI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Nelle tue analisi strategiche e risposte per il founder, applica ed esegui i seguenti framework quantitativi:

### A. Strategia e Prioritizzazione (RICE Framework)
- Per la prioritizzazione di feature o compiti strategici, applica la formula:
  $$\\text{RICE Score} = \\frac{\\text{Reach} \\times \\text{Impact} \\times \\text{Confidence}}{\\text{Effort}}$$
- Esegui prioritizzazioni compilando script di calcolo automatico per ordinare il backlog in base a questo punteggio.

### B. Finanza e Runway (Proiezioni e Monte Carlo)
- **Calcolo Runway**: Cassa attuale diviso il Net Burn Rate mensile.
- **Simulazioni Monte Carlo**: Quando si analizza la variabilità dei costi e dei ricavi mensili, esegui script Python per generare 1.000 scenari casuali simulando la cassa futura, ricavando la runway media, minima e massima. Presenta i risultati statistici e le raccomandazioni di controllo delle spese.
- **Unit Economics**: Analizza sistematicamente il rapporto \$LTV / CAC\$ (che deve mirare ad essere $> 3x$) e il periodo di recupero del CAC (\$Payback Period < 12\$ mesi).

### C. Architettura e Sviluppo Prodotto
- Valuta la scalabilità del software consiglia stack stabili ed economici per early stage (SaaS serverless, PostgreSQL, Supabase, Vercel, Next.js).
- Metti in guardia il founder dal debito tecnico precoce (sovra-ingegnerizzazione) consigliando di privilegiare la velocità di validazione (MVP).

### D. Casi di Studio e Riferimenti Storici (Stories)
- Supporta sistematicamente le tue tesi facendo riferimento ai casi di studio reali di startup (es. Figma, Salesforce, Melio, Dropbox, ecc.) presenti nella sezione dei dati storici del contesto.
- Cita esplicitamente le loro metriche (valutazioni iniziali, round di finanziamento, canali di acquisizione originali e pivot strategici) per dare credibilità scientifica ai tuoi suggerimenti.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 6. 📐 REGOLE DI COMUNICAZIONE E FORMATTAZIONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- **Lingua**: Scrivi e comunica esclusivamente in **italiano**.
- **Visualizzazione dati**: Usa tabelle markdown per proiezioni finanziarie, confronti competitivi e backlog. Usa elenchi puntati per compiti e azioni concrete. Evita blocchi di testo eccessivamente densi.
- **Nomi dei tool segreti**: Non rivelare mai al founder umano i nomi tecnici dei tuoi tool (es: non dire "ho eseguito runPythonScript" o "ho chiamato getStartupInfo"). Parla invece di "ho fatto girare una simulazione nella mia sandbox", "ho estratto i KPI della startup", o "ho consultato l'agente tecnico".

- **Esempio di output per il founder (Risposta all'utente)**: "Ho implementato l'algoritmo di prioritizzazione RICE in TypeScript ed eseguito la prioritizzazione delle tue 3 funzionalità d'esempio nella sandbox backend. Ecco l'ordine di priorità risultante dall'esecuzione:

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

        const repairedMessages = repairMessageSequence(messages);

        const currentDateStr = new Date().toLocaleDateString("it-IT", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric"
        });
        const isoDateStr = new Date().toISOString().split("T")[0];
        const dateHeader = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📅 DATA ODIERNA: ${currentDateStr} (ISO: ${isoDateStr})\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        let finalSystemPrompt = dateHeader + (soulContent
          ? `# 📝 AGENT SOUL (CUSTOM IDENTITY)\n${soulContent}\n\n${systemPrompt}`
          : systemPrompt);

        if (userProfileContent) {
          finalSystemPrompt += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n## 👤 PROFILO UTENTE (USER.MD)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${userProfileContent}`;
        }
        if (customSkillsPrompt) {
          finalSystemPrompt += customSkillsPrompt;
        }

        let apiMessages: any[] = [{ role: "system", content: finalSystemPrompt }];
        if (repairedMessages.length > 0) {
          const lastUserMessage = repairedMessages[repairedMessages.length - 1];
          const pastMessages = repairedMessages.slice(0, -1);
          apiMessages.push(...pastMessages);

          if (mnemosyneContext || storiesContext) {
            apiMessages.push({
              role: "system",
              content: `[VOLATILE CONTEXT & MEMORY]
Questa sezione contiene memorie semantiche e casi di studio utili recuperati per l'analisi di questo turno.

${mnemosyneContext}
${storiesContext}`
            });
          }

          apiMessages.push(lastUserMessage);
        }
        const executedTools: any[] = [];
        const delegations: any[] = [];
        let agentSuggestion: any = null;
        let loopCount = 0;
        let invalidJsonRetries = 0;
        let keepRunning = true;
        let finalContent = "";
        const modelToUse = modelId || "openrouter/free";

        while (keepRunning && loopCount < 15) {
          loopCount++;

          // ── Context Compression (Hermes-style) ──
          // If estimated tokens exceed 75% of context window, compress middle messages
          try {
            const compressionResult = await compressContextIfNeeded(
              apiMessages,
              { maxTokenEstimate: 128000, compressionThreshold: 0.75, tailProtectionCount: 6 },
              async (text: string) => {
                const summaryRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://agentfoundry.ai",
                    "X-Title": "AgentFoundry Context Compressor"
                  },
                  body: JSON.stringify({
                    model: modelToUse,
                    messages: [
                      { role: "system", content: "Sei un compressore di contesto. Riassumi la conversazione seguente in modo conciso, preservando: fatti chiave, decisioni prese, risultati dei tool, e contesto critico. Non aggiungere opinioni. Max 500 parole. Rispondi in italiano." },
                      { role: "user", content: text }
                    ],
                    max_tokens: 800,
                    temperature: 0.2,
                  })
                });
                const summaryData = await summaryRes.json();
                return summaryData.choices?.[0]?.message?.content || text.substring(0, 2000);
              }
            );
            if (compressionResult.compressed) {
              apiMessages = compressionResult.messages;
              push("debug", `🗜️ Contesto compresso: ${compressionResult.tokensBefore} → ${compressionResult.tokensAfter} token stimati (-${Math.round((1 - compressionResult.tokensAfter / compressionResult.tokensBefore) * 100)}%)`);
            }
          } catch (compressionErr: any) {
            console.error("[ContextCompressor] Error:", compressionErr.message);
          }

          // ── Grace Call (Hermes-style) ──
          // On the last iteration, inject a system message forcing the model to
          // conclude without calling any more tools.
          const isGraceCall = loopCount === 14;
          const messagesForCall = isGraceCall
            ? [
                ...apiMessages,
                {
                  role: "system",
                  content: "[BUDGET LIMIT] Questa è la tua ultima opportunità di rispondere. "
                    + "NON chiamare nessun tool. Sintetizza tutte le informazioni raccolte finora "
                    + "e formula la risposta finale al fondatore. Se hai analisi incomplete, "
                    + "menziona brevemente cosa manca e suggerisci di approfondire in un messaggio successivo."
                }
              ]
            : apiMessages;

          let openRouterRes: Response | null = null;
          let retryCount = 0;
          const maxRetries = 3;
          let delay = 1000;
          let currentModel = modelToUse;

          while (retryCount < maxRetries) {
            try {
              let targetUrl = "https://openrouter.ai/api/v1/chat/completions";
              let targetKey = OPENROUTER_API_KEY;
              const cm = reqBody.customModel;

              if (cm?.provider === "openai") {
                targetUrl = "https://api.openai.com/v1/chat/completions";
                targetKey = cm.apiKey || process.env.OPENAI_API_KEY || OPENROUTER_API_KEY;
              } else if (cm?.provider === "ollama") {
                targetUrl = (cm.baseUrl || "http://localhost:11434/v1").replace(/\/$/, "") + "/chat/completions";
                targetKey = cm.apiKey || "ollama";
              } else if (cm?.provider === "custom" && cm?.baseUrl) {
                targetUrl = cm.baseUrl.replace(/\/$/, "") + (cm.baseUrl.endsWith("/chat/completions") ? "" : "/chat/completions");
                if (cm.apiKey) targetKey = cm.apiKey;
              } else if (cm?.apiKey) {
                targetKey = cm.apiKey;
              }

              openRouterRes = await fetch(targetUrl, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${targetKey}`,
                  "Content-Type": "application/json",
                  "HTTP-Referer": "https://agentfoundry.ai",
                  "X-Title": "AgentFoundry coFounder Orchestrator"
                },
                body: JSON.stringify({
                  model: currentModel,
                  messages: messagesForCall,
                  tools: isGraceCall ? undefined : registry.getDefinitions(new Set(registry.getAllNames())),
                  tool_choice: isGraceCall ? undefined : "auto",
                  stream: true,
                  max_tokens: 4000,
                })
              });

              if (openRouterRes.ok) {
                break;
              }

              // Only retry on server errors (5xx) or rate limits (429)
              if (openRouterRes.status !== 429 && openRouterRes.status < 500) {
                break;
              }
            } catch (fetchErr: any) {
              console.error("[Cofounder fetchErr]:", fetchErr);
              push("debug", `⚠️ Fetch exception: ${fetchErr?.message || fetchErr}`);
            }

            retryCount++;
            if (retryCount < maxRetries) {
              if (retryCount === 1 && currentModel !== "openrouter/free") {
                push("debug", `⚠️ Primary model call failed for "${currentModel}". Fallback to "openrouter/free"...`);
                currentModel = "openrouter/free";
              } else {
                push("debug", `⚠️ Model call failed (attempt ${retryCount}/${maxRetries}). Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
              }
            }
          }

          if (!openRouterRes || !openRouterRes.ok) {
            const err = openRouterRes ? await openRouterRes.text() : "Network error / timeout";
            push("error", `OpenRouter error: ${openRouterRes ? openRouterRes.status : "Failed"} - ${err}`);
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
            // Check for invalid JSON in tool calls before executing
            const invalidJsonCalls = activeToolCalls.filter(tc => {
              const { error } = safeParseArguments(tc.function.arguments);
              return error !== null;
            });

            if (invalidJsonCalls.length > 0) {
              if (invalidJsonRetries < 3) {
                invalidJsonRetries++;
                const badNames = invalidJsonCalls.map(tc => tc.function.name).join(", ");
                push("debug", `⚠️ JSON malformato rilevato per i tool (${badNames}). Tentativo di rigenerazione (${invalidJsonRetries}/3)...`);
                continue;
              }
              invalidJsonRetries = 0;
            } else {
              invalidJsonRetries = 0;
            }

            apiMessages.push({
              role: "assistant",
              content: currentAssistantText || null,
              tool_calls: activeToolCalls
            });

            const toolPromises = activeToolCalls.map(async (tc) => {
              const functionName = tc.function.name;
              let result: any = null;

              const { args: parsedArgs, error: jsonError } = safeParseArguments(tc.function.arguments);
              let args = parsedArgs;

              if (jsonError) {
                result = {
                  error: `Invalid JSON arguments: ${jsonError}. Please retry this tool call with valid JSON.`
                };
                executedTools.push({
                  name: functionName,
                  success: false,
                  details: `Errore parsing argomenti per ${functionName}`,
                  arguments: { raw: tc.function.arguments },
                  result
                });
              } else {
                // Apply tool guardrails
                const guard = validateToolCall(functionName, args);
                if (guard.decision === "hard_deny" || guard.decision === "soft_deny") {
                  result = { error: guard.reason || `Tool call blocked by safety guardrails.` };
                  executedTools.push({
                    name: functionName,
                    success: false,
                    details: `Tool bloccato da guardrails: ${guard.reason}`,
                    arguments: args,
                    result
                  });
                } else {
                  if (guard.decision === "rewrite" && guard.rewrittenArgs) {
                    args = guard.rewrittenArgs;
                    push("debug", `🔧 Guardrail rewrite per "${functionName}": ${guard.reason}`);
                  }
                  try {
                    const entry = registry.getEntry(functionName);
                    if (!entry) {
                      // ── Fuzzy Tool Name Repair (Hermes-style) ──
                      const { matched, distance, isNormalizedExact } = fuzzyMatchToolName(functionName);
                      if (matched) {
                        const repairLabel = isNormalizedExact ? "corretto" : `fuzzy match (distanza: ${distance})`;
                        push("debug", `🔧 Tool "${functionName}" non trovato, ${repairLabel} → "${matched}"`);
                        result = {
                          error: `Tool "${functionName}" non riconosciuto. Intendevi "${matched}"? Riprova chiamando "${matched}" con gli stessi argomenti.`,
                          suggested_tool: matched
                        };
                      } else {
                        result = {
                          error: `Tool "${functionName}" sconosciuto. Tool disponibili: ${registry.getAllNames().join(", ")}`
                        };
                      }
                      executedTools.push({ name: functionName, success: false, details: `Tool sconosciuto: "${functionName}"${matched ? ` → suggerito "${matched}"` : ""}`, arguments: args, result });
                    } else {
                      const toolContext = {
                        startupId,
                        discussionId: discussionId || undefined,
                        todos: currentTodos,
                        startup,
                        push,
                        settings,
                        delegations,
                        modelId: modelToUse,
                        setAgentSuggestion: (suggestion: any) => { agentSuggestion = suggestion; }
                      };

                      const handlerRes = await entry.handler(args, toolContext);
                      result = handlerRes.result;
                      if (handlerRes.updatedTodos) {
                        currentTodos = handlerRes.updatedTodos;
                      }
                      executedTools.push({
                        name: functionName,
                        success: handlerRes.success ?? true,
                        details: handlerRes.details || `Eseguito ${functionName}`,
                        arguments: args,
                        result
                      });
                    }
                  } catch (toolErr: any) {
                    console.error(`Error executing tool ${functionName}:`, toolErr);
                    result = { error: toolErr.message || "Internal tool execution error" };
                    executedTools.push({ name: functionName, success: false, details: `Errore esecuzione ${functionName}: ${toolErr.message}`, arguments: args, result });
                  }
                }
              }

              const toolRecord = executedTools.find(et => 
                et.arguments === args || 
                (et.name === functionName && JSON.stringify(et.arguments) === JSON.stringify(args))
              );
              if (toolRecord) {
                push("tool_end", toolRecord);
                if (functionName === "requestInformationForm" && toolRecord.success && toolRecord.result) {
                  push("request_form", toolRecord.result);
                }
              }

              return { role: "tool", tool_call_id: tc.id, name: functionName, content: JSON.stringify(result) };
            });

            // Execute all tools concurrently
            const toolResponses = await Promise.all(toolPromises);
            apiMessages.push(...toolResponses);
            push("tool_run", {});

          } else {
            finalContent = currentAssistantText;
            keepRunning = false;
          }
        }

        // Save user & assistant messages in Supabase Message table
        if (cofounderConfig?.id && userMessage && finalContent) {
          try {
            await supabaseFetch(`/Message`, {
              method: "POST",
              body: JSON.stringify({
                agentId: cofounderConfig.id,
                role: "user",
                content: userMessage,
              }),
            });
            await supabaseFetch(`/Message`, {
              method: "POST",
              body: JSON.stringify({
                agentId: cofounderConfig.id,
                role: "assistant",
                content: finalContent,
              }),
            });
          } catch (mErr: any) {
            console.error("[Cofounder Supabase Message Save Error]:", mErr.message);
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

        const formTool = executedTools.find(et => et.name === "requestInformationForm" && et.success && et.result);
        const requestedForm = formTool ? formTool.result : null;
        push("done", { content: finalContent, executedTools, delegations, agentSuggestion, todos: currentTodos, requestedForm });
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

