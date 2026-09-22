import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";

function CreateEmployeeModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.createEmployee({ name: name.trim(), phoneNumber: phoneNumber.trim(), username: username.trim() });
      setCredentials({ ...res.credentials, employeeId: res.employee.employeeId, name: res.employee.name });
      onCreated();
    } catch (err) {
      setError(err.body?.error === "username_taken" ? "That username is already taken." : "Couldn't create the employee.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {!credentials ? (
          <>
            <h2 className="modal-title">Add employee</h2>
            <form onSubmit={handleSubmit} className="modal-form">
              <label className="field">
                <span>Full name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              </label>
              <label className="field">
                <span>Phone number</span>
                <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required />
              </label>
              <label className="field">
                <span>Portal username</span>
                <input value={username} onChange={(e) => setUsername(e.target.value)} required />
              </label>
              {error && <p className="modal-error">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={busy}>
                  {busy ? "Creating…" : "Create employee"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h2 className="modal-title">{credentials.name} is set up</h2>
            <p className="modal-note">
              Save these now — the password won't be shown again. The device ID goes into the
              Android app; the username/password are for the web portal.
            </p>
            <div className="cred-list">
              <div className="cred-row">
                <span>Device ID</span>
                <code>{credentials.employeeId}</code>
              </div>
              <div className="cred-row">
                <span>Username</span>
                <code>{credentials.username}</code>
              </div>
              <div className="cred-row">
                <span>Temp. password</span>
                <code>{credentials.temporaryPassword}</code>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(20, 33, 61, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 50;
        }
        .modal {
          background: var(--paper-raised);
          border-radius: var(--radius-lg);
          padding: 26px;
          max-width: 400px;
          width: 100%;
          box-shadow: var(--shadow-raised);
        }
        .modal-title {
          font-size: 1.2rem;
          margin-bottom: 16px;
        }
        .modal-note {
          font-size: 0.83rem;
          color: var(--ink-soft);
          line-height: 1.5;
          margin-bottom: 16px;
        }
        .modal-form {
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
        .modal-error {
          background: var(--clay-tint);
          color: var(--clay);
          font-size: 0.8rem;
          padding: 8px 10px;
          border-radius: var(--radius-sm);
        }
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 6px;
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
        .btn-secondary {
          background: transparent;
          border: 1px solid var(--line-strong);
          padding: 10px 18px;
          border-radius: var(--radius-sm);
          font-weight: 600;
          font-size: 0.85rem;
          color: var(--ink-soft);
        }
        .cred-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .cred-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--paper-sunken);
          padding: 10px 12px;
          border-radius: var(--radius-sm);
          font-size: 0.82rem;
        }
        .cred-row span {
          color: var(--ink-soft);
          font-weight: 600;
        }
        .cred-row code {
          font-family: ui-monospace, monospace;
          font-weight: 600;
          color: var(--navy);
        }
      `}</style>
    </div>
  );
}

function CreateBossAccountModal({ onClose, onCreated }) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.createBossAccount({ username: username.trim() });
      setCredentials({ ...res.credentials });
      onCreated();
    } catch (err) {
      setError(err.body?.error === "username_taken" ? "That username is already taken." : "Couldn't create the account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {!credentials ? (
          <>
            <h2 className="modal-title">Add boss account</h2>
            <p className="modal-note">
              A boss account is a portal login only — no phone number or Android device ID, since a
              BOSS doesn't sync call data directly. They can view the team and every call, but can't
              add, remove, or manage anyone (only a DEVELOPER can).
            </p>
            <form onSubmit={handleSubmit} className="modal-form">
              <label className="field">
                <span>Portal username</span>
                <input value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
              </label>
              {error && <p className="modal-error">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={busy}>
                  {busy ? "Creating…" : "Create account"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h2 className="modal-title">Boss account is set up</h2>
            <p className="modal-note">
              Save these now — the password won't be shown again.
            </p>
            <div className="cred-list">
              <div className="cred-row">
                <span>Username</span>
                <code>{credentials.username}</code>
              </div>
              <div className="cred-row">
                <span>Temp. password</span>
                <code>{credentials.temporaryPassword}</code>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(20, 33, 61, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 50;
        }
        .modal {
          background: var(--paper-raised);
          border-radius: var(--radius-lg);
          padding: 26px;
          max-width: 400px;
          width: 100%;
          box-shadow: var(--shadow-raised);
        }
        .modal-title { font-size: 1.2rem; margin-bottom: 16px; }
        .modal-note { font-size: 0.83rem; color: var(--ink-soft); line-height: 1.5; margin-bottom: 16px; }
        .modal-form { display: flex; flex-direction: column; gap: 14px; }
        .field { display: flex; flex-direction: column; gap: 5px; }
        .field span { font-size: 0.78rem; font-weight: 600; color: var(--ink-soft); }
        .field input {
          border: 1.5px solid var(--line-strong);
          border-radius: var(--radius-sm);
          padding: 10px 11px;
          font-size: 0.9rem;
          background: var(--paper);
        }
        .field input:focus { border-color: var(--navy); outline: none; }
        .modal-error {
          background: var(--clay-tint);
          color: var(--clay);
          font-size: 0.8rem;
          padding: 8px 10px;
          border-radius: var(--radius-sm);
        }
        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }
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
        .btn-secondary {
          background: transparent;
          border: 1px solid var(--line-strong);
          padding: 10px 18px;
          border-radius: var(--radius-sm);
          font-weight: 600;
          font-size: 0.85rem;
          color: var(--ink-soft);
        }
        .cred-list { display: flex; flex-direction: column; gap: 8px; }
        .cred-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--paper-sunken);
          padding: 10px 12px;
          border-radius: var(--radius-sm);
          font-size: 0.82rem;
        }
        .cred-row span { color: var(--ink-soft); font-weight: 600; }
        .cred-row code { font-family: ui-monospace, monospace; font-weight: 600; color: var(--navy); }
      `}</style>
    </div>
  );
}

