"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

export interface StakeholderNode {
  id: string;
  label: string;
  cat: "hub" | "investitori" | "advisor" | "team" | "clienti" | "fornitori" | "partner";
  x: number;
  y: number;
  expanded?: boolean;
}

export interface StakeholderEdge {
  a: string;
  b: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  hub: "#5ee0ff",
  investitori: "#f2a623",
  advisor: "#e08fd0",
  team: "#5dcaa5",
  clienti: "#378add",
  fornitori: "#d85a30",
  partner: "#a99cf0",
};

const CATEGORY_NAMES: Record<string, string> = {
  investitori: "Investitori",
  advisor: "Advisor",
  team: "Team",
  clienti: "Clienti",
  fornitori: "Fornitori",
  partner: "Partner",
};

const SEED_CATEGORIES = ["investitori", "advisor", "team", "clienti", "fornitori", "partner"] as const;

interface StakeholderMapProps {
  startupName?: string;
}

export default function StakeholderMap({ startupName = "La tua startup" }: StakeholderMapProps) {
  // Initialize Nodes & Edges
  const [nodes, setNodes] = useState<StakeholderNode[]>(() => {
    const initialNodes: StakeholderNode[] = [
      { id: "hub", label: startupName, cat: "hub", x: 0, y: 0, expanded: true },
    ];
    SEED_CATEGORIES.forEach((cat, i) => {
      const a = (i * 60 * Math.PI) / 180;
      const R = 180;
      initialNodes.push({
        id: cat,
        label: CATEGORY_NAMES[cat],
        cat: cat as any,
        x: Math.round(R * Math.cos(a)),
        y: Math.round(R * Math.sin(a)),
        expanded: true,
      });
    });
    return initialNodes;
  });

  const [edges, setEdges] = useState<StakeholderEdge[]>(() => {
    return SEED_CATEGORIES.map((cat) => ({ a: "hub", b: cat }));
  });

  // Pan & Zoom state
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [zoom, setZoom] = useState(1);

  // Dragging state
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Form & Sync State
  const [newLabel, setNewLabel] = useState("");
  const [newCat, setNewCat] = useState<keyof typeof CATEGORY_NAMES>("team");
  const [parentTargetId, setParentTargetId] = useState<string>("hub");
  const [showFormHighlight, setShowFormHighlight] = useState(false);
  const [savingDb, setSavingDb] = useState(false);
  const [loadingDb, setLoadingDb] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch nodes & edges from database on mount
  useEffect(() => {
    fetch("/api/demo/stakeholders")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.nodes) && Array.isArray(data.edges)) {
          setNodes(data.nodes.map((n: any) => (n.id === "hub" ? { ...n, label: startupName } : n)));
          setEdges(data.edges);
        }
      })
      .catch((err) => console.error("Error fetching stakeholders:", err))
      .finally(() => setLoadingDb(false));
  }, [startupName]);

  // Save graph state to database
  const saveGraphToDb = async (newNodes: StakeholderNode[], newEdges: StakeholderEdge[]) => {
    setSavingDb(true);
    try {
      await fetch("/api/demo/stakeholders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes: newNodes, edges: newEdges }),
      });
    } catch (err) {
      console.error("Error saving stakeholders to DB:", err);
    } finally {
      setSavingDb(false);
    }
  };

  // Delete node from database
  const handleDeleteNode = async (id: string) => {
    if (id === "hub") return;
    setSavingDb(true);
    try {
      const res = await fetch(`/api/demo/stakeholders?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && Array.isArray(data.nodes)) {
        setNodes(data.nodes.map((n: any) => (n.id === "hub" ? { ...n, label: startupName } : n)));
        setEdges(data.edges);
        setSelectedId(null);
      }
    } catch (err) {
      console.error("Error deleting stakeholder:", err);
    } finally {
      setSavingDb(false);
    }
  };

  // Compute visibility of nodes based on parent expansion state
  const visibleNodeIds = React.useMemo(() => {
    const visible = new Set<string>(["hub"]);
    const queue = ["hub"];

    while (queue.length > 0) {
      const currId = queue.shift()!;
      const currNode = nodes.find((n) => n.id === currId);
      if (currNode && currNode.expanded !== false) {
        edges.forEach((e) => {
          if (e.a === currId) {
            visible.add(e.b);
            queue.push(e.b);
          }
        });
      }
    }
    return visible;
  }, [nodes, edges]);

  // Panning & Dragging Handlers
  const handlePointerDownMap = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".node-card")) return;
    setIsDraggingMap(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handlePointerMoveMap = (e: React.PointerEvent) => {
    if (!isDraggingMap) return;
    setPanX(e.clientX - dragStart.x);
    setPanY(e.clientY - dragStart.y);
  };

  const handlePointerUpMap = () => {
    setIsDraggingMap(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => Math.max(0.4, Math.min(3, prev - e.deltaY * 0.0015)));
  };

  const centerView = useCallback(() => {
    setPanX(0);
    setPanY(0);
    setZoom(1);
  }, []);

  const panStep = (dx: number, dy: number) => {
    setPanX((prev) => prev + dx);
    setPanY((prev) => prev + dy);
  };

  // Node Dragging
  const [nodeDraggingId, setNodeDraggingId] = useState<string | null>(null);
  const [nodeDragStart, setNodeDragStart] = useState({ clientX: 0, clientY: 0, nodeX: 0, nodeY: 0 });

  const handleNodePointerDown = (e: React.PointerEvent, node: StakeholderNode) => {
    e.stopPropagation();
    setNodeDraggingId(node.id);
    setNodeDragStart({
      clientX: e.clientX,
      clientY: e.clientY,
      nodeX: node.x,
      nodeY: node.y,
    });
  };

  const handleNodePointerMove = (e: React.PointerEvent) => {
    if (!nodeDraggingId) return;
    const dx = (e.clientX - nodeDragStart.clientX) / zoom;
    const dy = (e.clientY - nodeDragStart.clientY) / zoom;

    setNodes((prev) =>
      prev.map((n) =>
        n.id === nodeDraggingId
          ? { ...n, x: Math.round(nodeDragStart.nodeX + dx), y: Math.round(nodeDragStart.nodeY + dy) }
          : n
      )
    );
  };

  const handleNodePointerUp = (nodeId: string) => {
    if (nodeDraggingId === nodeId) {
      setNodeDraggingId(null);
      // Auto-save graph state after drag
      saveGraphToDb(nodes, edges);
    }
  };

  // Add Stakeholder
  const handleAddStakeholder = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newLabel.trim()) return;

    const parentNode = nodes.find((n) => n.id === parentTargetId) || nodes[0];
    const angle = Math.random() * 2 * Math.PI;
    const r = 100 + Math.random() * 40;
    const newId = "node-" + Date.now();

    const newNode: StakeholderNode = {
      id: newId,
      label: newLabel.trim(),
      cat: newCat as any,
      x: Math.round(parentNode.x + r * Math.cos(angle)),
      y: Math.round(parentNode.y + r * Math.sin(angle)),
      expanded: true,
    };

    const nextNodes = nodes.map((n) => (n.id === parentNode.id ? { ...n, expanded: true } : n)).concat(newNode);
    const nextEdges = [...edges, { a: parentNode.id, b: newId }];

    setNodes(nextNodes);
    setEdges(nextEdges);
    setNewLabel("");

    saveGraphToDb(nextNodes, nextEdges);
  };

  // Toggle Expansion
  const toggleExpand = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const nextNodes = nodes.map((n) => (n.id === nodeId ? { ...n, expanded: !n.expanded } : n));
    setNodes(nextNodes);
    saveGraphToDb(nextNodes, edges);
  };

  // Trigger (+) Quick Add button
  const triggerQuickAdd = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setParentTargetId(nodeId);
    const n = nodes.find((item) => item.id === nodeId);
    if (n && n.cat !== "hub") {
      setNewCat(n.cat as any);
    }
    setShowFormHighlight(true);
    setTimeout(() => setShowFormHighlight(false), 500);
  };

  const selectedNode = nodes.find((n) => n.id === selectedId);
  const connectedCount = selectedNode
    ? edges.filter((e) => e.a === selectedId || e.b === selectedId).length
    : 0;

  return (
    <div className="rounded-2xl overflow-hidden relative border border-[#2A2E39]" style={{ background: "#0B0D10", height: "550px" }}>
      {/* ── Top Header Bar ── */}
      <div className="px-5 py-3.5 flex items-center justify-between z-20 relative border-b border-[#1E222D]" style={{ background: "rgba(20,22,26,0.85)", backdropFilter: "blur(8px)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#5EE0FF]/10 text-[#5EE0FF] flex items-center justify-center font-bold text-sm border border-[#5EE0FF]/30">
            🕸️
          </div>
          <div>
            <h3 className="font-bold text-xs text-[#E6E8EB]">Mappa degli Stakeholder</h3>
            <p className="text-[10px] text-[#9AA0A8]">Visualizza e organizza la rete di investitori, team, clienti e partner</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={centerView}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#14161A] text-[#E6E8EB] hover:border-[#5EE0FF] transition border border-[#2A2E39] whitespace-nowrap"
          >
            🎯 Centra vista
          </button>
        </div>
      </div>

      {/* ── Canvas Viewport ── */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing overflow-hidden relative select-none"
        onPointerDown={handlePointerDownMap}
        onPointerMove={(e) => {
          handlePointerMoveMap(e);
          handleNodePointerMove(e);
        }}
        onPointerUp={() => {
          handlePointerUpMap();
          if (nodeDraggingId) setNodeDraggingId(null);
        }}
        onWheel={handleWheel}
      >
        {/* World Center */}
        <div
          className="absolute left-1/2 top-1/2 w-0 h-0 transition-transform duration-75 ease-out pointer-events-none"
          style={{
            transform: `translate3d(${panX}px, ${panY}px, 0px) scale(${zoom})`,
          }}
        >
          {/* Render Edges */}
          <svg className="overflow-visible absolute top-0 left-0 w-1 h-1 pointer-events-none">
            {edges.map((e, idx) => {
              const nodeA = nodes.find((n) => n.id === e.a);
              const nodeB = nodes.find((n) => n.id === e.b);
              if (!nodeA || !nodeB || !visibleNodeIds.has(nodeA.id) || !visibleNodeIds.has(nodeB.id)) return null;

              const isHl = selectedId && (selectedId === nodeA.id || selectedId === nodeB.id);

              return (
                <line
                  key={`${e.a}-${e.b}-${idx}`}
                  x1={nodeA.x}
                  y1={nodeA.y}
                  x2={nodeB.x}
                  y2={nodeB.y}
                  stroke={isHl ? "#5EE0FF" : "rgba(255,255,255,0.18)"}
                  strokeWidth={isHl ? 2.5 : 1.5}
                />
              );
            })}
          </svg>

          {/* Render Nodes */}
          {nodes.map((node) => {
            if (!visibleNodeIds.has(node.id)) return null;

            const isSelected = selectedId === node.id;
            const isHub = node.cat === "hub";
            const color = CATEGORY_COLORS[node.cat] || "#5ee0ff";
            const hasChildren = edges.some((e) => e.a === node.id);

            return (
              <div
                key={node.id}
                onPointerDown={(e) => handleNodePointerDown(e, node)}
                onPointerUp={() => handleNodePointerUp(node.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(selectedId === node.id ? null : node.id);
                }}
                className="absolute pointer-events-auto node-card transition-shadow"
                style={{
                  transform: `translate3d(${node.x - 60}px, ${node.y - 25}px, 0px)`,
                  width: "120px",
                }}
              >
                <div
                  className={`relative flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center transition-all cursor-grab active:cursor-grabbing ${
                    isHub
                      ? "p-4 border-[#5EE0FF]/50 bg-[#0F2A30]"
                      : isSelected
                      ? "border-[#5EE0FF] bg-[#5EE0FF]/10 shadow-[0_0_15px_rgba(94,224,255,0.2)]"
                      : "border-white/15 bg-[#14161A] hover:border-white/40"
                  }`}
                >
                  {/* Quick (+) Add Child button */}
                  <button
                    type="button"
                    onClick={(e) => triggerQuickAdd(e, node.id)}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#14161A] border border-[#5EE0FF]/50 text-[#5EE0FF] flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 hover:scale-110 hover:bg-[#5EE0FF] hover:text-[#0B0D10] transition-all z-20"
                    title="Aggiungi sottogruppo"
                  >
                    +
                  </button>

                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <div className={`font-semibold text-xs text-[#E6E8EB] leading-tight ${isHub ? "text-sm font-bold" : ""}`}>
                    {node.label}
                  </div>
                  {!isHub && (
                    <div className="text-[10px] text-[#9AA0A8] uppercase tracking-wider font-mono">
                      {CATEGORY_NAMES[node.cat] || node.cat}
                    </div>
                  )}

                  {/* Expand / Collapse (-) (+) Toggle */}
                  {hasChildren && (
                    <button
                      type="button"
                      onClick={(e) => toggleExpand(e, node.id)}
                      className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#14161A] border border-white/30 text-white hover:border-[#5EE0FF] hover:text-[#5EE0FF] flex items-center justify-center text-xs font-bold transition-all z-10"
                      title={node.expanded !== false ? "Comprimi rami" : "Espandi rami"}
                    >
                      {node.expanded !== false ? "−" : "+"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Control Pad (Bottom Left) ── */}
      <div className="absolute left-4 bottom-4 z-20 flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-1 w-24">
          <div />
          <button onClick={() => panStep(0, 50)} className="w-7 h-7 rounded bg-[#14161A] border border-white/15 text-white hover:bg-white/10 flex items-center justify-center text-xs font-bold">↑</button>
          <div />
          <button onClick={() => panStep(50, 0)} className="w-7 h-7 rounded bg-[#14161A] border border-white/15 text-white hover:bg-white/10 flex items-center justify-center text-xs font-bold">←</button>
          <button onClick={() => panStep(0, -50)} className="w-7 h-7 rounded bg-[#14161A] border border-white/15 text-white hover:bg-white/10 flex items-center justify-center text-xs font-bold">↓</button>
          <button onClick={() => panStep(-50, 0)} className="w-7 h-7 rounded bg-[#14161A] border border-white/15 text-white hover:bg-white/10 flex items-center justify-center text-xs font-bold">→</button>
        </div>
      </div>

      {/* ── Side Control Panel (Right Side) ── */}
      <div
        className={`absolute right-4 top-16 w-56 p-4 rounded-xl z-20 transition-all border ${
          showFormHighlight
            ? "border-[#5EE0FF] shadow-[0_0_20px_rgba(94,224,255,0.4)] bg-[#14161A]/95"
            : "border-white/12 bg-[#14161A]/90"
        }`}
        style={{ backdropFilter: "blur(8px)" }}
      >
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-xs text-[#E6E8EB]">
            {selectedNode ? selectedNode.label : "Rete Stakeholder"}
          </h4>
          <span className="text-[9px] font-mono" style={{ color: savingDb ? "#F9AB00" : "#34A853" }}>
            {savingDb ? "Salvataggio..." : "● DB Synced"}
          </span>
        </div>

        <p className="text-[11px] text-[#9AA0A8] mt-1 leading-normal">
          {selectedNode
            ? selectedNode.cat === "hub"
              ? `Centro della rete. ${connectedCount} collegamenti attivi.`
              : `${CATEGORY_NAMES[selectedNode.cat]} • ${connectedCount} collegamenti.`
            : "Clicca un nodo per ispezionare o trascina i widget."}
        </p>

        {selectedNode && selectedNode.id !== "hub" && (
          <button
            type="button"
            onClick={() => handleDeleteNode(selectedNode.id)}
            className="w-full mt-2 py-1.5 text-xs font-semibold rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition flex items-center justify-center gap-1"
          >
            🗑️ Elimina Stakeholder
          </button>
        )}

        <form onSubmit={handleAddStakeholder} className="mt-3 space-y-2.5 border-t border-white/10 pt-2.5">
          <div>
            <label className="block text-[10px] text-[#9AA0A8] uppercase tracking-wider font-semibold mb-1">Nome Stakeholder</label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="es. Fondo VC / Sviluppatore"
              className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[#0B0D10] border border-white/15 text-white focus:outline-none focus:border-[#5EE0FF]"
            />
          </div>

          <div>
            <label className="block text-[10px] text-[#9AA0A8] uppercase tracking-wider font-semibold mb-1">Categoria</label>
            <select
              value={newCat}
              onChange={(e) => setNewCat(e.target.value as any)}
              className="w-full px-2 py-1.5 rounded-lg text-xs bg-[#0B0D10] border border-white/15 text-white focus:outline-none"
            >
              {Object.entries(CATEGORY_NAMES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-[#9AA0A8] uppercase tracking-wider font-semibold mb-1">Collega a:</label>
            <select
              value={parentTargetId}
              onChange={(e) => setParentTargetId(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg text-xs bg-[#0B0D10] border border-white/15 text-white focus:outline-none"
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="w-full py-2 text-xs font-bold rounded-lg bg-[#5EE0FF]/20 text-[#5EE0FF] border border-[#5EE0FF]/40 hover:bg-[#5EE0FF]/30 transition"
          >
            + Aggiungi Stakeholder
          </button>
        </form>
      </div>
    </div>
  );
}
