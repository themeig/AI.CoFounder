import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = cookies();
    const demoUserId = cookieStore.get("demo_user")?.value;
    if (!demoUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const startup = await db.startup.findFirst({
      where: { userId: demoUserId },
      include: { agentConfigs: true },
    });

    if (!startup) return NextResponse.json([]);

    return NextResponse.json(startup.agentConfigs);
  } catch (error) {
    console.error("Get demo agents error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
