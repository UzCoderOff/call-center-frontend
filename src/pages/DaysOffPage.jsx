import { useState } from "react";
import pageStyles from "./Pages.module.css";
import styles from "../components/daysoff/DaysOff.module.css";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Sheet from "../components/ui/Sheet";
import { SelectField, TextAreaField, TextField } from "../components/ui/Field";
import { List, ListRow } from "../components/ui/List";
import { AsyncBoundary, EmptyState, PageHeader } from "../components/ui/Misc";
import { shiftMonth, useMonthLabel } from "../components/finance/parts";
import { useAuth, isManagerRole } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

// Dam olish — days away and holidays.
// Staff: ask for a day off, say they're sick or worked away from the office;
// see their requests. The boss and the developer: approve or refuse, add days
// for anyone (approved at once), see who's away in a month. The developer
// also confirms the year's public holidays — Ledger suggests the fixed-date
// ones; only confirmed ones count (src/services/workdays.js on the server).

const KINDS = ["day_off", "sick", "vacation", "remote"];
const STATUS_TONE = { pending: "warning", approved: "good", rejected: "neutral" };

function useRange() {
  const { fmt } = useI18n();
  return (a) => (a.from === a.to ? fmt.isoDateLong(a.from) : `${fmt.isoDateLong(a.from)} – ${fmt.isoDateLong(a.to)}`);
}

