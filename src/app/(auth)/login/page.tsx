"use client";

import { useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDemoLogin = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/demo/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error + (data.details ? ": " + data.details : ""));
        setLoading(false);
        return;
      }

      window.location.href = "/dashboard";
    } catch (err) {
      setError("Network error: " + (err?.message || "sconosciuto"));
      setLoading(false);
    }
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

        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 mb-6">
            <p className="text-sm text-red-400 text-center">{error}</p>
          </div>
        )}

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
