import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import * as path from "path";

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

    const { stripeUrl, mixpanelUrl, plaidUrl, stripeConnType, stripeKey } = await req.json();

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
    if (stripeConnType === "direct" && stripeKey) {
      logs.push(`[${new Date().toLocaleTimeString()}] Avvio connessione diretta all'API ufficiale di Stripe...`);
      try {
        let subscriptionsData: any = null;
        
        if (stripeKey === "sk_test_demo") {
          logs.push(`[${new Date().toLocaleTimeString()}] Rilevata chiave Sandbox. Generazione dati Stripe simulati...`);
          const variation = 1 + (Math.random() * 0.04 - 0.02);
          subscriptionsData = {
            data: [
              {
                id: "sub_1",
                items: {
                  data: [
                    { plan: { amount: 9900, interval: "month" }, quantity: Math.round(80 * variation) }
                  ]
                }
              },
              {
                id: "sub_2",
                items: {
                  data: [
                    { plan: { amount: 19900, interval: "month" }, quantity: Math.round(30 * variation) }
                  ]
                }
              },
              {
                id: "sub_3",
                items: {
                  data: [
                    { plan: { amount: 120000, interval: "year" }, quantity: Math.round(10 * variation) }
                  ]
                }
              }
            ]
          };
        } else {
          logs.push(`[${new Date().toLocaleTimeString()}] Connessione a https://api.stripe.com/v1/subscriptions...`);
          const res = await fetch("https://api.stripe.com/v1/subscriptions?status=active&limit=100", {
            headers: {
              "Authorization": `Bearer ${stripeKey}`,
            }
          });
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Stripe API error: ${res.status} - ${errorText}`);
          }
          subscriptionsData = await res.json();
        }

        if (subscriptionsData && Array.isArray(subscriptionsData.data)) {
          let mrrCents = 0;
          let payingCustomers = 0;
          
          for (const sub of subscriptionsData.data) {
            payingCustomers++;
            const items = sub.items?.data || [];
            for (const item of items) {
              const amount = item.plan?.amount || 0;
              const quantity = item.quantity || 1;
              const interval = item.plan?.interval || "month";
              let itemMrr = amount * quantity;
              
              if (interval === "year") {
                itemMrr = Math.round(itemMrr / 12);
              } else if (interval === "week") {
                itemMrr = Math.round(itemMrr * 4.33);
              }
              mrrCents += itemMrr;
            }
          }
          
          newMrr = Math.round(mrrCents / 100);
          newUsers = payingCustomers;
          
          logs.push(`[${new Date().toLocaleTimeString()}] Stripe Direct: Estratto con successo MRR ($${newMrr.toLocaleString()}) e ${newUsers} clienti paganti.`);
        }
      } catch (err: any) {
        logs.push(`[${new Date().toLocaleTimeString()}] Stripe Direct Errore: ${err.message}`);
      }
    } else if (stripeUrl) {
      logs.push(`[${new Date().toLocaleTimeString()}] Connessione a Stripe Proxy API (${stripeUrl})...`);
      try {
        const res = await fetch(stripeUrl);
        if (!res.ok) throw new Error(`Stato risposta ${res.status}`);
        const data = await res.json();
        
        if (typeof data.mrr === "number") {
          newMrr = data.mrr;
          logs.push(`[${new Date().toLocaleTimeString()}] Stripe Proxy: MRR estratto ($${newMrr.toLocaleString()})`);
        }
        if (typeof data.users === "number") {
          newUsers = data.users;
          logs.push(`[${new Date().toLocaleTimeString()}] Stripe Proxy: Utenti registrati estratti (${newUsers})`);
        }
      } catch (err: any) {
        logs.push(`[${new Date().toLocaleTimeString()}] Stripe Proxy Errore: ${err.message}`);
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

    // Helper to resolve dot-notation json paths (e.g. data.users)
    const getJsonValue = (obj: any, pathStr: string) => {
      if (!pathStr) return obj;
      const parts = pathStr.split(".");
      let current = obj;
      for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
        if (arrayMatch) {
          const key = arrayMatch[1];
          const index = parseInt(arrayMatch[2], 10);
          current = current[key]?.[index];
        } else {
          current = current[part];
        }
      }
      return current;
    };

    // 5.5 Sync Custom Connections
    const connectionsPath = path.join(process.cwd(), "src/lib/custom-connections.json");
    const metricsPath = path.join(process.cwd(), "src/lib/custom-metrics.json");

    try {
      const connectionsData = await fs.readFile(connectionsPath, "utf-8");
      const connections = JSON.parse(connectionsData);
      const activeConns = connections.filter((c: any) => c.isActive);

      if (activeConns.length > 0) {
        logs.push(`[${new Date().toLocaleTimeString()}] Rilevate ${activeConns.length} connessioni API personalizzate attive...`);

        // Load custom metrics in case we need to update any custom metric value/trend
        let customMetrics: any[] = [];
        try {
          const metricsData = await fs.readFile(metricsPath, "utf-8");
          customMetrics = JSON.parse(metricsData);
        } catch {}

        for (const conn of activeConns) {
          logs.push(`[${new Date().toLocaleTimeString()}] Avvio recupero da "${conn.name}" (${conn.url})...`);
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), conn.timeout || 5000);

            const fetchOptions: any = {
              method: conn.method || "GET",
              headers: conn.headers || {},
              signal: controller.signal
            };
            if (conn.method !== "GET" && conn.body) {
              fetchOptions.body = typeof conn.body === "string" ? conn.body : JSON.stringify(conn.body);
              fetchOptions.headers["Content-Type"] = fetchOptions.headers["Content-Type"] || "application/json";
            }

            const connRes = await fetch(conn.url, fetchOptions);
            clearTimeout(timeoutId);
            if (!connRes.ok) throw new Error(`Risposta HTTP ${connRes.status}`);

            let extracted: any;
            if (conn.responseType === "text") {
              const textResponse = await connRes.text();
              extracted = textResponse.trim().replace(/^["']|["']$/g, '');
            } else {
              const jsonResponse = await connRes.json();
              extracted = getJsonValue(jsonResponse, conn.jsonPath);
            }

            if (extracted === undefined) {
              throw new Error(`JSON Path "${conn.jsonPath}" non ha prodotto alcun risultato.`);
            }

            logs.push(`[${new Date().toLocaleTimeString()}] "${conn.name}": Estratto valore "${extracted}"`);

            const numValue = typeof extracted === "number" ? extracted : parseFloat(extracted);

            // Update either base metric or custom metric card
            if (["mrr", "users", "burnRate", "runway"].includes(conn.targetMetric)) {
              if (!isNaN(numValue)) {
                if (conn.targetMetric === "mrr") newMrr = Math.round(numValue);
                if (conn.targetMetric === "users") newUsers = Math.round(numValue);
                if (conn.targetMetric === "burnRate") newBurnRate = Math.round(numValue);
                if (conn.targetMetric === "runway") newRunway = Math.round(numValue);
                logs.push(`[${new Date().toLocaleTimeString()}] Metrica base "${conn.targetMetric}" aggiornata a ${numValue}`);
              } else {
                logs.push(`[${new Date().toLocaleTimeString()}] ATTENZIONE: Il valore estratto non è un numero valido per la metrica base "${conn.targetMetric}".`);
              }
            } else {
              // Custom metric card update!
              const metricIdx = customMetrics.findIndex((m: any) => m.id === conn.targetMetric);
              if (metricIdx !== -1) {
                let formattedValue = String(extracted);
                const m = customMetrics[metricIdx];
                if (!isNaN(numValue)) {
                  if (m.type === "currency") formattedValue = `$${Math.round(numValue).toLocaleString()}`;
                  else if (m.type === "percentage") formattedValue = `${numValue}%`;
                  else if (m.type === "ratio") formattedValue = `${numValue}x`;
                  else formattedValue = Math.round(numValue).toLocaleString();

                  // Append or update trend data
                  if (m.chartType === "line" || m.chartType === "bar") {
                    const newData = [...(m.data || [])];
                    if (newData.length >= 6) newData.shift();
                    newData.push(numValue);
                    m.data = newData;
                  } else if (m.chartType === "gauge") {
                    m.data = [numValue];
                  }
                }
                m.value = formattedValue;
                logs.push(`[${new Date().toLocaleTimeString()}] Metrica personalizzata "${m.title}" aggiornata a "${formattedValue}"`);
              } else {
                logs.push(`[${new Date().toLocaleTimeString()}] ERRORE: Metrica target "${conn.targetMetric}" non trovata.`);
              }
            }
          } catch (connErr: any) {
            logs.push(`[${new Date().toLocaleTimeString()}] Errore connessione "${conn.name}": ${connErr.message}`);
          }
        }

        // Save updated custom metrics if any custom target was modified
        await fs.writeFile(metricsPath, JSON.stringify(customMetrics, null, 2), "utf-8");
      }
    } catch (e: any) {
      // Ignore if file doesn't exist
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
