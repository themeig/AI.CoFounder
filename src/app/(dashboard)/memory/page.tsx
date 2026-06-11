"use client";

import { useEffect, useState } from "react";

interface Pattern {
  id: string; title: string; description: string; sector: string | null;
  phase: string | null; successRate: number; sampleSize: number; confidence: number;
  keyFactors: string[]; failureModes: string[]; avgTimeToOutcome: string | null;
}

interface Playbook {
  id: string; title: string; description: string; sector: string | null;
  phase: string | null; steps: any[]; successRate: number;
}

export default function MemoryPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [tab, setTab] = useState<"patterns" | "playbooks">("patterns");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/memory/patterns").then((res) => res.json()),
      fetch("/api/memory/playbooks").then((res) => res.json()),
    ])
      .then(([p, pb]) => {
        setPatterns(Array.isArray(p) ? p : []);
        setPlaybooks(Array.isArray(pb) ? pb : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-2">Knowledge Base</h1>
      <p className="text-muted-foreground mb-8">Patterns and playbooks learned from thousands of startups.</p>

      <div className="flex gap-4 mb-6">
        <button onClick={() => setTab("patterns")} className={`px-4 py-2 rounded-lg font-medium transition ${tab === "patterns" ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"}`}>
          Patterns ({patterns.length})
        </button>
        <button onClick={() => setTab("playbooks")} className={`px-4 py-2 rounded-lg font-medium transition ${tab === "playbooks" ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"}`}>
          Playbooks ({playbooks.length})
        </button>
      </div>

      {tab === "patterns" && (
        <div className="grid gap-4">
          {patterns.length === 0 && <p className="text-muted-foreground">No patterns found. Make sure the database is set up.</p>}
          {patterns.map((p) => (
            <div key={p.id} className="p-6 rounded-xl bg-card border border-border">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold">{p.title}</h3>
                  <div className="flex gap-2 mt-1">
                    {p.sector && <span className="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary">{p.sector.toUpperCase()}</span>}
                    {p.phase && <span className="px-2 py-0.5 rounded text-xs bg-cyan-500/10 text-cyan-400">{p.phase.toUpperCase()}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gradient">{(p.successRate * 100).toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground">success rate</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{p.description}</p>
              <div className="flex gap-4 text-xs">
                <span className="text-muted-foreground">Sample: <strong className="text-foreground">{p.sampleSize}</strong></span>
                <span className="text-muted-foreground">Confidence: <strong className="text-foreground">{(p.confidence * 100).toFixed(0)}%</strong></span>
                {p.avgTimeToOutcome && <span className="text-muted-foreground">Avg time: <strong className="text-foreground">{p.avgTimeToOutcome}</strong></span>}
              </div>
              {p.keyFactors && p.keyFactors.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {p.keyFactors.map((factor, i) => (
                    <span key={i} className="px-2 py-0.5 rounded text-xs bg-green-500/10 text-green-400">{factor}</span>
                  ))}
                </div>
              )}
              {p.failureModes && p.failureModes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.failureModes.map((mode, i) => (
                    <span key={i} className="px-2 py-0.5 rounded text-xs bg-red-500/10 text-red-400">{mode}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "playbooks" && (
        <div className="grid gap-4">
          {playbooks.length === 0 && <p className="text-muted-foreground">No playbooks found.</p>}
          {playbooks.map((pb) => (
            <div key={pb.id} className="p-6 rounded-xl bg-card border border-border">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold">{pb.title}</h3>
                  <div className="flex gap-2 mt-1">
                    {pb.sector && <span className="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary">{pb.sector.toUpperCase()}</span>}
                    {pb.phase && <span className="px-2 py-0.5 rounded text-xs bg-cyan-500/10 text-cyan-400">{pb.phase.toUpperCase()}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gradient">{(pb.successRate * 100).toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground">success rate</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{pb.description}</p>
              {pb.steps && pb.steps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Steps:</p>
                  {pb.steps.map((step: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">{step.step || i + 1}</span>
                      <span className="font-medium">{step.title}</span>
                      <span className="text-muted-foreground">— {step.duration}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
