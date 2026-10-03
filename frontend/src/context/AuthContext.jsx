import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api, { TOKEN_KEY } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/session");
      if (!data) { setUser(null); return; }
      if (localStorage.getItem("bs_cache_user") !== data.user_id) {
        await queryClient.cancelQueries();
        queryClient.clear();
        localStorage.removeItem("bs_query_cache");
      }
      localStorage.setItem("bs_cache_user", data.user_id);
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const applyAuth = (data) => {
    queryClient.clear();
    localStorage.removeItem("bs_query_cache");
    localStorage.setItem("bs_cache_user", data.user.user_id);
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
    return data.user;
  };

  const value = {
    user,
    loading,
    login: async (email, password) => applyAuth((await api.post("/auth/login", { email, password })).data),
    register: async (name, email, password) => applyAuth((await api.post("/auth/register", { name, email, password })).data),
    googleLogin: async (credential) => applyAuth((await api.post("/auth/google", { credential })).data),
    logout: async () => {
      await api.post("/auth/logout").catch(() => {});
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      await queryClient.cancelQueries();
      queryClient.clear();
      ["bs_query_cache", "bs_cache_user", "bs_timer"].forEach(k => localStorage.removeItem(k));
      ["bs_lib_job", "bs_import_job"].forEach(k => sessionStorage.removeItem(k));
      window.dispatchEvent(new Event("bookshelf:logout"));
      if ("caches" in window) {
        try { await Promise.all((await caches.keys()).filter(k => k.startsWith("bookshelf-covers-")).map(k => caches.delete(k))); } catch { /* restricted storage */ }
      }
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
