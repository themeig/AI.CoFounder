import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateEmbedding } from "@/lib/embeddings";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const headers = {
  "apikey": SUPABASE_SERVICE_KEY,
  "Authorization": "Bearer " + SUPABASE_SERVICE_KEY,
  "Content-Type": "application/json",
};

export async function POST() {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    console.log("[Vector Backfill] 1. Enabling pgvector extension...");
    await db.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS vector;");

    // --- 2. Backfill Patterns ---
    console.log("[Vector Backfill] 2. Fetching existing patterns...");
    const patternsRes = await fetch(`${SUPABASE_URL}/rest/v1/Pattern?select=*`, { headers });
    if (!patternsRes.ok) {
      throw new Error(`Failed to fetch patterns: ${patternsRes.statusText}`);
    }
    const patterns = await patternsRes.json();
    let patternsCount = 0;

    console.log(`[Vector Backfill] Found ${patterns.length} patterns. Generating embeddings...`);
    for (const pattern of patterns) {
      // Generate embedding if not already present
      if (!pattern.embedding) {
        try {
          const textToEmbed = `${pattern.title}. ${pattern.description}`;
          const embedding = await generateEmbedding(textToEmbed);
          
          const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/Pattern?id=eq.${pattern.id}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ embedding }),
          });
          
          if (updateRes.ok) {
            patternsCount++;
          } else {
            console.error(`Failed to update pattern ${pattern.id}:`, await updateRes.text());
          }
        } catch (err: any) {
          console.error(`Error embedding pattern ${pattern.id}:`, err.message);
        }
      }
    }

    // --- 3. Backfill Mnemosyne Memories ---
    console.log("[Vector Backfill] 3. Fetching agent configurations...");
    const configRes = await fetch(`${SUPABASE_URL}/rest/v1/AgentConfig?select=*`, { headers });
    if (!configRes.ok) {
      throw new Error(`Failed to fetch agent configs: ${configRes.statusText}`);
    }
    const configs = await configRes.json();
    let memoriesCount = 0;

    // Clean existing VectorMemory table to prevent duplicates
    console.log("[Vector Backfill] Cleaning existing VectorMemory table...");
    try {
      await db.$executeRawUnsafe('TRUNCATE TABLE "VectorMemory" CASCADE;');
    } catch (cleanErr: any) {
      console.warn("[Vector Backfill] Direct truncate failed, attempting via HTTP DELETE...", cleanErr.message);
      // Fallback HTTP delete
      await fetch(`${SUPABASE_URL}/rest/v1/VectorMemory?id=not.is.null`, {
        method: "DELETE",
        headers,
      });
    }

    console.log("[Vector Backfill] Rebuilding VectorMemory from agent settings JSONB...");
    for (const config of configs) {
      let settings = config.settings || {};
      if (typeof settings === "string") {
        try {
          settings = JSON.parse(settings);
        } catch {
          settings = {};
        }
      }

      const mnemosyne = settings.mnemosyne || [];
      if (Array.isArray(mnemosyne) && mnemosyne.length > 0) {
        console.log(`[Vector Backfill] Config ${config.id} (${config.type}) has ${mnemosyne.length} memories. Embedding...`);
        for (const entry of mnemosyne) {
          try {
            const embedding = await generateEmbedding(entry.content);
            const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/VectorMemory`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                id: entry.id,
                agentConfigId: config.id,
                content: entry.content,
                embedding: embedding,
                importance: entry.importance || 3,
                scope: entry.scope || "local",
                category: entry.category || "general",
                createdAt: entry.createdAt || new Date().toISOString(),
                updatedAt: entry.createdAt || new Date().toISOString(),
              }),
            });

            if (insertRes.ok) {
              memoriesCount++;
            } else {
              console.error(`Failed to insert vector memory ${entry.id}:`, await insertRes.text());
            }
          } catch (err: any) {
            console.error(`Error embedding memory ${entry.id}:`, err.message);
          }
        }
      }
    }

    console.log(`[Vector Backfill] Completed. Backfilled: ${patternsCount} patterns, ${memoriesCount} memories.`);
    return NextResponse.json({
      success: true,
      patternsBackfilled: patternsCount,
      memoriesBackfilled: memoriesCount,
    });
  } catch (error: any) {
    console.error("[Vector Backfill] Error during migration:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