export default function DaysOffPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const manager = isManagerRole(user.role);
  const [asking, setAsking] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const reload = () => setRefresh((n) => n + 1);

  return (
    <div>
      <PageHeader
        title={t("daysOff.title")}
        subtitle={manager ? t("daysOff.subtitleManager") : t("daysOff.subtitle")}
        actions={
          <Button variant="primary" icon="plus" onClick={() => setAsking(true)}>
            {manager ? t("daysOff.add") : t("daysOff.ask")}
          </Button>
        }
      />
      <div className={pageStyles.stack}>
        {manager && <Pending refresh={refresh} onChanged={reload} />}
        {manager ? <Month refresh={refresh} onChanged={reload} /> : <Mine refresh={refresh} onChanged={reload} />}
        <Holidays />
      </div>
      {asking && (
        <AbsenceSheet
          manager={manager}
          onClose={() => setAsking(false)}
          onSaved={() => {
            setAsking(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------ staff
function Mine({ refresh, onChanged }) {
  const { t } = useI18n();
  const range = useRange();
  const state = useAsync(() => api.absences(), [refresh]);
  return (
    <Card flush title={t("daysOff.mine")} subtitle={t("daysOff.mineSubtitle")}>
      <AsyncBoundary state={state}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState icon="coffee" text={t("daysOff.mineEmpty")} />
          ) : (
            <List plain inset={16}>
              {rows.map((a) => (
                <ListRow
                  key={a.id}
                  title={`${t(`daysOff.kinds.${a.kind}`)} · ${range(a)}`}
                  subtitle={[t("daysOff.daysCount", { n: a.days }), a.note, a.decidedBy ? t("daysOff.decidedBy", { name: a.decidedBy }) : null].filter(Boolean).join(" · ")}
                  trailing={
                    <span className={styles.trailing}>
                      <Badge tone={STATUS_TONE[a.status]}>{t(`daysOff.status.${a.status}`)}</Badge>
                      {a.status === "pending" && (
                        <Button size="small" variant="plain" icon="x" aria-label={t("daysOff.cancel")} onClick={() => api.deleteAbsence(a.id).then(onChanged)} />
                      )}
                    </span>
                  }
                />
              ))}
            </List>
          )
        }
      </AsyncBoundary>
    </Card>
  );
}

// --------------------------------------------------------- managers
function Pending({ refresh, onChanged }) {
  const { t } = useI18n();
  const range = useRange();
  const state = useAsync(() => api.absences({ status: "pending" }), [refresh]);
  const [busy, setBusy] = useState(null);
  async function decide(a, status) {
    setBusy(`${a.id}${status}`);
    try {
      await api.decideAbsence(a.id, status);
      onChanged();
    } finally {
      setBusy(null);
    }
  }
  return (
    <AsyncBoundary state={state}>
      {(rows) =>
        rows.length > 0 && (
          <Card flush title={t("daysOff.pending", { n: rows.length })} subtitle={t("daysOff.pendingSubtitle")}>
            <List plain inset={16}>
              {rows.map((a) => (
                <ListRow
                  key={a.id}
                  title={`${a.employee.name} — ${t(`daysOff.kinds.${a.kind}`)}`}
                  subtitle={[range(a), t("daysOff.daysCount", { n: a.days }), a.note].filter(Boolean).join(" · ")}
                  trailing={
                    <span className={styles.trailing}>
                      <Button size="small" variant="primary" icon="check" busy={busy === `${a.id}approved`} onClick={() => decide(a, "approved")}>
                        {t("daysOff.approve")}
                      </Button>
                      <Button size="small" busy={busy === `${a.id}rejected`} onClick={() => decide(a, "rejected")}>
                        {t("daysOff.reject")}
                      </Button>
                    </span>
                  }
                />
              ))}
            </List>
          </Card>
        )
      }
    </AsyncBoundary>
  );
}

function Month({ refresh, onChanged }) {
  const { t, fmt } = useI18n();
  const range = useRange();
  const monthLabel = useMonthLabel();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const state = useAsync(
    () => Promise.all([api.absences({ from: `${month}-01`, to: `${month}-${last}` }), api.holidays(month.slice(0, 4))]),
    [month, refresh]
  );
  return (
    <Card
      flush
      title={t("daysOff.monthTitle")}
      action={
        <span className={styles.monthNav}>
          <Button size="small" icon="chevronLeft" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t("finance.prevMonth")} />
          <span className={styles.monthLabel}>{monthLabel(month)}</span>
          <Button size="small" icon="chevronRight" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t("finance.nextMonth")} />
        </span>
      }
    >
      <AsyncBoundary state={state}>
        {([rows, hol]) => {
          const holidays = hol.rows.filter((h) => h.status === "confirmed" && h.date.startsWith(month));
          const shown = rows.filter((a) => a.status !== "pending");
          if (shown.length === 0 && holidays.length === 0) return <EmptyState icon="coffee" text={t("daysOff.monthEmpty")} />;
          return (
            <List plain inset={16}>
              {holidays.map((h) => (
                <ListRow key={`h${h.id}`} title={h.name} subtitle={`${fmt.isoDateLong(h.date)} · ${t("daysOff.holidayLine")}`} trailing={<Badge tone="accent">{t("daysOff.holiday")}</Badge>} />
              ))}
              {shown.map((a) => (
                <ListRow
                  key={a.id}
                  title={`${a.employee.name} — ${t(`daysOff.kinds.${a.kind}`)}`}
                  subtitle={[range(a), t("daysOff.daysCount", { n: a.days }), a.note, a.decidedBy ? t("daysOff.decidedBy", { name: a.decidedBy }) : null].filter(Boolean).join(" · ")}
                  trailing={
                    <span className={styles.trailing}>
                      <Badge tone={STATUS_TONE[a.status]}>{t(`daysOff.status.${a.status}`)}</Badge>
                      <Button
                        size="small"
                        variant="plain"
                        icon="trash"
                        aria-label={t("daysOff.remove")}
                        onClick={() => confirm(t("daysOff.removeConfirm")) && api.deleteAbsence(a.id).then(onChanged)}
                      />
                    </span>
                  }
                />
              ))}
            </List>
          );
        }}
      </AsyncBoundary>
    </Card>
  );
}

function AbsenceSheet({ manager, onClose, onSaved }) {
  const { t } = useI18n();
  const today = new Date().toISOString().slice(0, 10);
  const people = useAsync(() => (manager ? api.employees() : Promise.resolve([])), [manager]);
  const [employeeId, setEmployeeId] = useState("");
  const [kind, setKind] = useState("day_off");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    if (manager && !employeeId) return setError(t("daysOff.pickPerson"));
    if (!from || !to || to < from) return setError(t("daysOff.badDates"));
    setBusy(true);
    setError("");
    try {
      await api.addAbsence({ ...(manager ? { employeeId: Number(employeeId) } : {}), kind, from, to, note: note.trim() || null });
      onSaved();
    } catch {
      setError(t("daysOff.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={manager ? t("daysOff.add") : t("daysOff.ask")} onClose={onClose}>
      <form onSubmit={save} className={pageStyles.formStack}>
        {manager && (
          <SelectField label={t("daysOff.person")} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">{t("daysOff.pickPerson")}</option>
            {(people.data || [])
              .filter((p) => p.active)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </SelectField>
        )}
        <SelectField label={t("daysOff.kind")} hint={t(`daysOff.kindHints.${kind}`)} value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`daysOff.kinds.${k}`)}
            </option>
          ))}
        </SelectField>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          <TextField label={t("daysOff.from")} type="date" value={from} onChange={(e) => (setFrom(e.target.value), e.target.value > to && setTo(e.target.value))} required />
          <TextField label={t("daysOff.to")} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} required />
        </div>
        <TextAreaField label={t("daysOff.note")} placeholder={t("daysOff.notePh")} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        <p className={pageStyles.note}>{manager ? t("daysOff.managerNote") : t("daysOff.staffNote")}</p>
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" variant="primary" busy={busy}>
            {manager ? t("common.save") : t("daysOff.send")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

// ---------------------------------------------------------- holidays
function Holidays() {
  const { t, fmt } = useI18n();
  const { user } = useAuth();
  const developer = user.role === "DEVELOPER";
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [refresh, setRefresh] = useState(0);
  const state = useAsync(() => api.holidays(year), [year, refresh]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(null);
  const reload = () => setRefresh((n) => n + 1);

  async function act(h, action) {
    setBusy(`${h.id}${action}`);
    try {
      if (action === "remove") await api.deleteHoliday(h.id);
      else await api.updateHoliday(h.id, { status: action });
      reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card
      flush
      title={t("daysOff.holidaysTitle", { year })}
      subtitle={developer ? t("daysOff.holidaysSubtitleDev") : t("daysOff.holidaysSubtitle")}
      action={
        <span className={styles.monthNav}>
          <Button size="small" icon="chevronLeft" onClick={() => setYear(year - 1)} aria-label={t("daysOff.prevYear")} />
          <Button size="small" icon="chevronRight" onClick={() => setYear(year + 1)} aria-label={t("daysOff.nextYear")} />
          {developer && (
            <Button size="small" variant="plain" icon="plus" onClick={() => setAdding(true)}>
              {t("daysOff.addHoliday")}
            </Button>
          )}
        </span>
      }
    >
      <AsyncBoundary state={state}>
        {({ rows }) =>
          rows.length === 0 ? (
            <EmptyState icon="calendar" text={t("daysOff.noHolidays")} />
          ) : (
            <List plain inset={16}>
              {rows.map((h) => (
                <ListRow
                  key={h.id}
                  title={h.name}
                  subtitle={[fmt.isoDateLong(h.date), h.status === "confirmed" && h.confirmedBy ? t("daysOff.confirmedBy", { name: h.confirmedBy.name || h.confirmedBy.username }) : null].filter(Boolean).join(" · ")}
                  trailing={
                    <span className={styles.trailing}>
                      <Badge tone={h.status === "confirmed" ? "good" : h.status === "suggested" ? "warning" : "neutral"}>{t(`daysOff.holidayStatus.${h.status}`)}</Badge>
                      {developer && h.status !== "confirmed" && (
                        <Button size="small" variant="primary" icon="check" busy={busy === `${h.id}confirmed`} onClick={() => act(h, "confirmed")}>
                          {t("daysOff.confirm")}
                        </Button>
                      )}
                      {developer && h.status !== "rejected" && (
                        <Button size="small" busy={busy === `${h.id}rejected`} onClick={() => act(h, h.builtin ? "rejected" : "remove")}>
                          {h.builtin ? t("daysOff.notHoliday") : t("daysOff.remove")}
                        </Button>
                      )}
                    </span>
                  }
                />
              ))}
            </List>
          )
        }
      </AsyncBoundary>
      {developer && <p className={styles.footNote}>{t("daysOff.movableNote")}</p>}
      {adding && (
        <HolidaySheet
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            reload();
          }}
        />
      )}
    </Card>
  );
}

function HolidaySheet({ onClose, onSaved }) {
  const { t } = useI18n();
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e) {
    e.preventDefault();
    if (!date || !name.trim()) return setError(t("daysOff.holidayNeeds"));
    setBusy(true);
    try {
      await api.addHoliday({ date, name: name.trim() });
      onSaved();
    } catch {
      setError(t("daysOff.failed"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet title={t("daysOff.addHoliday")} onClose={onClose}>
      <form onSubmit={save} className={pageStyles.formStack}>
        <TextField label={t("daysOff.date")} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <TextField label={t("daysOff.holidayName")} placeholder={t("daysOff.holidayNamePh")} value={name} onChange={(e) => setName(e.target.value)} required />
        <p className={pageStyles.note}>{t("daysOff.addHolidayNote")}</p>
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" variant="primary" busy={busy}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
