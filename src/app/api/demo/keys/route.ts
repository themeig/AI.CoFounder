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
    const isTest = searchParams.get("test") === "true";

    if (!name) {
      return NextResponse.json({ error: "Missing key name parameter" }, { status: 400 });
    }

    const configured = await hasApiKey(name);

    if (isTest && name === "tavily") {
      const key = await getApiKey("tavily");
      if (!key) {
        return NextResponse.json({ configured: false, valid: false, error: "No Tavily API Key configured" }, { status: 400 });
      }
      try {
        const testRes = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: key,
            query: "test connection",
            search_depth: "basic",
            max_results: 1
          })
        });

        if (testRes.ok) {
          const resData = await testRes.json();
          return NextResponse.json({ configured: true, valid: true, resultsCount: resData.results?.length || 0, message: "Tavily API Key is valid and working!" });
        } else {
          const errBody = await testRes.text();
          return NextResponse.json({ configured: true, valid: false, error: `Tavily API Error ${testRes.status}: ${errBody}` }, { status: 400 });
        }
      } catch (err: any) {
        return NextResponse.json({ configured: true, valid: false, error: err.message }, { status: 500 });
      }
    }

    if (isTest && name === "stripe") {
      const key = await getApiKey("stripe");
      if (!key) {
        return NextResponse.json({ configured: false, valid: false, error: "No Stripe API Key configured" }, { status: 400 });
      }
      try {
        const testRes = await fetch("https://api.stripe.com/v1/balance", {
          method: "GET",
          headers: { "Authorization": `Bearer ${key}` }
        });

        if (testRes.ok) {
          const resData = await testRes.json();
          return NextResponse.json({
            configured: true,
            valid: true,
            message: "Stripe API Key is valid and connected successfully!",
            currency: resData.available?.[0]?.currency || "usd"
          });
        } else {
          const errBody = await testRes.text();
          return NextResponse.json({ configured: true, valid: false, error: `Stripe API Error ${testRes.status}: ${errBody}` }, { status: 400 });
        }
      } catch (err: any) {
        return NextResponse.json({ configured: true, valid: false, error: err.message }, { status: 500 });
      }
    }

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
