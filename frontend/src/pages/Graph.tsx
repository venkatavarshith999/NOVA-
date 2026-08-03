import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  MarkerType,
  useNodesState,
  useEdgesState,
  type NodeProps,
  Handle,
  Position,
  BackgroundVariant,
  Panel,
  useReactFlow,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Share2, Zap, Loader2, X, ArrowRight, Download,
  Maximize2, RotateCcw, Filter, Network, AlertTriangle,
  Building2, Globe, User, ShieldCheck, Lock, FileText,
  Layers, Clock, BookOpen, ChevronDown, Info, Eye,
} from "lucide-react";
import { graphApi, complianceApi, type GraphNode as GNode, type ImpactAnalysisResponse } from "../lib/api";
import { entityColor, cn } from "../lib/utils";

// ─── Entity Type Icons ─────────────────────────────────────────────────────────
const TYPE_ICONS: Record<string, React.ElementType> = {
  Organization: Building2,
  Department: Layers,
  Country: Globe,
  Person: User,
  Policy: FileText,
  Regulation: BookOpen,
  Standard: ShieldCheck,
  Product: Layers,
  "Storage Location": Lock,
  "Security Control": ShieldCheck,
  Encryption: Lock,
  "Retention Period": Clock,
  "Compliance Rule": AlertTriangle,
  Entity: Share2,
};

function getTypeIcon(type: string) {
  return TYPE_ICONS[type] ?? Share2;
}

// ─── Custom Node ───────────────────────────────────────────────────────────────
function EntityNode({ data, selected }: NodeProps) {
  const color = entityColor(data.type);
  const Icon = getTypeIcon(data.type);
  const size = Math.max(36, Math.min(64, 36 + data.degree * 4));
  const isHighlighted = data.highlighted;
  const highlightColor = data.highlightColor ?? color;

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: "none" }} />
      <div
        className="flex flex-col items-center gap-1 cursor-pointer select-none"
        style={{ minWidth: 80 }}
      >
        {/* Outer glow ring */}
        {(selected || isHighlighted) && (
          <div
            className="absolute inset-0 rounded-full animate-ping"
            style={{
              background: `${highlightColor}22`,
              transform: "scale(1.5)",
              animationDuration: "1.5s",
            }}
          />
        )}
        {/* Node circle */}
        <div
          className="flex items-center justify-center rounded-full transition-all duration-200 relative"
          style={{
            width: size,
            height: size,
            background: isHighlighted
              ? `radial-gradient(circle at 40% 35%, ${highlightColor}55, ${highlightColor}22)`
              : `radial-gradient(circle at 40% 35%, ${color}40, ${color}18)`,
            border: selected
              ? `2.5px solid ${color}`
              : isHighlighted
              ? `2px solid ${highlightColor}`
              : `1.5px solid ${color}70`,
            boxShadow: selected
              ? `0 0 20px ${color}55, 0 0 40px ${color}22`
              : isHighlighted
              ? `0 0 14px ${highlightColor}44`
              : `0 0 8px ${color}22`,
          }}
        >
          <Icon size={size * 0.38} style={{ color }} />
          {/* Degree badge */}
          {data.degree > 1 && (
            <div
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
              style={{ background: color, color: "#0a0b14" }}
            >
              {data.degree > 9 ? "9+" : data.degree}
            </div>
          )}
        </div>
        {/* Label */}
        <div
          className="text-center leading-tight px-1 py-0.5 rounded"
          style={{
            fontSize: 9,
            maxWidth: 88,
            color: selected ? color : "#cbd5e1",
            fontWeight: selected ? 600 : 400,
            background: selected ? `${color}18` : "transparent",
            textShadow: "0 1px 3px rgba(0,0,0,0.8)",
          }}
        >
          <div className="truncate">{data.label}</div>
          <div className="opacity-50 text-[7px] uppercase tracking-wider mt-0.5">{data.type}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: "none" }} />
    </>
  );
}

const nodeTypes = { entityNode: EntityNode };

