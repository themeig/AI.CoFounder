import { NextResponse } from "next/server";
import { getDiscussions, saveDiscussions, Discussion } from "@/lib/custom-discussions";
import { supabaseFetch } from "@/lib/supabase-demo";
import { getActiveStartupContext } from "../../startups/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const activeCtx = await getActiveStartupContext(req);
    const startupId = activeCtx.id;

    // 1. Try Supabase Discussion table
    try {
      const dbDiscussions = await supabaseFetch(
        `/Discussion?startupId=eq.${startupId}&order=updatedAt.desc&select=*`
      );
      if (Array.isArray(dbDiscussions)) {
        return NextResponse.json(dbDiscussions);
      }
    } catch (dbErr: any) {
      console.warn("[Discussions GET] Supabase Discussion table not available, falling back to JSON:", dbErr?.message);
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

    // 1. Try Supabase Discussion table
    let savedToDb = false;
    try {
      // Check if discussion exists in DB
      const existing = await supabaseFetch(`/Discussion?id=eq.${id}&select=id`);
      if (existing && Array.isArray(existing) && existing.length > 0) {
        // Update existing
        const updatePayload: any = { updatedAt: new Date().toISOString() };
        if (title !== undefined) updatePayload.title = title;
        if (messages !== undefined) updatePayload.messages = messages;
        if (todos !== undefined) updatePayload.todos = todos;

        await supabaseFetch(`/Discussion?id=eq.${id}`, {
          method: "PATCH",
          body: JSON.stringify(updatePayload)
        });
        savedToDb = true;

        const updated = await supabaseFetch(`/Discussion?id=eq.${id}&select=*`);
        return NextResponse.json({
          success: true,
          discussion: updated && updated.length > 0 ? updated[0] : { id, startupId, title, messages, todos }
        });
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
        const result = await supabaseFetch("/Discussion", {
          method: "POST",
          body: JSON.stringify(newDisc)
        });
        savedToDb = true;
        return NextResponse.json({
          success: true,
          discussion: result && result.length > 0 ? result[0] : newDisc
        });
      }
    } catch (dbErr: any) {
      console.warn("[Discussions POST] Supabase Discussion table not available, falling back to JSON:", dbErr?.message);
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
    try {
      await supabaseFetch(`/Discussion?id=eq.${id}`, { method: "DELETE" });
    } catch (dbErr: any) {
      console.warn("[Discussions DELETE] Supabase fallback:", dbErr?.message);
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
