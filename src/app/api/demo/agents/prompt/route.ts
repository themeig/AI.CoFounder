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
    headers: { ...supabaseHeaders, ...options.headers },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase REST error: ${response.status} - ${errorText}`);
  }
  return response.json();
}

// GET /api/demo/agents/prompt?agentId=xxx
// Returns the current system prompt and training metadata for an agent
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    const agents = await supabaseFetch(`/AgentConfig?id=eq.${agentId}&select=id,name,type,settings`);
    const agent = agents?.[0];

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const settings = agent.settings || {};

    return NextResponse.json({
      agentId: agent.id,
      name: agent.name,
      type: agent.type,
      systemPrompt: settings.systemPrompt || null,
      expertise: settings.expertise || null,
      persona: settings.persona || null,
      knowledgeSources: settings.knowledgeSources || [],
      trainedAt: settings.trainedAt || null,
      lastEditedAt: settings.lastEditedAt || null,
      trainingStats: settings.trainingStats || null,
    });
  } catch (err: any) {
    console.error("[AgentPrompt GET Error]:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/demo/agents/prompt
// Manually update the system prompt, expertise, or persona
export async function PUT(req: Request) {
  try {
    const { agentId, systemPrompt, expertise, persona } = await req.json();

    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    // Fetch current settings
    const agents = await supabaseFetch(`/AgentConfig?id=eq.${agentId}&select=id,settings`);
    const agent = agents?.[0];

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const currentSettings = agent.settings || {};
    const updatedSettings: any = { ...currentSettings };

    if (systemPrompt !== undefined) {
      updatedSettings.systemPrompt = systemPrompt;
    }
    if (expertise !== undefined) {
      updatedSettings.expertise = expertise;
    }
    if (persona !== undefined) {
      updatedSettings.persona = persona;
    }
    updatedSettings.lastEditedAt = new Date().toISOString();

    const updated = await supabaseFetch(`/AgentConfig?id=eq.${agentId}`, {
      method: "PATCH",
      body: JSON.stringify({ settings: updatedSettings }),
    });

    return NextResponse.json({
      success: true,
      agentId,
      systemPrompt: updatedSettings.systemPrompt,
      expertise: updatedSettings.expertise,
      persona: updatedSettings.persona,
      lastEditedAt: updatedSettings.lastEditedAt,
    });
  } catch (err: any) {
    console.error("[AgentPrompt PUT Error]:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
