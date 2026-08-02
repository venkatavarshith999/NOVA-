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
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type FormData = z.infer<typeof schema>;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const push = useToastStore((s) => s.push);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await authApi.login(data);
      setAuth(res.data.access_token, res.data.user);
      push(`Welcome back, ${res.data.user.full_name.split(" ")[0]}`, "success");
      navigate("/dashboard");
    } catch (err: any) {
      if (!err?.response) {
        push("Cannot reach the server. Make sure the backend is running on port 8000.", "error");
      } else {
        push(err.response.data?.detail || "Login failed. Check your credentials.", "error");
      }
    } finally {
      setLoading(false);
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
          <h1 className="text-2xl font-display font-semibold mb-1">Welcome back</h1>
          <p className="text-sm text-slate-400 mb-6">Log in to access your knowledge graph.</p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Email</label>
              <input type="email" className="input-field" placeholder="you@company.com" {...register("email")} />
              {errors.email && <p className="text-xs text-coral-400 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Password</label>
              <input type="password" className="input-field" placeholder="••••••••" {...register("password")} />
              {errors.password && <p className="text-xs text-coral-400 mt-1">{errors.password.message}</p>}
              <div className="text-right mt-1.5">
                <Link to="/forgot-password" className="text-xs text-violet-400 hover:text-violet-300">Forgot password?</Link>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <>Log in <ArrowRight size={16} /></>}
            </button>
          </form>
        </div>
        <p className="text-center text-sm text-slate-500 mt-6">
          Don't have an account? <Link to="/signup" className="text-violet-400 hover:text-violet-300">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
