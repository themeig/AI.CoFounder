"use client";

import { useEffect, useState } from "react";

export default function StartupPage() {
  const [startup, setStartup] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/demo/startup")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setStartup(data[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!startup) return <div className="p-8 text-center text-muted-foreground">No startup found.</div>;

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Startup Profile</h1>
      <div className="space-y-6">
        <div className="p-6 rounded-xl bg-card border border-border">
          <h2 className="text-lg font-semibold mb-4">Basic Info</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm text-muted-foreground">Name</label><p className="font-medium">{startup.name}</p></div>
            <div><label className="text-sm text-muted-foreground">Sector</label><p className="font-medium">{startup.sector?.toUpperCase()}</p></div>
            <div><label className="text-sm text-muted-foreground">Phase</label><p className="font-medium">{startup.phase?.toUpperCase()}</p></div>
            <div><label className="text-sm text-muted-foreground">Country</label><p className="font-medium">{startup.country || "—"}</p></div>
            <div><label className="text-sm text-muted-foreground">Team Size</label><p className="font-medium">{startup.teamSize}</p></div>
            <div><label className="text-sm text-muted-foreground">Website</label><p className="font-medium">{startup.website || "—"}</p></div>
          </div>
          {startup.description && <div className="mt-4"><label className="text-sm text-muted-foreground">Description</label><p className="mt-1">{startup.description}</p></div>}
        </div>
        <div className="p-6 rounded-xl bg-card border border-border">
          <h2 className="text-lg font-semibold mb-4">Metrics</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm text-muted-foreground">MRR</label><p className="text-2xl font-bold">${startup.mrr?.toLocaleString() || 0}</p></div>
            <div><label className="text-sm text-muted-foreground">Users</label><p className="text-2xl font-bold">{startup.users?.toLocaleString() || 0}</p></div>
            <div><label className="text-sm text-muted-foreground">Burn Rate</label><p className="text-2xl font-bold">${startup.burnRate?.toLocaleString() || 0}/mo</p></div>
            <div><label className="text-sm text-muted-foreground">Runway</label><p className="text-2xl font-bold">{startup.runway || 0} months</p></div>
          </div>
        </div>
        <div className="p-6 rounded-xl bg-card border border-border">
          <h2 className="text-lg font-semibold mb-4">Active Agents</h2>
          <div className="grid grid-cols-3 gap-3">
            {startup.agentConfigs?.map((agent: any) => (
              <div key={agent.id} className={`p-3 rounded-lg border ${agent.isActive ? "border-green-500/30 bg-green-500/5" : "border-border"}`}>
                <p className="font-medium text-sm">{agent.name}</p>
                <p className="text-xs text-muted-foreground">{agent.isActive ? "Active" : "Inactive"}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
