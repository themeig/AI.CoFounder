"use client";

export default function SettingsPage() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      <div className="space-y-6">
        <div className="p-6 rounded-xl bg-card border border-border">
          <h2 className="text-lg font-semibold mb-4">Account</h2>
          <div className="space-y-3">
            <div><label className="text-sm text-muted-foreground">Name</label><p className="font-medium">Demo Founder</p></div>
            <div><label className="text-sm text-muted-foreground">Email</label><p className="font-medium">demo@agentfoundry.ai</p></div>
            <div><label className="text-sm text-muted-foreground">Mode</label><p className="font-medium">Demo</p></div>
          </div>
        </div>
        <div className="p-6 rounded-xl bg-card border border-border">
          <h2 className="text-lg font-semibold mb-4">About</h2>
          <p className="text-sm text-muted-foreground">AI.CoFounder v0.1.0 — Demo Mode. This is a preview of the AI agent platform for startup founders.</p>
        </div>
      </div>
    </div>
  );
}
