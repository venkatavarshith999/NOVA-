import { type ReactNode, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FileStack, Share2, MessageSquareText, BarChart3, Settings,
  LogOut, Menu, X, Search, FileBarChart, GitCompareArrows, History,
} from "lucide-react";
import Logo from "./Logo";
import ConstellationBackground from "./ConstellationBackground";
import { useAuthStore } from "../store/authStore";
import { initials, cn } from "../lib/utils";
const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/documents", label: "Documents", icon: FileStack },
  { to: "/graph", label: "Knowledge Graph", icon: Share2 },
  { to: "/ask", label: "Ask Nova", icon: MessageSquareText },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/compare", label: "Compare", icon: GitCompareArrows },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex relative">
      {/* Background UI */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <ConstellationBackground density={30} />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 h-screen w-64 shrink-0 border-r border-white/[0.06] bg-void-950/80 backdrop-blur-xl z-40 transition-transform duration-200 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Logo size={24} />
            <span className="font-display font-semibold text-lg">Nova AI</span>
          </div>
          <button className="lg:hidden text-slate-400" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  isActive
                    ? "bg-nova-gradient-soft text-white border border-violet-500/30"
                    : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]"
                )
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-nova-gradient flex items-center justify-center text-xs font-semibold shrink-0">
              {user ? initials(user.full_name) : "NA"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{user?.full_name}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{user?.role}</p>
            </div>
            <button onClick={handleLogout} title="Log out" className="text-slate-500 hover:text-coral-400 transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col relative z-10">
        <header className="h-16 border-b border-white/[0.06] bg-void-900/70 backdrop-blur-xl sticky top-0 z-20 flex items-center gap-4 px-4 lg:px-8">
          <button className="lg:hidden text-slate-400" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="hidden sm:flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                placeholder="Search documents, entities, questions…"
                className="input-field pl-9 bg-void-800/60"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const q = (e.target as HTMLInputElement).value;
                    if (q.trim()) navigate(`/ask?q=${encodeURIComponent(q)}`);
                  }
                }}
              />
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
