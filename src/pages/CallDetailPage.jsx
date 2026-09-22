import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { CALL_TYPE_LABEL, formatDateTime, formatDuration } from "../lib/format";

function Field({ label, value }) {
  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <span className="field-value">{value}</span>
    </div>
  );
}

function RecordingPlayer({ callId }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="recording-error">
        Couldn't play this recording. The file may be in a format the server couldn't convert, or
        the conversion tool isn't installed — check the backend logs for a "couldn't prepare
        recording" line. The original file is still safe on disk.
      </div>
    );
  }

  return (
    <div className="recording">
      <audio controls src={api.recordingUrl(callId)} style={{ width: "100%" }} onError={() => setFailed(true)} />
    </div>
  );
}

export default function CallDetailPage() {
  const { id } = useParams();
  const [call, setCall] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .call(id)
      .then((c) => {
        if (!cancelled) setCall(c);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this call.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <div className="empty-state">{error}</div>;
  if (!call) return <div className="empty-state">Loading…</div>;

  return (
    <div className="detail">
      <Link to="/calls" className="back-link">
        ← All calls
      </Link>

      <div className="detail-card">
        <div className="detail-head">
          <span className={`badge tone-${call.missed ? "clay" : call.callType === "outgoing" ? "navy" : "sage"}`}>
            {CALL_TYPE_LABEL[call.callType] || call.callType}
          </span>
          <h1 className="detail-title">{call.phoneNumber}</h1>
        </div>

        {call.recordingPath ? (
          <RecordingPlayer callId={call.id} />
        ) : (
          <div className="no-recording">No recording attached to this call.</div>
        )}

        <div className="field-list">
          <Field label="Employee" value={call.employee?.name || "—"} />
          <Field label="When" value={formatDateTime(call.callTimestampMs)} />
          <Field label="Duration" value={call.missed ? "—" : formatDuration(call.durationSeconds)} />
          <Field label="Missed" value={call.missed ? "Yes" : "No"} />
          {call.logIntegrityFlag && <Field label="Integrity flag" value={call.logIntegrityFlag} />}
        </div>

        {call.transcript?.text && (
          <div className="section-block">
            <h2 className="section-title">Transcript</h2>
            <p className="transcript-text">{call.transcript.text}</p>
          </div>
        )}

        {call.analysis && (call.analysis.summary || call.analysis.whatWentWrong) && (
          <div className="section-block">
            <h2 className="section-title">Review</h2>
            {call.analysis.summary && <p className="review-text">{call.analysis.summary}</p>}
            {call.analysis.score != null && (
              <p className="review-score">Score: {call.analysis.score}/10</p>
            )}
          </div>
        )}
      </div>

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
        .detail-card {
          background: var(--paper-raised);
          border: 1px solid var(--line);
          border-radius: var(--radius-lg);
          padding: 24px;
          box-shadow: var(--shadow-card);
          max-width: 640px;
        }
        .detail-head {
          margin-bottom: 18px;
        }
        .badge {
          display: inline-block;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 999px;
          margin-bottom: 8px;
        }
        .badge.tone-clay { background: var(--clay-tint); color: var(--clay); }
        .badge.tone-navy { background: var(--navy-tint); color: var(--navy); }
        .badge.tone-sage { background: var(--sage-tint); color: var(--sage); }
        .detail-title {
          font-size: 1.5rem;
        }
        .recording {
          background: var(--paper-sunken);
          border-radius: var(--radius-md);
          padding: 14px;
          margin-bottom: 18px;
        }
        .no-recording {
          font-size: 0.85rem;
          color: var(--ink-soft);
          background: var(--paper-sunken);
          padding: 14px;
          border-radius: var(--radius-md);
          margin-bottom: 18px;
        }
        .recording-error {
          font-size: 0.85rem;
          color: var(--clay);
          background: var(--clay-tint);
          padding: 14px;
          border-radius: var(--radius-md);
          margin-bottom: 18px;
          line-height: 1.5;
        }
        .field-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .field-row {
          display: flex;
          justify-content: space-between;
          padding: 9px 0;
          border-bottom: 1px solid var(--line);
          font-size: 0.86rem;
        }
        .field-row:last-child { border-bottom: none; }
        .field-label { color: var(--ink-soft); font-weight: 500; }
        .field-value { font-weight: 600; }
        .section-block {
          margin-top: 22px;
          padding-top: 18px;
          border-top: 1px solid var(--line);
        }
        .section-title {
          font-size: 0.95rem;
          margin-bottom: 8px;
        }
        .transcript-text, .review-text {
          font-size: 0.88rem;
          line-height: 1.6;
          color: var(--ink);
        }
        .review-score {
          margin-top: 8px;
          font-weight: 700;
          color: var(--brass);
          font-size: 0.85rem;
        }
        .empty-state {
          padding: 40px 20px;
          text-align: center;
          color: var(--ink-soft);
        }
      `}</style>
    </div>
  );
}
