import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { useToastStore } from "../store/toastStore";

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };
const COLORS = {
  success: "text-mint-400 border-mint-400/30",
  error: "text-coral-400 border-coral-400/30",
  info: "text-azure-400 border-azure-400/30",
};

export default function ToastHost() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 w-80">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              className={`glass rounded-xl p-3.5 flex items-start gap-3 border ${COLORS[t.kind]} shadow-lg`}
            >
              <Icon size={18} className="shrink-0 mt-0.5" />
              <p className="text-sm text-slate-200 flex-1">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="text-slate-500 hover:text-slate-300">
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
