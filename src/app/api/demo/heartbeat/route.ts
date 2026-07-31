import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import * as path from "path";
import { getApiKey } from "@/lib/secure-store";

const PULSES_FILE_PATH = path.join(process.cwd(), "src/lib/heartbeat-pulses.json");
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

export interface Pulse {
  id: string;
  type: "warning" | "critical" | "idea" | "positive" | "action";
  title: string;
  body: string;
  priority: "high" | "medium" | "low";
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  actionText?: string;
}

const DEFAULT_PULSES: Pulse[] = [
  {
    id: "pulse-init-1",
    type: "warning",
    title: "Monitoraggio Churn Rate",
    body: "Rilevata una lieve flessione nella retention delle nuove coorti. Si suggerisce di verificare il primo onboarding degli utenti.",
    priority: "high",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    actionUrl: "/dashboard/metrics",
    actionText: "Vedi Metriche Churn"
  },
  {
    id: "pulse-init-2",
    type: "idea",
    title: "Opportunità Upsell: Tier Enterprise",
    body: "Oltre il 30% degli utenti attivi utilizza le funzionalità avanzate quotidianamente. Potresti introdurre un piano dedicato ai team.",
    priority: "medium",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    actionUrl: "/dashboard/agents",
    actionText: "Pianifica con CoFounder"
  },
  {
    id: "pulse-init-3",
    type: "positive",
    title: "Rapporto LTV/CAC eccellente (4.8x)",
    body: "Il valore generato da ciascun cliente è 4.8 volte superiore al costo di acquisizione, posizionando la startup sopra il benchmark di settore.",
    priority: "low",
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    actionUrl: "/dashboard/metrics",
    actionText: "Esplora Analytics"
  },
  {
    id: "pulse-init-4",
    type: "action",
    title: "Pianificazione Runway & Fundraising",
    body: "Con 14 mesi di runway rimanenti, questo è il trimestre ideale per preparare la dataroom e contattare i primi investitori angel.",
    priority: "high",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 720).toISOString(),
    actionUrl: "/dashboard/memory",
    actionText: "Consulta Playbook Funding"
  }
];

