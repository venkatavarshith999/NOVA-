import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactFlow, {
  Background, Controls, MiniMap, type Node, type Edge, MarkerType, useNodesState, useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Share2, Filter, Zap, Loader2 } from "lucide-react";
import { graphApi, complianceApi, type ImpactAnalysisResponse } from "../lib/api";
import { entityColor, cn } from "../lib/utils";
import NodeDetailPanel from "../components/NodeDetailPanel";

function layoutNodes(nodes: { id: string; label: string; type: string; degree: number }[]): Node[] {
  const byType = new Map<string, typeof nodes>();
  for (const n of nodes) {
    if (!byType.has(n.type)) byType.set(n.type, []);
    byType.get(n.type)!.push(n);
  }
  const types = Array.from(byType.keys());
  const ringGap = 220;
  const result: Node[] = [];
  types.forEach((type, ringIdx) => {
    const group = byType.get(type)!;
    const radius = 140 + ringIdx * ringGap;
    group.forEach((n, i) => {
      const angle = (i / group.length) * Math.PI * 2 + ringIdx * 0.4;
      result.push({
        id: n.id,
        position: { x: radius * Math.cos(angle) + ringIdx * 40, y: radius * Math.sin(angle) },
        data: { label: n.label, type: n.type, degree: n.degree },
        style: {
          background: `${entityColor(n.type)}22`,
          border: `1.5px solid ${entityColor(n.type)}88`,
          borderRadius: 10,
          color: "#f1f5f9",
          fontSize: 11,
          padding: "6px 10px",
          width: "auto",
          minWidth: 90,
          textAlign: "center" as const,
        },
      });
    });
  });
  return result;
}

export default function Graph() {
  const { data, isLoading } = useQuery({ queryKey: ["graph"], queryFn: () => graphApi.get().then((r) => r.data) });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [impactEntity, setImpactEntity] = useState<string | null>(null);
  const [impactData, setImpactData] = useState<ImpactAnalysisResponse | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);

  const types = useMemo(() => Array.from(new Set((data?.nodes ?? []).map((n) => n.type))), [data]);

  useEffect(() => {
    if (!data) return;
    let filteredNodes = data.nodes;
    if (search) filteredNodes = filteredNodes.filter((n) => n.label.toLowerCase().includes(search.toLowerCase()));
    if (typeFilter) filteredNodes = filteredNodes.filter((n) => n.type === typeFilter);
    const visibleIds = new Set(filteredNodes.map((n) => n.id));

    const rfNodes = layoutNodes(filteredNodes);

    // Highlight impact nodes
    if (impactData) {
      const directIds = new Set(impactData.directly_affected.map((n) => n.id));
      const indirectIds = new Set(impactData.indirectly_affected.map((n) => n.id));
      for (const n of rfNodes) {
        if (directIds.has(n.id)) {
          n.style = { ...n.style, border: "2px solid #f87171", boxShadow: "0 0 16px rgba(248,113,113,0.4)" };
        } else if (indirectIds.has(n.id)) {
          n.style = { ...n.style, border: "2px solid #fbbf24", boxShadow: "0 0 12px rgba(251,191,36,0.3)" };
        }
      }
    }

    const rfEdges: Edge[] = data.edges
      .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label.replace(/_/g, " "),
        animated: e.confidence > 0.85,
        style: { stroke: "#4c4f6b", strokeWidth: 1 },
        labelStyle: { fill: "#94a3b8", fontSize: 9 },
        labelBgStyle: { fill: "#12162a", fillOpacity: 0.8 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#4c4f6b", width: 14, height: 14 },
      }));

    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [data, search, typeFilter, setNodes, setEdges, impactData]);

  const handleNodeClick = (_event: any, node: Node) => {
    if (!data) return;
    const nodeEdges = data.edges
      .filter((e) => e.source === node.id || e.target === node.id)
      .map((e) => {
        const isSource = e.source === node.id;
        const targetId = isSource ? e.target : e.source;
        const targetNode = data.nodes.find((n) => n.id === targetId);
        return {
          target: targetId,
          targetLabel: targetNode?.label ?? targetId,
          label: e.label,
          direction: isSource ? "out" as const : "in" as const,
        };
      });
    setSelectedNode({
      id: node.id,
      label: node.data.label,
      type: node.data.type,
      degree: node.data.degree,
      edges: nodeEdges,
    });
  };

  const handleImpact = async (entityLabel: string) => {
    setImpactLoading(true);
    setImpactEntity(entityLabel);
    try {
      const res = await complianceApi.impact(entityLabel);
      setImpactData(res.data);
    } catch {
      setImpactData(null);
    } finally {
      setImpactLoading(false);
    }
  };

  const clearImpact = () => {
    setImpactEntity(null);
    setImpactData(null);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold">Knowledge Graph</h1>
          <p className="text-sm text-slate-400 mt-1">Entities and relationships extracted from your documents.</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedNode && (
            <button
              onClick={() => handleImpact(selectedNode.label)}
              className="btn-secondary text-xs"
              disabled={impactLoading}
            >
              {impactLoading ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
              Impact Analysis
            </button>
          )}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input-field pl-8 py-2 text-sm w-48" placeholder="Search nodes…"
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Nodes", value: data?.stats.node_count ?? 0 },
          { label: "Relationships", value: data?.stats.edge_count ?? 0 },
          { label: "Density", value: data?.stats.density ?? 0 },
          { label: "Clusters", value: data?.stats.connected_components ?? 0 },
        ].map((s) => (
          <div key={s.label} className="card py-4">
            <p className="text-xl font-display font-semibold">{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Impact analysis banner */}
      {impactData && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="card bg-gradient-to-r from-red-500/10 to-amber-500/10 border-red-500/20"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Zap size={14} className="text-amber-400" />
              Impact Analysis: {impactEntity}
            </p>
            <button onClick={clearImpact} className="text-xs text-slate-400 hover:text-white">Clear</button>
          </div>
          <p className="text-xs text-slate-300">{impactData.risk_summary}</p>
          <div className="flex gap-4 mt-2 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              {impactData.directly_affected.length} direct
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              {impactData.indirectly_affected.length} indirect
            </span>
          </div>
        </motion.div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={13} className="text-slate-500" />
        <button
          onClick={() => setTypeFilter(null)}
          className={cn("text-xs px-2.5 py-1 rounded-full border", !typeFilter ? "bg-white/10 border-white/20" : "border-white/10 text-slate-500")}
        >
          All
        </button>
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(typeFilter === t ? null : t)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors",
              typeFilter === t ? "border-white/30" : "border-white/10 text-slate-500"
            )}
            style={typeFilter === t ? { background: `${entityColor(t)}22`, color: entityColor(t) } : {}}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="card flex-1 min-h-[520px] p-0 overflow-hidden relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">Loading graph…</div>
        ) : !data || data.nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <Share2 size={28} className="text-slate-600 mb-3" />
            <p className="text-slate-400">No graph yet. Upload and process a document to see entities appear here.</p>
          </div>
        ) : (
          <>
            <ReactFlow
              nodes={nodes} edges={edges}
              onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
              fitView proOptions={{ hideAttribution: true }}
            >
              <Background color="#242a4a" gap={24} />
              <Controls className="!bg-void-800 !border-white/10" />
              <MiniMap
                nodeColor={(n) => entityColor((n.data as any)?.type ?? "Entity")}
                maskColor="rgba(6,7,13,0.75)" className="!bg-void-800 !border-white/10"
              />
            </ReactFlow>
            <AnimatePresence>
              {selectedNode && (
                <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
