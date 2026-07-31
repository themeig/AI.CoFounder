import { NextResponse } from "next/server";

/**
 * POST /api/demo/models/test
 * Body: { provider, modelId, baseUrl, apiKey }
 * Tests connecting to an LLM provider endpoint.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { provider, modelId, baseUrl, apiKey } = body;

    if (!modelId) {
      return NextResponse.json({ success: false, error: "Model ID is required" }, { status: 400 });
    }

    let targetUrl = "";
    let targetKey = "";

    if (provider === "openai") {
      targetUrl = "https://api.openai.com/v1/chat/completions";
      targetKey = apiKey || process.env.OPENAI_API_KEY || "";
    } else if (provider === "ollama") {
      targetUrl = (baseUrl || "http://localhost:11434/v1").replace(/\/$/, "") + "/chat/completions";
      targetKey = apiKey || "ollama";
    } else if (provider === "custom") {
      if (!baseUrl) {
        return NextResponse.json({ success: false, error: "Base URL is required for custom provider" }, { status: 400 });
      }
      targetUrl = baseUrl.replace(/\/$/, "") + (baseUrl.endsWith("/chat/completions") ? "" : "/chat/completions");
      targetKey = apiKey || "";
    } else {
      // Default: OpenRouter
      targetUrl = "https://openrouter.ai/api/v1/chat/completions";
      targetKey = apiKey || process.env.OPENROUTER_API_KEY || "";
    }

    if (!targetKey && provider !== "ollama") {
      return NextResponse.json({
        success: false,
        error: `No API key provided or found in environment for ${provider || "OpenRouter"}`
      }, { status: 400 });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (targetKey) {
      headers["Authorization"] = `Bearer ${targetKey}`;
    }

    const testPayload = {
      model: modelId,
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 5,
    };

    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(testPayload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({
        success: false,
        error: `Provider returned status ${res.status}: ${errorText.slice(0, 150)}`
      }, { status: 400 });
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "OK";

    return NextResponse.json({
      success: true,
      message: `Successfully connected to ${modelId}! Response: "${reply.trim()}"`
    });
  } catch (err: any) {
    console.error("[Model Test API] Error:", err.message);
    return NextResponse.json({
      success: false,
      error: `Connection error: ${err.message}`
    }, { status: 500 });
  }
}
