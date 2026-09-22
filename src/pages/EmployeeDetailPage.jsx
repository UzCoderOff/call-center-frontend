import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import { formatDuration, formatDateTime, rangePreset } from "../lib/format";
import StatCard from "../components/StatCard";

function SliceTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  return (
    <div className="slice-tooltip">
      <span className="dot" style={{ background: row.payload.fill }} />
      {row.name}: {row.value}
    </div>
  );
}

function AnsweredMissedPie({ answered, missed }) {
  const data = [
    { name: "Answered", value: answered, fill: "var(--sage)" },
    { name: "Missed", value: missed, fill: "var(--clay)" },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return <div className="pie-empty">No calls in this period yet.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip content={<SliceTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canManage = user.role === "DEVELOPER";

  const [employee, setEmployee] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState(null);
  const [resetCreds, setResetCreds] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  function load() {
    api
      .employee(id)
      .then(setEmployee)
      .catch(() => setError("Couldn't load this employee."));
    const { from, to } = rangePreset("30d");
    api
      .dashboard({ from, to })
      .then((d) => {
        const row = d.employees?.find((e) => String(e.employeeId) === String(id));
        setStats(row || null);
      })
      .catch(() => {});
  }

  useEffect(load, [id]);

  async function toggleActive() {
    setBusy(true);
    try {
      const updated = await api.updateEmployee(id, { active: !employee.active });
      setEmployee(updated);
    } catch {
      setError("Couldn't update this employee.");
    } finally {
      setBusy(false);
    }
  }

  async function regenerateId() {
    if (!confirm("This invalidates the current device ID immediately. The employee's Android app will stop syncing until it's reconfigured. Continue?")) return;
    setBusy(true);
    try {
      const updated = await api.regenerateDeviceId(id);
      setEmployee(updated);
      setNewDeviceId(updated.employeeId);
    } catch {
      setError("Couldn't regenerate the device ID.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!confirm(`Reset ${employee.name}'s portal password? Their current password stops working immediately.`)) return;
    setBusy(true);
    try {
      const res = await api.resetEmployeePassword(id);
      setEmployee(res.employee);
      setResetCreds(res.credentials);
    } catch {
      setError("Couldn't reset this employee's password.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteEmployee() {
    if (!confirm(`Remove ${employee.name} entirely? This can't be undone.`)) return;
    setDeleteError("");
    setBusy(true);
    try {
      await api.deleteEmployee(id);
      window.location.href = "/team";
    } catch (err) {
      setDeleteError(
        err.body?.error === "has_call_history"
          ? "This employee has call history on record — deactivate them instead of deleting."
          : "Couldn't remove this employee."
      );
    } finally {
      setBusy(false);
    }
  }

  if (error) return <div className="empty-state">{error}</div>;
  if (!employee) return <div className="empty-state">Loading…</div>;

  const missRate = stats && stats.totalCalls ? Math.round((stats.missedCalls / stats.totalCalls) * 100) : 0;

  return (
    <div className="detail">
      <Link to="/team" className="back-link">
        ← Team
      </Link>

      <div className="head-card">
        <div className="avatar-lg">{employee.name.charAt(0).toUpperCase()}</div>
        <div>
          <h1 className="emp-name">{employee.name}</h1>
          <p className="emp-sub">{employee.phoneNumber} · @{employee.username || "no login"}</p>
        </div>
        <span className={`status-pill ${employee.active ? "active" : "inactive"}`}>
          {employee.active ? "Active" : "Inactive"}
        </span>
      </div>

      {stats && (
        <>
          <div className="stat-grid">
            <StatCard label="Calls (30d)" value={stats.totalCalls} tone="navy" />
            <StatCard label="Answered" value={stats.answeredCalls} tone="sage" />
            <StatCard label="Missed" value={stats.missedCalls} tone="clay" sub={`${missRate}% miss rate`} />
            <StatCard label="Talk time" value={formatDuration(stats.totalTalkTimeSeconds)} tone="brass" />
          </div>

          <div className="pie-card">
            <h2 className="actions-title">Answered vs. missed (30 days)</h2>
            <AnsweredMissedPie answered={stats.answeredCalls} missed={stats.missedCalls} />
            <div className="legend">
              <span><i className="sw sage" />Answered</span>
              <span><i className="sw clay" />Missed</span>
            </div>
          </div>
        </>
      )}

      <div className="actions-card">
        <h2 className="actions-title">Device</h2>
        <div className="device-row">
          <span>Device ID</span>
          <code>{newDeviceId || employee.employeeId}</code>
        </div>
        {newDeviceId && (
          <p className="hint-note">New ID generated — update the Android app on this employee's phone.</p>
        )}
        {canManage ? (
          <div className="actions-row">
            <button className="btn-secondary" onClick={regenerateId} disabled={busy}>
              Regenerate device ID
            </button>
            <button className={employee.active ? "btn-danger" : "btn-primary"} onClick={toggleActive} disabled={busy}>
              {employee.active ? "Deactivate" : "Reactivate"}
            </button>
          </div>
        ) : (
          <p className="hint-note view-only-note">Only a developer account can change device or active status.</p>
        )}
      </div>

      {canManage && (
        <div className="actions-card">
          <h2 className="actions-title">Account</h2>
          {employee.passwordStatus ? (
            <div className="device-row">
              <span>Password</span>
              <span className={`pw-pill ${employee.passwordStatus.mustChangePassword ? "pw-temp" : "pw-set"}`}>
                {employee.passwordStatus.mustChangePassword
                  ? "Still on temporary password"
                  : `Changed ${formatDateTime(new Date(employee.passwordStatus.passwordChangedAt).getTime())}`}
              </span>
            </div>
          ) : (
            <p className="hint-note">This employee has no portal login.</p>
          )}

          {resetCreds && (
            <div className="cred-box">
              <p className="hint-note">
                New temporary password — save it now, it won't be shown again.
              </p>
              <div className="device-row">
                <span>Username</span>
                <code>{resetCreds.username}</code>
              </div>
              <div className="device-row">
                <span>Temp. password</span>
                <code>{resetCreds.temporaryPassword}</code>
              </div>
            </div>
          )}

          {employee.username && (
            <div className="actions-row">
              <button className="btn-secondary" onClick={resetPassword} disabled={busy}>
                Reset password
              </button>
            </div>
          )}

          <div className="danger-zone">
            <p className="hint-note">
              Removing an employee is permanent and only works if they have no call history yet — deactivate them instead once they've taken calls.
            </p>
            {deleteError && <p className="hint-note error-note">{deleteError}</p>}
            <button className="btn-danger" onClick={deleteEmployee} disabled={busy}>
              Remove employee
            </button>
          </div>
        </div>
      )}

      <Link to={`/calls?employeeId=${employee.id}`} className="view-calls-link">
        View all calls →
      </Link>

      <style>{`
        .back-link {
          display: inline-block;
          margin-bottom: 14px;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--navy);
          text-decoration: none;
        }
        .back-link:hover { text-decoration: underline; }
        .head-card {
          display: flex;
          align-items: center;
          gap: 14px;
          background: var(--paper-raised);
          border: 1px solid var(--line);
          border-radius: var(--radius-lg);
          padding: 20px;
          box-shadow: var(--shadow-card);
          margin-bottom: 18px;
          max-width: 640px;
        }
        .avatar-lg {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: var(--navy-tint);
          color: var(--navy);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.3rem;
          flex-shrink: 0;
        }
        .emp-name { font-size: 1.25rem; }
        .emp-sub { font-size: 0.82rem; color: var(--ink-soft); margin-top: 2px; }
        .status-pill {
          margin-left: auto;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 999px;
          flex-shrink: 0;
        }
        .status-pill.active { background: var(--sage-tint); color: var(--sage); }
        .status-pill.inactive { background: var(--paper-sunken); color: var(--ink-soft); }
        .pw-pill {
          font-size: 0.76rem;
          font-weight: 700;
          padding: 3px 9px;
          border-radius: 999px;
        }
        .pw-pill.pw-temp { background: var(--brass-tint); color: var(--brass); }
        .pw-pill.pw-set { background: var(--sage-tint); color: var(--sage); }
        .stat-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 18px;
          max-width: 640px;
        }
        .pie-card {
          background: var(--paper-raised);
          border: 1px solid var(--line);
          border-radius: var(--radius-lg);
          padding: 20px;
          box-shadow: var(--shadow-card);
          max-width: 640px;
          margin-bottom: 18px;
        }
        .pie-empty {
          padding: 40px 10px;
          text-align: center;
          color: var(--ink-soft);
          font-size: 0.85rem;
        }
        .legend {
          display: flex;
          justify-content: center;
          gap: 18px;
          margin-top: 6px;
          font-size: 0.78rem;
          color: var(--ink-soft);
          font-weight: 500;
        }
        .legend span { display: flex; align-items: center; gap: 6px; }
        .sw { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
        .sw.sage { background: var(--sage); }
        .sw.clay { background: var(--clay); }
        .slice-tooltip {
          background: var(--navy);
          color: var(--paper);
          padding: 8px 11px;
          border-radius: var(--radius-sm);
          font-size: 0.78rem;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: var(--shadow-raised);
        }
        .slice-tooltip .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
        .actions-card {
          background: var(--paper-raised);
          border: 1px solid var(--line);
          border-radius: var(--radius-lg);
          padding: 20px;
          box-shadow: var(--shadow-card);
          max-width: 640px;
          margin-bottom: 18px;
        }
        .actions-title { font-size: 1rem; margin-bottom: 12px; }
        .device-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--paper-sunken);
          padding: 10px 12px;
          border-radius: var(--radius-sm);
          font-size: 0.85rem;
        }
        .device-row + .device-row { margin-top: 8px; }
        .device-row span:first-child { color: var(--ink-soft); font-weight: 600; }
        .device-row code { font-family: ui-monospace, monospace; font-weight: 600; color: var(--navy); }
        .hint-note {
          font-size: 0.78rem;
          color: var(--clay);
          margin-top: 8px;
          font-weight: 500;
        }
        .hint-note.view-only-note { color: var(--ink-soft); }
        .hint-note.error-note { color: var(--clay); }
        .cred-box {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px dashed var(--line-strong);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .actions-row {
          display: flex;
          gap: 10px;
          margin-top: 14px;
          flex-wrap: wrap;
        }
        .danger-zone {
          margin-top: 18px;
          padding-top: 16px;
          border-top: 1px solid var(--line);
        }
        .btn-primary, .btn-secondary, .btn-danger {
          padding: 9px 15px;
          border-radius: var(--radius-sm);
          font-weight: 600;
          font-size: 0.82rem;
          border: 1px solid transparent;
        }
        .btn-primary { background: var(--navy); color: var(--paper); }
        .btn-secondary { background: transparent; border-color: var(--line-strong); color: var(--ink-soft); }
        .btn-danger { background: var(--clay-tint); color: var(--clay); margin-top: 10px; }
        button:disabled { opacity: 0.55; }
        .view-calls-link {
          display: inline-block;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--navy);
          text-decoration: none;
        }
        .view-calls-link:hover { text-decoration: underline; }
        .empty-state {
          padding: 40px 20px;
          text-align: center;
          color: var(--ink-soft);
        }
      `}</style>
    </div>
  );
}
