import { useState } from "react";
import { Link } from "react-router-dom";
import styles from "./Performance.module.css";
import Card from "../ui/Card";
import Sheet from "../ui/Sheet";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import { TextField } from "../ui/Field";
import pageStyles from "../../pages/Pages.module.css";
import { personName } from "../clients/parts";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { saveFailed } from "../../lib/saveFailed";
import { useI18n } from "../../i18n";

// Late call-backs ("strikes"): a missed call not called back within the
// set minutes (in working hours) counts one. The rule, the limit a month
// and what follows are set in Settings (backend: services/strikes.js).

// Staff home: how many this month, out of how many allowed, what the rule
// asks — and which calls they were.
export function MyStrikesCard({ strikes: s }) {
  const { t } = useI18n();
  const tone = s.over > 0 ? "critical" : s.count > 0 && s.count >= s.limit ? "warning" : s.count > 0 ? "neutral" : "good";
  return (
    <Card
      title={t("strikes.myTitle")}
      subtitle={t("strikes.rule", { minutes: s.minutes })}
      action={
        <Badge tone={tone}>
          {s.count} / {s.limit}
        </Badge>
      }
    >
      <p className={styles.strikeNote}>
        {s.over > 0 ? t("strikes.myOver", { limit: s.limit }) : s.count === 0 ? t("strikes.myNone") : t("strikes.myLeft", { left: Math.max(0, s.limit - s.count), limit: s.limit })}
      </p>
      {s.count > 0 && <StrikeList employeeId={null} manager={false} compact />}
    </Card>
  );
}

// Managers' home: who has strikes this month (and who's over the limit).
export function TeamStrikesCard({ employees, rules }) {
  const { t, fmt } = useI18n();
  const rows = employees.filter((e) => e.strikes?.count > 0).sort((a, b) => b.strikes.count - a.strikes.count);
  return (
    <Card title={t("strikes.teamTitle")} subtitle={t("strikes.teamRule", { minutes: rules.minutes, limit: rules.limit })}>
      {rows.length === 0 ? (
        <p className={styles.strikeNote}>{t("strikes.teamNone")}</p>
      ) : (
        <ul className={styles.strikeRows}>
          {rows.map((e) => (
            <li key={e.id}>
              <Link to={`/performance/${e.id}`}>{e.name}</Link>
              <span className={styles.strikeCount}>
                {e.strikes.count} / {e.strikes.limit}
              </span>
              {e.strikes.over > 0 && (
                <Badge tone="critical">{e.strikes.fine > 0 ? t("strikes.overFine", { fine: fmt.money(e.strikes.fine) }) : t("strikes.over")}</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// Natijalar → person: the month's strikes, each with the call, by when it
// had to be called back and when it was. Managers can cancel one (with a
// reason — a real excuse: a meeting, the line was down) or restore it.
export function StrikesCard({ employeeId, month, summary, manager, onChanged }) {
  const { t, fmt } = useI18n();
  return (
    <Card
      title={t("strikes.monthTitle")}
      subtitle={t("strikes.rule", { minutes: summary.minutes })}
      action={
        <Badge tone={summary.over > 0 ? "critical" : summary.count > 0 ? "warning" : "good"}>
          {summary.count} / {summary.limit}
        </Badge>
      }
    >
      {summary.over > 0 && manager && (
        <p className={styles.strikeNote}>
          {summary.fine > 0 ? t("strikes.overNoteFine", { over: summary.over, fine: fmt.money(summary.fine) }) : t("strikes.overNote", { over: summary.over })}
        </p>
      )}
      <StrikeList employeeId={employeeId} month={month} manager={manager} onChanged={onChanged} />
    </Card>
  );
}

function StrikeList({ employeeId, month, manager, compact = false, onChanged }) {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.strikes({ ...(employeeId ? { employeeId } : {}), ...(month ? { month } : {}) }), [employeeId, month]);
  const [cancelling, setCancelling] = useState(null);
  const [busy, setBusy] = useState(null);
  const list = state.data?.strikes || [];
  if (state.loading && !state.data) return null;
  if (list.length === 0) return <p className={styles.strikeNote}>{t("strikes.none")}</p>;

  async function restore(s) {
    setBusy(s.id);
    try {
      await api.restoreStrike(s.id);
      state.reload();
      onChanged?.();
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <ul className={styles.strikeList}>
        {(compact ? list.slice(0, 5) : list).map((s) => {
          const missed = new Date(s.missedAt).getTime();
          const deadline = new Date(s.deadlineAt).getTime();
          const cancelled = Boolean(s.cancelledAt);
          return (
            <li key={s.id} className={cancelled ? styles.strikeCancelled : undefined}>
              <div className={styles.strikeMain}>
                <span className={styles.strikeWhen}>
                  {fmt.dateTime(missed)} · {s.callLog?.phoneNumber ? <Link to={`/calls/${s.callLog.id}`}>{fmt.phone(s.callLog.phoneNumber)}</Link> : "—"}
                </span>
                <span className={styles.strikeDetail}>
                  {s.answeredAt
                    ? t("strikes.calledAt", { deadline: fmt.time(deadline), at: fmt.dateTime(new Date(s.answeredAt).getTime()) })
                    : t("strikes.notCalled", { deadline: fmt.time(deadline) })}
                </span>
                {cancelled && (
                  <span className={styles.strikeDetail}>
                    {s.cancelReason === "callback_found"
                      ? t("strikes.autoCancelled")
                      : t("strikes.cancelledBy", { name: personName(s.cancelledBy), reason: s.cancelReason })}
                  </span>
                )}
              </div>
              {manager && (
                <div className={styles.strikeActions}>
                  {cancelled ? (
                    <Button size="small" variant="plain" busy={busy === s.id} onClick={() => restore(s)}>
                      {t("strikes.restore")}
                    </Button>
                  ) : (
                    <Button size="small" onClick={() => setCancelling(s)}>
                      {t("strikes.cancel")}
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {cancelling && (
        <CancelSheet
          strike={cancelling}
          onClose={() => setCancelling(null)}
          onSaved={() => {
            setCancelling(null);
            state.reload();
            onChanged?.();
          }}
        />
      )}
    </>
  );
}

function CancelSheet({ strike, onClose, onSaved }) {
  const { t, fmt } = useI18n();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!reason.trim()) return setError(t("strikes.reasonRequired"));
    setBusy(true);
    try {
      await api.cancelStrike(strike.id, reason.trim());
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(false);
    }
  }

  return (
    <Sheet title={t("strikes.cancelTitle")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <p className={pageStyles.note}>
          {strike.employee?.name} · {fmt.dateTime(new Date(strike.missedAt).getTime())} · {strike.callLog?.phoneNumber ? fmt.phone(strike.callLog.phoneNumber) : "—"}
        </p>
        <TextField label={t("strikes.reason")} placeholder={t("strikes.reasonPlaceholder")} value={reason} onChange={(e) => setReason(e.target.value)} />
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" busy={busy} onClick={save}>
            {t("strikes.cancel")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
