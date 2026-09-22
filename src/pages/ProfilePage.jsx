import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";

const ROLE_LABEL = {
  DEVELOPER: "Developer",
  BOSS: "Boss",
  EMPLOYEE: "Employee",
};

export default function ProfilePage() {
  const { user, refreshMe } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const justChangedTemp = user.mustChangePassword;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (newPassword.length < 8) {
      setError("New password needs to be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Those two passwords don't match.");
      return;
    }

    setBusy(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      refreshMe?.();
    } catch (err) {
      setError(
        err.status === 401
          ? "That current password isn't right."
          : err.body?.error === "password_too_short"
          ? "New password needs to be at least 8 characters."
          : "Couldn't update your password right now."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="profile">
      <PageHeader title="Profile" subtitle="Your account details and login." />

      <div className="card">
        <div className="who-row">
          <div className="who-avatar">{(user.employee?.name || user.username).charAt(0).toUpperCase()}</div>
          <div>
            <div className="who-name">{user.employee?.name || user.username}</div>
            <div className="who-meta">
              @{user.username} · <span className="role-pill">{ROLE_LABEL[user.role] || user.role}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Change password</h2>
        <p className="card-note">
          {justChangedTemp
            ? "You're still on a temporary password — set your own so it's something only you know."
            : "Change your password any time. You'll need your current one first."}
        </p>

        <form onSubmit={handleSubmit} className="pw-form">
          <label className="field">
            <span>Current password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label className="field">
            <span>New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label className="field">
            <span>Confirm new password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          {error && <p className="msg msg-error">{error}</p>}
          {success && <p className="msg msg-success">Password updated.</p>}

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .profile {
          max-width: 460px;
        }
        .card {
          background: var(--paper-raised);
          border: 1px solid var(--line);
          border-radius: var(--radius-lg);
          padding: 20px;
          box-shadow: var(--shadow-card);
          margin-bottom: 16px;
        }
        .who-row {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .who-avatar {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: var(--navy-tint);
          color: var(--navy);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.1rem;
          flex-shrink: 0;
        }
        .who-name { font-weight: 600; font-size: 1rem; }
        .who-meta { font-size: 0.82rem; color: var(--ink-soft); margin-top: 2px; }
        .role-pill {
          font-weight: 700;
          font-size: 0.7rem;
          letter-spacing: 0.02em;
          color: var(--brass);
        }
        .card-title { font-size: 1.05rem; margin-bottom: 6px; }
        .card-note {
          font-size: 0.83rem;
          color: var(--ink-soft);
          line-height: 1.5;
          margin-bottom: 16px;
        }
        .pw-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .field span {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--ink-soft);
        }
        .field input {
          border: 1.5px solid var(--line-strong);
          border-radius: var(--radius-sm);
          padding: 10px 11px;
          font-size: 0.9rem;
          background: var(--paper);
        }
        .field input:focus {
          border-color: var(--navy);
          outline: none;
        }
        .msg {
          font-size: 0.8rem;
          font-weight: 500;
          padding: 8px 10px;
          border-radius: var(--radius-sm);
        }
        .msg-error { background: var(--clay-tint); color: var(--clay); }
        .msg-success { background: var(--sage-tint); color: var(--sage); }
        .form-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 2px;
        }
        .btn-primary {
          background: var(--navy);
          color: var(--paper);
          border: none;
          padding: 10px 18px;
          border-radius: var(--radius-sm);
          font-weight: 600;
          font-size: 0.85rem;
        }
        .btn-primary:disabled { opacity: 0.6; }
      `}</style>
    </div>
  );
}
