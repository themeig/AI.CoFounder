"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/* ─── Animated Counter ──────────────────────────────────────────────── */
function AnimatedCounter({ end, suffix = "", prefix = "", duration = 2000 }: { end: number; suffix?: string; prefix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * end));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

/* ─── Floating Particle Field ───────────────────────────────────────── */
function ParticleField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {Array.from({ length: 40 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${2 + Math.random() * 3}px`,
            height: `${2 + Math.random() * 3}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: `rgba(${100 + Math.floor(Math.random() * 80)}, ${140 + Math.floor(Math.random() * 80)}, ${220 + Math.floor(Math.random() * 35)}, ${0.15 + Math.random() * 0.25})`,
            animation: `floatParticle ${8 + Math.random() * 12}s ease-in-out ${Math.random() * 5}s infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Scroll Fade-In Hook ───────────────────────────────────────────── */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function RevealSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(40px)",
        transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   MAIN LANDING PAGE
   ════════════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* ── Agent cards data ──────────────────────────────────────────────── */
  const agents = [
    { name: "Strategy", emoji: "🎯", desc: "Market analysis, competitor intelligence, positioning, and Go-to-Market. Data-driven strategies based on patterns from thousands of startups.", gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
    { name: "Tech", emoji: "⚙️", desc: "Software architecture, code review, cloud infrastructure, CI/CD. Your always-available AI CTO.", gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)" },
    { name: "Finance", emoji: "💰", desc: "Cash flow modeling, unit economics, valuation, and investor pitch decks. End-to-end fundraising preparation.", gradient: "linear-gradient(135deg, #F2994A 0%, #F2C94C 100%)" },
    { name: "Marketing", emoji: "📣", desc: "Growth hacking, content strategy, acquisition campaigns, SEO/SEM, and brand positioning.", gradient: "linear-gradient(135deg, #eb3349 0%, #f45c43 100%)" },
    { name: "Legal", emoji: "⚖️", desc: "Contracts, NDAs, term sheets, GDPR compliance, corporate structure, and intellectual property.", gradient: "linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)" },
    { name: "Operations", emoji: "📋", desc: "Project management, workflow automation, OKR tracking, team management, and operational scaling.", gradient: "linear-gradient(135deg, #0575E6 0%, #021B79 100%)" },
  ];

  /* ── Feature highlights ────────────────────────────────────────────── */
  const features = [
    { icon: "🧠", title: "Persistent Memory", desc: "Mnemosyne™ — the long-term memory engine that remembers every decision, conversation, and insight. Never repeat context again.", tag: "MNEMOSYNE" },
    { icon: "🫀", title: "Heartbeat Monitor", desc: "Continuous startup health tracking with proactive alerts, growth ideas, and automatic warnings every 6 hours.", tag: "MONITORING" },
    { icon: "🕸️", title: "Stakeholder Map", desc: "Interactive 2D graph to map investors, advisors, team members, clients, and partners. Every relationship tracked and analyzed.", tag: "NETWORK" },
    { icon: "🎙️", title: "AI Daily Standup", desc: "Automated daily meeting where every AI agent presents their daily briefing. Action items generated by your coFounder.", tag: "TEAM" },
    { icon: "📊", title: "Metrics & Stripe Sync", desc: "Real-time KPI dashboard with direct Stripe synchronization. MRR, churn, LTV, and automated projections.", tag: "ANALYTICS" },
    { icon: "📅", title: "Google Calendar", desc: "Native Google Calendar integration. Agents can schedule events, meetings, and reminders directly on your agenda.", tag: "INTEGRATION" },
  ];

  return (
    <main className="landing-page" style={{ background: "#000000", color: "#f5f5f7", overflowX: "hidden" }}>
      {/* ═══ Global Styles ═══ */}
      <style jsx global>{`
        .landing-page {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        @keyframes floatParticle {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(${30}px, ${-40}px) scale(1.5); }
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(100, 130, 255, 0.3); }
          50% { box-shadow: 0 0 40px rgba(100, 130, 255, 0.6); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes typewriter {
          from { width: 0; }
          to { width: 100%; }
        }
        @keyframes blink {
          50% { opacity: 0; }
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .glass-card:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
          transform: translateY(-4px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .gradient-text {
          background: linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6);
          background-size: 200% 200%;
          animation: gradientShift 6s ease infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .gradient-text-gold {
          background: linear-gradient(135deg, #F2C94C, #F2994A, #EB5757);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .cta-button {
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          transition: all 0.3s ease;
        }
        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 40px rgba(99, 102, 241, 0.4);
        }
        .cta-button::after {
          content: '';
          position: absolute;
          top: 0; left: -100%; width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          animation: shimmer 3s ease-in-out infinite;
        }
        .nav-blur {
          transition: all 0.3s ease;
        }
        .feature-tag {
          font-size: 9px;
          letter-spacing: 0.12em;
          padding: 3px 8px;
          border-radius: 4px;
          background: rgba(99, 102, 241, 0.15);
          color: #818cf8;
          font-weight: 700;
        }
      `}</style>

      {/* ═══ Navigation ═══════════════════════════════════════════════ */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 nav-blur"
        style={{
          background: scrolled ? "rgba(0, 0, 0, 0.80)" : "transparent",
          backdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
          borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "none",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
              style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", boxShadow: "0 2px 10px rgba(99,102,241,0.3)" }}
            >
              AI
            </div>
            <span className="font-semibold text-sm text-white/90">AI.CoFounder</span>
          </div>
          <div className="flex items-center gap-8">
            <Link href="#intelligence" className="text-sm text-white/50 hover:text-white/90 transition-colors hidden sm:block">Intelligence</Link>
            <Link href="#agents" className="text-sm text-white/50 hover:text-white/90 transition-colors hidden sm:block">Agents</Link>
            <Link href="#features" className="text-sm text-white/50 hover:text-white/90 transition-colors hidden sm:block">Features</Link>
            <Link
              href="/login"
              className="cta-button px-5 py-2 rounded-full text-sm font-semibold text-white"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-14" style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.15), transparent)" }}>
        <ParticleField />

        {/* Ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)" }} />

        <div className="relative z-10 text-center max-w-5xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8" style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#818cf8" }} />
            <span className="text-xs font-medium" style={{ color: "#a5b4fc" }}>Powered by the experience of thousands of startups</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] mb-6">
            <span style={{ color: "#f5f5f7" }}>Your </span>
            <span className="gradient-text">AI CoFounder</span>
            <br />
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.65em" }}>that already knows how to scale.</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-4 leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
            A team of 6 specialized AI agents, with knowledge distilled from
            <span className="font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}> thousands of startups, patterns from Y Combinator, Sequoia, and First Round Capital</span>.
          </p>
          <p className="text-base max-w-xl mx-auto mb-10" style={{ color: "rgba(255,255,255,0.35)" }}>
            Strategy, tech, finance, marketing, legal, and operations — 24/7, with persistent memory.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/login"
              className="cta-button px-10 py-4 rounded-full text-base font-semibold text-white"
            >
              Try for free — Access Workspace
            </Link>
            <Link
              href="#intelligence"
              className="px-8 py-4 rounded-full text-base font-medium transition-all"
              style={{ color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; e.currentTarget.style.color = "rgba(255,255,255,0.9)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
            >
              Explore Intelligence →
            </Link>
          </div>

          {/* Stats Row */}
          <div className="flex flex-wrap justify-center gap-12 mt-20">
            {[
              { value: 12000, suffix: "+", label: "Analyzed Patterns" },
              { value: 6, suffix: "", label: "Specialized Agents" },
              { value: 24, suffix: "/7", label: "Availability" },
              { value: 150, suffix: "+", label: "VC & Accelerator Sources" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold" style={{ color: "#f5f5f7" }}>
                  <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-xs mt-1 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
          <div className="w-5 h-8 rounded-full border border-white/20 flex items-start justify-center p-1">
            <div className="w-1.5 h-1.5 rounded-full bg-white/40" style={{ animation: "pulseGlow 2s ease infinite" }} />
          </div>
        </div>
      </section>

      {/* ═══ INTELLIGENCE SECTION ═════════════════════════════════════ */}
      <section id="intelligence" className="py-32 px-6 relative" style={{ background: "#000000" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(168, 85, 247, 0.06), transparent)" }} />

        <div className="max-w-6xl mx-auto relative z-10">
          <RevealSection className="text-center mb-20">
            <span className="feature-tag mb-4 inline-block">DEEP INTELLIGENCE</span>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-5">
              <span style={{ color: "#f5f5f7" }}>It&apos;s not a chatbot.</span><br />
              <span className="gradient-text-gold">It&apos;s real knowledge.</span>
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,0.45)" }}>
              Your AI coFounder has studied and assimilated success and failure patterns from <strong style={{ color: "rgba(255,255,255,0.7)" }}>thousands of startups</strong>, world-class investors, and top accelerators.
            </p>
          </RevealSection>

          {/* Knowledge Sources Grid */}
          <div className="grid md:grid-cols-3 gap-5 mb-16">
            {[
              { logo: "YC", name: "Y Combinator", desc: "Patterns from 4,000+ funded startups. Do Things That Don't Scale, Default Alive vs Default Dead, Product-Market Fit signals.", color: "#FF6600" },
              { logo: "S", name: "Sequoia Capital", desc: "Growth frameworks, business plan blueprints, and valuation metrics from 50+ years of tech venture investments.", color: "#c62828" },
              { logo: "FR", name: "First Round Capital", desc: "Operational insights on seed-stage, hiring, culture, go-to-market, and fundraising from hundreds of portfolio companies.", color: "#1565c0" },
            ].map((source, i) => (
              <RevealSection key={source.name} delay={i * 150}>
                <div className="glass-card p-7 h-full">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-sm mb-5" style={{ background: source.color }}>
                    {source.logo}
                  </div>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: "#f5f5f7" }}>{source.name}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{source.desc}</p>
                </div>
              </RevealSection>
            ))}
          </div>

          {/* Deep Knowledge Pillars */}
          <div className="grid md:grid-cols-2 gap-5">
            {[
              { icon: "📈", title: "Growth Patterns", items: ["Product-Market Fit detection", "Channel strategy optimization", "Pricing model validation", "Scaling timing signals"] },
              { icon: "🚨", title: "Anti-Patterns & Failure Modes", items: ["Premature scaling alerts", "Burn rate danger zones", "Co-founder conflict patterns", "Market timing misalignment"] },
              { icon: "💵", title: "Fundraising Intelligence", items: ["Stage-by-stage valuation benchmarks", "Sector-specific investor matching", "Optimal pitch deck structure", "Term sheet analysis"] },
              { icon: "🏗️", title: "Architecture & Stack", items: ["Tech stack by growth phase", "Build vs Buy decisions", "Infrastructure cost modeling", "Security & compliance roadmap"] },
            ].map((pillar, i) => (
              <RevealSection key={pillar.title} delay={i * 100}>
                <div className="glass-card p-7">
                  <div className="text-2xl mb-3">{pillar.icon}</div>
                  <h3 className="text-base font-semibold mb-4" style={{ color: "#f5f5f7" }}>{pillar.title}</h3>
                  <ul className="space-y-2.5">
                    {pillar.items.map((item) => (
                      <li key={item} className="flex items-center gap-2.5 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                        <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "#818cf8" }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ AGENTS SECTION ═══════════════════════════════════════════ */}
      <section id="agents" className="py-32 px-6 relative" style={{ background: "#08080a" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 50% at 50% 100%, rgba(59, 130, 246, 0.06), transparent)" }} />

        <div className="max-w-6xl mx-auto relative z-10">
          <RevealSection className="text-center mb-16">
            <span className="feature-tag mb-4 inline-block">AI TEAM</span>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-5">
              <span style={{ color: "#f5f5f7" }}>Six experts.</span><br />
              <span className="gradient-text">One unified workspace.</span>
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,0.45)" }}>
              Each agent has vertical expertise, dedicated memory, and access to specialized tools.
              Your coFounder orchestrates them seamlessly.
            </p>
          </RevealSection>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {agents.map((agent, i) => (
              <RevealSection key={agent.name} delay={i * 100}>
                <div className="glass-card p-7 h-full group cursor-default">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-lg transition-transform group-hover:scale-110"
                      style={{ background: agent.gradient, boxShadow: `0 4px 15px ${agent.gradient.includes('#667eea') ? 'rgba(102,126,234,0.3)' : 'rgba(0,0,0,0.2)'}` }}
                    >
                      {agent.emoji}
                    </div>
                    <div>
                      <h3 className="font-semibold text-[15px]" style={{ color: "#f5f5f7" }}>{agent.name} Agent</h3>
                      <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "rgba(255,255,255,0.25)" }}>AI SPECIALIST</span>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{agent.desc}</p>

                  {/* Activity indicator */}
                  <div className="mt-5 pt-4 flex items-center gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#34d399" }} />
                    <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>Online — ready to work</span>
                  </div>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ COFOUNDER SHOWCASE ═══════════════════════════════════════ */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 50% at 30% 50%, rgba(99,102,241,0.08), transparent)" }} />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Text */}
            <RevealSection>
              <span className="feature-tag mb-4 inline-block">VIRTUAL CO-FOUNDER</span>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
                <span style={{ color: "#f5f5f7" }}>Like talking to an </span>
                <span className="gradient-text">experienced co-founder</span>
                <span style={{ color: "#f5f5f7" }}>.</span>
              </h2>
              <p className="text-base leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.45)" }}>
                Your coFounder doesn&apos;t just answer questions — <strong style={{ color: "rgba(255,255,255,0.7)" }}>it thinks proactively</strong>.
                It analyzes your startup every 6 hours, generates warnings and growth ideas, orchestrates the AI team, and makes informed decisions based on real data.
              </p>

              <div className="space-y-4">
                {[
                  { label: "Automatic orchestration", desc: "Delegates tasks to 6 specialized agents" },
                  { label: "Shared memory", desc: "Remembers every conversation and decision made" },
                  { label: "Advanced tools", desc: "Web search, agent creation, data analysis, Google Calendar" },
                  { label: "Proactive heartbeat", desc: "Monitors your startup and proposes concrete action steps" },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(99,102,241,0.2)" }}>
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <div>
                      <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>{item.label}</span>
                      <span className="text-sm ml-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>— {item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </RevealSection>

            {/* Right: Chat mockup */}
            <RevealSection delay={200}>
              <div className="glass-card p-1 overflow-hidden" style={{ animation: "pulseGlow 4s ease-in-out infinite" }}>
                <div className="rounded-[16px] p-5" style={{ background: "rgba(0,0,0,0.6)" }}>
                  {/* Chat header */}
                  <div className="flex items-center gap-3 mb-5 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs" style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}>AI</div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: "#f5f5f7" }}>coFounder</div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#34d399" }} />
                        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>Analyzing your startup...</span>
                      </div>
                    </div>
                  </div>

                  {/* Chat messages */}
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] flex-shrink-0 mt-1" style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}>AI</div>
                      <div className="rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%]" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)" }}>
                        I&apos;ve analyzed your KPIs. Your MRR grew by <span style={{ color: "#34d399", fontWeight: 600 }}>23% MoM</span> — this aligns with the <span style={{ color: "#818cf8" }}>&quot;hockey stick early traction&quot;</span> pattern seen in 12% of successful YC startups.
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] flex-shrink-0 mt-1" style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8" }}>AI</div>
                      <div className="rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%]" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)" }}>
                        ⚠️ <strong style={{ color: "#fbbf24" }}>Warning:</strong> Your current burn rate gives you 8 months of runway. I recommend preparing your fundraising <em>now</em>. I have already delegated building the financial model to the <strong style={{ color: "#818cf8" }}>Finance Agent</strong>.
                      </div>
                    </div>

                    {/* Tool call indicator */}
                    <div className="ml-10 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)" }}>
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="32" /></svg>
                      <span className="text-[11px]" style={{ color: "#a5b4fc" }}>🔧 Delegating to Finance Agent — building financial model...</span>
                    </div>
                  </div>
                </div>
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ═══ FEATURES GRID ════════════════════════════════════════════ */}
      <section id="features" className="py-32 px-6 relative" style={{ background: "#08080a" }}>
        <div className="max-w-6xl mx-auto relative z-10">
          <RevealSection className="text-center mb-16">
            <span className="feature-tag mb-4 inline-block">COMPLETE PLATFORM</span>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-5">
              <span style={{ color: "#f5f5f7" }}>Everything you need.</span><br />
              <span className="gradient-text">Nothing superfluous.</span>
            </h2>
          </RevealSection>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <RevealSection key={feature.title} delay={i * 80}>
                <div className="glass-card p-7 h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">{feature.icon}</span>
                    <span className="feature-tag">{feature.tag}</span>
                  </div>
                  <h3 className="text-base font-semibold mb-2" style={{ color: "#f5f5f7" }}>{feature.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{feature.desc}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF / TRUST ═════════════════════════════════════ */}
      <section className="py-24 px-6 relative" style={{ background: "#000" }}>
        <div className="max-w-4xl mx-auto relative z-10">
          <RevealSection className="text-center">
            <div className="glass-card p-10 md:p-14">
              <div className="text-5xl mb-6">💬</div>
              <blockquote className="text-xl sm:text-2xl font-medium leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.8)" }}>
                &ldquo;It&apos;s like having a Y Combinator advisory team available at 3 AM. AI.CoFounder saved me 3 months of costly mistakes.&rdquo;
              </blockquote>
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: "linear-gradient(135deg, #667eea, #764ba2)" }}>M</div>
                <div className="text-left">
                  <div className="text-sm font-semibold" style={{ color: "#f5f5f7" }}>Marco R.</div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Founder & CEO — B2B SaaS</div>
                </div>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ═══ FINAL CTA ════════════════════════════════════════════════ */}
      <section className="py-32 px-6 relative" style={{ background: "radial-gradient(ellipse 70% 50% at 50% 80%, rgba(99,102,241,0.12), #000)" }}>
        <ParticleField />

        <div className="max-w-3xl mx-auto text-center relative z-10">
          <RevealSection>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6">
              <span style={{ color: "#f5f5f7" }}>Ready to build</span><br />
              <span className="gradient-text">the future?</span>
            </h2>
            <p className="text-lg mb-10" style={{ color: "rgba(255,255,255,0.45)" }}>
              Join founders using AI.CoFounder to build, grow, and fundraise — powered by the collective intelligence of thousands of startups.
            </p>
            <Link
              href="/login"
              className="cta-button inline-flex items-center gap-3 px-10 py-4 rounded-full text-base font-semibold text-white"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
              </svg>
              Start for free — No credit card required
            </Link>
            <p className="mt-6 text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Instant demo mode · 6 AI agents included · Persistent memory</p>
          </RevealSection>
        </div>
      </section>

      {/* ═══ FOOTER ═══════════════════════════════════════════════════ */}
      <footer className="py-10 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-white font-bold text-[8px]" style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}>AI</div>
            <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>AI.CoFounder © 2025</span>
          </div>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
            Built for founders who want to move fast.
          </p>
        </div>
      </footer>
    </main>
  );
}
