import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  GitCompareArrows, Loader2, ArrowRight, FileText, CheckCircle2, XCircle,
} from "lucide-react";
import { documentsApi, type CompareResponse } from "../lib/api";
import { useToastStore } from "../store/toastStore";
import { entityColor } from "../lib/utils";

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
    if (!docA || !docB) {
      push("Select two documents to compare", "error");
      return;
    }
    if (docA === docB) {
      push("Select two different documents", "error");
      return;
    }
    setComparing(true);
    setResult(null);
    try {
      const res = await documentsApi.compare(docA, docB);
      setResult(res.data);
    } catch (err: any) {
      push(err?.response?.data?.detail || "Comparison failed", "error");
    } finally {
      setComparing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold flex items-center gap-2">
          <GitCompareArrows size={22} className="text-violet-400" />
          Compare Documents
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Compare two compliance documents to identify differences in entities and relationships.
        </p>
      </div>

      {/* Selector */}
      <div className="card">
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Document A</label>
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
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Document B</label>
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
        <div className="flex justify-end">
          <button
            onClick={handleCompare}
            disabled={comparing || !docA || !docB || docA === docB}
            className="btn-primary text-sm"
          >
            {comparing ? (
              <><Loader2 size={15} className="animate-spin" /> Comparing…</>
            ) : (
              <><GitCompareArrows size={15} /> Compare</>
            )}
          </button>
        </div>
      </div>

      {/* Loading */}
      {comparing && (
        <div className="card text-center py-16">
          <Loader2 size={28} className="mx-auto text-violet-400 animate-spin mb-4" />
          <p className="text-sm text-slate-400">Analyzing document differences…</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          {/* Summary */}
          <div className="card">
            <p className="text-sm text-slate-200 leading-relaxed">{result.summary}</p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card py-4 text-center">
              <p className="text-2xl font-display font-semibold text-mint-400">{result.shared_entities.length}</p>
              <p className="text-xs text-slate-500 mt-1">Shared Entities</p>
            </div>
            <div className="card py-4 text-center">
              <p className="text-2xl font-display font-semibold text-violet-400">{result.unique_to_a.length}</p>
              <p className="text-xs text-slate-500 mt-1">Unique to A</p>
            </div>
            <div className="card py-4 text-center">
              <p className="text-2xl font-display font-semibold text-azure-400">{result.unique_to_b.length}</p>
              <p className="text-xs text-slate-500 mt-1">Unique to B</p>
            </div>
            <div className="card py-4 text-center">
              <p className="text-2xl font-display font-semibold">{(result.overlap_score * 100).toFixed(0)}%</p>
              <p className="text-xs text-slate-500 mt-1">Overlap Score</p>
            </div>
          </div>

          {/* Overlap bar */}
          <div className="card">
            <p className="text-xs text-slate-400 font-medium mb-2">Entity Overlap</p>
            <div className="w-full h-3 bg-void-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-nova-gradient rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${result.overlap_score * 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-slate-500">
              <span>0% overlap</span>
              <span>100% overlap</span>
            </div>
          </div>

          {/* Document comparison columns */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Doc A */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={14} className="text-violet-400" />
                <p className="text-sm font-medium truncate">{result.document_a.filename}</p>
              </div>
              <div className="flex gap-3 text-xs text-slate-500 mb-4">
                <span>{result.document_a.entity_count} entities</span>
                <span>{result.document_a.relationship_count} relationships</span>
              </div>
              {result.unique_to_a.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-2">Unique entities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.unique_to_a.map((e) => (
                      <span
                        key={e.name}
                        className="text-[10px] px-2 py-1 rounded-full border"
                        style={{
                          background: `${entityColor(e.type)}12`,
                          borderColor: `${entityColor(e.type)}35`,
                          color: entityColor(e.type),
                        }}
                      >
                        {e.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Doc B */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={14} className="text-azure-400" />
                <p className="text-sm font-medium truncate">{result.document_b.filename}</p>
              </div>
              <div className="flex gap-3 text-xs text-slate-500 mb-4">
                <span>{result.document_b.entity_count} entities</span>
                <span>{result.document_b.relationship_count} relationships</span>
              </div>
              {result.unique_to_b.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-2">Unique entities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.unique_to_b.map((e) => (
                      <span
                        key={e.name}
                        className="text-[10px] px-2 py-1 rounded-full border"
                        style={{
                          background: `${entityColor(e.type)}12`,
                          borderColor: `${entityColor(e.type)}35`,
                          color: entityColor(e.type),
                        }}
                      >
                        {e.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Shared entities */}
          {result.shared_entities.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={14} className="text-mint-400" />
                <p className="text-sm font-medium">Shared Entities ({result.shared_entities.length})</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.shared_entities.map((e) => (
                  <span
                    key={e.name}
                    className="text-[10px] px-2 py-1 rounded-full border"
                    style={{
                      background: `${entityColor(e.type)}12`,
                      borderColor: `${entityColor(e.type)}35`,
                      color: entityColor(e.type),
                    }}
                  >
                    {e.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Relationship diffs */}
          {result.relationship_diffs.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <XCircle size={14} className="text-coral-400" />
                <p className="text-sm font-medium">Relationship Differences ({result.relationship_diffs.length})</p>
              </div>
              <div className="space-y-1.5">
                {result.relationship_diffs.slice(0, 15).map((rd, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-void-800/40 rounded-lg px-3 py-2">
                    <span className="text-slate-300">{rd.source}</span>
                    <ArrowRight size={10} className="text-violet-400 shrink-0" />
                    <span className="text-violet-400">{rd.relation.replace(/_/g, " ")}</span>
                    <ArrowRight size={10} className="text-violet-400 shrink-0" />
                    <span className="text-slate-300">{rd.target}</span>
                    <span className="text-slate-600 ml-auto shrink-0">— {rd.document}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Empty state */}
      {!result && !comparing && (
        <div className="card text-center py-16">
          <GitCompareArrows size={32} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400">Select two processed documents above and click Compare to see the differences.</p>
        </div>
      )}
    </div>
  );
}
