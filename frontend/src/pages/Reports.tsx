import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileBarChart, Plus, Loader2, Trash2, AlertTriangle, Shield,
  Share2, FileText, ChevronDown, ChevronRight, CheckCircle2, Clock,
  TrendingUp, BookOpen, Lightbulb, Globe, BarChart3, Printer,
  FileDown, Eye, Building2, Calendar, Target, AlertOctagon,
  ArrowRight, Star, BookMarked, Layers,
} from "lucide-react";
import { reportsApi, documentsApi, type ReportItem, type ReportDetail } from "../lib/api";
import { useToastStore } from "../store/toastStore";
import { formatRelativeTime, cn } from "../lib/utils";
import RiskBadge from "../components/RiskBadge";

// ─── Generation Workflow Steps ────────────────────────────────────────────────
const GENERATION_STEPS = [
  { id: "analyzing",   label: "Analyzing Documents",       icon: FileText },
  { id: "entities",    label: "Extracting Entities",        icon: Share2 },
  { id: "graph",       label: "Building Knowledge Graph",   icon: Layers },
  { id: "compliance",  label: "Performing Compliance Analysis", icon: Shield },
  { id: "generating",  label: "Generating Report",          icon: FileBarChart },
  { id: "complete",    label: "Completed",                  icon: CheckCircle2 },
];

const REPORT_TYPES = [
  { value: "compliance_overview", label: "Compliance Overview", desc: "Full compliance posture analysis with risks, gaps & recommendations" },
  { value: "risk_assessment",     label: "Risk Assessment",     desc: "Focused risk identification and impact analysis" },
  { value: "entity_summary",      label: "Entity Summary",      desc: "Entity extraction, relationship mapping & graph summary" },
];

// ─── Score Ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - score / 100);
  const color = score >= 75 ? "#4ade80" : score >= 50 ? "#fbbf24" : "#f87171";

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-display font-bold" style={{ color }}>{score}%</p>
        <p className="text-[9px] text-slate-500 uppercase tracking-wider">Score</p>
      </div>
    </div>
  );
}

