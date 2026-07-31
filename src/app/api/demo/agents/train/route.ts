import { NextResponse } from "next/server";
import { runAgentTraining } from "@/lib/agents/trainer";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

// POST /api/demo/agents/train — Deep Training Pipeline (SSE)
export async function POST(req: Request) {
  try {
    const { agentId, expertise, agentName, agentType, modelId } = await req.json();
    const activeModelId = modelId || "openrouter/free";

    if (!agentId || !expertise) {
      return NextResponse.json({ error: "agentId and expertise are required" }, { status: 400 });
    }
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "OPENROUTER_API_KEY not configured" }, { status: 500 });
    }

    // SSE stream setup
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const push = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          await runAgentTraining(agentId, expertise, agentName, agentType, activeModelId, (event) => {
            push(event);
          });
        } catch (err: any) {
          push({ type: "error", message: err.message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (err: any) {
    console.error("[AgentTrain Error]:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

