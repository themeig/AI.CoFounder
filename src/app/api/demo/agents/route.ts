import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const DEFAULT_AGENTS = [
  { type: "strategy", name: "Strategy Agent", isActive: true },
  { type: "tech", name: "Tech Agent", isActive: true },
  { type: "finance", name: "Finance Agent", isActive: true },
  { type: "marketing", name: "Marketing Agent", isActive: false },
  { type: "legal", name: "Legal Agent", isActive: false },
  { type: "operations", name: "Operations Agent", isActive: false },
];

export async function GET() {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json(DEFAULT_AGENTS.map((a, i) => ({ id: "default-" + i, ...a })));
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
      return NextResponse.json(DEFAULT_AGENTS.map((a, i) => ({ id: "default-" + i, ...a })));
    }
    const userId = users[0].id;

    // Get agent configs
    const agentsRes = await fetch(
      SUPABASE_URL + "/rest/v1/AgentConfig?userId=eq." + userId + "&select=id,type,name,isActive",
      { headers }
    );
    let agents = [];
    try {
      agents = await agentsRes.json();
    } catch (e) {
      // ignore
    }

    if (Array.isArray(agents) && agents.length > 0) {
      return NextResponse.json(agents);
    }

    // No agents in DB - return defaults
    return NextResponse.json(DEFAULT_AGENTS.map((a, i) => ({ id: "default-" + i, ...a })));
  } catch (err) {
    console.error("Demo agents error:", err);
    return NextResponse.json(DEFAULT_AGENTS.map((a, i) => ({ id: "default-" + i, ...a })));
  }
}
