import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitCompareArrows, Loader2, ArrowRight, FileText, CheckCircle2, XCircle,
  AlertTriangle, Layers, BarChart3, Share2, Zap, Info,
} from "lucide-react";
import { documentsApi, type CompareResponse } from "../lib/api";
import { useToastStore } from "../store/toastStore";
import { entityColor, cn } from "../lib/utils";

// ─── Mini Stat Card ───────────────────────────────────────────────────────────
function StatCard({
  value, label, color = "violet",
}: {
  value: string | number; label: string; color?: string;
}) {
  const colorMap: Record<string, string> = {
    violet: "text-violet-400",
    cyan: "text-cyan-400",
    amber: "text-amber-400",
    green: "text-green-400",
    red: "text-red-400",
  };
  return (
    <div className="card py-4 text-center">
      <p className={cn("text-3xl font-display font-bold", colorMap[color] ?? colorMap.violet)}>
        {value}
      </p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

// ─── Entity Tag ───────────────────────────────────────────────────────────────
function EntityTag({ name, type }: { name: string; type: string }) {
  const color = entityColor(type);
  return (
    <span
      className="text-[10px] px-2 py-1 rounded-full border font-medium"
      style={{
        background: `${color}14`,
        borderColor: `${color}35`,
        color,
      }}
    >
      {name}
    </span>
  );
}

// ─── Document Panel ───────────────────────────────────────────────────────────
function DocPanel({
  doc,
  unique,
  side,
}: {
  doc: CompareResponse["document_a"];
  unique: Array<{ name: string; type: string }>;
  side: "A" | "B";
}) {
  const accentColor = side === "A" ? "violet" : "cyan";
  const textColor = side === "A" ? "text-violet-400" : "text-cyan-400";
  const borderColor = side === "A" ? "border-violet-500/30" : "border-cyan-500/30";
  const bgColor = side === "A" ? "bg-violet-500/5" : "bg-cyan-500/5";
  const hasNoEntities = doc.entity_count === 0;

  return (
    <div className={cn("card border", borderColor, bgColor, "space-y-3")}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold",
          side === "A" ? "bg-violet-500/15 text-violet-300" : "bg-cyan-500/15 text-cyan-300"
        )}>
          {side}
        </div>
        <FileText size={13} className={textColor} />
        <p className="text-sm font-medium truncate flex-1">{doc.filename}</p>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Layers size={11} /> {doc.entity_count} entities
        </span>
        <span className="flex items-center gap-1">
          <Share2 size={11} /> {doc.relationship_count} relationships
        </span>
      </div>

      {/* Warning if no entities */}
      {hasNoEntities && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle size={12} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-300 leading-relaxed">
            No entities extracted from this document. It may still be processing, or try
            re-uploading to trigger AI extraction.
          </p>
        </div>
      )}

      {/* Unique entities */}
      {unique.length > 0 ? (
        <div>
          <p className="text-xs text-slate-400 font-medium mb-2">
            Unique entities ({unique.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unique.map((e) => (
              <EntityTag key={e.name} name={e.name} type={e.type} />
            ))}
          </div>
        </div>
      ) : (
        !hasNoEntities && (
          <p className="text-xs text-slate-500 italic">No entities unique to this document.</p>
        )
      )}
    </div>
  );
}

// ─── Overlap Gauge ────────────────────────────────────────────────────────────
function OverlapGauge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 60 ? "#4ade80" : pct >= 30 ? "#fbbf24" : "#f87171";

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
          <BarChart3 size={12} /> Entity Overlap
        </p>
        <p className="text-lg font-display font-bold" style={{ color }}>
          {pct}%
        </p>
      </div>
      <div className="w-full h-2.5 bg-void-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>0% overlap</span>
        <span>100% overlap</span>
      </div>
    </div>
  );
}

