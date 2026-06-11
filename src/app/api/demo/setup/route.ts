import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";

export async function POST() {
  try {
    // Check if demo user already exists
    let user = await db.user.findUnique({
      where: { email: "demo@agentfoundry.ai" },
    });

    if (!user) {
      // Create demo user
      user = await db.user.create({
        data: {
          email: "demo@agentfoundry.ai",
          name: "Demo Founder",
        },
      });

      // Create demo startup
      const startup = await db.startup.create({
        data: {
          userId: user.id,
          name: "TechFlow",
          description: "AI-powered project management for remote teams. We help distributed teams collaborate better with AI-assisted task management and automated workflows.",
          website: "https://techflow-demo.vercel.app",
          sector: "saas",
          phase: "mvp",
          country: "Italy",
          teamSize: 3,
          mrr: 2500,
          users: 150,
          burnRate: 8000,
          runway: 6,
          fundingRaised: 0,
        },
      });

      // Create agent configs
      const agentTypes = [
        { type: "strategy", name: "Strategy Agent", active: true },
        { type: "tech", name: "Tech Agent", active: true },
        { type: "finance", name: "Finance Agent", active: true },
        { type: "marketing", name: "Marketing Agent", active: false },
        { type: "legal", name: "Legal Agent", active: false },
        { type: "operations", name: "Operations Agent", active: false },
      ];

      for (const agent of agentTypes) {
        await db.agentConfig.create({
          data: {
            startupId: startup.id,
            type: agent.type,
            name: agent.name,
            isActive: agent.active,
          },
        });
      }

      // Create some demo interactions
      await db.interaction.create({
        data: {
          startupId: startup.id,
          agentType: "strategy",
          category: "growth",
          advice: "Focus on Product-Led Growth with a freemium tier. Your viral coefficient should be > 0.3 for organic growth.",
          context: { mrr: 2500, users: 150, phase: "mvp" },
        },
      });

      await db.interaction.create({
        data: {
          startupId: startup.id,
          agentType: "finance",
          category: "fundraising",
          advice: "With $2.5K MRR and 6 months runway, start fundraising in 3-4 months. Target $500K-$1M seed round.",
          context: { mrr: 2500, burnRate: 8000, runway: 6 },
        },
      });

      // Create demo outcome
      await db.outcome.create({
        data: {
          startupId: startup.id,
          status: "growing",
          metrics: { mrr: 2500, users: 150, growth_rate: 0.15 },
          keyFactors: ["product_market_fit", "strong_team", "plg_strategy"],
        },
      });
    }

    // Set a simple demo cookie (bypass NextAuth for demo)
    const response = NextResponse.json({ success: true, userId: user.id });
    response.cookies.set("demo_user", user.id, {
      httpOnly: true,
      maxAge: 60 * 60 * 24, // 1 day
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Demo setup error:", error);
    return NextResponse.json({ error: "Demo setup failed" }, { status: 500 });
  }
}
