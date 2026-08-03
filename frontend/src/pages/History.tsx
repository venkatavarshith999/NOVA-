import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { History as HistoryIcon, LogIn, Upload, FileBarChart, MessageSquareText, Activity, Loader2 } from "lucide-react";
import { authApi } from "../lib/api";

const ACTION_ICONS: Record<string, React.FC<any>> = {
  login: LogIn,
  signup: LogIn,
  upload_document: Upload,
  generate_report: FileBarChart,
  ask_question: MessageSquareText,
};

const ACTION_LABELS: Record<string, string> = {
  login: "Logged In",
  signup: "Signed Up",
  upload_document: "Uploaded Document",
  generate_report: "Generated Report",
  ask_question: "Asked Question",
};

export default function History() {
  const { data: activityLogs, isLoading } = useQuery({
    queryKey: ["activity"],
    queryFn: () => authApi.activity().then((res) => res.data),
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-semibold flex items-center gap-2">
          <HistoryIcon size={22} className="text-violet-400" /> User Activity History
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Review your past actions, document uploads, and generated reports.
        </p>
      </div>

      {isLoading ? (
        <div className="card py-16 flex flex-col items-center justify-center text-slate-500">
          <Loader2 size={24} className="animate-spin mb-4 text-violet-400" />
          <p className="text-sm">Loading activity history...</p>
        </div>
      ) : activityLogs?.length === 0 ? (
        <div className="card py-16 flex flex-col items-center justify-center text-slate-500">
          <Activity size={32} className="mb-4 opacity-50" />
          <p className="text-sm">No activity recorded yet.</p>
        </div>
      ) : (
        <div className="card overflow-hidden !p-0">
          <div className="divide-y divide-white/[0.06]">
            {activityLogs?.map((log) => {
              const Icon = ACTION_ICONS[log.action] || Activity;
              const label = ACTION_LABELS[log.action] || log.action;
              
              return (
                <div key={log.id} className="p-4 sm:px-6 hover:bg-white/[0.02] transition-colors flex gap-4">
                  <div className="mt-1 bg-void-800/80 p-2 rounded-xl border border-white/[0.06] shrink-0">
                    <Icon size={16} className="text-slate-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-slate-200">
                      {label}
                    </p>
                    <div className="mt-1 text-xs text-slate-400 bg-void-900/50 p-3 rounded-lg border border-white/[0.04]">
                      {log.action === "upload_document" && (
                        <span>Document: <strong className="text-slate-300 font-medium">{log.details.filename}</strong></span>
                      )}
                      {log.action === "generate_report" && (
                        <span>Report: <strong className="text-slate-300 font-medium">{log.details.title}</strong></span>
                      )}
                      {log.action === "ask_question" && (
                        <span className="italic">"{log.details.question}"</span>
                      )}
                      {(log.action === "login" || log.action === "signup") && (
                        <span>Email: {log.details.email}</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-slate-500 whitespace-nowrap">
                    {format(new Date(log.timestamp), "MMM d, h:mm a")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