// ─── Summary Banner ───────────────────────────────────────────────────────────
function SummaryBanner({ summary }: { summary: string }) {
  return (
    <div className="card border border-violet-500/20 bg-violet-500/[0.04] flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
        <Zap size={14} className="text-violet-400" />
      </div>
      <p className="text-sm text-slate-200 leading-relaxed">{summary}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Compare() {
  const push = useToastStore((s) => s.push);
  const [docA, setDocA] = useState("");
  const [docB, setDocB] = useState("");
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<CompareResponse | null>(null);

  const { data: docs } = useQuery({
    queryKey: ["documents"],
    queryFn: () => documentsApi.list().then((r) => r.data),
  });

  const readyDocs = (docs ?? []).filter((d) => d.status === "ready");

  const handleCompare = async () => {
    if (!docA || !docB) { push("Select two documents to compare", "error"); return; }
    if (docA === docB) { push("Select two different documents", "error"); return; }
    setComparing(true);
    setResult(null);
    try {
      const res = await documentsApi.compare(docA, docB);
      setResult(res.data);
      // Warn if either doc has 0 entities
      const r = res.data;
      if (r.document_a.entity_count === 0 || r.document_b.entity_count === 0) {
        push(
          "One or both documents have no extracted entities. Results may be incomplete.",
          "error"
        );
      }
    } catch (err: any) {
      push(err?.response?.data?.detail || "Comparison failed", "error");
    } finally {
      setComparing(false);
    }
  };

  const totalEntities = result
    ? result.shared_entities.length + result.unique_to_a.length + result.unique_to_b.length
    : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-semibold flex items-center gap-2">
          <GitCompareArrows size={22} className="text-violet-400" /> Compare Documents
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Side-by-side analysis of entity and relationship differences between two compliance documents.
        </p>
      </div>

      {/* Selector */}
      <div className="card">
        <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-4 mb-4 items-end">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block font-medium">
              Document A
            </label>
            <select
              className="input-field"
              value={docA}
              onChange={(e) => setDocA(e.target.value)}
            >
              <option value="">Select document…</option>
              {readyDocs.map((d) => (
                <option key={d.id} value={d.id}>{d.filename}</option>
              ))}
            </select>
          </div>

          {/* VS divider */}
          <div className="flex items-center justify-center pb-1">
            <div className="w-9 h-9 rounded-full bg-void-700 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-400">
              vs
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1.5 block font-medium">
              Document B
            </label>
            <select
              className="input-field"
              value={docB}
              onChange={(e) => setDocB(e.target.value)}
            >
              <option value="">Select document…</option>
              {readyDocs.map((d) => (
                <option key={d.id} value={d.id}>{d.filename}</option>
              ))}
            </select>
          </div>
        </div>

        {readyDocs.length < 2 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
            <Info size={13} className="text-amber-400 shrink-0" />
            <p className="text-xs text-amber-300">
              You need at least 2 processed documents to compare. Upload and process more documents first.
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleCompare}
            disabled={comparing || !docA || !docB || docA === docB}
            className="btn-primary text-sm"
          >
            {comparing ? (
              <><Loader2 size={15} className="animate-spin" /> Comparing…</>
            ) : (
              <><GitCompareArrows size={15} /> Compare Documents</>
            )}
          </button>
        </div>
      </div>

      {/* Loading */}
      {comparing && (
        <div className="card text-center py-16">
          <Loader2 size={28} className="mx-auto text-violet-400 animate-spin mb-4" />
          <p className="text-sm text-slate-400">Analyzing entity and relationship differences…</p>
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-5"
          >
            {/* Summary banner */}
            <SummaryBanner summary={result.summary} />

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard value={result.shared_entities.length} label="Shared Entities" color="green" />
              <StatCard value={result.unique_to_a.length} label="Unique to A" color="violet" />
              <StatCard value={result.unique_to_b.length} label="Unique to B" color="cyan" />
              <StatCard value={`${(result.overlap_score * 100).toFixed(0)}%`} label="Overlap Score" color="amber" />
            </div>

            {/* Overlap gauge */}
            <OverlapGauge score={result.overlap_score} />

            {/* Side-by-side doc panels */}
            <div className="grid md:grid-cols-2 gap-4">
              <DocPanel doc={result.document_a} unique={result.unique_to_a} side="A" />
              <DocPanel doc={result.document_b} unique={result.unique_to_b} side="B" />
            </div>

            {/* Shared entities */}
            {result.shared_entities.length > 0 && (
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 size={14} className="text-green-400" />
                  <p className="text-sm font-semibold">
                    Shared Entities
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      ({result.shared_entities.length} of {totalEntities} total)
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.shared_entities.map((e) => (
                    <EntityTag key={e.name} name={e.name} type={e.type} />
                  ))}
                </div>
              </div>
            )}

            {/* No shared entities note */}
            {result.shared_entities.length === 0 && totalEntities > 0 && (
              <div className="card flex items-center gap-3">
                <XCircle size={16} className="text-amber-400 shrink-0" />
                <p className="text-sm text-slate-400">
                  No shared entities found. The two documents cover completely different topics or one has no entities extracted.
                </p>
              </div>
            )}

            {/* Relationship diffs */}
            {result.relationship_diffs.length > 0 && (
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <XCircle size={14} className="text-red-400" />
                  <p className="text-sm font-semibold">
                    Relationship Differences
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      ({result.relationship_diffs.length})
                    </span>
                  </p>
                </div>
                <div className="space-y-1.5">
                  {result.relationship_diffs.slice(0, 20).map((rd, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs bg-void-800/40 rounded-lg px-3 py-2 border border-white/[0.04]"
                    >
                      <span className="text-slate-300 font-medium min-w-0 truncate max-w-[120px]">
                        {rd.source}
                      </span>
                      <ArrowRight size={10} className="text-violet-400 shrink-0" />
                      <span className="text-violet-400 font-medium shrink-0">
                        {rd.relation.replace(/_/g, " ")}
                      </span>
                      <ArrowRight size={10} className="text-violet-400 shrink-0" />
                      <span className="text-slate-300 font-medium min-w-0 truncate max-w-[120px]">
                        {rd.target}
                      </span>
                      <span className="text-[10px] text-slate-600 ml-auto shrink-0 truncate max-w-[100px]">
                        — {rd.document}
                      </span>
                    </div>
                  ))}
                  {result.relationship_diffs.length > 20 && (
                    <p className="text-xs text-slate-500 text-center pt-1">
                      … and {result.relationship_diffs.length - 20} more relationship differences
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* No differences state */}
            {result.relationship_diffs.length === 0 && result.shared_entities.length > 0 && (
              <div className="card flex items-center gap-3">
                <CheckCircle2 size={16} className="text-green-400 shrink-0" />
                <p className="text-sm text-slate-400">
                  No relationship differences found — the documents share the same relationship patterns for their common entities.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!result && !comparing && (
        <div className="card text-center py-16">
          <GitCompareArrows size={32} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400 text-sm">
            Select two processed documents above and click <strong className="text-slate-300">Compare Documents</strong> to see a detailed analysis.
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Both documents must be fully processed (status: ready) before comparison.
          </p>
        </div>
      )}
    </div>
  );
}
