import { useState } from "react";
import styles from "./NewCallers.module.css";
import fieldStyles from "../ui/Field.module.css";
import Button from "../ui/Button";
import { shiftIso, todayIso } from "../../lib/format";
import { useI18n } from "../../i18n";

// What came of a new caller who didn't book (services/callOutcomes.js): one
// tap — the day to talk again for "thinking it over", a word for "something
// else". On the home page's list (NewCallers) and when Ledger asks right
// after the call (AfterCallGate). `onSave(outcome, note, followUpOn)` returns
// a promise; it stays open when saving fails.
const GROUP_ORDER = ["thinking", "lost", "notOurs"];
// Quick picks for the day to talk again, in days from today.
const WHEN = [1, 2, 7];
const DEFAULT_WHEN = 2;

export default function OutcomeChoices({ groups, outcomes, busy, onSave }) {
  const { t } = useI18n();
  const [writing, setWriting] = useState(false); // "other" being written
  const [note, setNote] = useState("");
  const [planning, setPlanning] = useState(false); // the "talk again" day being picked
  const [day, setDay] = useState(""); // that day, "YYYY-MM-DD"

  if (writing) {
    return (
      <form
        className={styles.other}
        onSubmit={(e) => {
          e.preventDefault();
          if (note.trim()) onSave("other", note.trim());
        }}
      >
        <input className={fieldStyles.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("newCallers.otherPh")} maxLength={300} autoFocus />
        <Button type="submit" size="small" variant="primary" busy={busy} disabled={!note.trim()}>
          {t("common.save")}
        </Button>
        <Button size="small" onClick={() => (setWriting(false), setNote(""))}>
          {t("common.cancel")}
        </Button>
      </form>
    );
  }

  if (planning) {
    return (
      <div className={styles.when}>
        <span className={styles.groupLabel}>{t("newCallers.whenTitle")}</span>
        <div className={fieldStyles.chips}>
          {WHEN.map((n) => (
            <button key={n} type="button" className={`${fieldStyles.chip} ${day === shiftIso(todayIso(), n) ? fieldStyles.chipOn || "" : ""}`} aria-pressed={day === shiftIso(todayIso(), n)} onClick={() => setDay(shiftIso(todayIso(), n))}>
              {t(`newCallers.when.${n}`)}
            </button>
          ))}
          <input type="date" className={`${fieldStyles.input} ${styles.date}`} value={day} min={shiftIso(todayIso(), 1)} max={shiftIso(todayIso(), 30)} onChange={(e) => setDay(e.target.value)} aria-label={t("newCallers.whenTitle")} />
        </div>
        <p className={styles.whenNote}>{t("newCallers.whenNote")}</p>
        <div className={styles.whenActions}>
          <Button size="small" variant="primary" busy={busy} disabled={!day} onClick={() => onSave("call_again", null, day)}>
            {t("common.save")}
          </Button>
          <Button size="small" onClick={() => setPlanning(false)}>
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.groups}>
      {/* An older server without groups: one plain row. */}
      {(groups ? GROUP_ORDER.filter((g) => groups[g]).map((g) => [g, groups[g]]) : [["all", outcomes]]).map(([g, list]) => (
        <div key={g} className={styles.group}>
          {g !== "all" && <span className={styles.groupLabel}>{t(`newCallers.groups.${g}`)}</span>}
          <div className={fieldStyles.chips}>
            {list.map((o) => (
              <button
                key={o}
                type="button"
                className={fieldStyles.chip}
                disabled={busy}
                onClick={() => {
                  if (o === "other") {
                    setWriting(true);
                    setNote("");
                  } else if (o === "call_again") {
                    setPlanning(true);
                    setDay(shiftIso(todayIso(), DEFAULT_WHEN));
                  } else onSave(o);
                }}
              >
                {t(`newCallers.outcomes.${o}`)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
