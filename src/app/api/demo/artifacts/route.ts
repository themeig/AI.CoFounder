import { NextResponse } from "next/server";
import { getArtifacts, saveArtifacts, Artifact } from "@/lib/custom-artifacts";
import { executePython, executeTypeScript } from "@/lib/sandbox-runner";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const discussionId = searchParams.get("discussionId");

    let list = await getArtifacts();
    if (discussionId) {
      list = list.filter(a => a.discussionId === discussionId);
    }
    return NextResponse.json(list);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, id, title, filename, code, language, type, discussionId } = body;
    const list = await getArtifacts();

    if (action === "run") {
      const artId = id;
      const target = list.find(a => a.id === artId);
      const codeToRun = target ? target.code : code;
      const langToRun = target ? target.language : language;

      if (!codeToRun || !langToRun) {
        return NextResponse.json({ error: "Code or language missing for execution" }, { status: 400 });
      }

      let logs: string[] = [];
      const timestamp = new Date().toLocaleTimeString();
      logs.push(`> [${timestamp}] Avvio di ${target ? target.filename : "script"}...`);

      const l = langToRun.toLowerCase();
      if (l === "python" || l === "py") {
        const out = await executePython(codeToRun);
        logs.push(out);
      } else if (l === "javascript" || l === "typescript" || l === "js" || l === "ts") {
        const out = await executeTypeScript(codeToRun);
        logs.push(out);
      } else {
        logs.push(`[System] L'esecuzione non è supportata per la lingua: ${langToRun}`);
      }

      logs.push(`> [${new Date().toLocaleTimeString()}] Esecuzione terminata.`);

      if (target) {
        target.logs = logs;
        target.updatedAt = new Date().toISOString();
        await saveArtifacts(list);
      }

      return NextResponse.json({ success: true, logs, artifact: target });
    }

    // Default action: Create or Update
    let target: Artifact | undefined;
    if (id) {
      target = list.find(a => a.id === id);
    }

    if (target) {
      // Update
      target.title = title || target.title;
      target.filename = filename || target.filename;
      target.code = code || target.code;
      target.language = language || target.language;
      target.type = type || target.type;
      target.updatedAt = new Date().toISOString();
      if (discussionId) {
        target.discussionId = discussionId;
      }
    } else {
      // Create
      const newArt: Artifact = {
        id: id || "art-" + Date.now(),
        title: title || "Senza titolo",
        filename: filename || "artifact.txt",
        code: code || "",
        language: language || "text",
        type: type || "code",
        logs: [],
        discussionId: discussionId || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      list.push(newArt);
      target = newArt;
    }

    await saveArtifacts(list);
    return NextResponse.json({ success: true, artifact: target });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing artifact id" }, { status: 400 });
    }

    const list = await getArtifacts();
    const filtered = list.filter(a => a.id !== id);
    await saveArtifacts(filtered);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
