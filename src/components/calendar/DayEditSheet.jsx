import { useState } from "react";
import styles from "./Calendar.module.css";
import pageStyles from "../../pages/Pages.module.css";
import Sheet from "../ui/Sheet";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { SelectField, TextField } from "../ui/Field";
import TimeSelect from "./TimeSelect";
import { bookerName } from "./Appointment";
import { KINDS, WHOLE_DAY, blocksOn, byStart, checkDay, dayMode, replaceDay, usualDay } from "../../lib/calendarDays";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";

const MODES = [
  { value: "usual", icon: "calendar" },
  { value: "busy", icon: "briefcase" },
  { value: "off", icon: "minusCircle" },
  { value: "custom", icon: "sliders" },
];

// The lawyer changes one day. Four plain choices — an ordinary working day,
// busy all day (court in another city, a trip), a day off, or their own
// times. Saved straight away; if clients are already booked into time that
// goes away, the lawyer sees who and decides.
export default function DayEditSheet({ week, date, onClose, onSaved }) {
  const { t, fmt } = useI18n();
  const current = blocksOn(week.blocks, date);
  const initialMode = dayMode(current, week.usual, date);
  const [mode, setMode] = useState(initialMode);
  const [note, setNote] = useState(initialMode === "busy" ? current[0].note || "" : "");
  const [rows, setRows] = useState(() => (initialMode === "custom" ? current : usualDay(week.usual, date)).map(strip));
  const [error, setError] = useState("");
  const [conflicts, setConflicts] = useState(null);
  const [busy, setBusy] = useState(false);

  function dayBlocks() {
    if (mode === "usual") return usualDay(week.usual, date);
    if (mode === "busy") return [{ date, ...WHOLE_DAY, kind: "busy", ...(note.trim() ? { note: note.trim() } : {}) }];
    if (mode === "off") return [];
    return rows.map((r) => ({ date, start: r.start, end: r.end, kind: r.kind, ...(r.note?.trim() ? { note: r.note.trim() } : {}) }));
  }

  async function save(cancelAppointments = false) {
    const blocks = dayBlocks();
    const problem = mode === "custom" ? checkDay(blocks) : null;
    if (problem) return setError(t(`dayEdit.${problem}`));
    setError("");
    setBusy(true);
    try {
      const saved = await api.saveCalendarWeek(week.calendar.id, week.weekStart, replaceDay(week.blocks, date, blocks), {
        cancelAppointments,
        cancelReason: mode === "busy" ? note.trim() : "",
      });
      onSaved(saved);
    } catch (err) {
      if (err.code === "appointments_conflict") setConflicts(err.body.appointments);
      else setError(t("dayEdit.saveFailed", { reason: err.code || "?" }));
    } finally {
      setBusy(false);
    }
  }

  const usual = week.usual;
  const usualHint = usual.lunch
    ? t("dayEdit.usualHint", {
        from: fmt.minutes(usual.dayStart),
        to: fmt.minutes(usual.dayEnd),
        lunchFrom: fmt.minutes(usual.lunch.start),
        lunchTo: fmt.minutes(usual.lunch.end),
      })
    : t("dayEdit.usualHintNoLunch", { from: fmt.minutes(usual.dayStart), to: fmt.minutes(usual.dayEnd) });
  const hints = { usual: usualHint, busy: t("dayEdit.busyHint"), off: t("dayEdit.offHint"), custom: t("dayEdit.customHint") };

  if (conflicts) {
    return (
      <Sheet title={fmt.isoDay(date)} onClose={onClose}>
        <div className={styles.conflictBox}>
          <Icon name="alertTriangle" size={22} />
          <div>
            <p className={styles.conflictTitle}>{t("dayEdit.conflictTitle", { count: conflicts.length })}</p>
            <p className={pageStyles.note}>{t("dayEdit.conflictText")}</p>
          </div>
        </div>
        <div className={styles.schedule}>
          {conflicts.map((a) => (
            <div key={a.id} className={styles.row}>
              <span className={styles.rowTime}>
                <span>{fmt.minutes(a.start)}</span>
                <span className={styles.rowTimeEnd}>{fmt.minutes(a.end)}</span>
              </span>
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{a.clientName}</span>
                <span className={styles.rowSub}>
                  {[a.clientPhone && fmt.phone(a.clientPhone), bookerName(a) && t("calendar.bookedByLine", { name: bookerName(a) })]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </div>
          ))}
        </div>
        <div className={pageStyles.formActions}>
          <Button onClick={() => setConflicts(null)}>{t("dayEdit.back")}</Button>
          <Button variant="destructive" busy={busy} onClick={() => save(true)}>
            {t("dayEdit.confirmCancel", { count: conflicts.length })}
          </Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={fmt.isoDay(date)} onClose={onClose}>
      <div className={styles.choices} role="radiogroup" aria-label={t("calendar.editDay")}>
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={mode === m.value}
            className={`${styles.choice} ${mode === m.value ? styles.choiceOn : ""}`}
            onClick={() => setMode(m.value)}
          >
            <span className={styles.choiceIcon}>
              <Icon name={m.icon} size={20} />
            </span>
            <span className={styles.choiceText}>
              <span className={styles.choiceTitle}>{t(`dayEdit.${m.value}`)}</span>
              <span className={styles.choiceHint}>{hints[m.value]}</span>
            </span>
            <span className={styles.radio} aria-hidden="true" />
          </button>
        ))}
      </div>

      {mode === "busy" && (
        <TextField
          label={t("dayEdit.reason")}
          placeholder={t("dayEdit.reasonPlaceholder")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      )}

      {mode === "custom" && <RowsEditor rows={rows} onChange={setRows} />}

      {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
      <div className={pageStyles.formActions}>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="primary" busy={busy} onClick={() => save(false)}>
          {t("dayEdit.save")}
        </Button>
      </div>
    </Sheet>
  );
}

const strip = ({ start, end, kind, note }) => ({ start, end, kind, note: note || "" });

// The day's times, one card each: what it is, from, to, and a note.
function RowsEditor({ rows, onChange }) {
  const { t } = useI18n();
  const set = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function add() {
    const last = [...rows].sort(byStart).at(-1);
    const start = last ? Math.min(last.end, 23 * 60) : 9 * 60;
    onChange([...rows, { start, end: Math.min(start + 60, 24 * 60), kind: "available", note: "" }]);
  }

  return (
    <div className={styles.rowsEditor}>
      {rows.map((r, i) => (
        <div key={i} className={styles.editCard}>
          <div className={styles.editTop}>
            <SelectField label={t("dayEdit.kind")} value={r.kind} onChange={(e) => set(i, { kind: e.target.value })}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`calendar.kinds.${k}`)}
                </option>
              ))}
            </SelectField>
            <button type="button" className={styles.iconButton} onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={t("dayEdit.remove")}>
              <Icon name="trash" size={18} />
            </button>
          </div>
          <div className={styles.timeRow}>
            <TimeSelect label={t("dayEdit.from")} value={r.start} onChange={(start) => set(i, { start })} />
            <TimeSelect label={t("dayEdit.to")} value={r.end} onChange={(end) => set(i, { end })} />
          </div>
          {r.kind !== "available" && (
            <TextField label={t("dayEdit.note")} value={r.note} onChange={(e) => set(i, { note: e.target.value })} />
          )}
        </div>
      ))}
      <button type="button" className={styles.addRow} onClick={add}>
        <Icon name="plus" size={16} />
        {t("dayEdit.add")}
      </button>
    </div>
  );
}
