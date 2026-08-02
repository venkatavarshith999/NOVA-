import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line, CartesianGrid, RadialBarChart, RadialBar,
} from "recharts";
import { Shield, TrendingUp, FileStack, Share2 } from "lucide-react";
import { analyticsApi, complianceApi } from "../lib/api";
import { entityColor } from "../lib/utils";
import AnimatedCounter from "../components/AnimatedCounter";
import RiskBadge from "../components/RiskBadge";

const TOOLTIP_STYLE = { background: "#12162a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 };

export default function Analytics() {
  const { data } = useQuery({ queryKey: ["analytics"], queryFn: () => analyticsApi.get().then((r) => r.data) });
  const { data: risks } = useQuery({ queryKey: ["risks"], queryFn: () => complianceApi.risks().then((r) => r.data) });

  const entityData = Object.entries(data?.entity_distribution ?? {}).map(([name, value]) => ({ name, value }));
  const relData = Object.entries(data?.relationship_distribution ?? {}).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  const docTypeData = Object.entries(data?.document_type_distribution ?? {}).map(([name, value]) => ({ name, value }));
  const activityData = data?.daily_activity ?? [];

  const complianceScore = risks?.compliance_score ?? 0;
  const radialData = [{ name: "Score", value: complianceScore, fill: complianceScore >= 75 ? "#34d399" : complianceScore >= 45 ? "#fbbf24" : "#fb7185" }];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold">Analytics</h1>
        <p className="text-sm text-slate-400 mt-1">Insights across your document library and knowledge graph.</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Documents", value: data?.total_documents ?? 0, icon: FileStack },
          { label: "Graph Nodes", value: data?.total_nodes ?? 0, icon: Share2 },
          { label: "Relationships", value: data?.total_relationships ?? 0, icon: TrendingUp },
          { label: "Questions", value: data?.total_questions ?? 0, icon: TrendingUp },
          { label: "Avg Confidence", value: data?.average_confidence ?? 0, suffix: "%" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card py-4"
          >
            <p className="text-2xl font-display font-semibold">
              <AnimatedCounter value={s.value} />{s.suffix ?? ""}
            </p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Compliance Score + Risk summary */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card flex items-center gap-6">
          <div className="w-32 h-32 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" startAngle={90} endAngle={-270} data={radialData}>
                <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "#1a1f38" }} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-3xl font-display font-semibold">
              {complianceScore.toFixed(0)}%
            </p>
            <p className="text-sm text-slate-400 mt-1">Compliance Score</p>
            <p className="text-xs text-slate-500 mt-2">
              Based on {risks?.total_risks ?? 0} identified risk{(risks?.total_risks ?? 0) !== 1 ? "s" : ""} across your knowledge graph.
            </p>
          </div>
        </div>

        <div className="card">
          <h2 className="font-display font-semibold mb-3 flex items-center gap-2">
            <Shield size={16} className="text-violet-400" />
            Risk Breakdown
          </h2>
          {!risks || risks.total_risks === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No risks detected</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                  <p className="text-xl font-display font-semibold text-red-400">{risks.high_count}</p>
                  <p className="text-[10px] text-slate-500">High</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
                  <p className="text-xl font-display font-semibold text-amber-400">{risks.medium_count}</p>
                  <p className="text-[10px] text-slate-500">Medium</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                  <p className="text-xl font-display font-semibold text-blue-400">{risks.low_count}</p>
                  <p className="text-[10px] text-slate-500">Low</p>
                </div>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto scrollbar-thin">
                {risks.risks.slice(0, 4).map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs">
                    <RiskBadge severity={r.severity} />
                    <span className="text-slate-300 truncate">{r.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-display font-semibold mb-4">Entity Distribution</h2>
          {entityData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={entityData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {entityData.map((d) => <Cell key={d.name} fill={entityColor(d.name)} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            {entityData.map((d) => (
              <span key={d.name} className="text-[10px] px-2 py-1 rounded-full flex items-center gap-1.5" style={{ background: `${entityColor(d.name)}18`, color: entityColor(d.name) }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: entityColor(d.name) }} /> {d.name} ({d.value})
              </span>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="font-display font-semibold mb-4">Relationship Distribution</h2>
          {relData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={relData} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} width={90} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h2 className="font-display font-semibold mb-4">Document Types</h2>
          {docTypeData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={docTypeData}>
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h2 className="font-display font-semibold mb-4">Daily Question Activity</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={activityData}>
              <CartesianGrid stroke="#1a1f38" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false}
                     tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="questions" stroke="#22d3ee" strokeWidth={2} dot={{ fill: "#22d3ee", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function EmptyChart() {
  return <div className="h-56 flex items-center justify-center text-sm text-slate-500">No data yet</div>;
}
