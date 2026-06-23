import { NextResponse } from "next/server";
import { getDiscussions, saveDiscussions, Discussion } from "@/lib/custom-discussions";

export async function GET() {
  try {
    const list = await getDiscussions();
    // Sort discussions by updatedAt descending
    list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return NextResponse.json(list);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, title, messages } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing discussion id" }, { status: 400 });
    }

    const list = await getDiscussions();
    let target = list.find(d => d.id === id);

    if (target) {
      target.title = title || target.title;
      target.messages = messages || target.messages;
      target.updatedAt = new Date().toISOString();
    } else {
      const newDisc: Discussion = {
        id,
        title: title || "Nuova Conversazione",
        messages: messages || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      list.push(newDisc);
      target = newDisc;
    }

    await saveDiscussions(list);
    return NextResponse.json({ success: true, discussion: target });
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

    const list = await getDiscussions();
    const filtered = list.filter(d => d.id !== id);
    await saveDiscussions(filtered);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
