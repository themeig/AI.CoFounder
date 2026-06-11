import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const startup = await db.startup.create({
      data: {
        userId: session.user.id,
        name: body.name,
        description: body.description,
        website: body.website,
        sector: body.sector,
        phase: body.phase,
        country: body.country,
        teamSize: body.teamSize || 1,
      },
    });

    // Create default agent configs
    const agentTypes = ["strategy", "tech", "finance", "marketing", "legal", "operations"];
    for (const type of agentTypes) {
      await db.agentConfig.create({
        data: {
          startupId: startup.id,
          type,
          name: `${type.charAt(0).toUpperCase() + type.slice(1)} Agent`,
          isActive: type === "strategy", // Only strategy active by default
        },
      });
    }

    return NextResponse.json(startup);
  } catch (error) {
    console.error("Startup creation error:", error);
    return NextResponse.json({ error: "Failed to create startup" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startups = await db.startup.findMany({
      where: { userId: session.user.id },
      include: { agentConfigs: true },
    });

    return NextResponse.json(startups);
  } catch (error) {
    console.error("Get startups error:", error);
    return NextResponse.json({ error: "Failed to get startups" }, { status: 500 });
  }
}
