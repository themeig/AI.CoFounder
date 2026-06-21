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
      // Tell PostgREST to return all rows up to 500, bypassing the default page cap
      "Range": "0-499",
      "Range-Unit": "items",
      "Prefer": "count=none",
    };

    const res = await fetch(
      SUPABASE_URL + "/rest/v1/Pattern?select=*&isActive=eq.true&order=createdAt.desc",
      { headers }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Patterns API] Supabase error:", res.status, errText);
      return NextResponse.json([]);
    }

    const data = await res.json();
    const patterns = Array.isArray(data) ? data : [];
    console.log(`[Patterns API] Returned ${patterns.length} patterns from Supabase`);
    return NextResponse.json(patterns);
  } catch (err) {
    console.error("Patterns error:", err);
    return NextResponse.json([]);
  }
}
