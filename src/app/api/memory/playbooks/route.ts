import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const playbooks = await db.playbook.findMany({
      where: { isActive: true },
      orderBy: { successRate: "desc" },
    });
    return NextResponse.json(playbooks);
  } catch (error) {
    console.error("Get playbooks error:", error);
    return NextResponse.json({ error: "Failed to get playbooks" }, { status: 500 });
  }
}