// ─── Collapsible Section ──────────────────────────────────────────────────────
function Section({
  icon: Icon, title, children, badge, defaultOpen = false, accent = "violet",
}: {
  icon: any; title: string; children: React.ReactNode; badge?: string | number;
  defaultOpen?: boolean; accent?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const accentClasses: Record<string, string> = {
    violet: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    red: "text-red-400 bg-red-500/10 border-red-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    green: "text-green-400 bg-green-500/10 border-green-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  };

  return (
    <div className="border border-white/[0.06] rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 bg-void-800/40 hover:bg-void-700/40 transition-colors"
      >
        <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center shrink-0", accentClasses[accent])}>
          <Icon size={15} />
        </div>
        <span className="flex-1 text-left text-sm font-semibold text-slate-100">{title}</span>
        {badge !== undefined && (
          <span className={cn("text-xs font-bold px-2.5 py-0.5 rounded-full border", accentClasses[accent])}>
            {badge}
          </span>
        )}
        {open ? <ChevronDown size={15} className="text-slate-500" /> : <ChevronRight size={15} className="text-slate-500" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <div className="px-5 py-4 border-t border-white/[0.06] space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Priority Badge ───────────────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    critical: "bg-red-500/15 text-red-400 border-red-500/30",
    high:     "bg-orange-500/15 text-orange-400 border-orange-500/30",
    medium:   "bg-amber-500/15 text-amber-400 border-amber-500/30",
    low:      "bg-blue-500/15 text-blue-400 border-blue-500/30",
  };
  return (
    <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", styles[priority] ?? styles.low)}>
      {priority}
    </span>
  );
}

// ─── Risk Level Banner ────────────────────────────────────────────────────────
function RiskLevelBanner({ level }: { level: "high" | "medium" | "low" }) {
  const cfg = {
    high:   { label: "HIGH RISK", color: "from-red-900/40 to-red-800/20 border-red-500/30 text-red-300", icon: AlertOctagon },
    medium: { label: "MEDIUM RISK", color: "from-amber-900/40 to-amber-800/20 border-amber-500/30 text-amber-300", icon: AlertTriangle },
    low:    { label: "LOW RISK", color: "from-green-900/40 to-green-800/20 border-green-500/30 text-green-300", icon: CheckCircle2 },
  }[level];
  const Icon = cfg.icon;
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r border", cfg.color)}>
      <Icon size={18} />
      <div>
        <p className="text-sm font-bold tracking-wider">{cfg.label}</p>
        <p className="text-[11px] opacity-70">Overall compliance risk classification</p>
      </div>
    </div>
  );
}

// ─── Report Viewer ────────────────────────────────────────────────────────────
function ReportViewer({ data }: { report: ReportItem; data: ReportDetail; onClose: () => void }) {
  const push = useToastStore((s) => s.push);
  const viewerRef = useRef<HTMLDivElement>(null);
  const c = data.content;

  // ── Download as Markdown ──
  const downloadMarkdown = () => {
    const lines: string[] = [];
    lines.push(`# ${data.title}`);
    lines.push(`\n**Generated:** ${new Date(c.generated_at).toLocaleString()}`);
    lines.push(`**Report Type:** ${data.report_type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}`);
    lines.push(`\n---\n`);

    if (c.executive_summary) {
      lines.push(`## Executive Summary\n`);
      lines.push(c.executive_summary);
      lines.push("");
    }

    lines.push(`## Compliance Score & Risk Level\n`);
    lines.push(`- **Overall Compliance Score:** ${c.compliance_score ?? "N/A"}%`);
    lines.push(`- **Risk Level:** ${(c.risk_level ?? "unknown").toUpperCase()}`);
    lines.push(`- **Confidence Score:** ${c.confidence_score ?? "N/A"}%`);
    lines.push(`- **Entities Extracted:** ${data.entity_count}`);
    lines.push(`- **Relationships Mapped:** ${data.relationship_count}`);
    lines.push("");

    if (c.risks?.length) {
      lines.push(`## Detected Compliance Risks (${data.risk_count})\n`);
      c.risks.forEach((r, i) => {
        lines.push(`### ${i + 1}. [${r.severity.toUpperCase()}] ${r.title}`);
        lines.push(r.description);
        lines.push(`**Recommendation:** ${r.recommendation}`);
        if (r.affected_entities?.length) lines.push(`**Affected:** ${r.affected_entities.join(", ")}`);
        lines.push("");
      });
    }

    if (c.missing_policies?.length) {
      lines.push(`## Missing Policies & Controls\n`);
      c.missing_policies.forEach((p) => {
        lines.push(`- **${p.area}** [${p.severity.toUpperCase()}]: ${p.recommendation}`);
      });
      lines.push("");
    }

    if (c.key_regulations?.length) {
      lines.push(`## Key Regulations Identified\n`);
      c.key_regulations.forEach((r) => {
        lines.push(`- **${r.name}** (${r.full_name}) — ${r.region}`);
      });
      lines.push("");
    }

    if (c.recommendations?.length) {
      lines.push(`## AI Recommendations\n`);
      c.recommendations.forEach((r, i) => {
        lines.push(`### ${i + 1}. [${r.priority.toUpperCase()}] ${r.title}`);
        lines.push(r.description);
        lines.push("");
      });
    }

    if (c.citations?.length) {
      lines.push(`## Source Documents\n`);
      c.citations.forEach((cit, i) => {
        lines.push(`${i + 1}. **${cit.filename}** — ${cit.page_range} | ${cit.entity_count} entities | ${cit.chunks_analyzed} chunks`);
      });
      lines.push("");
    }

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${data.title.replace(/[^a-z0-9]/gi, "_")}.md`; a.click();
    URL.revokeObjectURL(url);
    push("Downloaded as Markdown", "success");
  };

  // ── Download as PDF ──
  const downloadPDF = () => {
    const printContent = document.getElementById("report-print-area");
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>${data.title}</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; color: #1a1a2e; background: white; padding: 40px; max-width: 800px; margin: 0 auto; }
        h1 { color: #1a1a2e; border-bottom: 3px solid #7c3aed; padding-bottom: 12px; }
        h2 { color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-top: 32px; }
        h3 { color: #4b5563; margin-top: 16px; }
        .meta { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
        .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .high { background: #fee2e2; color: #dc2626; }
        .medium { background: #fef3c7; color: #d97706; }
        .low { background: #dbeafe; color: #2563eb; }
        .critical { background: #fee2e2; color: #dc2626; }
        .score { font-size: 48px; font-weight: 900; color: #7c3aed; }
        .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
        ul { padding-left: 20px; }
        @media print { body { padding: 20px; } }
      </style>
      </head><body>
      <h1>Enterprise Compliance Report</h1>
      <div class="meta">
        <strong>${data.title}</strong><br>
        Generated: ${new Date(c.generated_at).toLocaleString()} &nbsp;|&nbsp;
        Type: ${data.report_type.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())} &nbsp;|&nbsp;
        Confidence: ${c.confidence_score ?? "N/A"}%
      </div>

      ${c.executive_summary ? `<h2>Executive Summary</h2><p>${c.executive_summary.replace(/\n/g, "<br>")}</p>` : ""}

      <h2>Compliance Score</h2>
      <p><span class="score">${c.compliance_score ?? "N/A"}%</span>&nbsp;&nbsp;
      <span class="badge ${c.risk_level ?? "low"}">${(c.risk_level ?? "N/A").toUpperCase()} RISK</span></p>
      <p>Entities: ${data.entity_count} &nbsp;|&nbsp; Relationships: ${data.relationship_count} &nbsp;|&nbsp; Graph Nodes: ${c.graph_stats?.total_nodes ?? 0}</p>

      ${c.risks?.length ? `<h2>Compliance Risks (${data.risk_count})</h2>${c.risks.map((r) => `<div class="card"><h3><span class="badge ${r.severity}">${r.severity.toUpperCase()}</span> ${r.title}</h3><p>${r.description}</p><p><strong>Recommendation:</strong> ${r.recommendation}</p></div>`).join("")}` : ""}

      ${c.missing_policies?.length ? `<h2>Missing Policies</h2><ul>${c.missing_policies.map((p) => `<li><span class="badge ${p.severity}">${p.severity.toUpperCase()}</span> <strong>${p.area}</strong>: ${p.recommendation}</li>`).join("")}</ul>` : ""}

      ${c.key_regulations?.length ? `<h2>Key Regulations</h2><ul>${c.key_regulations.map((r) => `<li><strong>${r.name}</strong> — ${r.full_name} (${r.region})</li>`).join("")}</ul>` : ""}

      ${c.recommendations?.length ? `<h2>AI Recommendations</h2>${c.recommendations.map((r) => `<div class="card"><h3><span class="badge ${r.priority}">${r.priority.toUpperCase()}</span> ${r.title}</h3><p>${r.description}</p></div>`).join("")}` : ""}

      ${c.citations?.length ? `<h2>Source Documents</h2><ul>${c.citations.map((cit) => `<li><strong>${cit.filename}</strong> — ${cit.page_range} | ${cit.entity_count} entities</li>`).join("")}</ul>` : ""}
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
    push("Report ready to print/save as PDF", "success");
  };


  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="space-y-4"
    >
      {/* Report Header */}
      <div className="card space-y-4">
        {/* Title + Actions */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={14} className="text-violet-400 shrink-0" />
              <span className="text-[11px] uppercase tracking-wider text-violet-400 font-semibold">Enterprise Compliance Report</span>
            </div>
            <h2 className="text-xl font-display font-bold leading-tight">{data.title}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1"><Calendar size={11} /> {new Date(c.generated_at).toLocaleString()}</span>
              <span>·</span>
              <span className="flex items-center gap-1"><Target size={11} /> {data.report_type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</span>
              <span>·</span>
              <span className="flex items-center gap-1"><Star size={11} className="text-amber-400" /> {c.confidence_score ?? "N/A"}% confidence</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={downloadMarkdown} className="btn-secondary !text-xs !px-3 !py-2" title="Download Markdown">
              <FileDown size={13} /> .md
            </button>
            <button onClick={downloadPDF} className="btn-secondary !text-xs !px-3 !py-2" title="Download / Print PDF">
              <Printer size={13} /> PDF
            </button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-void-800/50 rounded-xl p-3 text-center border border-white/[0.05]">
            <p className="text-2xl font-display font-bold text-violet-400">{data.entity_count}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Entities Extracted</p>
          </div>
          <div className="bg-void-800/50 rounded-xl p-3 text-center border border-white/[0.05]">
            <p className="text-2xl font-display font-bold text-cyan-400">{data.relationship_count}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Relationships Mapped</p>
          </div>
          <div className="bg-void-800/50 rounded-xl p-3 text-center border border-white/[0.05]">
            <p className="text-2xl font-display font-bold text-red-400">{data.risk_count}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Risks Detected</p>
          </div>
          <div className="bg-void-800/50 rounded-xl p-3 text-center border border-white/[0.05]">
            <p className="text-2xl font-display font-bold text-green-400">{c.graph_stats?.total_nodes ?? 0}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Graph Nodes</p>
          </div>
        </div>

        {/* Score + Risk Level */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <ScoreRing score={c.compliance_score ?? 0} size={100} />
          <div className="flex-1 space-y-2 w-full">
            {c.risk_level && <RiskLevelBanner level={c.risk_level} />}
            {c.risk_counts && (
              <div className="flex gap-2">
                <span className="flex-1 text-center py-1.5 text-[11px] font-semibold rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                  {c.risk_counts.high} High
                </span>
                <span className="flex-1 text-center py-1.5 text-[11px] font-semibold rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {c.risk_counts.medium} Medium
                </span>
                <span className="flex-1 text-center py-1.5 text-[11px] font-semibold rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {c.risk_counts.low} Low
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden print area */}
      <div id="report-print-area" className="hidden" ref={viewerRef} />

      {/* Collapsible Sections */}
      <div className="space-y-2">
        {/* Executive Summary */}
        {c.executive_summary && (
          <Section icon={BookOpen} title="Executive Summary" defaultOpen accent="violet">
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{c.executive_summary}</p>
          </Section>
        )}

        {/* Detected Risks */}
        <Section icon={AlertTriangle} title="Detected Compliance Risks" badge={data.risk_count} accent="red">
          {!c.risks?.length ? (
            <p className="text-sm text-slate-500">No compliance risks detected.</p>
          ) : (
            <div className="space-y-3">
              {c.risks.map((risk) => (
                <div key={risk.id} className="bg-void-800/40 rounded-xl p-4 border border-white/[0.05]">
                  <div className="flex items-start gap-2 mb-2">
                    <RiskBadge severity={risk.severity} />
                    <p className="text-sm font-semibold text-slate-100">{risk.title}</p>
                  </div>
                  <p className="text-xs text-slate-400 mb-2 leading-relaxed">{risk.description}</p>
                  <div className="flex items-start gap-1.5 text-xs">
                    <ArrowRight size={11} className="text-violet-400 shrink-0 mt-0.5" />
                    <span className="text-violet-300">{risk.recommendation}</span>
                  </div>
                  {risk.affected_entities?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {risk.affected_entities.map((e) => (
                        <span key={e} className="text-[10px] px-2 py-0.5 rounded-full bg-void-700 text-slate-400 border border-white/[0.05]">{e}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Missing Policies */}
        <Section icon={AlertOctagon} title="Missing Policies & Controls" badge={c.missing_policies?.length ?? 0} accent="amber">
          {!c.missing_policies?.length ? (
            <p className="text-sm text-slate-500">All common policy areas are covered.</p>
          ) : (
            <div className="space-y-2">
              {c.missing_policies.map((policy, i) => (
                <div key={i} className="flex items-start gap-3 bg-void-800/40 rounded-xl p-3 border border-white/[0.05]">
                  <RiskBadge severity={policy.severity as any} className="shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100">{policy.area}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{policy.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Key Regulations */}
        <Section icon={Globe} title="Key Regulations Identified" badge={c.key_regulations?.length ?? 0} accent="blue">
          {!c.key_regulations?.length ? (
            <p className="text-sm text-slate-500">No specific regulations identified. Upload regulatory documents to improve detection.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {c.key_regulations.map((reg, i) => (
                <div key={i} className="bg-void-800/40 rounded-xl p-3 border border-white/[0.05]">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-blue-400">{reg.name}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{reg.region}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">{reg.full_name}</p>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* AI Recommendations */}
        <Section icon={Lightbulb} title="AI Recommendations" badge={c.recommendations?.length ?? 0} accent="cyan">
          {!c.recommendations?.length ? (
            <p className="text-sm text-slate-500">No recommendations at this time.</p>
          ) : (
            <div className="space-y-3">
              {c.recommendations.map((rec, i) => (
                <div key={i} className="bg-void-800/40 rounded-xl p-4 border border-white/[0.05]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <PriorityBadge priority={rec.priority} />
                    <p className="text-sm font-semibold text-slate-100">{rec.title}</p>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{rec.description}</p>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Knowledge Graph Summary */}
        <Section icon={Share2} title="Knowledge Graph Summary" accent="violet">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-void-800/60 rounded-xl p-3 text-center border border-white/[0.05]">
              <p className="text-xl font-display font-bold text-violet-400">{c.graph_stats?.total_nodes ?? 0}</p>
              <p className="text-[10px] text-slate-500">Nodes</p>
            </div>
            <div className="bg-void-800/60 rounded-xl p-3 text-center border border-white/[0.05]">
              <p className="text-xl font-display font-bold text-cyan-400">{c.graph_stats?.total_edges ?? 0}</p>
              <p className="text-[10px] text-slate-500">Edges</p>
            </div>
            <div className="bg-void-800/60 rounded-xl p-3 text-center border border-white/[0.05]">
              <p className="text-xl font-display font-bold text-green-400">{(c.graph_stats?.density ?? 0).toFixed(3)}</p>
              <p className="text-[10px] text-slate-500">Density</p>
            </div>
          </div>
          {c.entity_breakdown && Object.keys(c.entity_breakdown).length > 0 && (
            <div>
              <p className="text-xs text-slate-500 font-medium mb-2">Entity Types</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {Object.entries(c.entity_breakdown).map(([type, names]) => (
                  <div key={type} className="bg-void-800/40 rounded-lg p-2.5 border border-white/[0.05]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-violet-300">{type}</span>
                      <span className="text-[10px] text-slate-500">{names.length} entities</span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">{names.slice(0, 4).join(", ")}{names.length > 4 ? "…" : ""}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* Analytics */}
        <Section icon={BarChart3} title="Compliance Analytics" accent="green">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="bg-void-800/50 rounded-xl p-3 border border-white/[0.05]">
              <p className="text-xs text-slate-500 mb-1">Documents Analyzed</p>
              <p className="text-2xl font-bold text-green-400">{c.documents_analyzed?.length ?? 0}</p>
            </div>
            <div className="bg-void-800/50 rounded-xl p-3 border border-white/[0.05]">
              <p className="text-xs text-slate-500 mb-1">Total Pages Reviewed</p>
              <p className="text-2xl font-bold text-green-400">
                {c.documents_analyzed?.reduce((s, d) => s + d.pages, 0) ?? 0}
              </p>
            </div>
            <div className="bg-void-800/50 rounded-xl p-3 border border-white/[0.05]">
              <p className="text-xs text-slate-500 mb-1">Analysis Confidence</p>
              <p className="text-2xl font-bold text-green-400">{c.confidence_score ?? "N/A"}%</p>
            </div>
          </div>
        </Section>

        {/* Source Documents & Citations */}
        <Section icon={BookMarked} title="Source Documents & Citations" badge={c.citations?.length ?? 0} accent="violet">
          {!c.citations?.length ? (
            <p className="text-sm text-slate-500">No source documents available.</p>
          ) : (
            <div className="space-y-2">
              {c.citations.map((cit, i) => (
                <div key={cit.document_id} className="bg-void-800/40 rounded-xl p-3 border border-white/[0.05]">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0 text-[10px] font-bold text-violet-400">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate">{cit.filename}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-void-700 text-slate-400">{cit.page_range}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-void-700 text-slate-400">{cit.entity_count} entities</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-void-700 text-slate-400">{cit.chunks_analyzed} chunks</span>
                        {cit.relationship_count > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-void-700 text-slate-400">{cit.relationship_count} relationships</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Processing Metadata */}
        <Section icon={Clock} title="Processing Details" accent="violet">
          <div className="grid sm:grid-cols-2 gap-3 text-xs text-slate-400">
            <div className="space-y-1.5">
              <div className="flex justify-between"><span>Processing Date</span><span className="text-slate-200">{new Date(c.generated_at).toLocaleDateString()}</span></div>
              <div className="flex justify-between"><span>Processing Time</span><span className="text-slate-200">{new Date(c.generated_at).toLocaleTimeString()}</span></div>
              <div className="flex justify-between"><span>Report Type</span><span className="text-slate-200 capitalize">{data.report_type.replace(/_/g, " ")}</span></div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between"><span>Graph Density</span><span className="text-slate-200">{(c.graph_stats?.density ?? 0).toFixed(4)}</span></div>
              <div className="flex justify-between"><span>Confidence Score</span><span className="text-slate-200">{c.confidence_score ?? "N/A"}%</span></div>
              <div className="flex justify-between"><span>Status</span><span className="text-green-400">Ready</span></div>
            </div>
          </div>
        </Section>
      </div>
    </motion.div>
  );
}

// ─── Generation Workflow ──────────────────────────────────────────────────────
function GenerationWorkflow({ onDone }: { onDone: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);

  // Auto-advance steps
  useEffect(() => {
    if (currentStep < GENERATION_STEPS.length - 1) {
      const timer = setTimeout(() => setCurrentStep((s) => s + 1), 750);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(onDone, 600);
      return () => clearTimeout(timer);
    }
  }, [currentStep, onDone]);

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-slate-300 mb-5 flex items-center gap-2">
        <Loader2 size={14} className="animate-spin text-violet-400" />
        Generating Enterprise Compliance Report…
      </h3>
      <div className="space-y-3">
        {GENERATION_STEPS.map((step, i) => {
          const Icon = step.icon;
          const isDone = i < currentStep;
          const isActive = i === currentStep;
          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0.3 }}
              animate={{ opacity: isDone || isActive ? 1 : 0.35 }}
              className="flex items-center gap-3"
            >
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-300",
                isDone ? "bg-green-500/20 border border-green-500/40" :
                isActive ? "bg-violet-500/20 border border-violet-500/40 animate-glow-pulse" :
                "bg-void-700 border border-white/[0.06]"
              )}>
                {isDone ? <CheckCircle2 size={13} className="text-green-400" /> :
                 isActive ? <Loader2 size={13} className="animate-spin text-violet-400" /> :
                 <Icon size={13} className="text-slate-600" />}
              </div>
              <span className={cn(
                "text-sm transition-colors",
                isDone ? "text-green-400" : isActive ? "text-violet-300 font-medium" : "text-slate-600"
              )}>
                {step.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Reports() {
  const push = useToastStore((s) => s.push);
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [selectedType, setSelectedType] = useState("compliance_overview");
  const [viewingReport, setViewingReport] = useState<{ item: ReportItem; data: ReportDetail } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const { data: reports } = useQuery({
    queryKey: ["reports"],
    queryFn: () => reportsApi.list().then((r) => r.data),
  });

  const { data: docs } = useQuery({
    queryKey: ["documents"],
    queryFn: () => documentsApi.list().then((r) => r.data),
  });

  const handleGenerate = async () => {
    setGenerating(true);
    setShowWorkflow(true);
    try {
      await reportsApi.generate({ report_type: selectedType });
      push("Enterprise compliance report generated", "success");
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    } catch (err: any) {
      push(err?.response?.data?.detail || "Failed to generate report", "error");
      setShowWorkflow(false);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await reportsApi.remove(id);
      push("Report deleted", "success");
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      if (viewingReport?.item.id === id) setViewingReport(null);
      if (expandedId === id) { setExpandedId(null); }
    } catch { push("Failed to delete report", "error"); }
  };

  const handleView = async (report: ReportItem) => {
    if (viewingReport?.item.id === report.id) { setViewingReport(null); return; }
    setExpandedId(report.id);
    setLoadingDetail(true);
    try {
      const res = await reportsApi.get(report.id);
      setViewingReport({ item: report, data: res.data });
      setExpandedId(null);
    } catch { push("Failed to load report", "error"); }
    finally { setLoadingDetail(false); }
  };

  const readyDocs = (docs ?? []).filter((d) => d.status === "ready");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-semibold flex items-center gap-2">
          <FileBarChart size={22} className="text-violet-400" /> Compliance Reports
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          AI-generated enterprise compliance reports with full audit trail, risk analysis, and recommendations.
        </p>
      </div>

      {/* Generator Panel */}
      <div className="card">
        <h2 className="font-display font-semibold mb-4 flex items-center gap-2 text-base">
          <TrendingUp size={17} className="text-violet-400" /> Generate New Report
        </h2>
        <div className="grid sm:grid-cols-3 gap-3 mb-5">
          {REPORT_TYPES.map((rt) => (
            <button
              key={rt.value}
              onClick={() => setSelectedType(rt.value)}
              className={cn(
                "text-left p-4 rounded-xl border transition-all",
                selectedType === rt.value
                  ? "border-violet-500/50 bg-violet-500/[0.08] shadow-glow"
                  : "border-white/[0.08] hover:border-white/20 bg-void-800/40"
              )}
            >
              <p className="text-sm font-semibold mb-1">{rt.label}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{rt.desc}</p>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <FileText size={13} />
            <span>{readyDocs.length} document{readyDocs.length !== 1 ? "s" : ""} ready for analysis</span>
            {readyDocs.length === 0 && <span className="text-amber-400">(upload documents first)</span>}
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating || readyDocs.length === 0}
            className="btn-primary text-sm"
          >
            {generating ? <><Loader2 size={15} className="animate-spin" /> Generating…</> : <><Plus size={15} /> Generate Report</>}
          </button>
        </div>
      </div>

      {/* Generation Workflow */}
      <AnimatePresence>
        {showWorkflow && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <GenerationWorkflow onDone={() => setShowWorkflow(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Report Viewer */}
      <AnimatePresence>
        {viewingReport && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Eye size={14} className="text-violet-400" /> Report Preview
              </h2>
              <button onClick={() => setViewingReport(null)} className="text-xs text-slate-500 hover:text-slate-200">
                ✕ Close
              </button>
            </div>
            <ReportViewer
              report={viewingReport.item}
              data={viewingReport.data}
              onClose={() => setViewingReport(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report List */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
          <Clock size={13} /> Report History
        </h2>
        {!reports || reports.length === 0 ? (
          <div className="card text-center py-16">
            <FileBarChart size={32} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">No reports yet — generate your first enterprise compliance report above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {reports.map((report, i) => (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={cn(
                  "card py-4 cursor-pointer transition-all hover:border-white/20",
                  viewingReport?.item.id === report.id && "border-violet-500/40 bg-violet-500/[0.04]"
                )}
                onClick={() => handleView(report)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-nova-gradient-soft border border-violet-500/20 flex items-center justify-center shrink-0">
                    <FileBarChart size={17} className="text-violet-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{report.title}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Clock size={10} /> {formatRelativeTime(report.created_at)}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1"><Share2 size={10} /> {report.entity_count} entities</span>
                      <span>·</span>
                      <span className="flex items-center gap-1"><AlertTriangle size={10} /> {report.risk_count} risks</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {loadingDetail && expandedId === report.id && <Loader2 size={14} className="animate-spin text-violet-400" />}
                    <span className="text-xs text-violet-400 hidden sm:block">
                      {viewingReport?.item.id === report.id ? "Close" : "Preview"}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(report.id); }}
                      className="text-slate-500 hover:text-red-400 p-1.5 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                    {viewingReport?.item.id === report.id
                      ? <ChevronDown size={15} className="text-violet-400" />
                      : <ChevronRight size={15} className="text-slate-400" />}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
