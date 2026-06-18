"use client";

import { useEffect, useState } from "react";

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
  const [newDataString, setNewDataString] = useState("10,20,30,40,50");
  const [newLabelsString, setNewLabelsString] = useState("Jan,Feb,Mar,Apr,May");
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => {
    fetchMetrics();

    // Listen to real-time events from coFounder tool calls
    window.addEventListener("startup-metrics-updated", fetchMetrics);
    return () => {
      window.removeEventListener("startup-metrics-updated", fetchMetrics);
    };
  }, []);

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
          labels: parsedLabels
        })
      });

      if (!res.ok) throw new Error("Errore durante la creazione della metrica");

      setNewTitle("");
      setNewValue("");
      setNewFormula("");
      setNewDataString("10,20,30,40,50");
      setNewLabelsString("Jan,Feb,Mar,Apr,May");
      setShowAddModal(false);
      fetchMetrics();

      // Dispatch event to keep other pages (like Startup page) in sync
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
  const renderGaugeChart = (val: number, label: string) => {
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
            stroke={val >= 3 ? "#34A853" : "#EA4335"}
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

      {error && (
        <div className="p-4 rounded-xl text-sm flex items-center gap-2" style={{ background: '#FCE8E6', border: '1px solid #F7CECE', color: '#C5221F' }}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
          Errore di caricamento: {error}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-6">
        {metrics.map((m) => (
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
              <p className="text-3xl font-extrabold tracking-tight mt-3" style={{ color: '#202124' }}>{m.value}</p>
            </div>

            {/* Custom chart rendering */}
            <div className="pt-2 flex justify-center w-full">
              {m.chartType === "line" && renderLineChart(m.data, m.labels)}
              {m.chartType === "bar" && renderBarChart(m.data, m.labels)}
              {m.chartType === "gauge" && renderGaugeChart(m.data[0] || 0, "Benchmark LTV/CAC > 3x")}
              {m.chartType === "cohort" && renderCohortTable(m.cohortData || [])}
              {m.chartType === "value" && (
                <div className="p-3 bg-[#F8F9FA] rounded-lg text-center w-full">
                  <p className="text-[10px] font-semibold" style={{ color: '#5F6368' }}>Nessun grafico visivo configurato</p>
                  <p className="text-[9px] mt-0.5" style={{ color: '#9AA0AC' }}>Formula: {m.formula || "—"}</p>
                </div>
              )}
            </div>
          </div>
        ))}
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
      
    </div>
  );
}
