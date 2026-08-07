import { NextResponse } from "next/server";
import { supabaseFetch, updateFallbackStartup, fallbackStartup } from "@/lib/supabase-demo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Portfolio in-memory fallback list if Supabase has single entry
let portfolioStartups: any[] = [
  {
    id: "dec0f78e-0113-48c3-ae65-b598d0e7267d",
    name: "TechFlow",
    description: "AI-powered workflow automation for startups",
    sector: "SaaS",
    phase: "pre-seed",
    mrr: 8500,
    users: 27000,
    burnRate: 18000,
    runway: 14,
    exitValuation: 0,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "startup-sold-01",
    name: "CloudScale AI",
    description: "Cloud optimization engine acquired by enterprise tech leader.",
    sector: "AI / Cloud",
    phase: "sold",
    mrr: 45000,
    users: 92000,
    burnRate: 0,
    runway: 0,
    exitValuation: 4200000,
    createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "startup-failed-01",
    name: "CryptoVault Labs",
    description: "DeFi custody wallet (operations halted during market pivot).",
    sector: "Fintech",
    phase: "failed",
    mrr: 0,
    users: 3500,
    burnRate: 0,
    runway: 0,
    exitValuation: 0,
    createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
  }
];

let activeStartupId = "dec0f78e-0113-48c3-ae65-b598d0e7267d";

