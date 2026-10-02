import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api, { TOKEN_KEY } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // CRITICAL: returning from OAuth – AuthCallback exchanges the session_id first.
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh]);

  const applyAuth = (data) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
    return data.user;
  };

  const value = {
    user,
    loading,
    login: async (email, password) => applyAuth((await api.post("/auth/login", { email, password })).data),
    register: async (name, email, password) => applyAuth((await api.post("/auth/register", { name, email, password })).data),
    exchangeSession: async (session_id) => applyAuth((await api.post("/auth/session", { session_id })).data),
    logout: async () => {
      await api.post("/auth/logout").catch(() => {});
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
