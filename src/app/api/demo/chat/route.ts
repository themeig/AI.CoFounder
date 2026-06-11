import { NextResponse } from "next/server";

const OPENROUTER_KEY = "8d0bd87af9f36bb1ceb771915f7388b3489826028bd0b32332034d1556028d4e";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { agentType, message } = body;

    if (!message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    console.log("[Chat] agentType:", agentType, "message:", message.slice(0, 30));

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/typh-h3-preview",
        messages: [
          { role: "system", content: "Sei un assistente AI per startup. Rispondi in italiano." },
          { role: "user", content: message }
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Chat] OpenRouter error:", res.status, err);
      return NextResponse.json({ error: "OpenRouter failed", details: err }, { status: 500 });
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content ?? "Nessuna risposta.";

    console.log("[Chat] reply:", reply.slice(0, 50));

    return NextResponse.json({ response: reply, sessionId: null });
  } catch (err: any) {
    console.error("[Chat] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
