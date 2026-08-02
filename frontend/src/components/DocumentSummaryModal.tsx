import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, FileText, Share2, ArrowRight, Sparkles } from "lucide-react";
import { documentsApi, type DocumentSummaryResponse } from "../lib/api";
import { entityColor } from "../lib/utils";

interface Props {
  documentId: string;
  filename: string;
  open: boolean;
  onClose: () => void;
}

export default function DocumentSummaryModal({ documentId, filename, open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DocumentSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await documentsApi.summary(documentId);
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to generate summary");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-2xl max-h-[80vh] overflow-y-auto glass rounded-2xl p-6 scrollbar-thin"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-violet-400" />
              <h2 className="font-display font-semibold text-lg">AI Summary</h2>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white p-1">
              <X size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-4 text-sm text-slate-400">
            <FileText size={14} />
            <span className="truncate">{filename}</span>
          </div>

          {!data && !loading && !error && (
            <div className="text-center py-10">
              <Sparkles size={32} className="mx-auto text-violet-400 mb-4" />
              <p className="text-slate-300 mb-2">Generate an AI-powered summary of this document</p>
              <p className="text-xs text-slate-500 mb-6">Nova AI will analyze the content and extract key compliance insights</p>
              <button onClick={generate} className="btn-primary">
                <Sparkles size={15} /> Generate Summary
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-16">
              <Loader2 size={28} className="mx-auto text-violet-400 animate-spin mb-4" />
              <p className="text-sm text-slate-400">Analyzing document content…</p>
              <div className="w-48 h-1 bg-void-700 rounded-full mx-auto mt-4 overflow-hidden">
                <motion.div
                  className="h-full bg-nova-gradient"
                  initial={{ width: "0%" }}
                  animate={{ width: "85%" }}
                  transition={{ duration: 3, ease: "easeOut" }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="text-center py-10">
              <p className="text-coral-400 text-sm mb-4">{error}</p>
              <button onClick={generate} className="btn-secondary text-sm">Try again</button>
            </div>
          )}

          {data && (
            <div className="space-y-5">
              <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {data.summary}
              </div>

              <div className="text-xs text-slate-500">
                {data.word_count.toLocaleString()} words analyzed
              </div>

              {data.key_entities.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                    <Share2 size={12} /> Key Entities
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.key_entities.map((e) => (
                      <span
                        key={e.name}
                        className="text-[10px] px-2 py-1 rounded-full border"
                        style={{
                          background: `${entityColor(e.type)}15`,
                          borderColor: `${entityColor(e.type)}40`,
                          color: entityColor(e.type),
                        }}
                      >
                        {e.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {data.key_relationships.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                    <ArrowRight size={12} /> Key Relationships
                  </div>
                  <div className="space-y-1">
                    {data.key_relationships.slice(0, 8).map((r, i) => (
                      <div key={i} className="text-xs text-slate-400 flex items-center gap-1.5">
                        <span className="text-slate-300">{r.source}</span>
                        <span className="text-violet-400">{r.relation.replace(/_/g, " ")}</span>
                        <span className="text-slate-300">{r.target}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
