import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, ApiError, onUnauthorized } from "../lib/api";
import { callBridge, inApp } from "../lib/appBridge";

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

  // Any 401 later on (expired session, deactivated account) sends the
  // person back to the login screen instead of leaving every page stuck
  // on "couldn't load".
  useEffect(() => {
    onUnauthorized(() => {
      setUser(null);
      setStatus("anon");
    });
    return () => onUnauthorized(null);
  }, []);

  const login = useCallback(async (username, password) => {
    await api.login(username, password);
    // Don't trust the login response alone: confirm the browser actually
    // kept the session cookie by making an authenticated request with it.
    // If it didn't, say so plainly rather than "logging in" to a portal
    // where every page then fails.
    let me;
    try {
      me = await api.me();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) throw new ApiError("cookie_not_saved", 401, null);
      throw err;
    }
    setUser(me);
    setStatus("authed");
    return me;
  }, []);

  const logout = useCallback(async () => {
    // Inside the Android app, signing out means signing the phone out: the
    // app revokes its device token and returns to its own sign-in screen.
    if (inApp) {
      callBridge("logout");
      return;
    }
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
    <AuthContext.Provider value={{ user, status, login, logout, refreshMe }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function isManagerRole(role) {
  return role === "BOSS" || role === "DEVELOPER";
}
