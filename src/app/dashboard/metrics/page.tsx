"use client";

import { useEffect, useState, useRef } from "react";

interface CohortRow {
  cohort: string;
  size: number;
  r1: number;
  r2: number;
  r3: number;
}

interface CustomMetric {
  id: string;
  title: string;
  value: string;
  type: string;
  chartType: string;
  data: number[];
  labels: string[];
  cohortData?: CohortRow[];
  formula?: string;
  apiEndpoint?: string | null;
  jsonPath?: string | null;
  color?: string | null;
  isDefault: boolean;
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<CustomMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states for adding a new metric
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newType, setNewType] = useState("integer");
  const [newChartType, setNewChartType] = useState("line");
  const [newFormula, setNewFormula] = useState("");
  const [newColor, setNewColor] = useState("#1A73E8");
  const [newApiEndpoint, setNewApiEndpoint] = useState("");
  const [newJsonPath, setNewJsonPath] = useState("");
  const [newDataString, setNewDataString] = useState("10,20,30,40,50");
  const [newLabelsString, setNewLabelsString] = useState("Jan,Feb,Mar,Apr,May");
  const [submitting, setSubmitting] = useState(false);

  // Live client-side values fetched from custom endpoints
  const [liveValues, setLiveValues] = useState<Record<string, { value: string; data?: number[] }>>({});

  // Integration Configuration & Drawer states
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [mixpanelConnected, setMixpanelConnected] = useState(false);
  const [plaidConnected, setPlaidConnected] = useState(false);

  const [stripeConnType, setStripeConnType] = useState("direct"); // "direct" or "proxy"
  const [stripeKey, setStripeKey] = useState("sk_test_demo");
  const [stripeUrl, setStripeUrl] = useState("");
  const [mixpanelUrl, setMixpanelUrl] = useState("");
  const [plaidUrl, setPlaidUrl] = useState("");

  // Custom API Connections State
  const [connections, setConnections] = useState<any[]>([]);
  const [showAddConnForm, setShowAddConnForm] = useState(false);
  const [connName, setConnName] = useState("");
  const [connUrl, setConnUrl] = useState("");
  const [connMethod, setConnMethod] = useState("GET");
  const [connHeaders, setConnHeaders] = useState(""); // JSON string
  const [connBody, setConnBody] = useState(""); // JSON string
  const [connTargetMetric, setConnTargetMetric] = useState("");
  const [connJsonPath, setConnJsonPath] = useState("");
  const [connResponseType, setConnResponseType] = useState("json");
  const [connTimeout, setConnTimeout] = useState("5000");

  // Terminal Logs states
  const [syncing, setSyncing] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const fetchConnections = () => {
    fetch("/api/demo/connections")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setConnections(data);
      })
      .catch((err) => console.error("Errore fetchConnections:", err));
  };

  const handleToggleConnection = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch("/api/demo/connections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !currentActive })
      });
      if (res.ok) {
        fetchConnections();
      }
    } catch (err) {
      console.error("Errore toggle connection:", err);
    }
  };

  const handleDeleteConnection = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa connessione API?")) return;
    try {
      const res = await fetch(`/api/demo/connections?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchConnections();
      }
    } catch (err) {
      console.error("Errore delete connection:", err);
    }
  };

  const handleAddConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connName || !connUrl || !connTargetMetric) return;

    let parsedHeaders = {};
    if (connHeaders.trim()) {
      try {
        parsedHeaders = JSON.parse(connHeaders);
      } catch (err) {
        alert("Headers non validi! Assicurati di inserire un oggetto JSON valido.");
        return;
      }
    }

    let parsedBody = null;
    if (connBody.trim()) {
      try {
        parsedBody = JSON.parse(connBody);
      } catch (err) {
        alert("Payload body non valido! Assicurati di inserire un oggetto JSON valido.");
        return;
      }
    }

    try {
      const res = await fetch("/api/demo/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: connName,
          url: connUrl,
          method: connMethod,
          headers: parsedHeaders,
          bodyPayload: parsedBody,
          targetMetric: connTargetMetric,
          jsonPath: connJsonPath,
          responseType: connResponseType,
          timeout: parseInt(connTimeout, 10) || 5000
        })
      });

      if (!res.ok) throw new Error("Errore durante la creazione della connessione");

      setConnName("");
      setConnUrl("");
      setConnMethod("GET");
      setConnHeaders("");
      setConnBody("");
      setConnTargetMetric("");
      setConnJsonPath("");
      setConnResponseType("json");
      setConnTimeout("5000");
      setShowAddConnForm(false);
      fetchConnections();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const fetchMetrics = () => {
    fetch("/api/demo/metrics")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setMetrics(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  // Helper to resolve dot-notation json paths (e.g. data.users)
  const getJsonValue = (obj: any, pathStr: string) => {
    if (!pathStr) return obj;
    const parts = pathStr.split(".");
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const key = arrayMatch[1];
        const index = parseInt(arrayMatch[2], 10);
        current = current[key]?.[index];
      } else {
        current = current[part];
      }
    }
    return current;
  };

  // Sync scroll for terminal logs
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalLogs]);

  // Load configuration and event listener
  useEffect(() => {
    fetchMetrics();
    fetchConnections();

    // Initialize Integration URLs from localStorage or Defaults
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const storedStripeUrl = localStorage.getItem("agentfoundry_integration_stripe_url") || `${origin}/api/demo/sandbox/metrics?provider=stripe`;
    const storedMixpanelUrl = localStorage.getItem("agentfoundry_integration_mixpanel_url") || `${origin}/api/demo/sandbox/metrics?provider=mixpanel`;
    const storedPlaidUrl = localStorage.getItem("agentfoundry_integration_plaid_url") || `${origin}/api/demo/sandbox/metrics?provider=plaid`;

    setStripeUrl(storedStripeUrl);
    setMixpanelUrl(storedMixpanelUrl);
    setPlaidUrl(storedPlaidUrl);

    setStripeConnType(localStorage.getItem("agentfoundry_integration_stripe_conn_type") || "direct");
    setStripeKey(localStorage.getItem("agentfoundry_integration_stripe_key") || "sk_test_demo");

    setStripeConnected(localStorage.getItem("agentfoundry_integration_stripe_conn") === "true");
    setMixpanelConnected(localStorage.getItem("agentfoundry_integration_mixpanel_conn") === "true");
    setPlaidConnected(localStorage.getItem("agentfoundry_integration_plaid_conn") === "true");

    // Listen to real-time events from coFounder tool calls
    const handleUpdateEvent = () => {
      fetchMetrics();
      fetchConnections();
    };

    window.addEventListener("startup-metrics-updated", handleUpdateEvent);
    return () => {
      window.removeEventListener("startup-metrics-updated", handleUpdateEvent);
    };
  }, []);

  // Fetch client-side live metrics when metrics are loaded
  useEffect(() => {
    metrics.forEach((m) => {
      if (m.apiEndpoint) {
        fetch(m.apiEndpoint)
          .then((res) => res.json())
          .then((data) => {
            const extracted = getJsonValue(data, m.jsonPath || "");
            if (extracted !== undefined) {
              let formattedValue = String(extracted);
              let trendData = m.data;
              
              if (typeof extracted === "number") {
                if (m.type === "currency") {
                  formattedValue = `$${extracted.toLocaleString()}`;
                } else if (m.type === "percentage") {
                  formattedValue = `${extracted}%`;
                } else if (m.type === "ratio") {
                  formattedValue = `${extracted}x`;
                } else {
                  formattedValue = extracted.toLocaleString();
                }
                
                if (m.chartType === "gauge") {
                  trendData = [extracted];
                }
              } else if (typeof extracted === "object" && extracted !== null) {
                if (extracted.value !== undefined) formattedValue = String(extracted.value);
                if (Array.isArray(extracted.data)) trendData = extracted.data;
              }
              
              setLiveValues((prev) => ({
                ...prev,
                [m.id]: { value: formattedValue, data: trendData }
              }));
            }
          })
          .catch((err) => {
            console.error(`Error fetching live metric for ${m.title}:`, err);
          });
      }
    });
  }, [metrics]);

  const handleSaveIntegrations = () => {
    localStorage.setItem("agentfoundry_integration_stripe_url", stripeUrl);
    localStorage.setItem("agentfoundry_integration_mixpanel_url", mixpanelUrl);
    localStorage.setItem("agentfoundry_integration_plaid_url", plaidUrl);

    localStorage.setItem("agentfoundry_integration_stripe_conn_type", stripeConnType);
    localStorage.setItem("agentfoundry_integration_stripe_key", stripeKey);

    localStorage.setItem("agentfoundry_integration_stripe_conn", String(stripeConnected));
    localStorage.setItem("agentfoundry_integration_mixpanel_conn", String(mixpanelConnected));
    localStorage.setItem("agentfoundry_integration_plaid_conn", String(plaidConnected));

    setTerminalLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Configurazione integrazioni salvata localmente.`
    ]);
  };

  const handleSyncNow = async () => {
    if (syncing) return;
    setSyncing(true);
    setTerminalLogs([`[${new Date().toLocaleTimeString()}] Avvio connessione socket e inizializzazione handshake...`]);

    try {
      const payload = {
        stripeUrl: stripeConnected ? stripeUrl : null,
        mixpanelUrl: mixpanelConnected ? mixpanelUrl : null,
        plaidUrl: plaidConnected ? plaidUrl : null,
        stripeConnType: stripeConnected ? stripeConnType : null,
        stripeKey: stripeConnected ? stripeKey : null,
      };

      const res = await fetch("/api/demo/startup/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sincronizzazione fallita");

      let currentLine = 0;
      const interval = setInterval(() => {
        if (currentLine < data.logs.length) {
          setTerminalLogs((prev) => [...prev, data.logs[currentLine]]);
          currentLine++;
        } else {
          clearInterval(interval);
          setSyncing(false);
          window.dispatchEvent(new Event("startup-metrics-updated"));
        }
      }, 250);
    } catch (err: any) {
      setTerminalLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ERRORE: ${err.message}`,
        `[${new Date().toLocaleTimeString()}] Sincronizzazione interrotta.`
      ]);
      setSyncing(false);
    }
  };

  const handleAddMetric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newValue) return;
    setSubmitting(true);

    const parsedData = newDataString.split(",").map(num => parseFloat(num.trim())).filter(num => !isNaN(num));
    const parsedLabels = newLabelsString.split(",").map(lbl => lbl.trim());

    try {
      const res = await fetch("/api/demo/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          value: newValue,
          type: newType,
          chartType: newChartType,
          formula: newFormula,
          data: parsedData,
          labels: parsedLabels,
          color: newColor || null,
          apiEndpoint: newApiEndpoint || null,
          jsonPath: newJsonPath || null
        })
      });

      if (!res.ok) throw new Error("Errore durante la creazione della metrica");

      setNewTitle("");
      setNewValue("");
      setNewFormula("");
      setNewColor("#1A73E8");
      setNewApiEndpoint("");
      setNewJsonPath("");
      setNewDataString("10,20,30,40,50");
      setNewLabelsString("Jan,Feb,Mar,Apr,May");
      setShowAddModal(false);
      fetchMetrics();

      window.dispatchEvent(new Event("startup-metrics-updated"));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMetric = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa metrica?")) return;
    try {
      const res = await fetch(`/api/demo/metrics?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Impossibile eliminare la metrica");
      fetchMetrics();
      window.dispatchEvent(new Event("startup-metrics-updated"));
    } catch (err: any) {
      alert(err.message);
    }
  };

  // SVG Line Chart Drawer
  const renderLineChart = (data: number[], labels: string[], color = "#1A73E8") => {
    if (!data || data.length === 0) return null;
    const width = 280;
    const height = 90;
    const padding = 12;

    const maxVal = Math.max(...data) * 1.1 || 100;
    const minVal = Math.min(...data) * 0.9 >= 0 ? 0 : Math.min(...data) * 0.9;

    const points = data.map((val, idx) => {
      const x = padding + (idx * (width - padding * 2)) / (data.length - 1);
      const y = height - padding - ((val - minVal) * (height - padding * 2)) / (maxVal - minVal);
      return { x, y };
    });

    const dPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    
    // Closed path for gradient fill
    const dFill = points.length > 0 
      ? `${dPath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
      : "";

    return (
      <svg className="w-full overflow-visible" height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="chart-glow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#F1F3F4" strokeWidth="1" strokeDasharray="3" />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#F1F3F4" strokeWidth="1" strokeDasharray="3" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#E8EAED" strokeWidth="1" />
        
        {/* Gradient fill */}
        <path d={dFill} fill="url(#chart-glow)" />

        {/* Chart line */}
        <path d={dPath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Interaction dots */}
        {points.map((p, idx) => (
          <circle key={idx} cx={p.x} cy={p.y} r="3" fill="#FFFFFF" stroke={color} strokeWidth="1.5" className="hover:r-4 cursor-pointer transition-all" />
        ))}

        {/* Labels */}
        {labels.map((lbl, idx) => {
          const x = padding + (idx * (width - padding * 2)) / (data.length - 1);
          return (
            <text key={idx} x={x} y={height - 1} textAnchor="middle" fill="#9AA0AC" fontSize="7px" fontFamily="monospace">
              {lbl}
            </text>
          );
        })}
      </svg>
    );
  };

  // SVG Bar Chart Drawer
  const renderBarChart = (data: number[], labels: string[], color = "#34A853") => {
    if (!data || data.length === 0) return null;
    const width = 280;
    const height = 90;
    const padding = 12;

    const maxVal = Math.max(...data) * 1.1 || 100;
    const minVal = 0;

    const barWidth = Math.max(10, Math.min(30, (width - padding * 2) / data.length - 8));

    return (
      <svg className="w-full" height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Grid lines */}
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#F1F3F4" strokeWidth="1" strokeDasharray="3" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#E8EAED" strokeWidth="1" />

        {data.map((val, idx) => {
          const x = padding + idx * ((width - padding * 2) / data.length) + ((width - padding * 2) / data.length - barWidth) / 2;
          const barHeight = ((val - minVal) * (height - padding * 2)) / (maxVal - minVal);
          const y = height - padding - barHeight;

          return (
            <g key={idx} className="group cursor-pointer">
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={color}
                opacity="0.8"
                rx="2"
                className="hover:opacity-100 transition-opacity"
              />
              <text x={x + barWidth / 2} y={y - 3} textAnchor="middle" fill="#202124" fontSize="7px" fontWeight="bold">
                {val}%
              </text>
              <text x={x + barWidth / 2} y={height - 1} textAnchor="middle" fill="#9AA0AC" fontSize="7px">
                {labels[idx] || ""}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  // SVG Gauge Arc Drawer
  const renderGaugeChart = (val: number, label: string, color?: string) => {
    const radius = 35;
    const cx = 50;
    const cy = 50;
    const strokeWidth = 8;
    const circumference = Math.PI * radius; // Half-circle
    
    // Clamp val to range 0-10 (assuming max is 10 for ratio)
    const normalized = Math.min(10, Math.max(0, val));
    const strokeOffset = circumference - (circumference * normalized) / 10;

    return (
      <div className="flex flex-col items-center justify-center h-[90px] relative">
        <svg className="w-28 h-16 transform -rotate-180" viewBox="0 0 100 60">
          {/* Base Background Track */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="transparent"
            stroke="#F1F3F4"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Active Progress Gauge */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="transparent"
            stroke={color || (val >= 3 ? "#34A853" : "#EA4335")}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeOffset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute top-8 text-center">
          <p className="text-xl font-bold" style={{ color: '#202124' }}>{val}x</p>
          <p className="text-[9px]" style={{ color: '#9AA0AC' }}>{label}</p>
        </div>
      </div>
    );
  };

  // Cohort Heatmap Table Drawer
  const renderCohortTable = (cohorts: CohortRow[]) => {
    if (!cohorts || cohorts.length === 0) return null;
    return (
      <div className="overflow-x-auto text-[10px] w-full" style={{ border: '1px solid #E8EAED', borderRadius: '8px' }}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ background: '#F8F9FA', borderBottom: '1px solid #E8EAED' }}>
              <th className="p-2 font-semibold" style={{ color: '#5F6368' }}>Coorte</th>
              <th className="p-2 font-semibold" style={{ color: '#5F6368' }}>Dim.</th>
              <th className="p-2 font-semibold" style={{ color: '#5F6368' }}>Mese 1</th>
              <th className="p-2 font-semibold" style={{ color: '#5F6368' }}>Mese 2</th>
              <th className="p-2 font-semibold" style={{ color: '#5F6368' }}>Mese 3</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((row, idx) => {
              const getBg = (val: number) => {
                const opacity = val / 100;
                return `rgba(26, 115, 232, ${opacity})`;
              };

              const getTextColor = (val: number) => {
                return val > 60 ? '#FFFFFF' : '#202124';
              };

              return (
                <tr key={idx} style={{ borderBottom: '1px solid #F1F3F4' }}>
                  <td className="p-2 font-bold" style={{ color: '#202124' }}>{row.cohort}</td>
                  <td className="p-2" style={{ color: '#5F6368' }}>{row.size} u</td>
                  <td className="p-2 text-center font-semibold transition" style={{ background: getBg(row.r1), color: getTextColor(row.r1) }}>{row.r1}%</td>
                  <td className="p-2 text-center font-semibold transition" style={{ background: getBg(row.r2), color: getTextColor(row.r2) }}>{row.r2}%</td>
                  <td className="p-2 text-center font-semibold transition" style={{ background: getBg(row.r3), color: getTextColor(row.r3) }}>{row.r3}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 rounded-full border-2 border-[#1A73E8] border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 animate-fade-in" style={{ background: '#F8F9FA' }}>
      
      <style>{`
        .custom-switch:checked ~ .switch-dot {
          transform: translateX(14px);
          background-color: #FFFFFF;
        }
        .custom-switch:checked {
          background-color: #34A853;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.2);
          border-radius: 2px;
        }
      `}</style>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#202124' }}>
            Analytics & Metriche Startup
          </h1>
          <p className="text-sm mt-1" style={{ color: '#5F6368' }}>
            Visualizza l'andamento finanziario, l'efficacia di acquisizione (LTV:CAC) e la retention utenti.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowIntegrations(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-[#DADCE0] hover:bg-[#F8F9FA] transition"
            style={{ color: '#1C3AA9', borderColor: '#C5D9F9', background: '#F4F7FE' }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
            </svg>
            Configura API Metriche
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg text-white transition hover:opacity-95"
            style={{ background: '#1A73E8', boxShadow: '0 1px 2px rgba(26,115,232,0.3)' }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Nuova Metrica
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl text-sm flex items-center gap-2" style={{ background: '#FCE8E6', border: '1px solid #F7CECE', color: '#C5221F' }}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          Errore di caricamento: {error}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-6">
        {metrics.map((m) => {
          const displayValue = liveValues[m.id]?.value || m.value;
          const displayData = liveValues[m.id]?.data || m.data;
          return (
            <div
              key={m.id}
              className="p-5 rounded-2xl border border-[#E8EAED] flex flex-col justify-between space-y-4 transition-all hover:shadow-md"
              style={{ background: '#FFFFFF' }}
            >
              <div>
                {/* Header card */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold text-sm" style={{ color: '#202124' }}>{m.title}</h2>
                    {m.formula && (
                      <p className="text-[10px] mt-0.5" style={{ color: '#9AA0AC' }}>f: {m.formula}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {m.apiEndpoint && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-tight uppercase bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]" title={m.apiEndpoint}>
                        LIVE API
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-tight uppercase" style={{ background: '#F1F3F4', color: '#5F6368' }}>
                      {m.chartType}
                    </span>
                    {!m.isDefault && (
                      <button
                        onClick={() => handleDeleteMetric(m.id)}
                        className="w-5 h-5 rounded hover:bg-[#FCE8E6] text-[#EA4335] flex items-center justify-center transition"
                        title="Elimina Metrica"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Value displaying */}
                <p className="text-3xl font-extrabold tracking-tight mt-3" style={{ color: '#202124' }}>{displayValue}</p>
              </div>

              {/* Custom chart rendering */}
              <div className="pt-2 flex justify-center w-full">
                {m.chartType === "line" && renderLineChart(displayData, m.labels, m.color || "#1A73E8")}
                {m.chartType === "bar" && renderBarChart(displayData, m.labels, m.color || "#34A853")}
                {m.chartType === "gauge" && renderGaugeChart(displayData[0] || 0, "Benchmark LTV/CAC > 3x", m.color || undefined)}
                {m.chartType === "cohort" && renderCohortTable(m.cohortData || [])}
                {m.chartType === "value" && (
                  <div className="p-3 bg-[#F8F9FA] rounded-lg text-center w-full">
                    <p className="text-[10px] font-semibold" style={{ color: '#5F6368' }}>Nessun grafico visivo configurato</p>
                    <p className="text-[9px] mt-0.5" style={{ color: '#9AA0AC' }}>Formula: {m.formula || "—"}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {metrics.length === 0 && !loading && (
        <div className="p-12 text-center rounded-2xl border border-dashed border-[#DADCE0]" style={{ background: '#FFFFFF' }}>
          <p className="text-sm font-semibold" style={{ color: '#5F6368' }}>Nessuna metrica configurata</p>
          <p className="text-xs mt-1" style={{ color: '#9AA0AC' }}>Fai clic su "Nuova Metrica" o chiedi al coFounder di crearne una.</p>
        </div>
      )}

      {/* Add Custom Metric Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <div onClick={() => setShowAddModal(false)} className="fixed inset-0 bg-black/30 backdrop-blur-xs transition-opacity" />

          {/* Modal Container */}
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden z-10 border border-[#E8EAED]">
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-[#E8EAED]" style={{ background: '#F8F9FA' }}>
              <h3 className="font-bold text-sm" style={{ color: '#202124' }}>Aggiungi Metrica</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#E8EAED] text-[#5F6368]"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddMetric} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold mb-1" style={{ color: '#5F6368' }}>TITOLO METRICA</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="es: CAC Payback"
                    className="w-full px-2.5 py-1.5 rounded text-xs border border-[#DADCE0] focus:outline-none"
                    style={{ color: '#202124' }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold mb-1" style={{ color: '#5F6368' }}>VALORE VISUALIZZATO</label>
                  <input
                    type="text"
                    required
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    placeholder="es: 8 mesi, 12%"
                    className="w-full px-2.5 py-1.5 rounded text-xs border border-[#DADCE0] focus:outline-none"
                    style={{ color: '#202124' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold mb-1" style={{ color: '#5F6368' }}>TIPO DI GRAFICO</label>
                  <select
                    value={newChartType}
                    onChange={e => setNewChartType(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded text-xs border border-[#DADCE0] focus:outline-none"
                    style={{ color: '#202124' }}
                  >
                    <option value="line">Line (Trend nel tempo)</option>
                    <option value="bar">Bar (Colonne di confronto)</option>
                    <option value="gauge">Gauge (Arc per proporzioni/KPI)</option>
                    <option value="value">Solo Valore (Senza grafico)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold mb-1" style={{ color: '#5F6368' }}>TIPO DI DATO</label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded text-xs border border-[#DADCE0] focus:outline-none"
                    style={{ color: '#202124' }}
                  >
                    <option value="integer">Intero</option>
                    <option value="currency">Valuta (Euro/Dollaro)</option>
                    <option value="percentage">Percentuale</option>
                    <option value="ratio">Rapporto (es: 4.8x)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold mb-1" style={{ color: '#5F6368' }}>COLORE GRAFICO</label>
                  <select
                    value={newColor}
                    onChange={e => setNewColor(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded text-xs border border-[#DADCE0] focus:outline-none"
                    style={{ color: '#202124' }}
                  >
                    <option value="#1A73E8">Blu (Default)</option>
                    <option value="#34A853">Verde</option>
                    <option value="#F9AB00">Giallo</option>
                    <option value="#EA4335">Rosso</option>
                    <option value="#9334E6">Viola</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold mb-1" style={{ color: '#5F6368' }}>JSON PATH ESTRATTO (Opzionale)</label>
                  <input
                    type="text"
                    value={newJsonPath}
                    onChange={e => setNewJsonPath(e.target.value)}
                    placeholder="es: mrr o data.users"
                    className="w-full px-2.5 py-1.5 rounded text-xs border border-[#DADCE0] focus:outline-none"
                    style={{ color: '#202124' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold mb-1" style={{ color: '#5F6368' }}>API ENDPOINT LIVE (Opzionale)</label>
                <input
                  type="text"
                  value={newApiEndpoint}
                  onChange={e => setNewApiEndpoint(e.target.value)}
                  placeholder="es: /api/demo/sandbox/metrics?provider=stripe"
                  className="w-full px-2.5 py-1.5 rounded text-xs border border-[#DADCE0] focus:outline-none"
                  style={{ color: '#202124' }}
                />
                <p className="text-[9px] mt-1" style={{ color: '#9AA0AC' }}>Se specificato, la card estrarrà il valore client-side in tempo reale.</p>
              </div>

              <div>
                <label className="block text-[10px] font-semibold mb-1" style={{ color: '#5F6368' }}>FORMULA / CALCOLO</label>
                <input
                  type="text"
                  value={newFormula}
                  onChange={e => setNewFormula(e.target.value)}
                  placeholder="es: Spese marketing / Clienti acquisiti nel mese"
                  className="w-full px-2.5 py-1.5 rounded text-xs border border-[#DADCE0] focus:outline-none"
                  style={{ color: '#202124' }}
                />
              </div>

              {(newChartType === "line" || newChartType === "bar") && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold mb-1" style={{ color: '#5F6368' }}>VALORI SERIE (separati da virgola)</label>
                    <input
                      type="text"
                      value={newDataString}
                      onChange={e => setNewDataString(e.target.value)}
                      placeholder="es: 12, 14, 11, 16"
                      className="w-full px-2.5 py-1.5 rounded text-xs border border-[#DADCE0] focus:outline-none"
                      style={{ color: '#202124' }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold mb-1" style={{ color: '#5F6368' }}>ETICHETTE SERIE (separate da virgola)</label>
                    <input
                      type="text"
                      value={newLabelsString}
                      onChange={e => setNewLabelsString(e.target.value)}
                      placeholder="es: Gen, Feb, Mar, Apr"
                      className="w-full px-2.5 py-1.5 rounded text-xs border border-[#DADCE0] focus:outline-none"
                      style={{ color: '#202124' }}
                    />
                  </div>
                </div>
              )}

              {newChartType === "gauge" && (
                <div>
                  <label className="block text-[10px] font-semibold mb-1" style={{ color: '#5F6368' }}>VALORE GRAFICO (Rapporto da 1 a 10)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={newDataString}
                    onChange={e => setNewDataString(e.target.value)}
                    placeholder="es: 4.8"
                    className="w-full px-2.5 py-1.5 rounded text-xs border border-[#DADCE0] focus:outline-none"
                    style={{ color: '#202124' }}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg text-white transition disabled:opacity-50"
                style={{ background: '#1A73E8', boxShadow: '0 1px 2px rgba(26,115,232,0.3)' }}
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creazione in corso...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                    Aggiungi Metrica
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Slide-over Integrations Configuration Panel */}
      {showIntegrations && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop overlay */}
          <div
            onClick={() => {
              handleSaveIntegrations();
              setShowIntegrations(false);
            }}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
          />

          {/* Drawer container */}
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 border-l border-[#E8EAED]" style={{ background: '#FFFFFF' }}>
            {/* Drawer Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-[#E8EAED]" style={{ background: '#F8F9FA' }}>
              <div>
                <h3 className="font-bold text-sm" style={{ color: '#202124' }}>Integrazioni API Metriche</h3>
                <p className="text-[11px]" style={{ color: '#5F6368' }}>Connetti e sincronizza dati finanziari ed operativi</p>
              </div>
              <button
                onClick={() => {
                  handleSaveIntegrations();
                  setShowIntegrations(false);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#E8EAED] transition text-[#5F6368]"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Stripe Connection Card */}
              <div className="p-4 rounded-xl border border-[#E8EAED]" style={{ background: '#FFFFFF' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-[#635BFF] flex items-center justify-center text-white text-[10px] font-bold">S</div>
                    <span className="text-xs font-bold" style={{ color: '#202124' }}>Connessione Stripe</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stripeConnected}
                      onChange={e => setStripeConnected(e.target.checked)}
                      className="sr-only custom-switch"
                    />
                    <div className="w-7 h-4 rounded-full bg-[#DADCE0] transition-colors relative">
                      <div className="switch-dot absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-[#FFFFFF] transition-transform" />
                    </div>
                  </label>
                </div>
                {stripeConnected && (
                  <div className="space-y-3 mt-3 pt-3 border-t border-[#F1F3F4] animate-fade-in">
                    <div>
                      <label className="block text-[10px] font-semibold mb-1" style={{ color: '#5F6368' }}>TIPO DI CONNESSIONE</label>
                      <select
                        value={stripeConnType}
                        onChange={e => setStripeConnType(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded text-xs border border-[#DADCE0] focus:outline-none"
                        style={{ color: '#202124' }}
                      >
                        <option value="direct">Diretta (Official Stripe API)</option>
                        <option value="proxy">Proxy (Custom JSON Endpoint)</option>
                      </select>
                    </div>

                    {stripeConnType === "direct" ? (
                      <div>
                        <label className="block text-[10px] font-semibold mb-1" style={{ color: '#5F6368' }}>STRIPE SECRET KEY (sk_live_... / sk_test_...)</label>
                        <input
                          type="password"
                          value={stripeKey}
                          onChange={e => setStripeKey(e.target.value)}
                          placeholder="sk_test_••••••••••••••••••••"
                          className="w-full px-2.5 py-1.5 rounded text-xs border border-[#DADCE0] focus:outline-none"
                          style={{ color: '#202124' }}
                        />
                        <p className="text-[9px] mt-1" style={{ color: '#9AA0AC' }}>Usa "sk_test_demo" per attivare la simulazione Sandbox</p>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[10px] font-semibold mb-1" style={{ color: '#5F6368' }}>ENDPOINT URL (MRR & Utenti)</label>
                          <input
                            type="text"
                            value={stripeUrl}
                            onChange={e => setStripeUrl(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded text-xs border border-[#DADCE0] focus:outline-none"
                            style={{ color: '#202124' }}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold mb-1" style={{ color: '#5F6368' }}>STRIPE API MOCK KEY</label>
                          <input
                            type="password"
                            value={stripeKey}
                            onChange={e => setStripeKey(e.target.value)}
                            placeholder="sk_test_••••••••••••••••••••"
                            className="w-full px-2.5 py-1.5 rounded text-xs border border-[#DADCE0] focus:outline-none"
                            style={{ color: '#202124' }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Mixpanel Connection Card */}
              <div className="p-4 rounded-xl border border-[#E8EAED]" style={{ background: '#FFFFFF' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-[#4F44E0] flex items-center justify-center text-white text-[10px] font-bold">M</div>
                    <span className="text-xs font-bold" style={{ color: '#202124' }}>Connessione Mixpanel / GA</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mixpanelConnected}
                      onChange={e => setMixpanelConnected(e.target.checked)}
                      className="sr-only custom-switch"
                    />
                    <div className="w-7 h-4 rounded-full bg-[#DADCE0] transition-colors relative">
                      <div className="switch-dot absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-[#FFFFFF] transition-transform" />
                    </div>
                  </label>
                </div>
                {mixpanelConnected && (
                  <div className="space-y-3 mt-3 pt-3 border-t border-[#F1F3F4] animate-fade-in">
                    <div>
                      <label className="block text-[10px] font-semibold mb-1" style={{ color: '#5F6368' }}>ENDPOINT URL (Utenti Attivi)</label>
                      <input
                        type="text"
                        value={mixpanelUrl}
                        onChange={e => setMixpanelUrl(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded text-xs border border-[#DADCE0] focus:outline-none"
                        style={{ color: '#202124' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Plaid Connection Card */}
              <div className="p-4 rounded-xl border border-[#E8EAED]" style={{ background: '#FFFFFF' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-[#0A85EA] flex items-center justify-center text-white text-[10px] font-bold">P</div>
                    <span className="text-xs font-bold" style={{ color: '#202124' }}>Connessione Plaid (Financial)</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={plaidConnected}
                      onChange={e => setPlaidConnected(e.target.checked)}
                      className="sr-only custom-switch"
                    />
                    <div className="w-7 h-4 rounded-full bg-[#DADCE0] transition-colors relative">
                      <div className="switch-dot absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-[#FFFFFF] transition-transform" />
                    </div>
                  </label>
                </div>
                {plaidConnected && (
                  <div className="space-y-3 mt-3 pt-3 border-t border-[#F1F3F4] animate-fade-in">
                    <div>
                      <label className="block text-[10px] font-semibold mb-1" style={{ color: '#5F6368' }}>ENDPOINT URL (Burn Rate & runway)</label>
                      <input
                        type="text"
                        value={plaidUrl}
                        onChange={e => setPlaidUrl(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded text-xs border border-[#DADCE0] focus:outline-none"
                        style={{ color: '#202124' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Sezione Connessioni API Personalizzate */}
              <div className="pt-4 border-t border-[#E8EAED] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold" style={{ color: '#202124' }}>Connessioni API Personalizzate</h4>
                    <p className="text-[10px]" style={{ color: '#5F6368' }}>Configura endpoint personalizzati per qualsiasi metrica</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddConnForm(!showAddConnForm)}
                    className="px-2 py-1 rounded text-[10px] font-bold text-white transition hover:opacity-90 animate-fade-in"
                    style={{ background: '#1A73E8' }}
                  >
                    {showAddConnForm ? "Annulla" : "+ Nuova"}
                  </button>
                </div>

                {/* Form di aggiunta nuova connessione */}
                {showAddConnForm && (
                  <form onSubmit={handleAddConnection} className="p-4 rounded-xl border border-[#E8EAED] bg-[#F8F9FA] space-y-3 animate-fade-in">
                    <div>
                      <label className="block text-[9px] font-bold mb-1" style={{ color: '#5F6368' }}>NOME CONNESSIONE</label>
                      <input
                        type="text"
                        required
                        value={connName}
                        onChange={e => setConnName(e.target.value)}
                        placeholder="Es. Satispay Sales, GA4 Users"
                        className="w-full px-2.5 py-1.5 rounded text-xs border border-[#DADCE0] bg-white focus:outline-none focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8]"
                        style={{ color: '#202124' }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold mb-1" style={{ color: '#5F6368' }}>METODO</label>
                        <select
                          value={connMethod}
                          onChange={e => setConnMethod(e.target.value)}
                          className="w-full px-2 py-1.5 rounded text-xs border border-[#DADCE0] bg-white focus:outline-none focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8]"
                          style={{ color: '#202124' }}
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="PATCH">PATCH</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold mb-1" style={{ color: '#5F6368' }}>FORMATO</label>
                        <select
                          value={connResponseType}
                          onChange={e => setConnResponseType(e.target.value)}
                          className="w-full px-2 py-1.5 rounded text-xs border border-[#DADCE0] bg-white focus:outline-none focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8]"
                          style={{ color: '#202124' }}
                        >
                          <option value="json">JSON</option>
                          <option value="text">Testo</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold mb-1" style={{ color: '#5F6368' }}>TIMEOUT (MS)</label>
                        <input
                          type="number"
                          value={connTimeout}
                          onChange={e => setConnTimeout(e.target.value)}
                          placeholder="5000"
                          className="w-full px-2 py-1.5 rounded text-xs border border-[#DADCE0] bg-white focus:outline-none focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8]"
                          style={{ color: '#202124' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold mb-1" style={{ color: '#5F6368' }}>METRICA TARGET</label>
                      <select
                        required
                        value={connTargetMetric}
                        onChange={e => setConnTargetMetric(e.target.value)}
                        className="w-full px-2 py-1.5 rounded text-xs border border-[#DADCE0] bg-white focus:outline-none focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8]"
                        style={{ color: '#202124' }}
                      >
                        <option value="">Seleziona metrica...</option>
                        <optgroup label="Metriche Principali">
                          <option value="mrr">MRR (Monthly Recurring Revenue)</option>
                          <option value="users">Utenti Attivi</option>
                          <option value="burnRate">Burn Rate</option>
                          <option value="runway">Runway</option>
                        </optgroup>
                        {metrics.filter(m => !["mrr", "users", "burnRate", "runway"].includes(m.id)).length > 0 && (
                          <optgroup label="Metriche Personalizzate">
                            {metrics
                              .filter(m => !["mrr", "users", "burnRate", "runway"].includes(m.id))
                              .map(m => (
                                <option key={m.id} value={m.id}>{m.title}</option>
                              ))
                            }
                          </optgroup>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold mb-1" style={{ color: '#5F6368' }}>ENDPOINT URL</label>
                      <input
                        type="url"
                        required
                        value={connUrl}
                        onChange={e => setConnUrl(e.target.value)}
                        placeholder="https://api.esempio.com/v1/stats"
                        className="w-full px-2.5 py-1.5 rounded text-xs border border-[#DADCE0] bg-white focus:outline-none focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8]"
                        style={{ color: '#202124' }}
                      />
                    </div>

                    {connResponseType === "json" && (
                      <div>
                        <label className="block text-[9px] font-bold mb-1" style={{ color: '#5F6368' }}>JSON PATH ESTRATTO</label>
                        <input
                          type="text"
                          value={connJsonPath}
                          onChange={e => setConnJsonPath(e.target.value)}
                          placeholder="Es. data.mrr o results[0].value"
                          className="w-full px-2.5 py-1.5 rounded text-xs border border-[#DADCE0] bg-white focus:outline-none focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8]"
                          style={{ color: '#202124' }}
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[9px] font-bold mb-1" style={{ color: '#5F6368' }}>HEADERS HTTP (JSON OPZIONALE)</label>
                      <textarea
                        value={connHeaders}
                        onChange={e => setConnHeaders(e.target.value)}
                        placeholder='Es. { "Authorization": "Bearer key" }'
                        rows={2}
                        className="w-full px-2.5 py-1.5 rounded text-[11px] font-mono border border-[#DADCE0] bg-white focus:outline-none focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8]"
                        style={{ color: '#202124' }}
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold mb-1" style={{ color: '#5F6368' }}>BODY REQUEST PAYLOAD (JSON OPZIONALE)</label>
                      <textarea
                        value={connBody}
                        onChange={e => setConnBody(e.target.value)}
                        placeholder='Es. { "status": "active" }'
                        rows={2}
                        className="w-full px-2.5 py-1.5 rounded text-[11px] font-mono border border-[#DADCE0] bg-white focus:outline-none focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8]"
                        style={{ color: '#202124' }}
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-1.5 rounded text-xs font-bold text-white transition hover:opacity-90"
                      style={{ background: '#34A853' }}
                    >
                      Crea Connessione API
                    </button>
                  </form>
                )}

                {/* Lista connessioni configurate */}
                <div className="space-y-3">
                  {connections.map((conn) => (
                    <div key={conn.id} className="p-3 rounded-xl border border-[#E8EAED] bg-white hover:border-[#1A73E8] transition-colors duration-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#F1F3F4', color: '#5F6368' }}>
                            {conn.method}
                          </span>
                          <span className="text-xs font-bold" style={{ color: '#202124' }}>{conn.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={conn.isActive}
                              onChange={() => handleToggleConnection(conn.id, conn.isActive)}
                              className="sr-only custom-switch"
                            />
                            <div className={`w-7 h-4 rounded-full transition-colors relative ${conn.isActive ? 'bg-[#34A853]' : 'bg-[#DADCE0]'}`}>
                              <div className={`switch-dot absolute top-0.5 w-3 h-3 rounded-full bg-[#FFFFFF] transition-all ${conn.isActive ? 'translate-x-3.5' : 'left-0.5'}`} />
                            </div>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleDeleteConnection(conn.id)}
                            className="text-[#EA4335] hover:text-[#C5221F] transition"
                            title="Elimina connessione"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-1 text-[10px]" style={{ color: '#5F6368' }}>
                        <div className="flex justify-between">
                          <span>Endpoint:</span>
                          <span className="truncate max-w-[220px] font-mono text-[9px] text-right" title={conn.url}>{conn.url}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Metrica Target:</span>
                          <span className="font-semibold text-[#1A73E8]">{conn.targetMetric}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Formato & Timeout:</span>
                          <span className="font-semibold text-[#5F6368] uppercase text-[9px]">
                            {conn.responseType || "json"} • {conn.timeout || 5000}ms
                          </span>
                        </div>
                        {conn.jsonPath && conn.responseType !== "text" && (
                          <div className="flex justify-between">
                            <span>JSON Path:</span>
                            <span className="font-mono text-[9px]">{conn.jsonPath}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {connections.length === 0 && (
                    <div className="text-center py-4 border border-dashed border-[#DADCE0] rounded-xl text-[10px]" style={{ color: '#9AA0AC' }}>
                      Nessuna connessione personalizzata configurata.
                    </div>
                  )}
                </div>
              </div>

              {/* Synchronize Logs console block */}
              <div className="rounded-xl border border-[#3C4043] overflow-hidden" style={{ background: '#202124', color: '#F1F3F4' }}>
                <div className="px-4 py-2 flex items-center justify-between border-b border-[#3C4043]" style={{ background: '#2B2D30' }}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#EA4335]" />
                    <span className="w-2 h-2 rounded-full bg-[#F9AB00]" />
                    <span className="w-2 h-2 rounded-full bg-[#34A853]" />
                    <span className="text-[10px] font-mono ml-2 text-[#9AA0AC]">API Sync Console</span>
                  </div>
                  <span className="text-[9px] font-mono text-[#9AA0AC]">ready</span>
                </div>
                <div className="p-4 font-mono text-[10px] space-y-1.5 h-44 overflow-y-auto custom-scrollbar">
                  {terminalLogs.map((log, index) => (
                    <div key={index} className="leading-relaxed">
                      {log.startsWith("ERROR") || log.includes("ERRORE") ? (
                        <span className="text-[#F28B82]">{log}</span>
                      ) : log.includes("completata") || log.includes("successo") ? (
                        <span className="text-[#81C995]">{log}</span>
                      ) : (
                        <span>{log}</span>
                      )}
                    </div>
                  ))}
                  {terminalLogs.length === 0 && (
                    <div className="text-[#9AA0AC] italic">Nessun log registrato. Avvia la sincronizzazione delle API abilitate.</div>
                  )}
                  {syncing && (
                    <div className="flex items-center gap-1.5 text-[#81C995]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#81C995] animate-ping" />
                      <span>Connessione socket attiva, in attesa di dati...</span>
                    </div>
                  )}
                  <div ref={terminalEndRef} />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={syncing || (!stripeConnected && !mixpanelConnected && !plaidConnected && !connections.some(c => c.isActive))}
                  onClick={() => {
                    handleSaveIntegrations();
                    handleSyncNow();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg text-white transition disabled:opacity-50"
                  style={{ background: '#34A853', boxShadow: '0 1px 2px rgba(52,168,83,0.3)' }}
                >
                  {syncing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sincronizzazione in corso...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M19 8l-4 4h3c0 3.31-2.69 6-6 6-1.01 0-1.97-.25-2.8-.7l-1.46 1.46C8.97 19.54 10.43 20 12 20c4.42 0 8-3.58 8-8h3l-4-4zM6 12c0-3.31 2.69-6 6-6 1.01 0 1.97.25 2.8.7l1.46-1.46C15.03 4.46 13.57 4 12 4c-4.42 0-8 3.58-8 8H1l4 4 4-4H6z"/></svg>
                      Sincronizza Ora
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}
