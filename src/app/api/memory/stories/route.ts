import { NextRequest, NextResponse } from "next/server";
import { generateEmbedding } from "@/lib/embeddings";

export const dynamic = "force-dynamic";

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
    const status = searchParams.get("status") || "all";

    const headers: Record<string, string> = {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": "Bearer " + SUPABASE_SERVICE_KEY,
    };

    // --- Case 1: Semantic Search via match_stories RPC ---
    if (searchQuery.trim().length > 0) {
      try {
        console.log(`[Stories API] Executing semantic search for: "${searchQuery}"`);
        const queryEmbedding = await generateEmbedding(searchQuery);

        const res = await fetch(
          SUPABASE_URL + "/rest/v1/rpc/match_stories",
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
              filter_status: status
            })
          }
        );

        if (res.ok) {
          const matchedStories = await res.json();
          console.log(`[Stories API] Returned ${matchedStories.length} semantically matched stories.`);
          return NextResponse.json(matchedStories);
        }
        const errText = await res.text();
        console.warn("[Stories API] Semantic matching RPC failed:", res.status, errText, "; falling back to full list.");
      } catch (err: any) {
        console.warn("[Stories API] Semantic search failed:", err.message, "; falling back.");
      }
    }

    // --- Case 2: Standard Fetch ---
    let filterString = "isActive=eq.true";
    if (sector !== "all") filterString += `&sector=eq.${sector}`;
    if (status !== "all") filterString += `&status=eq.${status}`;

    const rangeHeaders = {
      ...headers,
      "Range": "0-499",
      "Range-Unit": "items",
      "Prefer": "count=none",
    };

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/CaseStudy?select=*&${filterString}&order=createdAt.desc`,
      {
        headers: rangeHeaders,
        cache: "no-store"
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Stories API] Supabase fetch error:", res.status, errText);
      return NextResponse.json([]);
    }

    const data = await res.json();
    const stories = Array.isArray(data) ? data : [];
    console.log(`[Stories API] Returned ${stories.length} stories from Supabase`);
    return NextResponse.json(stories);
  } catch (err) {
    console.error("Stories API error:", err);
    return NextResponse.json([]);
  }
}
