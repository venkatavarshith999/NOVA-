import { cn } from "../lib/utils";

export default function ConfidenceMeter({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  const color = value >= 75 ? "mint" : value >= 45 ? "amber" : "coral";
  const colorClass = {
    mint: "text-mint-400 bg-mint-400",
    amber: "text-amber-400 bg-amber-400",
    coral: "text-coral-400 bg-coral-400",
  }[color];

  return (
    <div className={cn("flex items-center gap-2", size === "sm" ? "text-xs" : "text-sm")}>
      <div className={cn("relative rounded-full bg-void-700 overflow-hidden", size === "sm" ? "w-14 h-1.5" : "w-20 h-2")}>
        <div
          className={cn("h-full rounded-full transition-all duration-500", colorClass.split(" ")[1])}
          style={{ width: `${Math.min(100, Math.max(2, value))}%` }}
        />
      </div>
      <span className={cn("font-mono font-medium", colorClass.split(" ")[0])}>{value.toFixed(0)}%</span>
    </div>
  );
}
