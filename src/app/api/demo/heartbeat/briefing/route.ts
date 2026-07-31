import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import * as path from "path";
import { getApiKey } from "@/lib/secure-store";

const BRIEFINGS_FILE_PATH = path.join(process.cwd(), "src/lib/daily-briefings.json");
const PULSES_FILE_PATH = path.join(process.cwd(), "src/lib/heartbeat-pulses.json");
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

export interface BriefingSpeakerUpdate {
  agentId: string;
  agentType: string;
  agentName: string;
  roleTitle: string;
  avatarIcon: string;
  avatarBg: string;
  message: string;
  keyPoints: string[];
}

export interface DailyBriefing {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: string;
  cofounderIntro: string;
  employeeUpdates: BriefingSpeakerUpdate[];
  cofounderSummary: string;
  actionItems: string[];
  read: boolean;
}

const DEFAULT_BRIEFINGS: DailyBriefing[] = [
  {
    id: "briefing-demo-1",
    date: new Date().toISOString().split("T")[0],
    timestamp: new Date().toISOString(),
    cofounderIntro: "Buongiorno team! Iniziamo il Daily Standup di oggi. Oggi facciamo un punto rapido su metriche, priorità tecnologiche ed acquisizione. Cedo la parola alla squadra.",
    employeeUpdates: [
      {
        agentId: "agent-strategy",
        agentType: "strategy",
        agentName: "Strategy Agent",
        roleTitle: "Head of Strategy",
        avatarIcon: "📊",
        avatarBg: "#E8F0FE",
        message: "Stiamo monitorando i principali concorrenti nel settore SaaS. Il posizionamento attuale è solido, ma raccomando di spingere sui vantaggi di automation nei prossimi contenuti.",
        keyPoints: ["Analisi competitor completata", "Focus su automazione AI"]
      },
      {
        agentId: "agent-tech",
        agentType: "tech",
        agentName: "Tech Agent",
        roleTitle: "CTO / Lead Architect",
        avatarIcon: "💻",
        avatarBg: "#E6F4EA",
        message: "L'infrastruttura è stabile con uptime al 99.9%. Abbiamo completato il refactoring del connettore Stripe e ridotto i tempi di risposta delle API a meno di 150ms.",
        keyPoints: ["Connettore Stripe ottimizzato", "API response time <150ms"]
      },
      {
        agentId: "agent-finance",
        agentType: "finance",
        agentName: "Finance Agent",
        roleTitle: "CFO / Finance Lead",
        avatarIcon: "💶",
        avatarBg: "#FEF7E0",
        message: "Il MRR attuale è stabile. Con il burn rate corrente di $800/mese manteniamo 18 mesi di runway puliti. LTV/CAC ratio eccellente a 4.8x.",
        keyPoints: ["18 mesi di Runway", "LTV/CAC a 4.8x"]
      }
    ],
    cofounderSummary: "Ottimo lavoro a tutti. Il quadro generale è molto positivo: stabilità tecnica, finanze sotto controllo e strategia chiara.",
    actionItems: [
      "Revisionare i nuovi contratti abbonamento",
      "Pianificare il lancio della campagna marketing Q3",
      "Pianificare chiamata con gli angel investor per il round Pre-Seed"
    ],
    read: false
  }
];

