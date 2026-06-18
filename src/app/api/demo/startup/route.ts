import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function GET() {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json([], { status: 200 });
    }

    const headers = {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": "Bearer " + SUPABASE_SERVICE_KEY,
    };

    // Get demo user
    const userRes = await fetch(
      SUPABASE_URL + "/rest/v1/User?email=eq.demo@agentfoundry.ai&select=id",
      { headers }
    );
    const users = await userRes.json();
    if (!users || users.length === 0) {
      return NextResponse.json([], { status: 200 });
    }
    const userId = users[0].id;

    // Get startup
    const startupRes = await fetch(
      SUPABASE_URL + "/rest/v1/Startup?userId=eq." + userId + "&select=*",
      { headers }
    );
    const startups = await startupRes.json();
    if (!startups || startups.length === 0) {
      return NextResponse.json([], { status: 200 });
    }
    const startup = startups[0];
    const startupId = startup.id;

    // Get agent configs - Fix: Query by startupId instead of userId
    const agentsRes = await fetch(
      SUPABASE_URL + "/rest/v1/AgentConfig?startupId=eq." + startupId + "&select=id,type,name,isActive,settings",
      { headers }
    );
    let agents = [];
    try {
      agents = await agentsRes.json();
    } catch (e) {
      // ignore
    }

    const agentsWithStats = [];
    if (Array.isArray(agents)) {
      for (const agent of agents) {
        let messageCount = 0;
        try {
          // Perform a fast HEAD request to get message count via PostgREST headers
          const msgCountRes = await fetch(
            SUPABASE_URL + "/rest/v1/Message?agentId=eq." + agent.id + "&select=id",
            {
              headers: {
                ...headers,
                "Prefer": "count=exact"
              },
              method: "HEAD"
            }
          );
          const contentRange = msgCountRes.headers.get("content-range");
          if (contentRange) {
            const parts = contentRange.split("/");
            if (parts.length > 1) {
              messageCount = parseInt(parts[1], 10) || 0;
            }
          }
        } catch (e) {
          // ignore
        }

        // Count memories in settings.mnemosyne JSONB
        let memoryCount = 0;
        if (agent.settings && typeof agent.settings === "object") {
          const settingsObj = agent.settings as any;
          if (Array.isArray(settingsObj.mnemosyne)) {
            memoryCount = settingsObj.mnemosyne.length;
          }
        }

        agentsWithStats.push({
          id: agent.id,
          type: agent.type,
          name: agent.name,
          isActive: agent.isActive,
          messageCount,
          memoryCount,
        });
      }
    }

    const result = [{
      ...startup,
      agentConfigs: agentsWithStats,
    }];

    return NextResponse.json(result);
  } catch (err) {
    console.error("Demo startup GET error:", err);
    return NextResponse.json([], { status: 200 });
  }
}

/**
 * PATCH /api/demo/startup
 * Updates basic startup settings or manually overridden metrics.
 */
export async function PATCH(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ error: "Missing database configurations" }, { status: 500 });
    }

    const headers = {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": "Bearer " + SUPABASE_SERVICE_KEY,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    };

    const body = await req.json();
    const { id, mrr, users, burnRate, runway, name, description, website, sector, phase } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing startup id" }, { status: 400 });
    }

    const payload: any = {};
    if (typeof mrr === "number") payload.mrr = mrr;
    if (typeof users === "number") payload.users = users;
    if (typeof burnRate === "number") payload.burnRate = burnRate;
    if (typeof runway === "number") payload.runway = runway;
    if (name) payload.name = name;
    if (description !== undefined) payload.description = description;
    if (website !== undefined) payload.website = website;
    if (sector) payload.sector = sector;
    if (phase) payload.phase = phase;

    const patchRes = await fetch(
      SUPABASE_URL + "/rest/v1/Startup?id=eq." + id,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify(payload),
      }
    );

    if (!patchRes.ok) {
      const errorText = await patchRes.text();
      throw new Error(`Failed to patch startup: ${patchRes.status} - ${errorText}`);
    }

    const updated = await patchRes.json();
    return NextResponse.json(updated && updated.length > 0 ? updated[0] : null);
  } catch (err: any) {
    console.error("Demo startup PATCH error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
