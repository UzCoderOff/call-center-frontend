import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import { CALL_TYPE_LABEL, formatDateTime, formatDuration } from "../lib/format";
import PageHeader from "../components/PageHeader";

const TYPE_FILTERS = [
  { key: "", label: "All" },
  { key: "incoming", label: "Incoming" },
  { key: "outgoing", label: "Outgoing" },
  { key: "missed", label: "Missed" },
  { key: "voicemail", label: "Voicemail" },
];

// A separate filter axis from call type — "no recording" can apply to any
// call type, so it's its own row of chips rather than folded into the ones
// above.
const RECORDING_FILTERS = [
  { key: "", label: "Any" },
  { key: "false", label: "No recording" },
  { key: "true", label: "Has recording" },
];

// Missed/rejected calls never connect, so they never have a recording —
// flagging them would just be noise. This is for the case that actually
// matters: a call that *should* have audio (it connected — incoming,
// outgoing, or a voicemail) but doesn't have a file attached.
function expectsRecording(call) {
  return call.callType === "incoming" || call.callType === "outgoing" || call.callType === "voicemail";
}

export default function CallsPage() {
  const { user } = useAuth();
  const isManager = user.role === "BOSS" || user.role === "DEVELOPER";

  const [searchParams] = useSearchParams();
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState(searchParams.get("employeeId") || "");
  const [callType, setCallType] = useState("");
  const [hasRecording, setHasRecording] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isManager) return;
    api.employees().then(setEmployees).catch(() => {});
  }, [isManager]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .calls({
        employeeId: employeeId || undefined,
        callType: callType || undefined,
        hasRecording: hasRecording || undefined,
        page,
        pageSize: 25,
      })
      .then((r) => {
        if (!cancelled) setResult(r);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load calls right now.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, callType, hasRecording, page]);

  function resetAndSet(setter) {
    return (v) => {
      setPage(1);
      setter(v);
    };
  }

  return (
    <div>
      <PageHeader title="Calls" subtitle="Every call synced from the field." />

      <div className="filters">
        <div className="type-filters">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              className={`chip${callType === f.key ? " is-active" : ""}`}
              onClick={() => resetAndSet(setCallType)(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="type-filters">
          {RECORDING_FILTERS.map((f) => (
            <button
              key={f.key}
              className={`chip${hasRecording === f.key ? " is-active" : ""}`}
              onClick={() => resetAndSet(setHasRecording)(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {isManager && (
          <select
            className="employee-select"
            value={employeeId}
            onChange={(e) => resetAndSet(setEmployeeId)(e.target.value)}
          >
            <option value="">All employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && <div className="empty-state">Loading…</div>}
      {error && <div className="empty-state">{error}</div>}

      {!loading && !error && result && (
        <>
          {result.calls.length === 0 ? (
            <div className="empty-state">No calls match these filters.</div>
          ) : (
            <div className="call-list">
              {result.calls.map((c) => (
                <Link to={`/calls/${c.id}`} key={c.id} className="call-row">
                  <div className={`call-dot tone-${c.missed ? "clay" : c.callType === "outgoing" ? "navy" : "sage"}`} />
                  <div className="call-main">
                    <div className="call-line1">
                      <span className="call-type">{CALL_TYPE_LABEL[c.callType] || c.callType}</span>
                      {isManager && <span className="call-emp">{c.employee?.name}</span>}
                      {expectsRecording(c) && !c.recordingPath && (
                        <span className="no-rec-badge">No recording</span>
                      )}
                    </div>
                    <div className="call-line2">{c.phoneNumber}</div>
                  </div>
                  <div className="call-meta">
                    <span className="call-time">{formatDateTime(c.callTimestampMs)}</span>
                    <span className="call-dur">{c.missed ? "—" : formatDuration(c.durationSeconds)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {result.pagination.totalPages > 1 && (
            <div className="pager">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <span>
                Page {result.pagination.page} of {result.pagination.totalPages}
              </span>
              <button disabled={page >= result.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          )}
        </>
      )}

      <style>{`
        .filters {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 18px;
        }
        .type-filters {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          padding-bottom: 2px;
        }
        .chip {
          background: var(--paper-raised);
          border: 1px solid var(--line-strong);
          padding: 7px 13px;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--ink-soft);
          white-space: nowrap;
        }
        .chip.is-active {
          background: var(--navy);
          border-color: var(--navy);
          color: var(--paper);
        }
        .employee-select {
          border: 1px solid var(--line-strong);
          border-radius: var(--radius-sm);
          padding: 9px 10px;
          background: var(--paper-raised);
          font-size: 0.85rem;
          font-weight: 500;
          align-self: flex-start;
        }
        .empty-state {
          padding: 40px 20px;
          text-align: center;
          color: var(--ink-soft);
          font-size: 0.88rem;
          background: var(--paper-raised);
          border: 1px dashed var(--line-strong);
          border-radius: var(--radius-md);
        }
        .call-list {
          display: flex;
          flex-direction: column;
          background: var(--paper-raised);
          border: 1px solid var(--line);
          border-radius: var(--radius-md);
          overflow: hidden;
          box-shadow: var(--shadow-card);
        }
        .call-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 14px;
          text-decoration: none;
          color: var(--ink);
          border-bottom: 1px solid var(--line);
        }
        .call-row:last-child { border-bottom: none; }
        .call-row:hover { background: var(--paper-sunken); }
        .call-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .call-dot.tone-clay { background: var(--clay); }
        .call-dot.tone-navy { background: var(--navy); }
        .call-dot.tone-sage { background: var(--sage); }
        .call-main {
          flex: 1;
          min-width: 0;
        }
        .call-line1 {
          display: flex;
          gap: 8px;
          align-items: baseline;
        }
        .call-type {
          font-weight: 600;
          font-size: 0.88rem;
        }
        .call-emp {
          font-size: 0.76rem;
          color: var(--ink-soft);
        }
        .no-rec-badge {
          font-size: 0.68rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 999px;
          background: var(--clay-tint);
          color: var(--clay);
          white-space: nowrap;
        }
        .call-line2 {
          font-size: 0.8rem;
          color: var(--ink-soft);
          margin-top: 1px;
        }
        .call-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          flex-shrink: 0;
        }
        .call-time {
          font-size: 0.76rem;
          color: var(--ink-soft);
        }
        .call-dur {
          font-size: 0.8rem;
          font-weight: 600;
        }
        .pager {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-top: 18px;
          font-size: 0.82rem;
          color: var(--ink-soft);
        }
        .pager button {
          background: var(--paper-raised);
          border: 1px solid var(--line-strong);
          padding: 8px 14px;
          border-radius: var(--radius-sm);
          font-weight: 600;
          font-size: 0.8rem;
        }
        .pager button:disabled {
          opacity: 0.4;
        }
      `}</style>
    </div>
  );
}