async function getBriefingsData(): Promise<{ briefings: DailyBriefing[] }> {
  try {
    const raw = await fs.readFile(BRIEFINGS_FILE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    const initial = { briefings: DEFAULT_BRIEFINGS };
    await fs.mkdir(path.dirname(BRIEFINGS_FILE_PATH), { recursive: true });
    await fs.writeFile(BRIEFINGS_FILE_PATH, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
}

async function saveBriefingsData(data: { briefings: DailyBriefing[] }) {
  await fs.mkdir(path.dirname(BRIEFINGS_FILE_PATH), { recursive: true });
  await fs.writeFile(BRIEFINGS_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * GET /api/demo/heartbeat/briefing
 * Returns list of daily briefings and today's briefing status.
 */
export async function GET() {
  try {
    const data = await getBriefingsData();
    const todayStr = new Date().toISOString().split("T")[0];
    const todayBriefing = data.briefings.find((b) => b.date === todayStr);

    return NextResponse.json({
      briefings: data.briefings,
      todayBriefing: todayBriefing || null,
      hasTodayBriefing: !!todayBriefing
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/demo/heartbeat/briefing
 * Marks a briefing as read.
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const data = await getBriefingsData();
    if (body.id) {
      data.briefings = data.briefings.map((b) => (b.id === body.id ? { ...b, read: true } : b));
      await saveBriefingsData(data);
    }
    return NextResponse.json({ success: true, briefings: data.briefings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/demo/heartbeat/briefing
 * Triggers the Daily Standup Meeting where coFounder and all active employee agents brief the startup founder.
 */
export async function POST(req: Request) {
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    let startupInfo = null;
    let agentsList: any[] = [];
    let metricsList: any[] = [];

    // Gather Startup & Agents context
    try {
      const startupRes = await fetch("http://localhost:3000/api/demo/startup");
      if (startupRes.ok) {
        const list = await startupRes.json();
        if (Array.isArray(list) && list.length > 0) startupInfo = list[0];
      }
    } catch {}

    try {
      const agentsRes = await fetch("http://localhost:3000/api/demo/agents");
      if (agentsRes.ok) agentsList = await agentsRes.json();
    } catch {}

    try {
      const metricsRes = await fetch("http://localhost:3000/api/demo/metrics");
      if (metricsRes.ok) metricsList = await metricsRes.json();
    } catch {}

    const activeAgents = agentsList.filter((a) => a.isActive !== false);

    // Formulate LLM prompt for multi-agent standup meeting
    const prompt = `Sei il coFounder AI di una startup. Oggi devi moderare la RIUNIONE DI STANDUP GIORNALIERA (Daily Briefing) insieme a tutto il team di dipendenti AI.

CONTESTO STARTUP:
- Nome: ${startupInfo?.name || "TechFlow"}
- Settore: ${startupInfo?.sector || "SaaS"}
- Fase: ${startupInfo?.phase || "Pre-seed"}
- MRR: $${startupInfo?.mrr || 1200}
- Utenti: ${startupInfo?.users || 150}
- Runway: ${startupInfo?.runway || 18} mesi
- Burn Rate: $${startupInfo?.burnRate || 800}/mese

TEAM DIPENDENTI ATTIVI (${activeAgents.length} agenti):
${activeAgents.map((a) => `- ${a.name} (tipo: ${a.type})`).join("\n")}

METRICHE RECENTI:
${metricsList.slice(0, 5).map((m: any) => `- ${m.title}: ${m.value}`).join("\n")}

Genera la riunione completa in formato JSON ESATTO:
{
  "cofounderIntro": "Discorso di apertura breve del coFounder che saluta il team ed introduce la riunione di oggi.",
  "employeeUpdates": [
    {
      "agentId": "id-agente",
      "agentType": "strategy|tech|finance|marketing|legal|operations",
      "agentName": "Nome Agente",
      "roleTitle": "Head of Strategy / CTO / CFO / CMO",
      "avatarIcon": "📊|💻|💶|🚀|⚖️|⚙️",
      "avatarBg": "#E8F0FE",
      "message": "Aggiornamento conciso e specifico di 2-3 frasi sulle attività del giorno e priorità.",
      "keyPoints": ["Punto chiave 1", "Punto chiave 2"]
    }
  ],
  "cofounderSummary": "Sintesi finale del coFounder che trae le conclusioni della riunione.",
  "actionItems": [
    "Azione pratica 1 per il Founder",
    "Azione pratica 2 per il Founder",
    "Azione pratica 3 per il Founder"
  ]
}

REGOLE CRITICHE:
1. Includi un aggiornamento per OGNUNO degli agenti attivi elencati (${activeAgents.map((a) => a.name).join(", ")}).
2. Fornisci dettagli realistici e coerenti con i dati della startup.
3. Restituisci SOLTANTO il JSON valido, senza markdown, senza testo extra. Rispondi in italiano.`;

    let generatedBriefing: Partial<DailyBriefing> | null = null;
    const openrouterKey = OPENROUTER_API_KEY || (await getApiKey("openrouter"));

    if (openrouterKey) {
      const llmRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.5,
          max_tokens: 1500
        })
      });

      if (llmRes.ok) {
        const jsonRes = await llmRes.json();
        const content = jsonRes.choices?.[0]?.message?.content || "";
        try {
          const parsed = JSON.parse(content.replace(/```json|```/g, "").trim());
          if (parsed.cofounderIntro && Array.isArray(parsed.employeeUpdates)) {
            generatedBriefing = parsed;
          }
        } catch (e) {
          console.error("[Briefing POST] Error parsing LLM output:", e);
        }
      }
    }

    // Fallback if LLM output fails
    if (!generatedBriefing) {
      generatedBriefing = {
        cofounderIntro: `Buongiorno team! Diamo il via allo standup giornaliero per ${startupInfo?.name || "TechFlow"}. Ciascun dipendente presenti le priorità di oggi.`,
        employeeUpdates: activeAgents.map((a) => ({
          agentId: a.id || `agent-${a.type}`,
          agentType: a.type || "strategy",
          agentName: a.name || `${a.type} Agent`,
          roleTitle: `${a.type.toUpperCase()} Lead`,
          avatarIcon: a.type === "tech" ? "💻" : a.type === "finance" ? "💶" : a.type === "marketing" ? "🚀" : "📊",
          avatarBg: a.type === "tech" ? "#E6F4EA" : a.type === "finance" ? "#FEF7E0" : "#E8F0FE",
          message: `Stiamo lavorando all'ottimizzazione dei processi di ${a.type}. Le metriche principali mostrano stabilità ed efficienza.`,
          keyPoints: [`Integrazione ${a.type} attiva`, "Monitoraggio KPI"]
        })),
        cofounderSummary: "La riunione si conclude con un bilancio positivo. Il team è allineato sugli obiettivi.",
        actionItems: [
          "Verificare le KPI di crescita nel modulo Metriche",
          "Consolidare le comunicazioni con il team AI",
          "Revisionare la roadmap di prodotto Q3"
        ]
      };
    }

    const fullBriefing: DailyBriefing = {
      id: "briefing-" + Date.now(),
      date: todayStr,
      timestamp: new Date().toISOString(),
      cofounderIntro: generatedBriefing.cofounderIntro!,
      employeeUpdates: generatedBriefing.employeeUpdates || [],
      cofounderSummary: generatedBriefing.cofounderSummary!,
      actionItems: generatedBriefing.actionItems || [],
      read: false
    };

    // Save briefing to daily-briefings.json
    const existing = await getBriefingsData();
    // Replace today's briefing if already exists or prepend new
    const filtered = existing.briefings.filter((b) => b.date !== todayStr);
    const updatedBriefings = [fullBriefing, ...filtered].slice(0, 30);

    await saveBriefingsData({ briefings: updatedBriefings });

    // Also push a Heartbeat Pulse to alert user on sidebar badge
    try {
      const rawPulses = await fs.readFile(PULSES_FILE_PATH, "utf-8").catch(() => null);
      if (rawPulses) {
        const pulsesData = JSON.parse(rawPulses);
        const briefingPulse = {
          id: "pulse-briefing-" + Date.now(),
          type: "action",
          title: `🎙️ Daily Standup di Oggi (${new Date().toLocaleDateString("it-IT", { day: "numeric", month: "short" })})`,
          body: `La riunione del team è completata. Il coFounder ed i dipendenti hanno elaborato ${fullBriefing.actionItems.length} priorità operative per oggi.`,
          priority: "high",
          read: false,
          createdAt: new Date().toISOString(),
          actionUrl: "/dashboard/dashboard",
          actionText: "Vedi Riunione"
        };
        pulsesData.pulses = [briefingPulse, ...pulsesData.pulses].slice(0, 20);
        await fs.writeFile(PULSES_FILE_PATH, JSON.stringify(pulsesData, null, 2), "utf-8");
      }
    } catch (e) {
      console.error("[Briefing POST] Error creating heartbeat pulse:", e);
    }

    return NextResponse.json({
      success: true,
      briefing: fullBriefing,
      briefings: updatedBriefings
    });
  } catch (err: any) {
    console.error("[Briefing POST] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
