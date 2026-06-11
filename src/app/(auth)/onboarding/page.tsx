"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const SECTORS = ["saas", "fintech", "healthtech", "ecommerce", "ai", "climate", "consumer", "other"];
const PHASES = ["idea", "mvp", "launched", "growth", "funded"];

export default function OnboardingPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", website: "", sector: "", phase: "", country: "", teamSize: 1,
  });

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/startup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        await update();
        router.push("/dashboard");
      }
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12">
      <div className="w-full max-w-lg p-8 rounded-2xl bg-card border border-border">
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded ${s <= step ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>

        {step === 1 && (
          <>
            <h2 className="text-2xl font-bold mb-2">Tell us about your startup</h2>
            <p className="text-muted-foreground mb-6">Step 1 of 3: Basic info</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Startup Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary" placeholder="My Awesome Startup" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary h-24" placeholder="What does your startup do?" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Website</label>
                <input type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary" placeholder="https://..." />
              </div>
            </div>
            <button onClick={() => setStep(2)} disabled={!form.name} className="w-full mt-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition disabled:opacity-50">
              Continue
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-2xl font-bold mb-2">Sector & Phase</h2>
            <p className="text-muted-foreground mb-6">Step 2 of 3: Classification</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Sector *</label>
                <div className="grid grid-cols-2 gap-2">
                  {SECTORS.map((s) => (
                    <button key={s} onClick={() => setForm({ ...form, sector: s })} className={`py-2 px-3 rounded-lg border text-sm font-medium transition ${form.sector === s ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"}`}>
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Current Phase *</label>
                <div className="grid grid-cols-2 gap-2">
                  {PHASES.map((p) => (
                    <button key={p} onClick={() => setForm({ ...form, phase: p })} className={`py-2 px-3 rounded-lg border text-sm font-medium transition ${form.phase === p ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"}`}>
                      {p.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-lg border border-border font-medium hover:bg-secondary transition">Back</button>
              <button onClick={() => setStep(3)} disabled={!form.sector || !form.phase} className="flex-1 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition disabled:opacity-50">Continue</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-2xl font-bold mb-2">Team & Location</h2>
            <p className="text-muted-foreground mb-6">Step 3 of 3: Final details</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Country</label>
                <input type="text" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Italy" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Team Size</label>
                <input type="number" min={1} value={form.teamSize} onChange={(e) => setForm({ ...form, teamSize: parseInt(e.target.value) || 1 })} className="w-full px-4 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-lg border border-border font-medium hover:bg-secondary transition">Back</button>
              <button onClick={handleSubmit} disabled={loading} className="flex-1 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition disabled:opacity-50">
                {loading ? "Creating..." : "Complete Setup"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