export async function GET() {
  try {
    const users = await supabaseFetch("/User?email=eq.demo@agentfoundry.ai&select=id");
    const userId = users && Array.isArray(users) && users.length > 0 ? users[0].id : "demo-user-id";

    const dbStartups = await supabaseFetch(`/Startup?userId=eq.${userId}&select=*`);
    
    let startupsList = portfolioStartups;
    if (dbStartups && Array.isArray(dbStartups) && dbStartups.length > 0) {
      // Merge db startups with sold/failed portfolio mocks if db only has 1
      const dbIds = new Set(dbStartups.map(s => s.id));
      startupsList = [
        ...dbStartups,
        ...portfolioStartups.filter(p => !dbIds.has(p.id))
      ];
    }

    // Ensure active startup matches fallbackStartup in memory
    const mainStartup = startupsList.find(s => s.id === activeStartupId) || startupsList[0];
    if (mainStartup) {
      updateFallbackStartup({
        id: mainStartup.id,
        name: mainStartup.name,
        description: mainStartup.description,
        sector: mainStartup.sector,
        phase: mainStartup.phase,
        mrr: mainStartup.mrr,
        users: mainStartup.users,
        burnRate: mainStartup.burnRate,
        runway: mainStartup.runway
      });
    }

    // Calculate aggregated stats
    const activeCount = startupsList.filter(s => s.phase !== "sold" && s.phase !== "failed").length;
    const soldCount = startupsList.filter(s => s.phase === "sold" || s.phase === "exit").length;
    const failedCount = startupsList.filter(s => s.phase === "failed" || s.phase === "halted").length;
    const totalUsers = startupsList.reduce((acc, s) => acc + (Number(s.users) || 0), 0);
    const totalMrr = startupsList.reduce((acc, s) => acc + (Number(s.mrr) || 0), 0);
    const totalExitValuation = startupsList.reduce((acc, s) => acc + (Number(s.exitValuation) || 0), 0);

    return NextResponse.json({
      startups: startupsList,
      activeStartupId,
      stats: {
        totalStartups: startupsList.length,
        activeCount,
        soldCount,
        failedCount,
        totalUsers,
        totalMrr,
        totalExitValuation
      }
    });
  } catch (err: any) {
    console.error("[Startups GET Error]:", err?.message || err);
    return NextResponse.json({
      startups: portfolioStartups,
      activeStartupId,
      stats: {
        totalStartups: portfolioStartups.length,
        activeCount: 1,
        soldCount: 1,
        failedCount: 1,
        totalUsers: 122500,
        totalMrr: 53500,
        totalExitValuation: 4200000
      }
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, sector, phase, mrr, users, burnRate, runway, description, exitValuation } = body;

    if (!name) {
      return NextResponse.json({ error: "Il nome della startup è obbligatorio." }, { status: 400 });
    }

    const usersList = await supabaseFetch("/User?email=eq.demo@agentfoundry.ai&select=id");
    const userId = usersList && Array.isArray(usersList) && usersList.length > 0 ? usersList[0].id : "demo-user-id";

    const newStartup: any = {
      id: "startup-" + Date.now(),
      userId,
      name,
      description: description || "Nuova startup nel portfolio founder",
      sector: sector || "SaaS",
      phase: phase || "pre-seed",
      mrr: Number(mrr) || 0,
      users: Number(users) || 0,
      burnRate: Number(burnRate) || 0,
      runway: Number(runway) || 12,
      exitValuation: Number(exitValuation) || 0,
      createdAt: new Date().toISOString()
    };

    // Save to DB
    try {
      const dbResult = await supabaseFetch("/Startup", {
        method: "POST",
        body: JSON.stringify(newStartup)
      });
      if (dbResult && Array.isArray(dbResult) && dbResult.length > 0) {
        newStartup.id = dbResult[0].id;
      }
    } catch (err: any) {
      console.warn("[Startups POST DB Warning]:", err?.message);
    }

    portfolioStartups.unshift(newStartup);

    if (body.makeActive) {
      activeStartupId = newStartup.id;
      updateFallbackStartup(newStartup);
    }

    return NextResponse.json({
      success: true,
      message: `✓ Startup '${name}' creata con successo!`,
      startup: newStartup
    });
  } catch (err: any) {
    console.error("[Startups POST Error]:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Impossibile creare la startup." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, makeActive, name, sector, phase, mrr, users, burnRate, runway, description, exitValuation } = body;

    if (!id) {
      return NextResponse.json({ error: "ID startup obbligatorio." }, { status: 400 });
    }

    const targetIdx = portfolioStartups.findIndex(s => s.id === id);
    if (targetIdx !== -1) {
      if (name) portfolioStartups[targetIdx].name = name;
      if (sector) portfolioStartups[targetIdx].sector = sector;
      if (phase) portfolioStartups[targetIdx].phase = phase;
      if (mrr !== undefined) portfolioStartups[targetIdx].mrr = Number(mrr);
      if (users !== undefined) portfolioStartups[targetIdx].users = Number(users);
      if (burnRate !== undefined) portfolioStartups[targetIdx].burnRate = Number(burnRate);
      if (runway !== undefined) portfolioStartups[targetIdx].runway = Number(runway);
      if (description !== undefined) portfolioStartups[targetIdx].description = description;
      if (exitValuation !== undefined) portfolioStartups[targetIdx].exitValuation = Number(exitValuation);
    }

    // Try DB update
    try {
      await supabaseFetch(`/Startup?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...(name && { name }),
          ...(sector && { sector }),
          ...(phase && { phase }),
          ...(mrr !== undefined && { mrr: Number(mrr) }),
          ...(users !== undefined && { users: Number(users) }),
          ...(burnRate !== undefined && { burnRate: Number(burnRate) }),
          ...(runway !== undefined && { runway: Number(runway) }),
          ...(description !== undefined && { description }),
        })
      });
    } catch {}

    if (makeActive) {
      activeStartupId = id;
      const activeObj = portfolioStartups.find(s => s.id === id);
      if (activeObj) updateFallbackStartup(activeObj);
    }

    return NextResponse.json({
      success: true,
      message: `✓ Startup aggiornata con successo!`,
      activeStartupId
    });
  } catch (err: any) {
    console.error("[Startups PATCH Error]:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Impossibile aggiornare la startup." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Parametro id obbligatorio." }, { status: 400 });
    }

    portfolioStartups = portfolioStartups.filter(s => s.id !== id);

    try {
      await supabaseFetch(`/Startup?id=eq.${id}`, { method: "DELETE" });
    } catch {}

    if (activeStartupId === id && portfolioStartups.length > 0) {
      activeStartupId = portfolioStartups[0].id;
      updateFallbackStartup(portfolioStartups[0]);
    }

    return NextResponse.json({
      success: true,
      message: `✓ Startup eliminata con successo dal portfolio.`
    });
  } catch (err: any) {
    console.error("[Startups DELETE Error]:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Impossibile eliminare la startup." }, { status: 500 });
  }
}
