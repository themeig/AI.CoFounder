import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getModel } from "@/lib/ai";
import { getRelevantPatterns } from "@/lib/memory-engine";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { agentId, agentType, message } = await req.json();

    // Get agent config
    const agent = await db.agentConfig.findUnique({
      where: { id: agentId },
      include: { startup: true },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Get relevant patterns from memory engine
    const patterns = await getRelevantPatterns(agent.startup.sector as any, agent.startup.phase as any);

    // Build system prompt
    const patternContext = patterns.length > 0
      ? `\n\nRelevant patterns from successful startups:\n${patterns.map((p) => `- ${p.title}: ${p.description} (Success rate: ${(p.successRate * 100).toFixed(0)}%)`).join("\n")}`
      : "";

    const systemPrompt = `You are the ${agent.name} for ${agent.startup.name}, a ${agent.startup.sector} startup in the ${agent.startup.phase} phase.

Current startup metrics:
- MRR: $${agent.startup.mrr}
- Users: ${agent.startup.users}
- Burn Rate: $${agent.startup.burnRate}/month
- Runway: ${agent.startup.runway} months

${patternContext}

Provide actionable, specific advice based on the startup's current situation and patterns from similar successful startups. Be concise but thorough.`;

    // Get AI response
    const model = getModel("openrouter");
    
    const response = await model.chat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      maxTokens: 1000,
    });

    const aiResponse = response.text || "I'm thinking about that...";

    // Save interaction to memory engine
    await db.interaction.create({
      data: {
        startupId: agent.startupId,
        agentType,
        category: "chat",
        advice: aiResponse,
        context: {
          userMessage: message,
          agentType,
          startupPhase: agent.startup.phase,
          startupSector: agent.startup.sector,
        } as any,
      },
    });

    // Save messages
    await db.message.create({
      data: { agentId, role: "user", content: message },
    });
    await db.message.create({
      data: { agentId, role: "assistant", content: aiResponse },
    });

    return NextResponse.json({ response: aiResponse });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }
}
