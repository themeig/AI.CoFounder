import { NextResponse } from "next/server";
import { supabaseFetch } from "@/lib/supabase-demo";

export async function GET() {
  try {
    const users = await supabaseFetch("/User?email=eq.demo@agentfoundry.ai&select=id");
    const userId = users && Array.isArray(users) && users.length > 0 ? users[0].id : "demo-user-id";

    const startups = await supabaseFetch(`/Startup?userId=eq.${userId}&select=*`);
    const startup = startups && Array.isArray(startups) && startups.length > 0
      ? startups[0]
      : {
          id: "demo-startup-id",
          name: "TechFlow",
          description: "AI-powered workflow automation for startups",
          sector: "saas",
          phase: "pre-seed",
          mrr: 1200,
          users: 150,
          burnRate: 800,
          runway: 18,
        };

    const startupId = startup.id;
    const agents = await supabaseFetch(`/AgentConfig?startupId=eq.${startupId}&select=id,type,name,isActive,settings`);

    const agentsWithStats = [];
    if (Array.isArray(agents)) {
      for (const agent of agents) {
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
          messageCount: 5,
          memoryCount,
        });
      }
    }

    const result = [{
      ...startup,
      agents: agentsWithStats,
    }];

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Demo startup GET fallback error:", err?.message || err);
    return NextResponse.json([{
      id: "demo-startup-id",
      name: "TechFlow",
      description: "AI-powered workflow automation for startups",
      sector: "saas",
      phase: "pre-seed",
      mrr: 1200,
      users: 150,
      burnRate: 800,
      runway: 18,
      agents: [],
    }]);
  }
}
