import { NextResponse } from "next/server";
import { analyzeStartupOutcome } from "@/lib/analyzer-engine";

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
  try {
    const body = await req.json();
    const { status, notes } = body;

    if (!status) {
      return NextResponse.json({ error: "Missing status" }, { status: 400 });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    // 1. Get demo user
    const users = await supabaseFetch(`/User?email=eq.demo@agentfoundry.ai&select=id`);
    if (!users || users.length === 0) {
      return NextResponse.json({ error: "Demo user not found. Please setup first." }, { status: 404 });
    }
    const userId = users[0].id;

    // 2. Get startup
    const startups = await supabaseFetch(`/Startup?userId=eq.${userId}&select=*`);
    if (!startups || startups.length === 0) {
      return NextResponse.json({ error: "Demo startup not found." }, { status: 404 });
    }
    const startup = startups[0];

    // 3. Save outcome to DB
    const outcome = await supabaseFetch(`/Outcome`, {
      method: "POST",
      body: JSON.stringify({
        startupId: startup.id,
        status: status,
        notes: notes || "",
        metrics: {
          mrr: startup.mrr,
          users: startup.users,
          burnRate: startup.burnRate,
          runway: startup.runway,
        },
        keyFactors: [],
      }),
    });

    // 4. Optionally update Startup phase if pivot or fail
    if (status === "failed") {
      await supabaseFetch(`/Startup?id=eq.${startup.id}`, {
        method: "PATCH",
        body: JSON.stringify({ phase: "failed" }),
      });
    } else if (status === "pivot") {
      await supabaseFetch(`/Startup?id=eq.${startup.id}`, {
        method: "PATCH",
        body: JSON.stringify({ phase: "pivot" }),
      });
    } else if (status === "growing") {
      // If growing, maybe advance phase if in idea
      if (startup.phase === "idea") {
        await supabaseFetch(`/Startup?id=eq.${startup.id}`, {
          method: "PATCH",
          body: JSON.stringify({ phase: "mvp" }),
        });
      }
    }

    // 5. Trigger Analyzer
    console.log(`[OmniMemory API] Triggering causal analysis for startup ${startup.id} with status ${status}`);
    const analysisResult = await analyzeStartupOutcome(startup.id, status, notes || "");

    return NextResponse.json({
      success: true,
      outcome: outcome[0],
      analysis: analysisResult,
    });
  } catch (err: any) {
    console.error("[Startup Outcome POST Error]:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
