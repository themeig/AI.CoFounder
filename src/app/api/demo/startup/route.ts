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

    const result = startups.map((s) => ({
      ...s,
      agentConfigs: Array.isArray(agents) ? agents : [],
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("Demo startup error:", err);
    return NextResponse.json([], { status: 200 });
  }
}
