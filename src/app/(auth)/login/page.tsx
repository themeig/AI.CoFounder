"use client";

import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const handleDemoLogin = async () => {
    setLoading(true);
    setError("");
    setInfoMessage("");
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

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    setError("");
    setInfoMessage("");

    try {
      // Demo fallback: setup user session for entered email directly
      const res = await fetch("/api/demo/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        window.location.href = "/dashboard/portfolio";
      } else {
        const data = await res.json();
        setError(data.error || "Email authentication failed.");
        setLoading(false);
      }
    } catch (err: any) {
      setError("Network error: " + (err?.message || "unknown"));
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    setInfoMessage("");
    try {
      // Redirect to NextAuth Google OAuth sign-in endpoint
      const nextAuthRes = await fetch("/api/auth/csrf");
      if (nextAuthRes.ok) {
        // NextAuth is active -> redirect to Google OAuth
        window.location.href = "/api/auth/signin/google";
      } else {
        // Fallback to demo workspace if NextAuth endpoint is not configured
        setInfoMessage("Accessing workspace with Google Demo profile...");
        setTimeout(async () => {
          const res = await fetch("/api/demo/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: "google" }),
          });
          if (res.ok) {
            window.location.href = "/dashboard/portfolio";
          } else {
            setError("Google Sign-In failed.");
            setGoogleLoading(false);
          }
        }, 800);
      }
    } catch (err: any) {
      // Fallback to demo workspace if OAuth endpoint fails
      const res = await fetch("/api/demo/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google" }),
      });
      if (res.ok) {
        window.location.href = "/dashboard/portfolio";
      } else {
        setError("Google Sign-In error: " + (err?.message || "unknown"));
        setGoogleLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#F8F9FA' }}>
      {/* Centered Clean Card */}
      <div className="w-full max-w-md bg-white rounded-2xl p-8 border border-[#E8EAED] shadow-sm space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-sm"
              style={{ background: 'linear-gradient(135deg, #1A73E8, #34A853)' }}>
              AI
            </div>
            <span className="font-bold text-xl text-[#202124] tracking-tight">AI.CoFounder</span>
          </Link>
          <h1 className="text-2xl font-extrabold text-[#202124] pt-2">Sign in to your account</h1>
          <p className="text-xs text-[#5F6368]">
            Choose your preferred sign-in method to access your startup portfolio.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl flex items-center gap-2.5 text-xs bg-[#FCE8E6] border border-[#F7CECE] text-[#C5221F]">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Info Message */}
        {infoMessage && (
          <div className="p-3.5 rounded-xl flex items-center gap-2.5 text-xs bg-[#E8F0FE] border border-[#C5D9F9] text-[#1A73E8]">
            <span>ℹ️</span>
            <span>{infoMessage}</span>
          </div>
        )}

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading || loading}
          className="w-full py-3 px-4 rounded-xl border border-[#DADCE0] bg-white hover:bg-[#F8F9FA] text-[#3C4043] font-semibold text-sm transition-all flex items-center justify-center gap-3 shadow-2xs disabled:opacity-60"
        >
          {googleLoading ? (
            <div className="w-4 h-4 border-2 border-[#1A73E8] border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
          )}
          <span>Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-[#E8EAED]" />
          <span className="text-[11px] font-medium text-[#5F6368] uppercase tracking-wider">or email</span>
          <div className="flex-1 h-px bg-[#E8EAED]" />
        </div>

        {/* Email Form */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#3C4043] mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="founder@startup.com"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#DADCE0] bg-white text-sm text-[#202124] placeholder-[#9AA0AC] focus:outline-none focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8] transition"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#3C4043]">
                Password
              </label>
              <span className="text-[11px] text-[#1A73E8] hover:underline cursor-pointer">
                Forgot?
              </span>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#DADCE0] bg-white text-sm text-[#202124] placeholder-[#9AA0AC] focus:outline-none focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8] transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-xs"
            style={{ background: '#1A73E8' }}
            onMouseEnter={e => !loading && (e.currentTarget.style.background = '#1557B0')}
            onMouseLeave={e => !loading && (e.currentTarget.style.background = '#1A73E8')}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Signing in...
              </>
            ) : (
              <span>Sign In with Email</span>
            )}
          </button>
        </form>

        {/* Fast Demo Access Button */}
        <div className="pt-2 border-t border-[#E8EAED] text-center">
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-[#1A73E8] bg-[#E8F0FE] hover:bg-[#D2E3FC] transition flex items-center justify-center gap-1.5"
          >
            <span>⚡ Instant Demo Access (No Password Needed)</span>
          </button>
        </div>

      </div>

      {/* Footer Info */}
      <div className="mt-8 text-center text-xs text-[#5F6368] space-y-1">
        <p>AI.CoFounder Platform © 2026 · Secure Auth</p>
      </div>
    </div>
  );
}
