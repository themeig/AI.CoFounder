"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/dashboard/agents", label: "Agents", icon: "🤖" },
  { href: "/dashboard/startup", label: "Startup", icon: "🚀" },
  { href: "/dashboard/memory", label: "Memory", icon: "🧠" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [demoUser, setDemoUser] = useState<any>(null);

  useEffect(() => {
    const cookies = document.cookie.split("; ");
    const demoUserId = cookies.find(c => c.startsWith("demo_user_id="));
    const demoMode = cookies.find(c => c.startsWith("demo_mode="));
    
    if (demoUserId || demoMode) {
      setDemoUser({ name: "Demo Founder", email: "demo@agentfoundry.ai" });
      setLoading(false);
    } else {
      router.push("/login");
    }
  }, [router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="text-lg">Loading...</div></div>;
  }

  if (!demoUser) return null;

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 border-r border-border bg-card p-4 flex flex-col">
        <div className="text-xl font-bold text-gradient mb-8 px-2">AI.CoFounder</div>
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                pathname === item.href ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">D</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{demoUser.name}</p>
              <p className="text-xs text-muted-foreground truncate">{demoUser.email}</p>
            </div>
          </div>
          <button
            onClick={() => {
              document.cookie = "demo_user_id=; max-age=0; path=/";
              document.cookie = "demo_mode=; max-age=0; path=/";
              window.location.href = "/login";
            }}
            className="w-full mt-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
