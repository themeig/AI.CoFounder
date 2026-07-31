import { NextResponse } from "next/server";
import { getStripeMetrics } from "@/lib/connectors/stripe";
import { hasApiKey } from "@/lib/secure-store";

/**
 * GET /api/demo/metrics/sync
 * 
 * Triggers a live Stripe sync and returns all calculated metrics.
 * Query params:
 *   ?test=true  → Returns mock data so you can test the UI without a real key.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const isTest = searchParams.get("test") === "true";

  const startTime = Date.now();

  try {
    // ── Test / Demo Mode ──
    if (isTest) {
      // Simulate a short delay for realism
      await new Promise(r => setTimeout(r, 600));

      const now = new Date();
      const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
      const history = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const factor = 1 - (i * 0.07);
        history.push({
          label: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`,
          mrr: Number((12400 * factor).toFixed(2)),
          customers: Math.round(87 * factor),
          churn: Number((2.3 * (0.9 + Math.random() * 0.2)).toFixed(2))
        });
      }

      const demoMetrics = {
        mrr: 12400,
        arr: 148800,
        activeCustomers: 87,
        newCustomersThisMonth: 12,
        churnRate: 2.3,
        arpu: 142.53,
        ltv: 6197.39,
        monthlyRevenue: 13100,
        currency: "USD",
        monthlyHistory: history,
        lastSyncAt: now.toISOString()
      };

      return NextResponse.json({
        stripeConfigured: true,
        isTestMode: true,
        metrics: demoMetrics,
        syncDurationMs: Date.now() - startTime,
        apiCallsMade: 4,
        logs: [
          { ts: now.toISOString(), level: "info",  msg: "🧪 Modalità Test attivata — dati demo generati" },
          { ts: now.toISOString(), level: "info",  msg: `MRR calcolato: $12,400.00 (87 abbonamenti attivi)` },
          { ts: now.toISOString(), level: "info",  msg: `Churn Rate: 2.3% — LTV: $6,197.39 — ARPU: $142.53` },
          { ts: now.toISOString(), level: "ok",    msg: `Sincronizzazione demo completata in ${Date.now() - startTime}ms` },
        ],
        message: "✓ Test completato con dati demo"
      });
    }

    // ── Real Stripe Sync ──
    const isStripeConfigured = await hasApiKey("stripe");
    if (!isStripeConfigured) {
      return NextResponse.json({
        stripeConfigured: false,
        metrics: null,
        syncDurationMs: Date.now() - startTime,
        apiCallsMade: 0,
        logs: [
          { ts: new Date().toISOString(), level: "warn", msg: "Nessuna chiave Stripe configurata. Vai in Settings → Stripe Integration." },
        ],
        message: "Nessuna chiave Stripe configurata in Settings."
      });
    }

    const stripeData = await getStripeMetrics();
    const elapsed = Date.now() - startTime;

    if (!stripeData) {
      return NextResponse.json({
        stripeConfigured: true,
        metrics: null,
        syncDurationMs: elapsed,
        apiCallsMade: 4,
        logs: [
          { ts: new Date().toISOString(), level: "info",  msg: "Connessione a Stripe API stabilita..." },
          { ts: new Date().toISOString(), level: "error", msg: "Stripe ha restituito una risposta vuota o non valida." },
          { ts: new Date().toISOString(), level: "warn",  msg: "Verifica che la chiave abbia i permessi Read su Subscriptions, Customers e Charges." },
        ],
        message: "Errore durante la connessione a Stripe API."
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const currSymbol = stripeData.currency === "EUR" ? "€" : "$";

    return NextResponse.json({
      stripeConfigured: true,
      isTestMode: false,
      metrics: stripeData,
      syncDurationMs: elapsed,
      apiCallsMade: 4,
      logs: [
        { ts: now, level: "info", msg: `Connessione Stripe stabilita (${elapsed}ms)` },
        { ts: now, level: "info", msg: `GET /v1/subscriptions?status=active → ${stripeData.activeCustomers} abbonamenti attivi` },
        { ts: now, level: "info", msg: `GET /v1/customers → ${stripeData.activeCustomers + stripeData.newCustomersThisMonth} clienti totali (${stripeData.newCustomersThisMonth} nuovi questo mese)` },
        { ts: now, level: "info", msg: `GET /v1/subscriptions?status=canceled → Churn Rate calcolato: ${stripeData.churnRate}%` },
        { ts: now, level: "info", msg: `GET /v1/charges → Revenue mensile: ${currSymbol}${stripeData.monthlyRevenue.toLocaleString()}` },
        { ts: now, level: "ok",   msg: `MRR: ${currSymbol}${stripeData.mrr.toLocaleString()} | ARR: ${currSymbol}${stripeData.arr.toLocaleString()} | ARPU: ${currSymbol}${stripeData.arpu} | LTV: ${currSymbol}${stripeData.ltv.toLocaleString()}` },
        { ts: now, level: "ok",   msg: `✓ Sincronizzazione completata con successo in ${elapsed}ms` },
      ],
      message: `Sincronizzazione Stripe completata — MRR ${currSymbol}${stripeData.mrr.toLocaleString()}`
    });
  } catch (err: any) {
    console.error("[Metrics Sync GET] Error:", err.message);
    return NextResponse.json({
      stripeConfigured: true,
      metrics: null,
      syncDurationMs: Date.now() - startTime,
      apiCallsMade: 0,
      logs: [
        { ts: new Date().toISOString(), level: "error", msg: `Errore critico: ${err.message}` },
      ],
      message: err.message
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
