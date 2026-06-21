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

const DEFAULT_AGENTS = [
  { type: "strategy", name: "Strategy Agent", isActive: true },
  { type: "tech", name: "Tech Agent", isActive: true },
  { type: "finance", name: "Finance Agent", isActive: true },
];

async function getOrCreateStartup() {
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
  return startup;
}

/**
 * GET /api/demo/agents
 * Fetches all agent configurations for the active startup.
 */
export async function GET() {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json(DEFAULT_AGENTS.map((a, i) => ({ id: "default-" + i, ...a })));
    }

    const startup = await getOrCreateStartup();

    // Get agent configs linked to this startup
    let agents = await supabaseFetch(`/AgentConfig?startupId=eq.${startup.id}&select=id,type,name,isActive,settings`);

    // If no agents are in the database, seed default agents
    if (!agents || agents.length === 0) {
      agents = [];
      for (const da of DEFAULT_AGENTS) {
        const newAgent = await supabaseFetch(`/AgentConfig`, {
          method: "POST",
          body: JSON.stringify({
            startupId: startup.id,
            type: da.type,
            name: da.name,
            isActive: da.isActive,
            settings: { enabledTools: ["get_knowledge_pattern_details", "webSearch", "getStartupInfo", "getCustomMetrics", "readWebPage"] }
          }),
        });
        if (newAgent && newAgent.length > 0) {
          agents.push(newAgent[0]);
        }
      }
    }

    return NextResponse.json(agents);
  } catch (err: any) {
    console.error("Demo agents GET error:", err.message);
    return NextResponse.json(DEFAULT_AGENTS.map((a, i) => ({ id: "default-" + i, ...a })));
  }
}

/**
 * POST /api/demo/agents
 * Creates a new agent config.
 */
export async function POST(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ error: "Missing database configurations" }, { status: 500 });
    }

    const { type, name } = await req.json();
    if (!type || !name) {
      return NextResponse.json({ error: "Missing type or name parameter" }, { status: 400 });
    }

    const startup = await getOrCreateStartup();

    // Create new agent config
    const newAgent = await supabaseFetch(`/AgentConfig`, {
      method: "POST",
      body: JSON.stringify({
        startupId: startup.id,
        type: type.toLowerCase(),
        name,
        isActive: true,
        settings: { enabledTools: ["get_knowledge_pattern_details", "webSearch", "getStartupInfo", "getCustomMetrics", "readWebPage"] }
      }),
    });

    if (!newAgent || newAgent.length === 0) {
      throw new Error("Failed to insert AgentConfig");
    }

    return NextResponse.json(newAgent[0]);
  } catch (err: any) {
    console.error("Demo agents POST error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/demo/agents
 * Deletes an agent config.
 */
export async function DELETE(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ error: "Missing database configurations" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
    }

    // Delete agent config
    await supabaseFetch(`/AgentConfig?id=eq.${id}`, {
      method: "DELETE",
    });

    return NextResponse.json({ success: true, message: "AgentConfig deleted successfully" });
  } catch (err: any) {
    console.error("Demo agents DELETE error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/demo/agents
 * Updates agent configurations (e.g. active toggles).
 */
export async function PATCH(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ error: "Missing database configurations" }, { status: 500 });
    }

    const body = await req.json();
    const { id, isActive, name, settings } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
    }

    const payload: any = {};
    if (typeof isActive === "boolean") payload.isActive = isActive;
    if (name) payload.name = name;
    if (settings !== undefined) payload.settings = settings;

    const updated = await supabaseFetch(`/AgentConfig?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    return NextResponse.json(updated && updated.length > 0 ? updated[0] : null);
  } catch (err: any) {
    console.error("Demo agents PATCH error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