// ─── Force-Directed Layout ─────────────────────────────────────────────────────
function computeLayout(
  rawNodes: GNode[],
  _rawEdges: { source: string; target: string }[],
  highlightedIds: Set<string>,
  highlightColors: Map<string, string>,
  searchTerm: string
): Node[] {
  const byType = new Map<string, GNode[]>();
  for (const n of rawNodes) {
    if (!byType.has(n.type)) byType.set(n.type, []);
    byType.get(n.type)!.push(n);
  }

  const types = Array.from(byType.keys());
  const centerX = 0;
  const centerY = 0;
  const typeCount = types.length;
  const result: Node[] = [];

  // Build adjacency map for degree-based sizing
  const degreeMap = new Map<string, number>();
  for (const n of rawNodes) degreeMap.set(n.id, n.degree);

  types.forEach((type, tIdx) => {
    const group = byType.get(type)!;
    // Arrange type groups in a ring, then nodes within each ring
    const outerAngle = typeCount > 1 ? (tIdx / typeCount) * Math.PI * 2 : 0;
    const outerRadius = typeCount > 1 ? 280 + Math.floor(tIdx / 5) * 200 : 0;
    const groupCX = centerX + outerRadius * Math.cos(outerAngle);
    const groupCY = centerY + outerRadius * Math.sin(outerAngle);
    const innerRadius = Math.max(80, group.length * 18);

    group.forEach((n, i) => {
      const angle = (i / group.length) * Math.PI * 2 + tIdx * 0.8;
      const r = group.length === 1 ? 0 : innerRadius;
      const x = groupCX + r * Math.cos(angle);
      const y = groupCY + r * Math.sin(angle);

      const isSearched =
        searchTerm.length > 0 &&
        n.label.toLowerCase().includes(searchTerm.toLowerCase());

      result.push({
        id: n.id,
        type: "entityNode",
        position: { x, y },
        data: {
          label: n.label,
          type: n.type,
          degree: n.degree,
          centrality: n.centrality,
          highlighted: highlightedIds.has(n.id) || isSearched,
          highlightColor: highlightColors.get(n.id) ?? (isSearched ? "#fbbf24" : entityColor(n.type)),
        },
      });
    });
  });

  return result;
}

// ─── Fit View Button ──────────────────────────────────────────────────────────
function FitViewButton() {
  const { fitView } = useReactFlow();
  return (
    <button
      onClick={() => fitView({ duration: 600, padding: 0.15 })}
      className="p-2 rounded-lg glass border border-white/10 text-slate-400 hover:text-white transition-colors"
      title="Fit to view"
    >
      <Maximize2 size={14} />
    </button>
  );
}

