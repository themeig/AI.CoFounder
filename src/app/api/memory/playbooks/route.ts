import { NextResponse } from "next/server";
import { supabaseFetch } from "@/lib/supabase-demo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const playbooks = await supabaseFetch("/Playbook?select=*&order=successRate.desc", {
      headers: {
        "Range": "0-499",
        "Range-Unit": "items",
        "Prefer": "count=none",
      }
    });
    const result = Array.isArray(playbooks) ? playbooks : [];
    console.log(`[Playbooks API] Returned ${result.length} playbooks from Supabase`);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Playbooks error:", err?.message || err);
    return NextResponse.json([]);
  }
}
