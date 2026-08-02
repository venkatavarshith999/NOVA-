import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ArrowRight } from "lucide-react";
import Logo from "../components/Logo";
import ConstellationBackground from "../components/ConstellationBackground";
import { authApi } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { useToastStore } from "../store/toastStore";

const schema = z.object({
  full_name: z.string().min(1, "Enter your full name"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type FormData = z.infer<typeof schema>;

export default function Signup() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const push = useToastStore((s) => s.push);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await authApi.signup(data);
      setAuth(res.data.access_token, res.data.user);
      push("Account created — welcome to Nova AI", "success");
      navigate("/dashboard");
    } catch (err: any) {
      if (!err?.response) {
        // Network error — backend not reachable
        push("Cannot reach the server. Make sure the backend is running on port 8000.", "error");
      } else {
        const detail = err.response.data?.detail;
        if (Array.isArray(detail)) {
          push(detail.map((d: any) => d.msg).join(", "), "error");
        } else {
          push(detail || "Signup failed. Try a different email.", "error");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative px-6 py-12">
      <div className="absolute inset-0"><ConstellationBackground density={30} /></div>
      <div className="relative w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <Logo size={30} />
          <span className="font-display font-semibold text-xl">Nova AI</span>
        </Link>
        <div className="card">
          <h1 className="text-2xl font-display font-semibold mb-1">Create your account</h1>
          <p className="text-sm text-slate-400 mb-6">Start building your compliance knowledge graph.</p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Full name</label>
              <input className="input-field" placeholder="Jordan Lee" {...register("full_name")} />
              {errors.full_name && <p className="text-xs text-coral-400 mt-1">{errors.full_name.message}</p>}
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Email</label>
              <input type="email" className="input-field" placeholder="you@company.com" {...register("email")} />
              {errors.email && <p className="text-xs text-coral-400 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Password</label>
              <input type="password" className="input-field" placeholder="At least 6 characters" {...register("password")} />
              {errors.password && <p className="text-xs text-coral-400 mt-1">{errors.password.message}</p>}
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <>Create account <ArrowRight size={16} /></>}
            </button>
          </form>
        </div>
        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account? <Link to="/login" className="text-violet-400 hover:text-violet-300">Log in</Link>
        </p>
      </div>
    </div>
  );
}
