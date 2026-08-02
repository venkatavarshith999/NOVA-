import { create } from "zustand";
import type { User } from "../lib/api";

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
}

const storedToken = localStorage.getItem("nova_token");
const storedUser = localStorage.getItem("nova_user");

export const useAuthStore = create<AuthState>((set) => ({
  token: storedToken,
  user: storedUser ? JSON.parse(storedUser) : null,
  isAuthenticated: !!storedToken,
  setAuth: (token, user) => {
    localStorage.setItem("nova_token", token);
    localStorage.setItem("nova_user", JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },
  clearAuth: () => {
    localStorage.removeItem("nova_token");
    localStorage.removeItem("nova_user");
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
