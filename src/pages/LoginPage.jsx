import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(
        err.status === 401
          ? "That username or password isn't right."
          : "Couldn't reach the server. Try again in a moment."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-panel">
        <div className="login-mark">
          <span className="login-mark-word">Ledger</span>
          <span className="login-mark-sub">Call Center Portal</span>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="field">
            <span>Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="login-submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      <style>{`
        .login {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--navy);
          padding: 24px;
          position: relative;
        }
        .login::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(600px 400px at 15% 10%, rgba(176, 137, 71, 0.14), transparent 60%),
            radial-gradient(500px 380px at 85% 90%, rgba(176, 137, 71, 0.10), transparent 60%);
          pointer-events: none;
        }
        .login-panel {
          position: relative;
          width: 100%;
          max-width: 380px;
          background: var(--paper-raised);
          border-radius: var(--radius-lg);
          padding: 36px 30px 30px;
          box-shadow: var(--shadow-raised);
        }
        .login-mark {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          margin-bottom: 30px;
        }
        .login-mark-word {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 1.7rem;
          color: var(--navy);
        }
        .login-mark-sub {
          font-size: 0.78rem;
          color: var(--ink-soft);
          font-weight: 500;
          letter-spacing: 0.02em;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .field span {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--ink-soft);
        }
        .field input {
          border: 1.5px solid var(--line-strong);
          border-radius: var(--radius-sm);
          padding: 11px 12px;
          font-size: 0.95rem;
          background: var(--paper);
          transition: border-color 0.15s ease;
        }
        .field input:focus {
          border-color: var(--navy);
          outline: none;
        }
        .login-error {
          background: var(--clay-tint);
          color: var(--clay);
          font-size: 0.82rem;
          font-weight: 500;
          padding: 9px 11px;
          border-radius: var(--radius-sm);
        }
        .login-submit {
          background: var(--navy);
          color: var(--paper);
          border: none;
          border-radius: var(--radius-sm);
          padding: 12px;
          font-size: 0.92rem;
          font-weight: 600;
          margin-top: 6px;
          transition: background 0.15s ease;
        }
        .login-submit:hover:not(:disabled) {
          background: var(--navy-soft);
        }
        .login-submit:disabled {
          opacity: 0.6;
          cursor: default;
        }
      `}</style>
    </div>
  );
}