// ─── Stats Card ───────────────────────────────────────────────────────────────
function StatCard({
  value, label, color,
}: {
  value: string | number; label: string; color: string;
}) {
  return (
    <div className="card py-4 text-center border border-white/[0.06] relative overflow-hidden group hover:border-white/20 transition-all">
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: `radial-gradient(ellipse at 50% 100%, ${color}10, transparent)` }}
      />
      <p className="text-2xl font-display font-bold" style={{ color }}>
        {value}
      </p>
      <p className="text-[11px] text-slate-500 mt-0.5 uppercase tracking-wide">{label}</p>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend({
  types,
  activeFilter,
  onFilter,
  counts,
}: {
  types: string[];
  activeFilter: string | null;
  onFilter: (t: string | null) => void;
  counts: Record<string, number>;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="absolute bottom-4 left-4 z-10 w-52">
      <div className="glass rounded-xl border border-white/10 overflow-hidden">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.03] transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Filter size={11} /> Entity Types
          </span>
          <ChevronDown size={12} className={cn("transition-transform", expanded && "rotate-180")} />
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-2 pb-2 space-y-0.5 max-h-64 overflow-y-auto scrollbar-thin">
                <button
                  onClick={() => onFilter(null)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] transition-colors",
                    !activeFilter
                      ? "bg-white/10 text-white"
                      : "text-slate-400 hover:bg-white/[0.04]"
                  )}
                >
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span className="flex-1 text-left">All</span>
                </button>
                {types.map((t) => {
                  const color = entityColor(t);
                  const Icon = getTypeIcon(t);
                  return (
                    <button
                      key={t}
                      onClick={() => onFilter(activeFilter === t ? null : t)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] transition-colors",
                        activeFilter === t
                          ? "text-white"
                          : "text-slate-400 hover:bg-white/[0.04]"
                      )}
                      style={
                        activeFilter === t
                          ? { background: `${color}20`, color }
                          : {}
                      }
                    >
                      <Icon size={10} style={{ color }} />
                      <span className="flex-1 text-left truncate">{t}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background: `${color}20`, color }}
                      >
                        {counts[t] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Node Detail Panel ────────────────────────────────────────────────────────
function NodeDetailPanel({
  node,
  allEdges,
  allNodes,
  onClose,
  onImpact,
  impactLoading,
}: {
  node: any;
  allEdges: any[];
  allNodes: GNode[];
  onClose: () => void;
  onImpact: (label: string) => void;
  impactLoading: boolean;
}) {
  const color = entityColor(node.type);
  const Icon = getTypeIcon(node.type);

  const connections = useMemo(() => {
    return allEdges
      .filter((e) => e.source === node.id || e.target === node.id)
      .map((e) => {
        const isSource = e.source === node.id;
        const otherId = isSource ? e.target : e.source;
        const other = allNodes.find((n) => n.id === otherId);
        return {
          id: e.id,
          direction: isSource ? "out" : "in",
          relation: e.label.replace(/_/g, " "),
          otherLabel: other?.label ?? otherId,
          otherType: other?.type ?? "Entity",
        };
      });
  }, [node.id, allEdges, allNodes]);

  const outgoing = connections.filter((c) => c.direction === "out");
  const incoming = connections.filter((c) => c.direction === "in");

  return (
    <motion.div
      initial={{ x: 340, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 340, opacity: 0 }}
      transition={{ type: "spring", damping: 26, stiffness: 280 }}
      className="absolute top-0 right-0 w-80 h-full overflow-y-auto scrollbar-thin z-20 flex flex-col"
      style={{
        background: "rgba(10,11,22,0.92)",
        backdropFilter: "blur(20px)",
        borderLeft: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] shrink-0"
        style={{ background: `linear-gradient(135deg, ${color}10, transparent)` }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `${color}22`, border: `1px solid ${color}50` }}
          >
            <Icon size={14} style={{ color }} />
          </div>
          <span className="text-sm font-semibold text-slate-200">Entity Details</span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg hover:bg-white/[0.08] flex items-center justify-center text-slate-500 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 p-5 space-y-5 overflow-y-auto scrollbar-thin">
        {/* Entity name + type */}
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{
              background: `radial-gradient(circle at 40% 35%, ${color}35, ${color}12)`,
              border: `2px solid ${color}55`,
              boxShadow: `0 0 24px ${color}33`,
            }}
          >
            <Icon size={28} style={{ color }} />
          </div>
          <h3 className="font-display font-bold text-lg leading-tight">{node.label}</h3>
          <span
            className="inline-block mt-1.5 text-[11px] px-3 py-0.5 rounded-full font-semibold"
            style={{ background: `${color}20`, color }}
          >
            {node.type}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-void-800/60 rounded-xl p-3 text-center border border-white/[0.05]">
            <p className="text-2xl font-display font-bold" style={{ color }}>
              {node.degree}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Connections</p>
          </div>
          <div className="bg-void-800/60 rounded-xl p-3 text-center border border-white/[0.05]">
            <p className="text-2xl font-display font-bold" style={{ color }}>
              {node.centrality ? (node.centrality * 100).toFixed(1) : 0}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Centrality</p>
          </div>
        </div>

        {/* Impact Analysis Button */}
        <button
          onClick={() => onImpact(node.label)}
          disabled={impactLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all"
          style={{
            background: `${color}15`,
            borderColor: `${color}40`,
            color,
          }}
        >
          {impactLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Zap size={14} />
          )}
          Run Impact Analysis
        </button>

        {/* Outgoing relationships */}
        {outgoing.length > 0 && (
          <div>
            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ArrowRight size={10} /> Outgoing ({outgoing.length})
            </p>
            <div className="space-y-1.5">
              {outgoing.map((c, i) => (
                <RelEdge key={i} conn={c} />
              ))}
            </div>
          </div>
        )}

        {/* Incoming relationships */}
        {incoming.length > 0 && (
          <div>
            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ArrowRight size={10} className="rotate-180" /> Incoming ({incoming.length})
            </p>
            <div className="space-y-1.5">
              {incoming.map((c, i) => (
                <RelEdge key={i} conn={c} incoming />
              ))}
            </div>
          </div>
        )}

        {connections.length === 0 && (
          <div className="text-center py-6 text-slate-500 text-xs">
            <Network size={22} className="mx-auto mb-2 opacity-40" />
            No connections yet
          </div>
        )}
      </div>
    </motion.div>
  );
}