function BossAccountsSection() {
  const [bosses, setBosses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [resetCredsFor, setResetCredsFor] = useState(null);
  const [rowError, setRowError] = useState("");

  function load() {
    setLoading(true);
    api
      .bossAccounts()
      .then(setBosses)
      .catch(() => setError("Couldn't load boss accounts."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggleActive(account) {
    setRowError("");
    setBusyId(account.id);
    try {
      const updated = await api.updateBossAccount(account.id, { active: !account.active });
      setBosses((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch {
      setRowError("Couldn't update that account.");
    } finally {
      setBusyId(null);
    }
  }

  async function resetPassword(account) {
    if (!confirm(`Reset ${account.username}'s password? Their current password stops working immediately.`)) return;
    setRowError("");
    setBusyId(account.id);
    try {
      const res = await api.resetBossPassword(account.id);
      setBosses((prev) => prev.map((b) => (b.id === res.user.id ? res.user : b)));
      setResetCredsFor({ id: account.id, ...res.credentials });
    } catch {
      setRowError("Couldn't reset that account's password.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeAccount(account) {
    if (!confirm(`Remove the boss account "${account.username}" entirely? This can't be undone.`)) return;
    setRowError("");
    setBusyId(account.id);
    try {
      await api.deleteBossAccount(account.id);
      setBosses((prev) => prev.filter((b) => b.id !== account.id));
    } catch {
      setRowError("Couldn't remove that account.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="boss-section">
      <PageHeader
        title="Boss accounts"
        subtitle={`${bosses.length} account${bosses.length === 1 ? "" : "s"} · portal login only, no device sync`}
        action={
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            + Add boss account
          </button>
        }
      />

      {loading && <div className="empty-state">Loading…</div>}
      {error && <div className="empty-state">{error}</div>}
      {rowError && <p className="row-error">{rowError}</p>}

      {!loading && !error && (
        bosses.length === 0 ? (
          <div className="empty-state">No boss accounts yet.</div>
        ) : (
          <div className="boss-list">
            {bosses.map((b) => (
              <div className="boss-row" key={b.id}>
                <div className="avatar">{b.username.charAt(0).toUpperCase()}</div>
                <div className="team-main">
                  <div className="team-name">{b.username}</div>
                  <div className="team-sub">Boss</div>
                </div>
                <span className={`pw-pill ${b.passwordStatus.mustChangePassword ? "pw-temp" : "pw-set"}`}>
                  {b.passwordStatus.mustChangePassword ? "Temp password" : "Password set"}
                </span>
                <span className={`status-pill ${b.active ? "active" : "inactive"}`}>
                  {b.active ? "Active" : "Inactive"}
                </span>
                <div className="boss-actions">
                  <button className="btn-tiny" onClick={() => resetPassword(b)} disabled={busyId === b.id}>
                    Reset password
                  </button>
                  <button className="btn-tiny" onClick={() => toggleActive(b)} disabled={busyId === b.id}>
                    {b.active ? "Deactivate" : "Reactivate"}
                  </button>
                  <button className="btn-tiny btn-tiny-danger" onClick={() => removeAccount(b)} disabled={busyId === b.id}>
                    Remove
                  </button>
                </div>
                {resetCredsFor?.id === b.id && (
                  <div className="reset-cred-box">
                    <p className="hint-note">New temporary password — save it now, it won't be shown again.</p>
                    <div className="cred-row">
                      <span>Temp. password</span>
                      <code>{resetCredsFor.temporaryPassword}</code>
                    </div>
                    <button className="btn-tiny" onClick={() => setResetCredsFor(null)}>
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {showCreate && (
        <CreateBossAccountModal
          onClose={() => {
            setShowCreate(false);
            load();
          }}
          onCreated={load}
        />
      )}

      <style>{`
        .boss-section { margin-top: 34px; }
        .boss-list {
          display: flex;
          flex-direction: column;
          background: var(--paper-raised);
          border: 1px solid var(--line);
          border-radius: var(--radius-md);
          overflow: hidden;
          box-shadow: var(--shadow-card);
        }
        .boss-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 13px;
          padding: 13px 15px;
          border-bottom: 1px solid var(--line);
        }
        .boss-row:last-child { border-bottom: none; }
        .boss-actions { display: flex; gap: 8px; flex-shrink: 0; margin-left: auto; }
        .btn-tiny {
          background: transparent;
          border: 1px solid var(--line-strong);
          padding: 6px 10px;
          border-radius: var(--radius-sm);
          font-weight: 600;
          font-size: 0.74rem;
          color: var(--ink-soft);
          white-space: nowrap;
        }
        .btn-tiny:disabled { opacity: 0.5; }
        .btn-tiny-danger { color: var(--clay); border-color: var(--clay); }
        .row-error {
          color: var(--clay);
          font-size: 0.82rem;
          font-weight: 600;
          margin-bottom: 10px;
        }
        .reset-cred-box {
          width: 100%;
          margin-top: 4px;
          padding: 10px 12px;
          background: var(--paper-sunken);
          border-radius: var(--radius-sm);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .hint-note { font-size: 0.78rem; color: var(--ink-soft); }
        .cred-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.82rem;
        }
        .cred-row span { color: var(--ink-soft); font-weight: 600; }
        .cred-row code { font-family: ui-monospace, monospace; font-weight: 600; color: var(--navy); }
      `}</style>
    </div>
  );
}

export default function TeamPage() {
  const { user } = useAuth();
  const canManage = user.role === "DEVELOPER";
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  function load() {
    setLoading(true);
    api
      .employees()
      .then(setEmployees)
      .catch(() => setError("Couldn't load the team."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle={
          canManage
            ? `${employees.length} employee${employees.length === 1 ? "" : "s"}`
            : `${employees.length} employee${employees.length === 1 ? "" : "s"} · view only`
        }
        action={
          canManage && (
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              + Add employee
            </button>
          )
        }
      />

      {loading && <div className="empty-state">Loading…</div>}
      {error && <div className="empty-state">{error}</div>}

      {!loading && !error && (
        <div className="team-list">
          {employees.map((e) => (
            <Link to={`/team/${e.id}`} key={e.id} className="team-row">
              <div className="avatar">{e.name.charAt(0).toUpperCase()}</div>
              <div className="team-main">
                <div className="team-name">{e.name}</div>
                <div className="team-sub">{e.phoneNumber}</div>
              </div>
              {e.passwordStatus && (
                <span className={`pw-pill ${e.passwordStatus.mustChangePassword ? "pw-temp" : "pw-set"}`}>
                  {e.passwordStatus.mustChangePassword ? "Temp password" : "Password set"}
                </span>
              )}
              <span className={`status-pill ${e.active ? "active" : "inactive"}`}>
                {e.active ? "Active" : "Inactive"}
              </span>
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateEmployeeModal
          onClose={() => {
            setShowCreate(false);
            load();
          }}
          onCreated={load}
        />
      )}

      {canManage && <BossAccountsSection />}

      <style>{`
        .btn-primary {
          background: var(--navy);
          color: var(--paper);
          border: none;
          padding: 10px 16px;
          border-radius: var(--radius-sm);
          font-weight: 600;
          font-size: 0.85rem;
          white-space: nowrap;
        }
        .empty-state {
          padding: 40px 20px;
          text-align: center;
          color: var(--ink-soft);
          background: var(--paper-raised);
          border: 1px dashed var(--line-strong);
          border-radius: var(--radius-md);
        }
        .team-list {
          display: flex;
          flex-direction: column;
          background: var(--paper-raised);
          border: 1px solid var(--line);
          border-radius: var(--radius-md);
          overflow: hidden;
          box-shadow: var(--shadow-card);
        }
        .team-row {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 13px 15px;
          text-decoration: none;
          color: var(--ink);
          border-bottom: 1px solid var(--line);
        }
        .team-row:last-child { border-bottom: none; }
        .team-row:hover { background: var(--paper-sunken); }
        .avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: var(--navy-tint);
          color: var(--navy);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.95rem;
          flex-shrink: 0;
        }
        .team-main { flex: 1; min-width: 0; }
        .team-name { font-weight: 600; font-size: 0.92rem; }
        .team-sub { font-size: 0.78rem; color: var(--ink-soft); margin-top: 1px; }
        .status-pill {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 3px 9px;
          border-radius: 999px;
          flex-shrink: 0;
        }
        .status-pill.active { background: var(--sage-tint); color: var(--sage); }
        .status-pill.inactive { background: var(--paper-sunken); color: var(--ink-soft); }
        .pw-pill {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 3px 9px;
          border-radius: 999px;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .pw-pill.pw-temp { background: var(--brass-tint); color: var(--brass); }
        .pw-pill.pw-set { background: var(--sage-tint); color: var(--sage); }
      `}</style>
    </div>
  );
}
