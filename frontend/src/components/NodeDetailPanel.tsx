import { motion } from "framer-motion";
import { X, Share2, ArrowRight } from "lucide-react";
import { entityColor } from "../lib/utils";

interface NodeData {
  id: string;
  label: string;
  type: string;
  degree: number;
  edges: { target: string; targetLabel: string; label: string; direction: "out" | "in" }[];
}

interface Props {
  node: NodeData | null;
  onClose: () => void;
}

export default function NodeDetailPanel({ node, onClose }: Props) {
  if (!node) return null;

  const color = entityColor(node.type);

  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: "spring", damping: 24, stiffness: 260 }}
      className="absolute top-0 right-0 w-80 h-full glass border-l border-white/[0.08] z-20 p-5 overflow-y-auto scrollbar-thin"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display font-semibold text-sm">Entity Details</h3>
        <button onClick={onClose} className="text-slate-500 hover:text-white p-1">
          <X size={16} />
        </button>
      </div>

      <div className="mb-5">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
          style={{ background: `${color}22`, border: `1.5px solid ${color}66` }}
        >
          <Share2 size={20} style={{ color }} />
        </div>
        <h4 className="font-display font-semibold text-lg mb-1">{node.label}</h4>
        <span
          className="inline-flex text-[10px] px-2 py-0.5 rounded-full"
          style={{ background: `${color}18`, color }}
        >
          {node.type}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-void-800/60 rounded-lg p-3 text-center">
          <p className="text-lg font-display font-semibold">{node.degree}</p>
          <p className="text-[10px] text-slate-500">Connections</p>
        </div>
        <div className="bg-void-800/60 rounded-lg p-3 text-center">
          <p className="text-lg font-display font-semibold">{node.edges.length}</p>
          <p className="text-[10px] text-slate-500">Relationships</p>
        </div>
      </div>

      {node.edges.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 font-medium mb-2">Relationships</p>
          <div className="space-y-2">
            {node.edges.slice(0, 20).map((edge, i) => (
              <div key={i} className="bg-void-800/40 rounded-lg p-2.5 text-xs">
                <div className="flex items-center gap-1.5 text-slate-300">
                  {edge.direction === "out" ? (
                    <>
                      <span className="font-medium truncate max-w-[80px]">{node.label}</span>
                      <ArrowRight size={10} className="text-violet-400 shrink-0" />
                      <span className="truncate max-w-[80px]">{edge.targetLabel}</span>
                    </>
                  ) : (
                    <>
                      <span className="truncate max-w-[80px]">{edge.targetLabel}</span>
                      <ArrowRight size={10} className="text-violet-400 shrink-0" />
                      <span className="font-medium truncate max-w-[80px]">{node.label}</span>
                    </>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  {edge.label.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
