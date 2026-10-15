import { useState } from "react";
import styles from "./Personal.module.css";
import pageStyles from "../../pages/Pages.module.css";
import Sheet from "../ui/Sheet";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { SelectField, Switch, TextAreaField, TextField } from "../ui/Field";
import TimeSelect from "./TimeSelect";
import { api } from "../../lib/api";
import { shiftIso, todayIso } from "../../lib/format";
import { useI18n } from "../../i18n";

const EVENT_KINDS = ["court", "meeting", "work", "personal", "other"];
const KIND_ICONS = { court: "briefcase", meeting: "users", work: "clipboard", personal: "coffee", other: "calendar" };

// Add or change one thing in a lawyer's own calendar. Moving it is just
// another day or time: "Today / Tomorrow / +1 day" and the times. It can
// repeat (every day, Monday–Saturday, every week) until a day or for good;
// a change is to the whole series, and deleting asks "only this day, or all".
const REPEATS = ["none", "daily", "workdays", "weekly"];
export default function EventSheet({ event, defaults, people, onClose, onSaved }) {
  const { t, fmt } = useI18n();
  const editing = Boolean(event);
  const start0 = event ? event.start : defaults?.start ?? 9 * 60;
  const [title, setTitle] = useState(event?.title || "");
  const [kind, setKind] = useState(event?.kind || "meeting");
  // A series: its first day (changes are to all of it).
  const series = Boolean(event?.repeat);
  const [date, setDate] = useState((series ? event.seriesDate : event?.date) || defaults?.date || todayIso());
  const [repeat, setRepeat] = useState(event?.repeat || "none");
  const [repeatUntil, setRepeatUntil] = useState(event?.repeatUntil || "");
  const [allDay, setAllDay] = useState(editing && event.start == null);
  const [start, setStart] = useState(start0 ?? 9 * 60);
  const [end, setEnd] = useState(event?.end ?? Math.min((start0 ?? 9 * 60) + 60, 23 * 60 + 45));
  const [place, setPlace] = useState(event?.place || "");
  const [note, setNote] = useState(event?.note || "");
  const [ownerId, setOwnerId] = useState(event?.ownerId ?? defaults?.ownerId ?? people[0]?.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function changeStart(m) {
    // Keep the length when the start moves.
    setEnd(Math.min(m + Math.max(15, end - start), 24 * 60));
    setStart(m);
  }

  async function save(e) {
    e?.preventDefault();
    if (!title.trim()) return setError(t("personal.needTitle"));
    if (!allDay && end <= start) return setError(t("personal.badTimes"));
    setBusy(true);
    setError("");
    if (repeat !== "none" && repeatUntil && repeatUntil < date) return setError(t("personal.badUntil"));
    const payload = {
      title: title.trim(),
      kind,
      date,
      start: allDay ? null : start,
      end: allDay ? null : end,
      place: place.trim() || null,
      note: note.trim() || null,
      repeat: repeat === "none" ? null : repeat,
      repeatUntil: repeat === "none" ? null : repeatUntil || null,
    };
    try {
      const saved = editing ? await api.updatePersonalEvent(event.id, payload) : await api.addPersonalEvent({ ...payload, ownerId });
      onSaved(saved);
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(false);
    }
  }

  // `day`: only that day of a series.
  async function remove(day) {
    if (!window.confirm(day ? t("personal.deleteDayConfirm", { date: fmt.isoDay(day) }) : series ? t("personal.deleteSeriesConfirm") : t("personal.deleteConfirm"))) return;
    setBusy(true);
    try {
      await api.deletePersonalEvent(event.id, day);
      onSaved(null);
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(false);
    }
  }

  const today = todayIso();
  const quickDays = [
    { label: t("personal.today"), date: today },
    { label: t("personal.tomorrow"), date: shiftIso(today, 1) },
    ...(editing ? [{ label: t("personal.plusDay"), date: shiftIso(date, 1) }] : [{ label: t("personal.dayAfter"), date: shiftIso(today, 2) }]),
  ];

  return (
    <Sheet title={editing ? t("personal.editTitle") : t("personal.addTitle")} onClose={onClose}>
      <form className={pageStyles.formStack} onSubmit={save}>
        {event?.addedBy && <p className={pageStyles.note}>{t("personal.addedBy", { name: event.addedBy })}</p>}
        {!editing && people.length > 1 && (
          <SelectField label={t("personal.whoseCalendar")} value={ownerId} onChange={(e) => setOwnerId(Number(e.target.value))}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.isMe ? t("personal.me") : p.name}
              </option>
            ))}
          </SelectField>
        )}
        <TextField label={t("personal.what")} placeholder={t("personal.whatPlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!editing} maxLength={160} />

        <div className={styles.kinds} role="radiogroup" aria-label={t("personal.kind")}>
          {EVENT_KINDS.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} className={`${styles.kindChip} ${styles[`tone_${k}`]} ${kind === k ? styles.kindOn : ""}`} onClick={() => setKind(k)}>
              <Icon name={KIND_ICONS[k]} size={15} />
              {t(`personal.kinds.${k}`)}
            </button>
          ))}
        </div>

        <div>
          <TextField label={t("personal.date")} type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <div className={styles.quickDays}>
            {quickDays.map((q) => (
              <button key={q.label} type="button" className={`${styles.quickDay} ${date === q.date ? styles.quickDayOn : ""}`} onClick={() => setDate(q.date)}>
                {q.label}
              </button>
            ))}
            <span className={styles.quickDate}>{fmt.isoDay(date)}</span>
          </div>
        </div>

        {series && <p className={pageStyles.note}>{t("personal.seriesNote", { date: fmt.isoDay(event.date) })}</p>}
        <div className={styles.timeRow}>
          <SelectField label={t("personal.repeat")} value={repeat} onChange={(e) => setRepeat(e.target.value)}>
            {REPEATS.map((r) => (
              <option key={r} value={r}>
                {t(`personal.repeats.${r}`)}
              </option>
            ))}
          </SelectField>
          {repeat !== "none" && <TextField label={t("personal.repeatUntil")} type="date" value={repeatUntil} min={date} onChange={(e) => setRepeatUntil(e.target.value)} />}
        </div>
        <Switch label={t("personal.allDay")} checked={allDay} onChange={setAllDay} />
        {!allDay && (
          <div className={styles.timeRow}>
            <TimeSelect label={t("dayEdit.from")} value={start} onChange={changeStart} />
            <TimeSelect label={t("dayEdit.to")} value={end} onChange={setEnd} />
          </div>
        )}
        <TextField label={t("personal.place")} placeholder={t("personal.placePlaceholder")} value={place} onChange={(e) => setPlace(e.target.value)} maxLength={200} />
        <TextAreaField label={t("personal.note")} rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
        {event?.case && (
          <p className={pageStyles.note}>
            {t("personal.forClient", { name: event.case.clientName })}
          </p>
        )}

        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          {editing && series && (
            <Button variant="plain" icon="trash" disabled={busy} onClick={() => remove(event.date)}>
              {t("personal.deleteDay")}
            </Button>
          )}
          {editing && (
            <Button variant="plain" icon="trash" disabled={busy} onClick={() => remove()}>
              {series ? t("personal.deleteSeries") : t("personal.delete")}
            </Button>
          )}
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" type="submit" busy={busy}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
