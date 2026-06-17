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

/**
 * GET /api/demo/mnemosyne
 * Returns all memories stored in all AgentConfigs for the demo startup.
 */
export async function GET(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json([]);
    }

    // 1. Get or create user id
    let users = await supabaseFetch(`/User?email=eq.demo@agentfoundry.ai&select=id`);
    if (!users || users.length === 0) {
      return NextResponse.json([]);
    }
    const userId = users[0].id;

    // 2. Get startup id
    let startups = await supabaseFetch(`/Startup?userId=eq.${userId}&select=id`);
    if (!startups || startups.length === 0) {
      return NextResponse.json([]);
    }
    const startupId = startups[0].id;

    // 3. Fetch all agent configs for startup
    const agentConfigs = await supabaseFetch(`/AgentConfig?startupId=eq.${startupId}&select=*`);
    
    // 4. Extract and flatten all memories
    const allMemories: any[] = [];
    for (const config of agentConfigs) {
      let settings = config.settings || {};
      if (typeof settings === 'string') {
        try {
          settings = JSON.parse(settings);
        } catch {
          settings = {};
        }
      }
      const mnemosyne = settings.mnemosyne || [];
      if (Array.isArray(mnemosyne)) {
        for (const entry of mnemosyne) {
          allMemories.push({
            id: entry.id,
            agentConfigId: config.id,
            agentName: config.name,
            agentType: config.type,
            content: entry.content,
            importance: entry.importance,
            scope: entry.scope,
            source: entry.source,
            createdAt: entry.createdAt,
          });
        }
      }
    }

    // Sort by createdAt desc
    allMemories.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(allMemories);
  } catch (err: any) {
    console.error("[Mnemosyne GET Route] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/demo/mnemosyne
 * Deletes a specific memory entry.
 * Body or query params: { agentConfigId, id }
 */
export async function DELETE(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ error: "Missing database configuration" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const agentConfigId = searchParams.get("agentConfigId");
    const id = searchParams.get("id");

    if (!agentConfigId || !id) {
      return NextResponse.json({ error: "Missing agentConfigId or id parameter" }, { status: 400 });
    }

    // 1. Fetch AgentConfig
    const configs = await supabaseFetch(`/AgentConfig?id=eq.${agentConfigId}&select=*`);
    if (!configs || configs.length === 0) {
      return NextResponse.json({ error: "AgentConfig not found" }, { status: 444 });
    }

    const config = configs[0];
    let settings = config.settings || {};
    if (typeof settings === 'string') {
      try {
        settings = JSON.parse(settings);
      } catch {
        settings = {};
      }
    }

    const mnemosyne = settings.mnemosyne || [];
    if (!Array.isArray(mnemosyne)) {
      return NextResponse.json({ success: true, message: "No memories found" });
    }

    // 2. Filter out the targeted memory
    const updatedMnemosyne = mnemosyne.filter((entry: any) => entry.id !== id);
    settings.mnemosyne = updatedMnemosyne;

    // 3. Save back
    await supabaseFetch(`/AgentConfig?id=eq.${agentConfigId}`, {
      method: "PATCH",
      body: JSON.stringify({ settings }),
    });

    console.log(`[Mnemosyne DELETE] Deleted memory ${id} from agent ${agentConfigId}`);
    return NextResponse.json({ success: true, message: "Memory deleted successfully" });
  } catch (err: any) {
    console.error("[Mnemosyne DELETE Route] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
