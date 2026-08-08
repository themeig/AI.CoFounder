import { NextResponse } from "next/server";
import { supabaseFetch } from "@/lib/supabase-demo";
import { getActiveStartupContext } from "../../startups/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Helper to get or create the CoFounder AgentConfig in Supabase for the active startup
async function getCofounderConfigForActiveStartup(req: Request) {
  const activeCtx = await getActiveStartupContext(req);
  const startupId = activeCtx.id;

  const dbConfigs = await supabaseFetch(
    `/AgentConfig?startupId=eq.${startupId}&type=eq.cofounder&select=*`
  );

  if (dbConfigs && Array.isArray(dbConfigs) && dbConfigs.length > 0) {
    return { cofounderConfig: dbConfigs[0], startupId };
  }

  // Create cofounder config for this startup in Supabase if missing
  const newConfigs = await supabaseFetch("/AgentConfig", {
    method: "POST",
    body: JSON.stringify({
      startupId,
      type: "cofounder",
      name: "coFounder",
      isActive: true,
      settings: {
        enabledTools: [
          "webSearch", "readWebPage", "getStartupInfo", "getCustomMetrics",
          "runPythonScript", "runTypeScriptScript", "createOrUpdateArtifact",
          "runArtifact", "getActiveArtifacts", "renameDiscussion"
        ],
        useLongTermMemory: true,
        recencyBias: 0.5,
        autoSaveInteractions: true,
        discussions: []
      }
    })
  });

  return {
    cofounderConfig: newConfigs && Array.isArray(newConfigs) && newConfigs.length > 0 ? newConfigs[0] : null,
    startupId
  };
}

export async function GET(req: Request) {
  try {
    const { cofounderConfig } = await getCofounderConfigForActiveStartup(req);
    if (!cofounderConfig) {
      return NextResponse.json([]);
    }

    let settings = cofounderConfig.settings || {};
    if (typeof settings === "string") {
      try { settings = JSON.parse(settings); } catch { settings = {}; }
    }

    const discussions = Array.isArray(settings.discussions) ? settings.discussions : [];
    discussions.sort((a: any, b: any) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

    return NextResponse.json(discussions);
  } catch (err: any) {
    console.error("[Discussions GET Error]:", err?.message || err);
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, title, messages, todos } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing discussion id" }, { status: 400 });
    }

    const { cofounderConfig, startupId } = await getCofounderConfigForActiveStartup(req);
    if (!cofounderConfig) {
      return NextResponse.json({ error: "CoFounder config not found for active startup." }, { status: 500 });
    }

    let settings = cofounderConfig.settings || {};
    if (typeof settings === "string") {
      try { settings = JSON.parse(settings); } catch { settings = {}; }
    }

    let discussions: any[] = Array.isArray(settings.discussions) ? [...settings.discussions] : [];
    let target = discussions.find(d => d.id === id);

    if (target) {
      if (title !== undefined) target.title = title;
      if (messages !== undefined) target.messages = messages;
      if (todos !== undefined) target.todos = todos;
      target.updatedAt = new Date().toISOString();
      target.startupId = startupId;
    } else {
      target = {
        id,
        startupId,
        title: title || "Nuova Conversazione",
        messages: messages || [],
        todos: todos || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      discussions.unshift(target);
    }

    const updatedSettings = {
      ...settings,
      discussions
    };

    await supabaseFetch(`/AgentConfig?id=eq.${cofounderConfig.id}`, {
      method: "PATCH",
      body: JSON.stringify({ settings: updatedSettings })
    });

    return NextResponse.json({
      success: true,
      discussion: target
    });
  } catch (err: any) {
    console.error("[Discussions POST Error]:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Impossibile salvare la conversazione su Supabase." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing discussion id" }, { status: 400 });
    }

    const { cofounderConfig } = await getCofounderConfigForActiveStartup(req);
    if (!cofounderConfig) {
      return NextResponse.json({ success: true });
    }

    let settings = cofounderConfig.settings || {};
    if (typeof settings === "string") {
      try { settings = JSON.parse(settings); } catch { settings = {}; }
    }

    let discussions: any[] = Array.isArray(settings.discussions) ? settings.discussions : [];
    discussions = discussions.filter(d => d.id !== id);

    const updatedSettings = {
      ...settings,
      discussions
    };

    await supabaseFetch(`/AgentConfig?id=eq.${cofounderConfig.id}`, {
      method: "PATCH",
      body: JSON.stringify({ settings: updatedSettings })
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Discussions DELETE Error]:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Impossibile eliminare la conversazione." }, { status: 500 });
  }
}
