import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import * as path from "path";

const PULSES_FILE_PATH = path.join(process.cwd(), "src/lib/heartbeat-pulses.json");

export async function GET() {
  try {
    const raw = await fs.readFile(PULSES_FILE_PATH, "utf-8");
    const data = JSON.parse(raw);
    const unreadCount = Array.isArray(data.pulses)
      ? data.pulses.filter((p: any) => !p.read).length
      : 0;
    return NextResponse.json({ unreadCount });
  } catch {
    return NextResponse.json({ unreadCount: 3 }); // Default initial unread pulses
  }
}
