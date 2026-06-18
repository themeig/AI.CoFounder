"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    href: "/dashboard",
    label: "Home",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
      </svg>
    ),
  },
  {
    href: "/dashboard/agents",
    label: "Agenti AI",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3zm-2 10H6V7h12v12zm-9-6c-.83 0-1.5-.67-1.5-1.5S8.17 10 9 10s1.5.67 1.5 1.5S9.83 13 9 13zm7.5-1.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zM8 15h8v2H8v-2z"/>
      </svg>
    ),
  },
  {
    href: "/dashboard/startup",
    label: "Startup",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M13 2.05v2.02c3.95.49 7 3.85 7 7.93 0 3.21-1.81 6-4.72 7.28L13 17v5h5l-1.22-1.22C19.91 19.07 22 15.76 22 12c0-5.18-3.95-9.45-9-9.95zM11 2.05C5.95 2.55 2 6.82 2 12c0 3.76 2.09 7.07 5.22 8.78L6 22h5V2.05z"/>
      </svg>
    ),
  },
  {
    href: "/dashboard/memory",
    label: "Memoria",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M12 2c-4.42 0-8 3.58-8 8 0 2.93 1.58 5.5 3.93 6.93V21h8.14v-4.07C18.42 15.5 20 12.93 20 10c0-4.42-3.58-8-8-8zm2 14.5v2.5h-4v-2.5C7.36 15.16 6 12.71 6 10c0-3.31 2.69-6 6-6s6 2.69 6 6c0 2.71-1.36 5.16-4 6.5z"/>
      </svg>
    ),
  },
  {
    href: "/dashboard/settings",
    label: "Impostazioni",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38-1.03.7-1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
      </svg>
    ),
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [demoUser, setDemoUser] = useState<any>(null);

  // ── Sidebar collapse & resize ────────────────────────────────────
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(200); // Fixed expanded width of 200px
  const [logoHovered, setLogoHovered] = useState(false);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(200);
  const asideRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("agentfoundry_global_sidebar");
    if (stored) {
      try {
        const { collapsed, width } = JSON.parse(stored);
        if (typeof collapsed === "boolean") setSidebarCollapsed(collapsed);
        if (typeof width === "number") {
          // Clamp stored width to 200px
          const clamped = Math.max(200, Math.min(200, width));
          setSidebarWidth(clamped);
        }
      } catch {}
    } else {
      setSidebarWidth(200);
    }
  }, []);

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem(
      "agentfoundry_global_sidebar",
      JSON.stringify({ collapsed: next, width: sidebarWidth })
    );
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarCollapsed ? 52 : sidebarWidth;
    e.preventDefault();

    // Disable transitions during drag to avoid lag
    if (asideRef.current) {
      asideRef.current.style.transition = "none";
    }

    let wasCollapsed = sidebarCollapsed;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = ev.clientX - startXRef.current;
      const computedWidth = startWidthRef.current + delta;

      // Snap to collapsed if dragged below 130px, otherwise allow smooth resize up to 200px
      const isCollapsedNow = computedWidth < 130;
      const newWidth = isCollapsedNow ? 52 : Math.max(130, Math.min(200, computedWidth));

      if (asideRef.current) {
        asideRef.current.style.width = `${newWidth}px`;
      }

      if (isCollapsedNow !== wasCollapsed) {
        wasCollapsed = isCollapsedNow;
        setSidebarCollapsed(isCollapsedNow);
      }
    };

    const handleMouseUp = (ev: MouseEvent) => {
      isResizingRef.current = false;
      const delta = ev.clientX - startXRef.current;
      const computedWidth = startWidthRef.current + delta;
      
      const isCollapsedNow = computedWidth < 130;
      const finalWidth = isCollapsedNow ? 52 : 200; // Snap cleanly back to exactly 200px if expanded

      // Restore transition
      if (asideRef.current) {
        asideRef.current.style.transition = "";
      }

      setSidebarWidth(finalWidth);
      setSidebarCollapsed(isCollapsedNow);
      localStorage.setItem(
        "agentfoundry_global_sidebar",
        JSON.stringify({ collapsed: isCollapsedNow, width: finalWidth })
      );
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  useEffect(() => {
    const cookies = document.cookie.split("; ");
    const demoUserId = cookies.find((c) => c.startsWith("demo_user_id="));
    const demoMode = cookies.find((c) => c.startsWith("demo_mode="));

    if (demoUserId || demoMode) {
      setDemoUser({ name: "Demo Founder", email: "demo@agentfoundry.ai" });
      setLoading(false);
    } else {
      router.push("/login");
    }
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F8F9FA" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#1A73E8] border-t-transparent animate-spin" />
          <p className="text-sm" style={{ color: "#5F6368" }}>Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!demoUser) return null;

  return (
    <div className="min-h-screen flex" style={{ background: "#F8F9FA" }}>
      {/* ── Left Sidebar ─────────────────────────────────────────── */}
      <aside
        ref={asideRef}
        className="flex flex-col flex-shrink-0 h-screen sticky top-0 transition-all duration-200"
        style={{
          width: sidebarCollapsed ? "52px" : `${sidebarWidth}px`,
          minWidth: sidebarCollapsed ? "52px" : "200px",
          background: "#FFFFFF",
          borderRight: "1px solid #E8EAED",
          boxShadow: "1px 0 0 #E8EAED",
          position: "relative",
        }}
      >
        {/* Logo and Collapse Button */}
        <div 
          className={`flex items-center justify-between ${sidebarCollapsed ? "justify-center px-2" : "px-4"}`} 
          style={{ 
            height: "56px", 
            borderBottom: "1px solid #E8EAED",
            flexShrink: 0
          }}
        >
          {!sidebarCollapsed ? (
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #1A73E8, #34A853)" }}
                >
                  AI
                </div>
                <div className="truncate">
                  <div className="font-semibold text-sm leading-tight truncate" style={{ color: "#202124" }}>
                    AI.CoFounder
                  </div>
                  <div className="text-[10px] leading-tight truncate" style={{ color: "#9AA0AC" }}>
                    Workspace
                  </div>
                </div>
              </div>
              <button
                onClick={toggleSidebar}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
                style={{ background: "#F1F3F4", color: "#5F6368" }}
                title="Comprimi menu"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                </svg>
              </button>
            </>
          ) : (
            <button
              onClick={toggleSidebar}
              onMouseEnter={() => setLogoHovered(true)}
              onMouseLeave={() => setLogoHovered(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-all"
              style={{
                background: logoHovered ? "#F1F3F4" : "linear-gradient(135deg, #1A73E8, #34A853)",
                color: logoHovered ? "#5F6368" : "#FFFFFF"
              }}
              title="Espandi menu"
            >
              {logoHovered ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                </svg>
              ) : (
                "AI"
              )}
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center rounded-lg transition-colors group ${
                  sidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
                }`}
                style={{
                  background: isActive ? "#E8F0FE" : "transparent",
                  color: isActive ? "#1A73E8" : "#5F6368",
                  fontWeight: isActive ? 600 : 500,
                  fontSize: "0.875rem",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "#F1F3F4";
                    e.currentTarget.style.color = "#202124";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#5F6368";
                  }
                }}
              >
                <span
                  style={{
                    color: isActive ? "#1A73E8" : "#5F6368",
                    transition: "color 0.15s",
                  }}
                  className="flex-shrink-0"
                >
                  {item.icon}
                </span>
                {!sidebarCollapsed && <span>{item.label}</span>}
                {!sidebarCollapsed && isActive && (
                  <div
                    className="ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ background: "#1A73E8" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={`py-3 ${sidebarCollapsed ? "flex flex-col items-center gap-1.5 px-1.5" : "px-3"}`} style={{ borderTop: "1px solid #E8EAED" }}>
          {/* User profile */}
          <div className={`flex items-center rounded-lg mb-1 ${sidebarCollapsed ? "justify-center p-1.5" : "gap-2.5 px-2 py-2"}`} style={{ background: "#F8F9FA" }}>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
              style={{ background: "#1A73E8" }}
            >
              D
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "#202124" }}>
                  {demoUser.name}
                </p>
                <p className="text-[10px] truncate" style={{ color: "#9AA0AC" }}>
                  {demoUser.email}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              document.cookie = "demo_user_id=; max-age=0; path=/";
              document.cookie = "demo_mode=; max-age=0; path=/";
              window.location.href = "/login";
            }}
            className={`w-full flex items-center rounded-lg text-xs font-medium transition-colors ${
              sidebarCollapsed ? "justify-center p-2" : "gap-2 px-3 py-2"
            }`}
            style={{ color: "#EA4335" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#FCE8E6")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            title={sidebarCollapsed ? "Esci" : ""}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
            {!sidebarCollapsed && <span>Esci</span>}
          </button>
        </div>
      </aside>

      {/* ── Drag-Resize Handle ──────────────────────────────────────────── */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="flex-shrink-0 flex items-center justify-center group"
        style={{
          width: "6px",
          cursor: "col-resize",
          background: "transparent",
          position: "relative",
          zIndex: 10,
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#E8EAED")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        title="Trascina per ridimensionare"
      >
        {/* Grip dots */}
        {!sidebarCollapsed && (
          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-1 h-1 rounded-full" style={{ background: "#9AA0AC" }} />
            ))}
          </div>
        )}
      </div>

      {/* ── Main Content ──────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto h-screen custom-scrollbar" style={{ background: "#F8F9FA" }}>
        {children}
      </main>
    </div>
  );
}