function RelEdge({
  conn,
  incoming = false,
}: {
  conn: { relation: string; otherLabel: string; otherType: string };
  incoming?: boolean;
}) {
  const otherColor = entityColor(conn.otherType);
  return (
    <div className="bg-void-800/40 rounded-lg p-2.5 border border-white/[0.04] text-[11px]">
      <div className="flex items-center gap-1.5 text-slate-400 mb-1">
        <span
          className="px-1.5 py-0.5 rounded text-[9px] font-semibold"
          style={{ background: `${otherColor}20`, color: otherColor }}
        >
          {conn.otherType}
        </span>
        <span className="font-medium text-slate-200 truncate">{conn.otherLabel}</span>
      </div>
      <span className="text-[10px] text-violet-400 font-medium">
        {incoming ? "←" : "→"} {conn.relation}
      </span>
    </div>
  );
}

// ─── Impact Banner ─────────────────────────────────────────────────────────────
function ImpactBanner({
  data,
  entity,
  onClear,
}: {
  data: ImpactAnalysisResponse;
  entity: string;
  onClear: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="card bg-gradient-to-r from-red-900/30 to-amber-900/20 border border-red-500/25"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <Zap size={13} className="text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">Impact Analysis</p>
            <p className="text-[11px] text-amber-400 font-medium">{entity}</p>
          </div>
        </div>
        <button
          onClick={onClear}
          className="text-slate-500 hover:text-white text-xs flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/[0.05] transition-colors"
        >
          <X size={12} /> Clear
        </button>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed mb-3">{data.risk_summary}</p>
      <div className="flex gap-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_6px_#f87171]" />
          <span className="text-slate-300">
            <strong className="text-red-400">{data.directly_affected.length}</strong> directly affected
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
          <span className="text-slate-300">
            <strong className="text-amber-400">{data.indirectly_affected.length}</strong> indirectly affected
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyGraph() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
      <div className="relative mb-6">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full border border-violet-500/20"
            style={{
              width: 80 + i * 50,
              height: 80 + i * 50,
              top: -(25 + i * 25),
              left: -(25 + i * 25),
              animationDelay: `${i * 0.4}s`,
            }}
          />
        ))}
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/25 flex items-center justify-center">
          <Network size={28} className="text-violet-400" />
        </div>
      </div>
      <h3 className="text-lg font-display font-semibold text-slate-300 mb-2">
        No Knowledge Graph Yet
      </h3>
      <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-4">
        Upload and process compliance documents to automatically extract entities
        and build your knowledge graph.
      </p>
      <div className="flex items-center gap-4 text-xs text-slate-600">
        {["Organizations", "Policies", "Regulations", "Controls"].map((t) => (
          <span key={t} className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: entityColor(t === "Controls" ? "Security Control" : t.slice(0, -1)) }} />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Inner Graph (needs ReactFlowProvider) ─────────────────────────────────────
function GraphCanvas() {
  const { data: graphData, isLoading, refetch } = useQuery({
    queryKey: ["graph"],
    queryFn: () => graphApi.get().then((r) => r.data),
    refetchInterval: 30_000,
  });

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GNode | null>(null);
  const [impactData, setImpactData] = useState<ImpactAnalysisResponse | null>(null);
  const [impactEntity, setImpactEntity] = useState<string | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();

  // Derived entity type list
  const types = useMemo(
    () => Array.from(new Set((graphData?.nodes ?? []).map((n) => n.type))),
    [graphData]
  );

  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const n of graphData?.nodes ?? []) {
      m[n.type] = (m[n.type] ?? 0) + 1;
    }
    return m;
  }, [graphData]);

  // Impact highlight sets
  const highlightedIds = useMemo(() => {
    if (!impactData) return new Set<string>();
    return new Set([
      ...impactData.directly_affected.map((n) => n.id),
      ...impactData.indirectly_affected.map((n) => n.id),
    ]);
  }, [impactData]);

  const highlightColors = useMemo(() => {
    const m = new Map<string, string>();
    if (!impactData) return m;
    impactData.directly_affected.forEach((n) => m.set(n.id, "#f87171"));
    impactData.indirectly_affected.forEach((n) => m.set(n.id, "#fbbf24"));
    return m;
  }, [impactData]);

  // Build nodes + edges whenever data / filters / impact changes
  useEffect(() => {
    if (!graphData) return;

    let filteredNodes = graphData.nodes;
    if (typeFilter) filteredNodes = filteredNodes.filter((n) => n.type === typeFilter);
    if (search && search.length > 0) {
      // Don't filter out — just highlight matching ones via computeLayout
    }
    const visibleIds = new Set(filteredNodes.map((n) => n.id));

    const rfNodes = computeLayout(filteredNodes, graphData.edges, highlightedIds, highlightColors, search);

    const rfEdges: Edge[] = graphData.edges
      .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label.replace(/_/g, " "),
        animated: e.confidence > 0.85,
        type: "smoothstep",
        style: {
          stroke: e.confidence > 0.85 ? "#7c3aed88" : "#334155",
          strokeWidth: e.confidence > 0.85 ? 2 : 1,
        },
        labelStyle: { fill: "#64748b", fontSize: 8, fontWeight: 500 },
        labelBgStyle: { fill: "#0d0f1f", fillOpacity: 0.85, rx: 4 },
        labelBgPadding: [4, 6] as [number, number],
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: e.confidence > 0.85 ? "#7c3aed" : "#334155",
          width: 12,
          height: 12,
        },
      }));

    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [graphData, typeFilter, search, highlightedIds, highlightColors, setNodes, setEdges]);

  // Auto fit on first load
  useEffect(() => {
    if (graphData?.nodes.length) {
      const t = setTimeout(() => fitView({ duration: 700, padding: 0.15 }), 200);
      return () => clearTimeout(t);
    }
  }, [graphData?.nodes.length, fitView]);

  const handleNodeClick = useCallback(
    (_: any, node: Node) => {
      const raw = graphData?.nodes.find((n) => n.id === node.id);
      if (raw) setSelectedNode(raw);
    },
    [graphData]
  );

  const handleImpact = async (label: string) => {
    setImpactLoading(true);
    setImpactEntity(label);
    try {
      const res = await complianceApi.impact(label);
      setImpactData(res.data);
      // Re-fit after highlights applied
      setTimeout(() => fitView({ duration: 600, padding: 0.15 }), 300);
    } catch {
      setImpactData(null);
    } finally {
      setImpactLoading(false);
    }
  };

  const clearImpact = () => {
    setImpactData(null);
    setImpactEntity(null);
  };

  // Export as PNG via data URL
  const handleExport = useCallback(() => {
    const el = document.querySelector(".react-flow__renderer") as HTMLElement;
    if (!el) return;
    import("html-to-image")
      .then(({ toPng }) => toPng(el, { backgroundColor: "#090b15" }))
      .then((url) => {
        const a = document.createElement("a");
        a.href = url;
        a.download = "nova-knowledge-graph.png";
        a.click();
      })
      .catch(() => {
        // html-to-image may not be installed — graceful skip
      });
  }, []);

  const hasGraph = (graphData?.nodes.length ?? 0) > 0;

  return (
    <div className="max-w-full mx-auto space-y-5 h-full flex flex-col">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold flex items-center gap-2">
            <Network size={22} className="text-violet-400" /> Knowledge Graph
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Interactive entity-relationship graph extracted from your compliance documents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 rounded-xl glass border border-white/10 text-slate-400 hover:text-white transition-colors"
            title="Refresh graph"
          >
            <RotateCcw size={15} />
          </button>
          {hasGraph && (
            <button
              onClick={handleExport}
              className="btn-secondary text-xs !px-3 !py-2"
              title="Export as PNG"
            >
              <Download size={13} /> Export
            </button>
          )}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input-field pl-8 py-2 text-sm w-44"
              placeholder="Search nodes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard value={graphData?.stats.node_count ?? 0} label="Nodes" color="#8b5cf6" />
        <StatCard value={graphData?.stats.edge_count ?? 0} label="Relationships" color="#22d3ee" />
        <StatCard
          value={(graphData?.stats.density ?? 0).toFixed(3)}
          label="Density"
          color="#4ade80"
        />
        <StatCard
          value={graphData?.stats.connected_components ?? 0}
          label="Clusters"
          color="#fb7185"
        />
      </div>

      {/* ── Impact banner ── */}
      <AnimatePresence>
        {impactData && impactEntity && (
          <ImpactBanner data={impactData} entity={impactEntity} onClear={clearImpact} />
        )}
      </AnimatePresence>

      {/* ── Canvas ── */}
      <div className="card flex-1 min-h-[560px] p-0 overflow-hidden relative border border-white/[0.06]">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 size={28} className="animate-spin text-violet-400" />
            <p className="text-sm">Building knowledge graph…</p>
          </div>
        ) : !hasGraph ? (
          <EmptyGraph />
        ) : (
          <>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
              nodeTypes={nodeTypes}
              fitView
              proOptions={{ hideAttribution: true }}
              defaultEdgeOptions={{ type: "smoothstep" }}
              minZoom={0.2}
              maxZoom={2.5}
            >
              <Background
                variant={BackgroundVariant.Dots}
                color="#1e2240"
                gap={28}
                size={1}
              />
              <Controls
                showInteractive={false}
                className="!bg-void-800/90 !border-white/10 !rounded-xl !shadow-xl"
                style={{ bottom: "auto", top: 16, left: 16 }}
              />
              <MiniMap
                nodeColor={(n) => entityColor((n.data as any)?.type ?? "Entity")}
                maskColor="rgba(6,7,13,0.8)"
                className="!bg-void-900/90 !border-white/10 !rounded-xl"
                style={{ bottom: 16, right: hasGraph && selectedNode ? 328 : 16 }}
              />

              {/* Top-right toolbar */}
              <Panel position="top-right" className="flex items-center gap-2">
                <FitViewButton />
                {selectedNode && (
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="p-2 rounded-lg glass border border-white/10 text-slate-400 hover:text-white transition-colors"
                    title="Close panel"
                  >
                    <Eye size={14} />
                  </button>
                )}
              </Panel>

              {/* Search results count */}
              {search && (
                <Panel position="top-center">
                  <div className="glass rounded-full px-3 py-1 text-xs text-slate-300 border border-white/10">
                    {nodes.filter((n) => (n.data as any).highlighted).length} node
                    {nodes.filter((n) => (n.data as any).highlighted).length !== 1 ? "s" : ""}{" "}
                    matching "{search}"
                  </div>
                </Panel>
              )}
            </ReactFlow>

            {/* Legend (bottom-left inside canvas) */}
            <Legend
              types={types}
              activeFilter={typeFilter}
              onFilter={setTypeFilter}
              counts={typeCounts}
            />

            {/* Info tip (first visit) */}
            {!selectedNode && (
              <div className="absolute bottom-4 right-4 glass rounded-lg px-3 py-2 text-[10px] text-slate-500 border border-white/[0.06] flex items-center gap-1.5">
                <Info size={10} /> Click a node to explore
              </div>
            )}

            {/* Node Detail Panel */}
            <AnimatePresence>
              {selectedNode && (
                <NodeDetailPanel
                  node={selectedNode}
                  allEdges={graphData?.edges ?? []}
                  allNodes={graphData?.nodes ?? []}
                  onClose={() => setSelectedNode(null)}
                  onImpact={handleImpact}
                  impactLoading={impactLoading}
                />
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* ── Entity type breakdown ── */}
      {hasGraph && types.length > 0 && (
        <div className="card">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-4 flex items-center gap-2">
            <Layers size={12} /> Entity Distribution
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {types.map((t) => {
              const color = entityColor(t);
              const Icon = getTypeIcon(t);
              const count = typeCounts[t] ?? 0;
              const pct = graphData ? Math.round((count / graphData.stats.node_count) * 100) : 0;
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                  className={cn(
                    "flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left",
                    typeFilter === t
                      ? "border-opacity-60"
                      : "border-white/[0.06] hover:border-white/20 bg-void-800/30"
                  )}
                  style={
                    typeFilter === t
                      ? { background: `${color}12`, borderColor: `${color}50` }
                      : {}
                  }
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${color}20` }}
                  >
                    <Icon size={13} style={{ color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color }}>
                      {t}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {count} node{count !== 1 ? "s" : ""} · {pct}%
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Export wrapped in provider ───────────────────────────────────────────────
export default function Graph() {
  return (
    <ReactFlowProvider>
      <GraphCanvas />
    </ReactFlowProvider>
  );
}
