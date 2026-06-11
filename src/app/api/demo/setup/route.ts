import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function POST() {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ error: "Supabase non configurato" }, { status: 500 });
    }

    const headers = {
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": "Bearer " + SUPABASE_SERVICE_KEY,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    };

    // 1. Check if demo user exists
    const userCheckRes = await fetch(
      SUPABASE_URL + "/rest/v1/User?email=eq.demo@agentfoundry.ai&select=id",
      { headers }
    );
    const existingUsers = await userCheckRes.json();

    let userId = null;

    if (existingUsers && existingUsers.length > 0) {
      userId = existingUsers[0].id;
    } else {
      // Create demo user (columns: id, name, email, emailVerified, image, createdAt, updatedAt)
      const createRes = await fetch(SUPABASE_URL + "/rest/v1/User", {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: "demo@agentfoundry.ai",
          name: "Demo Founder",
        }),
      });
      const newUsers = await createRes.json();
      if (Array.isArray(newUsers) && newUsers.length > 0) {
        userId = newUsers[0].id;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Impossibile creare utente demo" }, { status: 500 });
    }

    // 2. Check/create demo startup (columns: userId, name, sector, phase are NOT NULL)
    const startupCheckRes = await fetch(
      SUPABASE_URL + "/rest/v1/Startup?userId=eq." + userId + "&select=id",
      { headers }
    );
    const existingStartups = await startupCheckRes.json();

    if (!existingStartups || existingStartups.length === 0) {
      await fetch(SUPABASE_URL + "/rest/v1/Startup", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId: userId,
          name: "TechFlow",
          description: "AI-powered workflow automation for startups",
          sector: "SaaS",
          phase: "idea",
        }),
      });
    }

    // 3. Set session cookie
    const response = NextResponse.json({ ok: true, redirect: "/dashboard" });
    response.cookies.set("demo_user_id", userId, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    response.cookies.set("demo_mode", "true", {
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Demo setup error:", err);
    return NextResponse.json(
      { error: "Errore interno", details: String(err) },
      { status: 500 }
    );
  }
}
