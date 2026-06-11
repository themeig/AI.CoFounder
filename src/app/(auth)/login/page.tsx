"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("demo@agentfoundry.ai");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDemoLogin = async () => {
    setLoading(true);
    // Create a demo user and startup via API
    const res = await fetch("/api/demo/setup", { method: "POST" });
    if (res.ok) {
      router.push("/dashboard");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 rounded-2xl bg-card border border-border">
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">🚀</div>
          <h1 className="text-2xl font-bold mb-2">AI.CoFounder</h1>
          <p className="text-muted-foreground">AI Agents for Startup Founders</p>
        </div>

        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 mb-6">
          <p className="text-sm text-center">
            👋 <strong>Demo Mode</strong><br />
            Click the button below to explore the platform with a demo account.
          </p>
        </div>

        <button
          onClick={handleDemoLogin}
          disabled={loading}
          className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? "Setting up demo..." : "🚀 Start Demo"}
        </button>

        <p className="text-center text-xs text-muted-foreground mt-4">
          No registration required. A demo account will be created automatically.
        </p>
      </div>
    </div>
  );
}
