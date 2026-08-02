import { Link } from "react-router-dom";
import { AlertTriangle, Home } from "lucide-react";
import Logo from "../components/Logo";
import ConstellationBackground from "../components/ConstellationBackground";

function ErrorShell({ code, title, desc }: { code: string; title: string; desc: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center relative px-6">
      <div className="absolute inset-0"><ConstellationBackground density={26} /></div>
      <div className="relative text-center max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <Logo size={28} /><span className="font-display font-semibold text-lg">Nova AI</span>
        </Link>
        <div className="w-14 h-14 rounded-2xl bg-nova-gradient-soft border border-violet-500/30 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle size={24} className="text-violet-300" />
        </div>
        <p className="font-mono text-sm text-violet-400 mb-2">{code}</p>
        <h1 className="text-2xl font-display font-semibold mb-2">{title}</h1>
        <p className="text-sm text-slate-400 mb-8">{desc}</p>
        <Link to="/" className="btn-primary inline-flex"><Home size={16} /> Back to home</Link>
      </div>
    </div>
  );
}

export function NotFound() {
  return <ErrorShell code="404" title="Page not found" desc="The page you're looking for doesn't exist or has moved." />;
}

export function ServerError() {
  return <ErrorShell code="500" title="Something went wrong" desc="An unexpected error occurred. Please try again in a moment." />;
}
