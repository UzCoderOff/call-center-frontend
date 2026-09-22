import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("checking"); // checking | authed | anon

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setStatus("authed");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("anon");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username, password) => {
    const me = await api.login(username, password);
    setUser(me);
    setStatus("authed");
    return me;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setStatus("anon");
    }
  }, []);

  // Re-fetches the current user without a loading flicker — used after
  // changing your own password so `mustChangePassword` reflects reality
  // straight away instead of waiting for the next full page load.
  const refreshMe = useCallback(async () => {
    const me = await api.me();
    setUser(me);
    return me;
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
