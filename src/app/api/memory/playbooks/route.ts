import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function GET() {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json([]);
    }

    const headers: Record<string, string> = {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": "Bearer " + SUPABASE_SERVICE_KEY,
      "Range": "0-499",
      "Range-Unit": "items",
      "Prefer": "count=none",
    };

    const res = await fetch(
      SUPABASE_URL + "/rest/v1/Playbook?select=*&order=successRate.desc",
      { headers }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Playbooks API] Supabase error:", res.status, errText);
      return NextResponse.json([]);
    }

    const data = await res.json();
    const playbooks = Array.isArray(data) ? data : [];
    console.log(`[Playbooks API] Returned ${playbooks.length} playbooks from Supabase`);
    return NextResponse.json(playbooks);
  } catch (err) {
    console.error("Playbooks error:", err);
    return NextResponse.json([]);
  }
}
