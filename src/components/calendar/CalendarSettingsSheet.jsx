import { useState } from "react";
import styles from "./Calendar.module.css";
import pageStyles from "../../pages/Pages.module.css";
import Sheet from "../ui/Sheet";
import Button from "../ui/Button";
import Segmented from "../ui/Segmented";
import { Switch } from "../ui/Field";
import TimeSelect from "./TimeSelect";
import { api } from "../../lib/api";
import { shiftIso } from "../../lib/format";
import { useI18n } from "../../i18n";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const SLOT_OPTIONS = [20, 30, 45, 60];
// Any Monday: only used to name the weekdays.
const A_MONDAY = "2026-09-28";

// The usual week, which every new week starts from: working days, reception
// hours, the lunch break (12:00–13:00 unless changed; can be switched off)
// and how long one appointment is.
export default function CalendarSettingsSheet({ calendar, onClose, onSaved }) {
  const { t, fmt } = useI18n();
  const u = calendar.usual;
  const [workDays, setWorkDays] = useState(u.workDays);
  const [dayStart, setDayStart] = useState(u.dayStart);
  const [dayEnd, setDayEnd] = useState(u.dayEnd);
  const [lunchOn, setLunchOn] = useState(Boolean(u.lunch));
  const [lunchStart, setLunchStart] = useState(u.lunch?.start ?? 12 * 60);
  const [lunchEnd, setLunchEnd] = useState(u.lunch?.end ?? 13 * 60);
  const [slotMinutes, setSlotMinutes] = useState(u.slotMinutes);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const toggleDay = (d) => setWorkDays((days) => (days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => a - b)));

  async function save() {
    if (dayEnd <= dayStart) return setError(t("calSettings.badHours"));
    if (lunchOn && (lunchEnd <= lunchStart || lunchStart < dayStart || lunchEnd > dayEnd)) return setError(t("calSettings.badLunch"));
    setError("");
    setBusy(true);
    try {
      const updated = await api.updateCalendar(calendar.id, {
        workDays,
        dayStart,
        dayEnd,
        lunch: lunchOn ? { start: lunchStart, end: lunchEnd } : null,
        slotMinutes,
      });
      onSaved(updated);
    } catch (err) {
      setError(t("calSettings.saveFailed", { reason: err.code || "?" }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={t("calSettings.title")} onClose={onClose}>
      <p className={pageStyles.note}>{t("calSettings.intro")}</p>

      <section className={styles.settingsSection}>
        <h3 className={styles.settingsLabel}>{t("calSettings.workDays")}</h3>
        <div className={styles.weekdayToggles} role="group" aria-label={t("calSettings.workDays")}>
          {WEEKDAYS.map((d) => {
            const date = fmt.weekdayShort(shiftIso(A_MONDAY, d - 1));
            const on = workDays.includes(d);
            return (
              <button key={d} type="button" role="checkbox" aria-checked={on} className={`${styles.weekdayToggle} ${on ? styles.weekdayOn : ""}`} onClick={() => toggleDay(d)}>
                {date}
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.settingsSection}>
        <h3 className={styles.settingsLabel}>{t("calSettings.hours")}</h3>
        <div className={styles.timeRow}>
          <TimeSelect label={t("dayEdit.from")} value={dayStart} onChange={setDayStart} />
          <TimeSelect label={t("dayEdit.to")} value={dayEnd} onChange={setDayEnd} />
        </div>
      </section>

      <section className={styles.settingsSection}>
        <Switch label={t("calSettings.lunch")} hint={t("calSettings.lunchHint")} checked={lunchOn} onChange={setLunchOn} />
        {lunchOn && (
          <div className={styles.timeRow}>
            <TimeSelect label={t("dayEdit.from")} value={lunchStart} onChange={setLunchStart} />
            <TimeSelect label={t("dayEdit.to")} value={lunchEnd} onChange={setLunchEnd} />
          </div>
        )}
      </section>

      <section className={styles.settingsSection}>
        <h3 className={styles.settingsLabel}>{t("calSettings.slot")}</h3>
        <Segmented
          full
          value={slotMinutes}
          onChange={setSlotMinutes}
          label={t("calSettings.slot")}
          options={SLOT_OPTIONS.map((m) => ({ value: m, label: t("calendar.minutes", { n: m }) }))}
        />
      </section>

      <p className={pageStyles.note}>{t("calSettings.savedWeeksNote")}</p>
      {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
      <div className={pageStyles.formActions}>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="primary" busy={busy} onClick={save}>
          {t("calSettings.save")}
        </Button>
      </div>
    </Sheet>
  );
}

