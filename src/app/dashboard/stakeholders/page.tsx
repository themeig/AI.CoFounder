"use client";

import { useEffect, useState } from "react";
import StakeholderMap from "@/components/StakeholderMap";
import { useTranslation } from "@/lib/i18n/LanguageContext";

interface Startup {
  id: string;
  name: string;
}

export default function StakeholdersPage() {
  const { language } = useTranslation();
  const [startup, setStartup] = useState<Startup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/demo/startup")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.name) {
          setStartup(data);
        } else {
          setStartup({ id: "demo", name: "La tua Startup" });
        }
      })
      .catch(() => setStartup({ id: "demo", name: "La tua Startup" }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8EAED]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center font-bold text-sm">
              🕸️
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#202124]">
              {language === "en" ? "Interactive Stakeholder Map" : "Mappa Stakeholder Interattiva"}
            </h1>
          </div>
          <p className="text-sm text-[#5F6368] mt-1">
            {language === "en"
              ? "Visualize, organize and manage key relationships across investors, advisors, team, clients, vendors and partners."
              : "Visualizza, organizza e gestisci la rete di relazioni tra investitori, advisor, team, clienti, fornitori e partner."}
          </p>
        </div>
      </div>

      {/* ── Stakeholder Map Canvas ────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden shadow-sm border border-[#E8EAED] bg-white p-2">
        {loading ? (
          <div className="h-[600px] flex items-center justify-center bg-[#0B0D10] rounded-xl text-white/50 text-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-[#5EE0FF] border-t-transparent rounded-full animate-spin" />
              <span>{language === "en" ? "Loading Stakeholder Network..." : "Caricamento Rete Stakeholder..."}</span>
            </div>
          </div>
        ) : (
          <StakeholderMap startupName={startup?.name || "La tua Startup"} />
        )}
      </div>
    </div>
  );
}
