"use client";

import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      <div className="space-y-6">
        <div className="p-6 rounded-xl bg-card border border-border">
          <h2 className="text-lg font-semibold mb-4">Account</h2>
          <div className="space-y-3">
            <div><label className="text-sm text-muted-foreground">Name</label><p className="font-medium">{session?.user?.name || "—"}</p></div>
            <div><label className="text-sm text-muted-foreground">Email</label><p className="font-medium">{session?.user?.email || "—"}</p></div>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-card border border-border">
          <h2 className="text-lg font-semibold mb-4">Danger Zone</h2>
          <button onClick={() => signOut({ callbackUrl: "/" })} className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 font-medium hover:bg-red-500/20 transition">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
