import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import Logo from "../components/Logo";
import ConstellationBackground from "../components/ConstellationBackground";
import { api } from "../lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/api/auth/forgot-password", { email });
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative px-6">
      <div className="absolute inset-0"><ConstellationBackground density={30} /></div>
      <div className="relative w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <Logo size={30} />
          <span className="font-display font-semibold text-xl">Nova AI</span>
        </Link>
        <div className="card">
          {sent ? (
            <div className="text-center py-4">
              <CheckCircle2 size={36} className="text-mint-400 mx-auto mb-3" />
              <h1 className="text-xl font-display font-semibold mb-2">Check your email</h1>
              <p className="text-sm text-slate-400">If an account exists for {email}, we've sent reset instructions.</p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-display font-semibold mb-1">Reset your password</h1>
              <p className="text-sm text-slate-400 mb-6">Enter your email and we'll send reset instructions.</p>
              <form onSubmit={onSubmit} className="space-y-4">
                <input
                  type="email" required className="input-field" placeholder="you@company.com"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                />
                <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <>Send instructions <ArrowRight size={16} /></>}
                </button>
              </form>
            </>
          )}
        </div>
        <p className="text-center text-sm text-slate-500 mt-6">
          <Link to="/login" className="text-violet-400 hover:text-violet-300">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
