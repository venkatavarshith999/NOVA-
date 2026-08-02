import { cn } from "../lib/utils";

const SEVERITY_STYLES = {
  high: "bg-red-500/15 text-red-400 border-red-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const SEVERITY_DOT = {
  high: "bg-red-400",
  medium: "bg-amber-400",
  low: "bg-blue-400",
};

export default function RiskBadge({ severity, className }: { severity: "high" | "medium" | "low"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border", SEVERITY_STYLES[severity], className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", SEVERITY_DOT[severity])} />
      {severity}
    </span>
  );
}
