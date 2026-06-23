import { NextRequest, NextResponse } from "next/server";
import { generateEmbedding } from "@/lib/embeddings";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function GET(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json([]);
    }

    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("search") || "";
    const sector = searchParams.get("sector") || "all";
    const phase = searchParams.get("phase") || "all";
    const minRate = parseFloat(searchParams.get("minRate") || "0.0") / 100.0;

    const headers: Record<string, string> = {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": "Bearer " + SUPABASE_SERVICE_KEY,
    };

    // --- Case 1: Semantic Vector Search ---
    if (searchQuery.trim().length > 0) {
      try {
        console.log(`[Patterns API] Executing semantic search for: "${searchQuery}"`);
        const queryEmbedding = await generateEmbedding(searchQuery);

        const res = await fetch(
          SUPABASE_URL + "/rest/v1/rpc/match_patterns",
          {
            method: "POST",
            headers: {
              ...headers,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              query_embedding: queryEmbedding,
              match_threshold: 0.25,
              match_count: 50,
              filter_sector: sector,
              filter_phase: phase,
              min_rate: minRate
            })
          }
        );

        if (res.ok) {
          const matchedPatterns = await res.json();
          console.log(`[Patterns API] Returned ${matchedPatterns.length} semantically matched patterns.`);
          return NextResponse.json(matchedPatterns);
        }
        const errText = await res.text();
        console.warn("[Patterns API] Semantic matching RPC failed:", res.status, errText, "; falling back to full list.");
      } catch (err: any) {
        console.warn("[Patterns API] Semantic search failed:", err.message, "; falling back to full list.");
      }
    }

    // --- Case 2: Standard Fetch (All active patterns) ---
    let filterString = "isActive=eq.true";
    if (sector !== "all") filterString += `&sector=eq.${sector}`;
    if (phase !== "all") filterString += `&phase=eq.${phase}`;
    
    const rangeHeaders = {
      ...headers,
      "Range": "0-499",
      "Range-Unit": "items",
      "Prefer": "count=none",
    };

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/Pattern?select=*&${filterString}&order=createdAt.desc`,
      { headers: rangeHeaders }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Patterns API] Supabase fetch error:", res.status, errText);
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

