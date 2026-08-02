import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Send, Loader2, Copy, RotateCcw, Bookmark, FileText, Sparkles, MessageSquareText, Settings, X
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { ragApi, type AskResponse } from "../lib/api";
import ConfidenceMeter from "../components/ConfidenceMeter";
import { useToastStore } from "../store/toastStore";
import { cn } from "../lib/utils";

interface ChatTurn {
  id: string;
  question: string;
  response?: AskResponse;
  loading?: boolean;
}

const SUGGESTED = [
  "What encryption standard protects customer data at rest?",
  "Which department approves access to customer records?",
  "What regulations does our data retention policy comply with?",
  "Summarize the security controls mentioned across my documents.",
];

function TypingText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(interval);
    }, 10); // typing speed
    return () => clearInterval(interval);
  }, [text]);

  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown>{displayed}</ReactMarkdown>
    </div>
  );
}

export default function Ask() {
  const [params] = useSearchParams();
  const [input, setInput] = useState(params.get("q") ?? "");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [llmProvider, setLlmProvider] = useState(() => localStorage.getItem("nova_llm_provider") || "gemini");
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("nova_api_key") || "");
  const scrollRef = useRef<HTMLDivElement>(null);
  const push = useToastStore((s) => s.push);
  const queryClient = useQueryClient();

  const { data: history } = useQuery({ queryKey: ["history"], queryFn: () => ragApi.history().then((r) => r.data) });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const submit = async (question: string) => {
    if (!question.trim()) return;
    const id = Math.random().toString(36).slice(2);
    setTurns((t) => [...t, { id, question, loading: true }]);
    setInput("");
    try {
      const res = await ragApi.ask(question, undefined, llmProvider, apiKey);
      setTurns((t) => t.map((turn) => (turn.id === id ? { ...turn, response: res.data, loading: false } : turn)));
      queryClient.invalidateQueries({ queryKey: ["history"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    } catch (err: any) {
      push(err?.response?.data?.detail || "Failed to get an answer", "error");
      setTurns((t) => t.filter((turn) => turn.id !== id));
    }
  };

  const handleBookmark = async (questionId: string) => {
    try {
      await ragApi.bookmark(questionId);
      push("Saved to bookmarks", "success");
    } catch {
      push("Failed to bookmark", "error");
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold flex items-center gap-2">
            <Sparkles size={20} className="text-violet-400" /> Ask Nova
          </h1>
          <p className="text-sm text-slate-400 mt-1">Every answer is grounded in your uploaded documents with citations.</p>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-lg bg-void-800/60 hover:bg-void-700/60 border border-white/[0.06] text-slate-400 transition-colors"
          title="Configure AI Engine"
        >
          <Settings size={18} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin space-y-6 pr-1 pb-4">
        {turns.length === 0 && (
          <div className="card">
            <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
              <MessageSquareText size={16} /> Try asking
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s} onClick={() => submit(s)}
                  className="text-left text-sm p-3 rounded-lg bg-void-800/60 hover:bg-void-700/60 border border-white/[0.06] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
            {history && history.length > 0 && (
              <div className="mt-6 pt-4 border-t border-white/[0.06]">
                <p className="text-xs text-slate-500 mb-2">Recent questions</p>
                <div className="flex flex-wrap gap-2">
                  {history.slice(0, 5).map((h) => (
                    <button
                      key={h.question_id} onClick={() => submit(h.question)}
                      className="text-xs px-3 py-1.5 rounded-full bg-void-800/60 hover:bg-void-700/60 border border-white/[0.06] text-slate-400"
                    >
                      {h.question.length > 40 ? h.question.slice(0, 40) + "…" : h.question}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {turns.map((turn) => (
          <div key={turn.id} className="space-y-3">
            <div className="flex justify-end">
              <div className="bg-nova-gradient rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm max-w-lg">{turn.question}</div>
            </div>
            {turn.loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 size={15} className="animate-spin" /> Searching graph & documents…
              </div>
            ) : turn.response ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl rounded-tl-sm p-4 max-w-2xl space-y-3">
                <div className="text-sm text-slate-100 leading-relaxed overflow-hidden">
                  <TypingText text={turn.response.answer} />
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-white/[0.06]">
                  <ConfidenceMeter value={turn.response.confidence} />
                  <div className="flex items-center gap-1">
                    <button onClick={() => { navigator.clipboard.writeText(turn.response!.answer); push("Copied", "success"); }} className="text-slate-500 hover:text-slate-200 p-1.5" title="Copy">
                      <Copy size={14} />
                    </button>
                    <button onClick={() => submit(turn.question)} className="text-slate-500 hover:text-slate-200 p-1.5" title="Regenerate">
                      <RotateCcw size={14} />
                    </button>
                    <button onClick={() => handleBookmark(turn.response!.question_id)} className="text-slate-500 hover:text-amber-400 p-1.5" title="Bookmark">
                      <Bookmark size={14} />
                    </button>
                  </div>
                </div>

                {turn.response.citations.length > 0 && (
                  <div className="pt-2 border-t border-white/[0.06] space-y-2">
                    <p className="text-xs text-slate-500 font-medium">Sources</p>
                    {turn.response.citations.map((c, i) => (
                      <div key={c.chunk_id + i} className="flex items-start gap-2 text-xs bg-void-800/50 rounded-lg p-2.5">
                        <FileText size={13} className="text-violet-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-slate-300 font-medium truncate">{c.filename}{c.page ? ` · page ${c.page}` : ""}</p>
                          <p className="text-slate-500 mt-0.5 line-clamp-2">{c.snippet}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {turn.response.related_entities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {turn.response.related_entities.slice(0, 8).map((e) => (
                      <span key={e.id} className="text-[10px] px-2 py-0.5 rounded-full bg-void-700 text-slate-400">{e.label}</span>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : null}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); submit(input); }}
        className="flex items-center gap-2 glass rounded-2xl p-2 mt-2"
      >
        <input
          value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a compliance question…"
          className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-500"
        />
        <button type="submit" className={cn("btn-primary !px-3 !py-2", !input.trim() && "opacity-50")} disabled={!input.trim()}>
          <Send size={16} />
        </button>
      </form>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-void-900 border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Settings size={18} className="text-violet-400" /> AI Engine Configuration
              </h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white p-1">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-5 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">LLM Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setLlmProvider("gemini")}
                    className={cn(
                      "p-3 rounded-xl border text-sm font-semibold transition-all flex flex-col items-center gap-1",
                      llmProvider === "gemini" ? "bg-violet-500/10 border-violet-500 text-violet-300" : "bg-void-800/40 border-white/[0.06] text-slate-400 hover:bg-void-800"
                    )}
                  >
                    Google Gemini
                  </button>
                  <button
                    onClick={() => setLlmProvider("openai")}
                    className={cn(
                      "p-3 rounded-xl border text-sm font-semibold transition-all flex flex-col items-center gap-1",
                      llmProvider === "openai" ? "bg-emerald-500/10 border-emerald-500 text-emerald-300" : "bg-void-800/40 border-white/[0.06] text-slate-400 hover:bg-void-800"
                    )}
                  >
                    OpenAI GPT-4o
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">API Key (Optional)</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={`Enter your ${llmProvider === "gemini" ? "Gemini" : "OpenAI"} API Key`}
                  className="input w-full"
                />
                <p className="text-xs text-slate-500">
                  If left blank, the system will use the default server-configured key. Your key is stored securely in your browser's local storage.
                </p>
              </div>
            </div>

            <div className="p-5 border-t border-white/[0.06] flex justify-end gap-3 bg-void-800/30">
              <button onClick={() => setShowSettings(false)} className="btn-secondary">Cancel</button>
              <button
                onClick={() => {
                  localStorage.setItem("nova_llm_provider", llmProvider);
                  localStorage.setItem("nova_api_key", apiKey);
                  setShowSettings(false);
                  push("AI settings saved", "success");
                }}
                className="btn-primary"
              >
                Save Changes
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
