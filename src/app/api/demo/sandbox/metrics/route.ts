import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider") || "stripe";

    // Add a small randomized variation (within +/- 3%) to make it look like a live sync
    const variation = 1 + (Math.random() * 0.06 - 0.03);

    if (provider === "stripe") {
      return NextResponse.json({
        provider: "Stripe",
        status: "active",
        mrr: Math.round(14500 * variation),
        users: Math.round(180 * variation),
        currency: "USD",
        syncTime: new Date().toISOString(),
      });
    } else if (provider === "mixpanel") {
      return NextResponse.json({
        provider: "Mixpanel",
        status: "active",
        activeUsers: Math.round(1520 * variation),
        dailySessions: Math.round(420 * variation),
        retentionRate: "74.8%",
        syncTime: new Date().toISOString(),
      });
    } else if (provider === "plaid") {
      const balance = Math.round(45000 * variation);
      const burn = Math.round(3000 * (1 + (Math.random() * 0.04 - 0.02)));
      return NextResponse.json({
        provider: "Plaid",
        status: "active",
        cashBalance: balance,
        burnRate: burn,
        runway: Math.round(balance / burn),
        syncTime: new Date().toISOString(),
      });
    }

    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
