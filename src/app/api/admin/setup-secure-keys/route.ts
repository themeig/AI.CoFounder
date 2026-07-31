import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * POST /api/admin/setup-secure-keys
 * Creates the SecureKey table in Supabase if it doesn't exist.
 * This endpoint is only for one-time setup — protected by a setup token.
 */
export async function POST(req: Request) {
  // Minimal protection: require a setup token
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const expectedToken = process.env.SETUP_TOKEN || "agentfoundry-setup-2026";

  if (token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // Run the DDL via Supabase Management API / SQL endpoint
  const sql = `
    CREATE TABLE IF NOT EXISTS "SecureKey" (
      "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
      "name"          TEXT NOT NULL,
      "iv"            TEXT NOT NULL,
      "encryptedData" TEXT NOT NULL,
      "authTag"       TEXT NOT NULL,
      "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "SecureKey_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "SecureKey_name_key" UNIQUE ("name")
    );
    ALTER TABLE "SecureKey" ENABLE ROW LEVEL SECURITY;
    DO $do$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'SecureKey'
        AND policyname = 'No public access to SecureKey'
      ) THEN
        CREATE POLICY "No public access to SecureKey"
          ON "SecureKey" FOR ALL TO public USING (false);
      END IF;
    END $do$;
  `;

  // Use Supabase's postgres REST endpoint (requires service role)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/query`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  // If rpc/query doesn't exist (not all Supabase plans), try the pg endpoint
  if (!res.ok) {
    // Verify the table exists by trying to query it
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/SecureKey?limit=1`,
      {
        headers: {
          "apikey": SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    if (checkRes.ok) {
      return NextResponse.json({
        success: true,
        message: "SecureKey table already exists and is accessible.",
        tableExists: true,
      });
    }

    return NextResponse.json({
      success: false,
      error: "Table does not exist. Please run the SQL from secure-key-table.sql in the Supabase SQL Editor.",
      sql: sql.trim(),
    }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: "SecureKey table created successfully in Supabase!",
  });
}

/**
 * GET /api/admin/setup-secure-keys
 * Checks if the SecureKey table exists and if keys are configured.
 */
export async function GET(_req: Request) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ supabaseConfigured: false, tableExists: false });
  }

  // Check table accessibility
  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/SecureKey?limit=1`,
    {
      headers: {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );

  const tableExists = checkRes.ok;
  let keyCount = 0;
  let keys: string[] = [];

  if (tableExists) {
    const rows = await checkRes.json().catch(() => []);
    // Get all key names (not values!)
    const allRes = await fetch(
      `${SUPABASE_URL}/rest/v1/SecureKey?select=name`,
      {
        headers: {
          "apikey": SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    if (allRes.ok) {
      const allRows = await allRes.json().catch(() => []);
      keys = Array.isArray(allRows) ? allRows.map((r: any) => r.name) : [];
      keyCount = keys.length;
    }
  }

  return NextResponse.json({
    supabaseConfigured: true,
    tableExists,
    keyCount,
    keys, // just the names, never the values
  });
}
