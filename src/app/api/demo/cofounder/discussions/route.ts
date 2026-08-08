import { NextResponse } from "next/server";
import { getDiscussions, saveDiscussions, Discussion } from "@/lib/custom-discussions";
import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from "@/lib/supabase-demo";
import { getActiveStartupContext } from "../../startups/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const activeCtx = await getActiveStartupContext(req);
    const startupId = activeCtx.id;

    // 1. Try Supabase Discussion table if configured
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/Discussion?startupId=eq.${startupId}&order=updatedAt.desc&select=*`,
          {
            headers: {
              apikey: SUPABASE_SERVICE_KEY,
              Authorization: "Bearer " + SUPABASE_SERVICE_KEY,
              "Content-Type": "application/json"
            }
          }
        );

        if (response.ok) {
          const dbDiscussions = await response.json();
          if (Array.isArray(dbDiscussions)) {
            return NextResponse.json(dbDiscussions);
          }
        }
      } catch (dbErr: any) {
        console.warn("[Discussions GET] Supabase Discussion table not ready, falling back to JSON:", dbErr?.message);
      }
    }

    // 2. Fallback: local JSON file filtered by startupId
    const list = await getDiscussions(startupId);
    list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return NextResponse.json(list);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, title, messages, todos } = body;
    const activeCtx = await getActiveStartupContext(req);
    const startupId = activeCtx.id;

    if (!id) {
      return NextResponse.json({ error: "Missing discussion id" }, { status: 400 });
    }

    let savedToDb = false;

    // 1. Try Supabase Discussion table if configured
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      try {
        const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/Discussion?id=eq.${id}&select=id`, {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: "Bearer " + SUPABASE_SERVICE_KEY,
            "Content-Type": "application/json"
          }
        });

        if (checkRes.ok) {
          const existing = await checkRes.json();
          if (Array.isArray(existing) && existing.length > 0) {
            // Update existing
            const updatePayload: any = { updatedAt: new Date().toISOString() };
            if (title !== undefined) updatePayload.title = title;
            if (messages !== undefined) updatePayload.messages = messages;
            if (todos !== undefined) updatePayload.todos = todos;

            const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/Discussion?id=eq.${id}`, {
              method: "PATCH",
              headers: {
                apikey: SUPABASE_SERVICE_KEY,
                Authorization: "Bearer " + SUPABASE_SERVICE_KEY,
                "Content-Type": "application/json",
                Prefer: "return=representation"
              },
              body: JSON.stringify(updatePayload)
            });
            if (patchRes.ok) {
              savedToDb = true;
              const updated = await patchRes.json();
              return NextResponse.json({
                success: true,
                discussion: Array.isArray(updated) && updated.length > 0 ? updated[0] : { id, startupId, title, messages, todos }
              });
            }
          } else {
            // Create new
            const newDisc = {
              id,
              startupId,
              title: title || "Nuova Conversazione",
              messages: messages || [],
              todos: todos || [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            const postRes = await fetch(`${SUPABASE_URL}/rest/v1/Discussion`, {
              method: "POST",
              headers: {
                apikey: SUPABASE_SERVICE_KEY,
                Authorization: "Bearer " + SUPABASE_SERVICE_KEY,
                "Content-Type": "application/json",
                Prefer: "return=representation"
              },
              body: JSON.stringify(newDisc)
            });
            if (postRes.ok) {
              savedToDb = true;
              const result = await postRes.json();
              return NextResponse.json({
                success: true,
                discussion: Array.isArray(result) && result.length > 0 ? result[0] : newDisc
              });
            }
          }
        }
      } catch (dbErr: any) {
        console.warn("[Discussions POST] Supabase Discussion table not ready, falling back to JSON:", dbErr?.message);
      }
    }

    // 2. Fallback: local JSON file
    if (!savedToDb) {
      const list = await getDiscussions();
      let target = list.find(d => d.id === id);

      if (target) {
        target.title = title || target.title;
        target.messages = messages || target.messages;
        if (todos !== undefined) target.todos = todos;
        target.updatedAt = new Date().toISOString();
        target.startupId = startupId;
      } else {
        const newDisc: Discussion = {
          id,
          startupId,
          title: title || "Nuova Conversazione",
          messages: messages || [],
          todos: todos || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        list.push(newDisc);
        target = newDisc;
      }

      await saveDiscussions(list);
      return NextResponse.json({ success: true, discussion: target });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing discussion id" }, { status: 400 });
    }

    // 1. Try Supabase
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/Discussion?id=eq.${id}`, {
          method: "DELETE",
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: "Bearer " + SUPABASE_SERVICE_KEY
          }
        });
      } catch (dbErr: any) {
        console.warn("[Discussions DELETE] Supabase fallback:", dbErr?.message);
      }
    }

    // 2. Also clean from JSON fallback
    const list = await getDiscussions();
    const filtered = list.filter(d => d.id !== id);
    await saveDiscussions(filtered);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
