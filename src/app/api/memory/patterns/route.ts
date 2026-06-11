import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const patterns = await db.pattern.findMany({
      where: { isActive: true },
      orderBy: [{ confidence: "desc" }, { successRate: "desc" }],
    });
    return NextResponse.json(patterns);
  } catch (error) {
    console.error("Get patterns error:", error);
    return NextResponse.json({ error: "Failed to get patterns" }, { status: 500 });
  }
}
