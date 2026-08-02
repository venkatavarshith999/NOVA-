import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FileStack, Share2, GitBranch, MessageSquareText, Loader2, ArrowRight, Upload,
  Shield, AlertTriangle, TrendingUp, Sparkles,
} from "lucide-react";
import { documentsApi, analyticsApi, ragApi, complianceApi } from "../lib/api";
import ConfidenceMeter from "../components/ConfidenceMeter";
import AnimatedCounter from "../components/AnimatedCounter";
import RiskBadge from "../components/RiskBadge";
import { formatRelativeTime, entityColor } from "../lib/utils";

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued", extracting: "Extracting text", chunking: "Chunking",
  embedding: "Embedding", extracting_entities: "Extracting entities",
  building_graph: "Building graph", ready: "Ready", failed: "Failed",
};

export default function Dashboard() {
  const { data: docs } = useQuery({ queryKey: ["documents"], queryFn: () => documentsApi.list().then((r) => r.data), refetchInterval: 4000 });
  const { data: analytics } = useQuery({ queryKey: ["analytics"], queryFn: () => analyticsApi.get().then((r) => r.data) });
  const { data: history } = useQuery({ queryKey: ["history"], queryFn: () => ragApi.history().then((r) => r.data) });
  const { data: risks } = useQuery({ queryKey: ["risks"], queryFn: () => complianceApi.risks().then((r) => r.data) });

  const processing = (docs ?? []).filter((d) => !["ready", "failed"].includes(d.status));

  const cards = [
    { label: "Documents", value: analytics?.total_documents ?? 0, icon: FileStack, gradient: "from-violet-500/20 to-violet-600/5" },
    { label: "Graph Nodes", value: analytics?.total_nodes ?? 0, icon: Share2, gradient: "from-azure-500/20 to-azure-600/5" },
    { label: "Relationships", value: analytics?.total_relationships ?? 0, icon: GitBranch, gradient: "from-cyan-400/20 to-cyan-500/5" },
    { label: "Questions Asked", value: analytics?.total_questions ?? 0, icon: MessageSquareText, gradient: "from-mint-400/20 to-mint-500/5" },
  ];

  const topEntities = Object.entries(analytics?.entity_distribution ?? {})
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 6);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Overview of your compliance knowledge graph.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/documents" className="btn-primary text-sm">
            <Upload size={16} /> Upload documents
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`card bg-gradient-to-br ${c.gradient}`}
          >
            <c.icon size={18} className="text-violet-400 mb-3" />
            <p className="text-2xl font-display font-semibold">
              <AnimatedCounter value={c.value as number} />
            </p>
            <p className="text-xs text-slate-500 mt-1">{c.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Confidence + Compliance Score */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card flex items-center gap-4"
        >
          <div className="relative w-16 h-16 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="#1a1f38" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15" fill="none" stroke="#a78bfa" strokeWidth="3"
                strokeDasharray={`${(analytics?.average_confidence ?? 0) * 0.94} 94`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-display font-semibold">
              {analytics?.average_confidence ?? 0}%
            </span>
          </div>
          <div>
            <p className="text-sm font-medium">Avg. Confidence</p>
            <p className="text-xs text-slate-500">Across all AI answers</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="card flex items-center gap-4"
        >
          <div className="relative w-16 h-16 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="#1a1f38" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15" fill="none"
                stroke={risks ? (risks.compliance_score >= 75 ? "#34d399" : risks.compliance_score >= 45 ? "#fbbf24" : "#fb7185") : "#1a1f38"}
                strokeWidth="3"
                strokeDasharray={`${(risks?.compliance_score ?? 0) * 0.94} 94`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-display font-semibold">
              {risks?.compliance_score?.toFixed(0) ?? "—"}%
            </span>
          </div>
          <div>
            <p className="text-sm font-medium">Compliance Score</p>
            <p className="text-xs text-slate-500">{risks?.total_risks ?? 0} risk{(risks?.total_risks ?? 0) !== 1 ? "s" : ""} detected</p>
          </div>
        </motion.div>
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Processing status */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold">Processing Status</h2>
            <Link to="/documents" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {processing.length === 0 ? (
            <EmptyState text="No documents currently processing." />
          ) : (
            <div className="space-y-3">
              {processing.map((d) => (
                <div key={d.id} className="flex items-center gap-3">
                  <Loader2 size={15} className="animate-spin text-violet-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{d.filename}</p>
                    <div className="w-full h-1.5 bg-void-700 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-nova-gradient transition-all duration-500" style={{ width: `${d.progress}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 shrink-0">{STATUS_LABEL[d.status] ?? d.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold">Recent Activity</h2>
            <Link to="/ask" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
              Ask a question <ArrowRight size={12} />
            </Link>
          </div>
          {!history || history.length === 0 ? (
            <EmptyState text="No questions asked yet." />
          ) : (
            <div className="space-y-4 max-h-64 overflow-y-auto scrollbar-thin pr-1">
              {history.slice(0, 6).map((h) => (
                <div key={h.question_id} className="pb-3 border-b border-white/[0.05] last:border-0 last:pb-0">
                  <p className="text-sm text-slate-200 truncate">{h.question}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-slate-500">{formatRelativeTime(h.created_at)}</span>
                    {h.confidence != null && <ConfidenceMeter value={h.confidence} size="sm" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Compliance risks */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold flex items-center gap-2">
              <Shield size={16} className="text-violet-400" /> Compliance Risks
            </h2>
            {risks && risks.total_risks > 0 && (
              <div className="flex items-center gap-2">
                {risks.high_count > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">{risks.high_count} high</span>
                )}
                {risks.medium_count > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{risks.medium_count} med</span>
                )}
              </div>
            )}
          </div>
          {!risks || risks.risks.length === 0 ? (
            <EmptyState text="No compliance risks detected. Upload documents to start analysis." />
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin pr-1">
              {risks.risks.slice(0, 5).map((r) => (
                <div key={r.id} className="bg-void-800/40 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={13} className={r.severity === "high" ? "text-red-400 mt-0.5" : "text-amber-400 mt-0.5"} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <RiskBadge severity={r.severity} />
                      </div>
                      <p className="text-xs text-slate-200 font-medium">{r.title}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{r.recommendation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Entity distribution */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold flex items-center gap-2">
              <TrendingUp size={16} className="text-violet-400" /> Entity Breakdown
            </h2>
            <Link to="/analytics" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
              Full analytics <ArrowRight size={12} />
            </Link>
          </div>
          {topEntities.length === 0 ? (
            <EmptyState text="No entities extracted yet." />
          ) : (
            <div className="space-y-2.5">
              {topEntities.map(([type, count]) => {
                const total = analytics?.total_nodes ?? 1;
                const pct = Math.round(((count as number) / total) * 100);
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: entityColor(type) }} />
                        <span className="text-xs text-slate-300">{type}</span>
                      </div>
                      <span className="text-xs text-slate-500">{count as number} ({pct}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-void-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: entityColor(type) }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: 0.1 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
          <Sparkles size={16} className="text-violet-400" /> Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { to: "/documents", label: "Upload Document", icon: Upload },
            { to: "/ask", label: "Ask a Question", icon: MessageSquareText },
            { to: "/graph", label: "Explore Graph", icon: Share2 },
            { to: "/reports", label: "Generate Report", icon: FileStack },
          ].map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-white/[0.06] hover:border-violet-500/30 hover:bg-violet-500/[0.04] transition-all text-center"
            >
              <action.icon size={20} className="text-violet-400" />
              <span className="text-xs text-slate-300">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-10 h-10 rounded-full bg-void-700 flex items-center justify-center mb-3">
        <FileStack size={16} className="text-slate-500" />
      </div>
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}
