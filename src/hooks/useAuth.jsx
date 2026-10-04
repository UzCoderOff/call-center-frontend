import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { dropWebPush } from "../lib/webPush";
import { api, ApiError, onUnauthorized } from "../lib/api";
import { callBridge, inApp } from "../lib/appBridge";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // checking | authed | anon | offline (the server couldn't be reached —
  // that's not the same as being signed out, so no login form for it)
  const [status, setStatus] = useState("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setStatus("authed");
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus(err instanceof ApiError && err.status === 401 ? "anon" : "offline");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setStatus("checking");
    setAttempt((n) => n + 1);
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
      await dropWebPush();
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
    <AuthContext.Provider value={{ user, status, login, logout, refreshMe, retry }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// A lawyer (not the boss): their own calendar and their own cases only.
export function isLawyerRole(role) {
  return role === "LAWYER";
}

export function isManagerRole(role) {
  return role === "BOSS" || role === "DEVELOPER";
}