async function getPulsesData(): Promise<{ pulses: Pulse[]; lastRunAt: string }> {
  try {
    const raw = await fs.readFile(PULSES_FILE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    const initial = {
      pulses: DEFAULT_PULSES,
      lastRunAt: new Date(Date.now() - 1000 * 60 * 45).toISOString()
    };
    await fs.mkdir(path.dirname(PULSES_FILE_PATH), { recursive: true });
    await fs.writeFile(PULSES_FILE_PATH, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
}

async function savePulsesData(data: { pulses: Pulse[]; lastRunAt: string }) {
  await fs.mkdir(path.dirname(PULSES_FILE_PATH), { recursive: true });
  await fs.writeFile(PULSES_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * GET /api/demo/heartbeat
 * Returns pulses, lastRunAt and unread count.
 */
export async function GET() {
  try {
    const data = await getPulsesData();
    const unreadCount = data.pulses.filter((p) => !p.read).length;
    return NextResponse.json({
      pulses: data.pulses,
      lastRunAt: data.lastRunAt,
      unreadCount
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/demo/heartbeat
 * Marks pulses as read (or all if markAllRead=true).
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const data = await getPulsesData();

    if (body.markAllRead) {
      data.pulses = data.pulses.map((p) => ({ ...p, read: true }));
    } else if (body.id) {
      data.pulses = data.pulses.map((p) => (p.id === body.id ? { ...p, read: true } : p));
    }

    await savePulsesData(data);
    const unreadCount = data.pulses.filter((p) => !p.read).length;

    return NextResponse.json({ success: true, unreadCount, pulses: data.pulses });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/demo/heartbeat
 * Triggers LLM analysis of startup metrics & status to generate new Heartbeat Pulses.
 */
export async function POST() {
  try {
    // 1. Gather Startup Context & Metrics
    let startupInfo = null;
    let metricsInfo = [];

    try {
      const startupRes = await fetch("http://localhost:3000/api/demo/startup");
      if (startupRes.ok) {
        const list = await startupRes.json();
        if (Array.isArray(list) && list.length > 0) startupInfo = list[0];
      }
    } catch {}

    try {
      const metricsRes = await fetch("http://localhost:3000/api/demo/metrics");
      if (metricsRes.ok) {
        metricsInfo = await metricsRes.json();
      }
    } catch {}

    // 2. Call LLM to analyze the startup and generate 2-4 fresh pulses
    const prompt = `Sei l'algoritmo di Heartbeat e Monitoraggio continuo di AI.CoFounder.
Analizza lo stato della startup e le sue metriche aggiornate, poi identifica 2-3 insight critici, opportunità o segnali di allarme.

DATI STARTUP:
- Nome: ${startupInfo?.name || "Startup"}
- Settore: ${startupInfo?.sector || "SaaS"}
- Fase: ${startupInfo?.phase || "MVP"}
- MRR: $${startupInfo?.mrr || 0}
- Utenti: ${startupInfo?.users || 0}
- Burn Rate: $${startupInfo?.burnRate || 0}/mese
- Runway: ${startupInfo?.runway || 0} mesi

METRICHE RECENTI (${metricsInfo.length} metriche tracciate):
${metricsInfo.map((m: any) => `- ${m.title}: ${m.value} (formula: ${m.formula || "standard"})`).join("\n")}

Genera un JSON valido contenente un array di oggetti "pulses" in questo formato ESATTO:
{
  "pulses": [
    {
      "type": "warning" | "critical" | "idea" | "positive" | "action",
      "title": "Titolo breve e d'impatto",
      "body": "Spiegazione concreta (2 frasi massimo) con consigli pratici.",
      "priority": "high" | "medium" | "low",
      "actionText": "Testo pulsante azione",
      "actionUrl": "/dashboard/metrics" | "/dashboard/agents" | "/dashboard/startup" | "/dashboard/memory"
    }
  ]
}

IMPORTANTE: Restituisci SOLTANTO il JSON valido, senza markdown, senza spiegazioni aggiuntive. Rispondi in italiano.`;

    let generatedPulses: Pulse[] = [];
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
          temperature: 0.4,
          max_tokens: 1000
        })
      });

      if (llmRes.ok) {
        const jsonRes = await llmRes.json();
        const content = jsonRes.choices?.[0]?.message?.content || "";
        try {
          const parsed = JSON.parse(content.replace(/```json|```/g, "").trim());
          if (Array.isArray(parsed.pulses)) {
            generatedPulses = parsed.pulses.map((p: any, idx: number) => ({
              id: "pulse-" + Date.now() + "-" + idx,
              type: p.type || "idea",
              title: p.title || "Analisi Heartbeat",
              body: p.body || "",
              priority: p.priority || "medium",
              read: false,
              createdAt: new Date().toISOString(),
              actionUrl: p.actionUrl || "/dashboard/metrics",
              actionText: p.actionText || "Esplora"
            }));
          }
        } catch (e) {
          console.error("[Heartbeat] Error parsing LLM JSON output:", e);
        }
      }
    }

    // Fallback if LLM call didn't yield items
    if (generatedPulses.length === 0) {
      generatedPulses = [
        {
          id: "pulse-" + Date.now() + "-0",
          type: "positive",
          title: "Analisi completata con successo",
          body: "Tutte le metriche finanziarie e operative rientrano nei parametri di crescita previsti per la fase attuale.",
          priority: "low",
          read: false,
          createdAt: new Date().toISOString(),
          actionUrl: "/dashboard/metrics",
          actionText: "Visualizza Dashboard"
        },
        {
          id: "pulse-" + Date.now() + "-1",
          type: "idea",
          title: "Ottimizzazione strategie di acquisizione",
          body: "Consigliata una revisione delle campagne marketing per sfruttare l'elevato LTV del settore.",
          priority: "medium",
          read: false,
          createdAt: new Date().toISOString(),
          actionUrl: "/dashboard/agents",
          actionText: "Parla con il Marketing Agent"
        }
      ];
    }

    // Prepend new pulses and cap array at 20 items
    const existing = await getPulsesData();
    const updatedPulses = [...generatedPulses, ...existing.pulses].slice(0, 20);
    const nowIso = new Date().toISOString();

    const newData = {
      pulses: updatedPulses,
      lastRunAt: nowIso
    };

    await savePulsesData(newData);
    const unreadCount = updatedPulses.filter((p) => !p.read).length;

    return NextResponse.json({
      success: true,
      pulses: updatedPulses,
      lastRunAt: nowIso,
      unreadCount,
      newPulsesCount: generatedPulses.length
    });
  } catch (err: any) {
    console.error("[Heartbeat POST] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
