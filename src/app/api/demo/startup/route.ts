import { NextResponse } from "next/server";
import { supabaseFetch, updateFallbackStartup } from "@/lib/supabase-demo";
import { getActiveStartupContext } from "../startups/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const activeCtx = getActiveStartupContext(req);
    const users = await supabaseFetch("/User?email=eq.demo@agentfoundry.ai&select=id");
    const userId = users && Array.isArray(users) && users.length > 0 ? users[0].id : "demo-user-id";

    const dbStartups = await supabaseFetch(`/Startup?id=eq.${activeCtx.id}&select=*`);
    const startup = dbStartups && Array.isArray(dbStartups) && dbStartups.length > 0
      ? dbStartups[0]
      : activeCtx;

    const startupId = startup.id || "demo-startup-id";
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

    // Sync fallback startup in memory
    updateFallbackStartup(startup);

    const result = [{
      ...startup,
      agents: agentsWithStats,
    }];

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Demo startup GET fallback error:", err?.message || err);
    return NextResponse.json([{
      ...updateFallbackStartup({}),
      agents: [],
    }]);
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { mrr, users, burnRate, runway, phase, sector, name, description } = body;

    const updatePayload: any = {};
    if (mrr !== undefined) updatePayload.mrr = Number(mrr);
    if (users !== undefined) updatePayload.users = Number(users);
    if (burnRate !== undefined) updatePayload.burnRate = Number(burnRate);
    if (runway !== undefined) updatePayload.runway = Number(runway);
    if (phase !== undefined) updatePayload.phase = String(phase);
    if (sector !== undefined) updatePayload.sector = String(sector);
    if (name !== undefined) updatePayload.name = String(name);
    if (description !== undefined) updatePayload.description = String(description);

    // Update in-memory fallback
    updateFallbackStartup(updatePayload);

    // Update in Supabase
    const usersList = await supabaseFetch("/User?email=eq.demo@agentfoundry.ai&select=id");
    const userId = usersList && Array.isArray(usersList) && usersList.length > 0 ? usersList[0].id : null;

    let updated = null;
    if (userId) {
      const startups = await supabaseFetch(`/Startup?userId=eq.${userId}&select=*`);
      if (startups && startups.length > 0) {
        const startupId = startups[0].id;
        updated = await supabaseFetch(`/Startup?id=eq.${startupId}`, {
          method: "PATCH",
          body: JSON.stringify(updatePayload),
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "✓ Metriche startup aggiornate con successo nel database!",
      startup: updated && Array.isArray(updated) && updated.length > 0 ? updated[0] : updatePayload
    });
  } catch (err: any) {
    console.error("[Startup PUT Error]:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Impossibile aggiornare i dati della startup." }, { status: 500 });
  }
}
