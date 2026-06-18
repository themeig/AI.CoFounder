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

export async function POST(req: Request) {
  const logs: string[] = [];
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ error: "Missing database configurations" }, { status: 500 });
    }

    const { stripeUrl, mixpanelUrl, plaidUrl } = await req.json();

    logs.push(`[${new Date().toLocaleTimeString()}] Avvio sincronizzazione metriche API...`);

    // 1. Get demo user
    const users = await supabaseFetch(`/User?email=eq.demo@agentfoundry.ai&select=id`);
    if (!users || users.length === 0) {
      return NextResponse.json({ error: "Demo user not found" }, { status: 404 });
    }
    const userId = users[0].id;

    // 2. Get startup
    const startups = await supabaseFetch(`/Startup?userId=eq.${userId}&select=*`);
    if (!startups || startups.length === 0) {
      return NextResponse.json({ error: "Demo startup not found" }, { status: 404 });
    }
    const startup = startups[0];
    logs.push(`[${new Date().toLocaleTimeString()}] Trovata startup attiva: "${startup.name}" (ID: ${startup.id})`);

    let newMrr = startup.mrr;
    let newUsers = startup.users;
    let newBurnRate = startup.burnRate;
    let newRunway = startup.runway;

    // 3. Sync Stripe
    if (stripeUrl) {
      logs.push(`[${new Date().toLocaleTimeString()}] Connessione a Stripe API (${stripeUrl})...`);
      try {
        const res = await fetch(stripeUrl);
        if (!res.ok) throw new Error(`Stato risposta ${res.status}`);
        const data = await res.json();
        
        if (typeof data.mrr === "number") {
          newMrr = data.mrr;
          logs.push(`[${new Date().toLocaleTimeString()}] Stripe Sync: MRR estratto con successo ($${newMrr.toLocaleString()})`);
        }
        if (typeof data.users === "number") {
          newUsers = data.users;
          logs.push(`[${new Date().toLocaleTimeString()}] Stripe Sync: Utenti registrati estratti (${newUsers})`);
        }
      } catch (err: any) {
        logs.push(`[${new Date().toLocaleTimeString()}] Stripe Sync Errore: ${err.message}`);
      }
    }

    // 4. Sync Mixpanel
    if (mixpanelUrl) {
      logs.push(`[${new Date().toLocaleTimeString()}] Connessione a Mixpanel API (${mixpanelUrl})...`);
      try {
        const res = await fetch(mixpanelUrl);
        if (!res.ok) throw new Error(`Stato risposta ${res.status}`);
        const data = await res.json();
        
        // Support activeUsers or users
        const activeUsersCount = data.activeUsers || data.users;
        if (typeof activeUsersCount === "number") {
          newUsers = activeUsersCount;
          logs.push(`[${new Date().toLocaleTimeString()}] Mixpanel Sync: Utenti attivi estratti con successo (${newUsers})`);
        }
      } catch (err: any) {
        logs.push(`[${new Date().toLocaleTimeString()}] Mixpanel Sync Errore: ${err.message}`);
      }
    }

    // 5. Sync Plaid
    if (plaidUrl) {
      logs.push(`[${new Date().toLocaleTimeString()}] Connessione a Plaid Financial API (${plaidUrl})...`);
      try {
        const res = await fetch(plaidUrl);
        if (!res.ok) throw new Error(`Stato risposta ${res.status}`);
        const data = await res.json();
        
        if (typeof data.burnRate === "number") {
          newBurnRate = data.burnRate;
          logs.push(`[${new Date().toLocaleTimeString()}] Plaid Sync: Burn Rate mensile estratto ($${newBurnRate.toLocaleString()}/mese)`);
        }
        if (typeof data.runway === "number") {
          newRunway = data.runway;
          logs.push(`[${new Date().toLocaleTimeString()}] Plaid Sync: Runway mensile estratto (${newRunway} mesi)`);
        } else if (typeof data.cashBalance === "number" && newBurnRate > 0) {
          newRunway = Math.round(data.cashBalance / newBurnRate);
          logs.push(`[${new Date().toLocaleTimeString()}] Plaid Sync: Runway calcolato dai fondi totali ($${data.cashBalance.toLocaleString()} / $${newBurnRate.toLocaleString()}) = ${newRunway} mesi`);
        }
      } catch (err: any) {
        logs.push(`[${new Date().toLocaleTimeString()}] Plaid Sync Errore: ${err.message}`);
      }
    }

    // 6. Update database
    logs.push(`[${new Date().toLocaleTimeString()}] Aggiornamento del database in corso...`);
    const updatedStartups = await supabaseFetch(`/Startup?id=eq.${startup.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        mrr: newMrr,
        users: newUsers,
        burnRate: newBurnRate,
        runway: newRunway,
      }),
    });

    logs.push(`[${new Date().toLocaleTimeString()}] Metriche salvate nel database con successo!`);
    logs.push(`[${new Date().toLocaleTimeString()}] Sincronizzazione completata con successo.`);

    return NextResponse.json({
      success: true,
      logs,
      startup: updatedStartups && updatedStartups.length > 0 ? updatedStartups[0] : null,
    });
  } catch (err: any) {
    logs.push(`[${new Date().toLocaleTimeString()}] Sincronizzazione fallita: ${err.message}`);
    return NextResponse.json({
      success: false,
      logs,
      error: err.message,
    });
  }
}
