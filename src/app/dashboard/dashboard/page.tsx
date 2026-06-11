"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Startup {
  id: string;
  name: string;
  sector: string;
  phase: string;
  mrr: number;
  users: number;
  burnRate: number;
  runway: number;
  agentConfigs: { id: string; type: string; name: string; isActive: boolean }[];
}

export default function DashboardPage() {
  const [startups, setStartups] = useState<Startup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/demo/startup")
      .then((res) => res.json())
      .then((data) => {
        setStartups(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  if (startups.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-2">Welcome!</h1>
        <p className="text-muted-foreground mb-8">No startup found. Something went wrong with demo setup.</p>
        <Link href="/login" className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition inline-block">
          Try Again
        </Link>
      </div>
    );
  }

  const startup = startups[0];
  const activeAgents = startup.agentConfigs.filter((a) => a.isActive);

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{startup.name}</h1>
          <p className="text-muted-foreground">{startup.sector.toUpperCase()} • {startup.phase.toUpperCase()}</p>
        </div>
        <Link href="/dashboard/agents" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition">
          Open Chat
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="p-4 rounded-xl bg-card border border-border">
          <p className="text-sm text-muted-foreground">MRR</p>
          <p className="text-2xl font-bold">${startup.mrr.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <p className="text-sm text-muted-foreground">Users</p>
          <p className="text-2xl font-bold">{startup.users.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <p className="text-sm text-muted-foreground">Active Agents</p>
          <p className="text-2xl font-bold">{activeAgents.length}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <p className="text-sm text-muted-foreground">Runway</p>
          <p className="text-2xl font-bold">{startup.runway} months</p>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
      <div className="grid grid-cols-3 gap-4">
        <Link href="/dashboard/agents" className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition">
          <div className="text-2xl mb-2">🤖</div>
          <h3 className="font-semibold mb-1">Talk to Agents</h3>
          <p className="text-sm text-muted-foreground">Get advice from your AI agents</p>
        </Link>
        <Link href="/dashboard/memory" className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition">
          <div className="text-2xl mb-2">🧠</div>
          <h3 className="font-semibold mb-1">Knowledge Base</h3>
          <p className="text-sm text-muted-foreground">Patterns from successful startups</p>
        </Link>
        <Link href="/dashboard/startup" className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition">
          <div className="text-2xl mb-2">🚀</div>
          <h3 className="font-semibold mb-1">Update Profile</h3>
          <p className="text-sm text-muted-foreground">Keep your startup info current</p>
        </Link>
      </div>
    </div>
  );
}
