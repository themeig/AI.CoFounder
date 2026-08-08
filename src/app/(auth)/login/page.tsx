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
      window.location.href = "/dashboard/portfolio";
    } catch (err: any) {
      setError("Network error: " + (err?.message || "unknown"));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#F8F9FA' }}>
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12"
        style={{ background: 'linear-gradient(135deg, #1A73E8 0%, #34A853 100%)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center font-bold text-white text-lg">AI</div>
          <span className="text-white font-semibold text-lg">AI.CoFounder</span>
        </div>
        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Your team of AI agents<br />for startup growth
          </h1>
          <p className="text-white/80 text-lg leading-relaxed">
            Long-term memory, patterns from thousands of startups, and specialized AI advisors — all in one workspace.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Strategic Patterns', value: '50+' },
              { label: 'Specialized Agents', value: '6' },
              { label: 'Analyzed Sources', value: 'YC, Sequoia, a16z' },
              { label: 'Persistent Memory', value: 'Mnemosyne' },
            ].map(item => (
              <div key={item.label} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <p className="text-white font-bold text-sm">{item.value}</p>
                <p className="text-white/70 text-xs">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-white/50 text-sm">AI.CoFounder © 2026 · Demo Version</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm"
              style={{ background: 'linear-gradient(135deg, #1A73E8, #34A853)' }}>AI</div>
            <span className="font-semibold text-base" style={{ color: '#202124' }}>AI.CoFounder</span>
          </div>

          <h2 className="text-2xl font-bold mb-1" style={{ color: '#202124' }}>Access Workspace</h2>
          <p className="text-sm mb-8" style={{ color: '#5F6368' }}>Demo mode — no registration required</p>

          {/* Demo info */}
          <div className="p-4 rounded-xl mb-6" style={{ background: '#E8F0FE', border: '1px solid #C5D9F9' }}>
            <div className="flex items-start gap-2.5">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#1A73E8' }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
              </svg>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#1A73E8' }}>Demo Mode</p>
                <p className="text-xs mt-0.5" style={{ color: '#5F6368' }}>
                  Click the button below to explore the platform with a preconfigured demo account.
                </p>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3.5 rounded-xl mb-4 flex items-center gap-2" style={{ background: '#FCE8E6', border: '1px solid #F7CECE' }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0" style={{ color: '#EA4335' }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <p className="text-sm" style={{ color: '#C5221F' }}>{error}</p>
            </div>
          )}

          <button
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: '#1A73E8', boxShadow: '0 1px 3px rgba(26,115,232,0.4)' }}
            onMouseEnter={e => !loading && (e.currentTarget.style.background = '#1557B0')}
            onMouseLeave={e => !loading && (e.currentTarget.style.background = '#1A73E8')}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Setting up demo...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                </svg>
                Launch Demo Workspace
              </>
            )}
          </button>

          <p className="text-center text-xs mt-6" style={{ color: '#9AA0AC' }}>
            No registration required · Sample data included
          </p>
        </div>
      </div>
    </div>
  );
}
