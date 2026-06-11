import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";

export async function GET() {
  try {
    // Get demo user from cookie
    const cookieStore = cookies();
    const demoUserId = cookieStore.get("demo_user")?.value;

    if (!demoUserId) {
      return NextResponse.json({ error: "No demo user" }, { status: 401 });
    }

    const startups = await db.startup.findMany({
      where: { userId: demoUserId },
      include: { agentConfigs: true },
    });

    return NextResponse.json(startups);
  } catch (error) {
    console.error("Get demo startup error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
