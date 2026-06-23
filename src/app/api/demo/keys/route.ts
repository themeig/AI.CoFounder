import { NextResponse } from "next/server";
import { getApiKey, setApiKey, hasApiKey, deleteApiKey } from "@/lib/secure-store";

/**
 * GET /api/demo/keys
 * Query parameter: ?name=tavily
 * Returns whether the key is configured (boolean)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json({ error: "Missing key name parameter" }, { status: 400 });
    }

    const configured = await hasApiKey(name);
    return NextResponse.json({ name, configured });
  } catch (err: any) {
    console.error("[Keys GET] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/demo/keys
 * Body: { name: string, key: string }
 * Encrypts and stores the key securely on the server
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, key } = body;

    if (!name || !key) {
      return NextResponse.json({ error: "Missing name or key in body" }, { status: 400 });
    }

    // Save key (encrypts internally)
    await setApiKey(name, key.trim());

    return NextResponse.json({ success: true, message: `Key for '${name}' saved securely.` });
  } catch (err: any) {
    console.error("[Keys POST] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/demo/keys
 * Query parameter: ?name=tavily
 * Deletes the key from the secure store
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json({ error: "Missing key name parameter" }, { status: 400 });
    }

    await deleteApiKey(name);
    return NextResponse.json({ success: true, message: `Key for '${name}' deleted successfully.` });
  } catch (err: any) {
    console.error("[Keys DELETE] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
