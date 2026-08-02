import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { User, Palette, History, Bookmark, Bell, Cpu, Webhook } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { ragApi, authApi } from "../lib/api";
import ConfidenceMeter from "../components/ConfidenceMeter";
import { formatRelativeTime, initials, cn } from "../lib/utils";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "history", label: "History", icon: History },
  { id: "bookmarks", label: "Bookmarks", icon: Bookmark },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "automations", label: "Automations", icon: Webhook },
  { id: "model", label: "AI Model", icon: Cpu },
];

export default function Settings() {
  const [tab, setTab] = useState("profile");
  const user = useAuthStore((s) => s.user);

  const { data: history } = useQuery({ queryKey: ["history"], queryFn: () => ragApi.history().then((r) => r.data), enabled: tab === "history" });
  const { data: bookmarks } = useQuery({ queryKey: ["bookmarks"], queryFn: () => ragApi.bookmarks().then((r) => r.data), enabled: tab === "bookmarks" });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your profile, preferences, and saved items.</p>
      </div>

      <div className="flex gap-6">
        <div className="w-48 shrink-0 space-y-1">
          {TABS.map((t) => (
            <button
              key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors",
                tab === t.id ? "bg-nova-gradient-soft text-white border border-violet-500/30" : "text-slate-400 hover:bg-white/[0.04]"
              )}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          {tab === "profile" && (
            <div className="card space-y-5 max-w-lg">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-nova-gradient flex items-center justify-center text-xl font-semibold">
                  {user ? initials(user.full_name) : "NA"}
                </div>
                <div>
                  <p className="font-medium">{user?.full_name}</p>
                  <p className="text-sm text-slate-500 capitalize">{user?.role}</p>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Full name</label>
                <input className="input-field" defaultValue={user?.full_name} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Email</label>
                <input className="input-field" defaultValue={user?.email} disabled />
              </div>
              <button className="btn-primary text-sm">Save changes</button>
            </div>
          )}

          {tab === "appearance" && (
            <div className="card space-y-5 max-w-lg">
              <div>
                <p className="text-sm font-medium mb-2">Theme</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border-2 border-violet-500 bg-void-800 p-4 text-center cursor-pointer">
                    <div className="w-full h-12 rounded-lg bg-nova-radial mb-2" />
                    <p className="text-sm">Dark (default)</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center cursor-not-allowed opacity-50">
                    <div className="w-full h-12 rounded-lg bg-slate-200 mb-2" />
                    <p className="text-sm">Light — coming soon</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Language</label>
                <select className="input-field">
                  <option>English (US)</option>
                  <option disabled>More languages coming soon</option>
                </select>
              </div>
            </div>
          )}

          {tab === "history" && (
            <div className="card">
              {!history || history.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No question history yet.</p>
              ) : (
                <div className="space-y-3">
                  {history.map((h) => (
                    <div key={h.question_id} className="pb-3 border-b border-white/[0.05] last:border-0">
                      <p className="text-sm">{h.question}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs text-slate-500">{formatRelativeTime(h.created_at)}</span>
                        {h.confidence != null && <ConfidenceMeter value={h.confidence} size="sm" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "bookmarks" && (
            <div className="card">
              {!bookmarks || bookmarks.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No bookmarked answers yet. Bookmark answers from the Ask page.</p>
              ) : (
                <div className="space-y-3">
                  {bookmarks.map((h) => (
                    <div key={h.question_id} className="pb-3 border-b border-white/[0.05] last:border-0">
                      <p className="text-sm font-medium">{h.question}</p>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{h.answer}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "notifications" && (
            <div className="card space-y-4 max-w-lg">
              {["Document processing complete", "Weekly analytics digest", "New compliance risk detected"].map((label) => (
                <label key={label} className="flex items-center justify-between py-2">
                  <span className="text-sm">{label}</span>
                  <input type="checkbox" defaultChecked className="accent-violet-500 w-4 h-4" />
                </label>
              ))}
            </div>
          )}

          {tab === "automations" && (
            <div className="card space-y-5 max-w-lg">
              <div>
                <h3 className="font-medium text-lg mb-1 flex items-center gap-2">
                  <Webhook size={18} className="text-violet-400" /> n8n Integration
                </h3>
                <p className="text-sm text-slate-400">
                  Connect your n8n cloud workflows. Nova AI will automatically trigger this webhook 
                  when important events occur (e.g., a Compliance Report is generated), sending the 
                  full data payload directly to your automation workflow.
                </p>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Webhook URL</label>
                <input 
                  id="n8n_webhook"
                  className="input-field font-mono text-sm" 
                  placeholder="https://your-instance.n8n.cloud/webhook/..."
                  defaultValue={user?.n8n_webhook_url || ""}
                />
              </div>
              <button 
                className="btn-primary text-sm"
                onClick={async () => {
                  const url = (document.getElementById("n8n_webhook") as HTMLInputElement).value;
                  try {
                    const res = await authApi.updateProfile({ n8n_webhook_url: url });
                    useAuthStore.getState().updateUser(res.data);
                    alert("Webhook saved successfully! Nova AI will now send report events to this URL.");
                  } catch (e) {
                    alert("Failed to save webhook");
                  }
                }}
              >
                Save Integration
              </button>
            </div>
          )}

          {tab === "model" && (
            <div className="card space-y-4 max-w-lg">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Generation model</label>
                <select className="input-field">
                  <option>Gemini 2.5 Flash</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Embedding model</label>
                <select className="input-field">
                  <option>Gemini text-embedding-004</option>
                </select>
              </div>
              <p className="text-xs text-slate-500">
                Configure <code className="text-violet-300">GEMINI_API_KEY</code> in the backend .env to enable live Gemini
                calls. Without it, Nova AI automatically uses a local heuristic pipeline so the product stays fully demoable.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
