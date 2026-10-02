import { useState } from "react";
import fieldStyles from "../ui/Field.module.css";
import Icon from "../ui/Icon";
import { readPref, writePref } from "../../lib/prefs";
import { useI18n } from "../../i18n";

// Whose phones the calls numbers are about. Not every monitored phone is a
// sales line: coordinators call clients who already signed, an office
// worker's phone rings with their own work. Calls and Home show the call
// center by default; the others are a tap away. The choice is remembered on
// this device and shared by both pages.
export const CALL_JOBS = ["call_center", "coordinator", "office", "other"];
const KEY = "callJobs";
const DEFAULT = ["call_center"];

export function useCallJobs() {
  const [jobs, setJobs] = useState(() => {
    const saved = String(readPref(KEY, DEFAULT.join(",")))
      .split(",")
      .filter((j) => CALL_JOBS.includes(j));
    return saved.length ? saved : DEFAULT;
  });
  function change(next) {
    // Never none: back to the call center.
    const list = next.length ? CALL_JOBS.filter((j) => next.includes(j)) : DEFAULT;
    writePref(KEY, list.join(","));
    setJobs(list);
  }
  return [jobs, change];
}

// counts: job -> monitored phones; a job without phones isn't offered.
export default function JobToggles({ value, onChange, counts }) {
  const { t } = useI18n();
  const shown = CALL_JOBS.filter((j) => !counts || counts[j] > 0 || value.includes(j));
  if (shown.length <= 1) return null;
  const toggle = (j) => onChange(value.includes(j) ? value.filter((x) => x !== j) : [...value, j]);
  return (
    <div className={fieldStyles.chips} role="group" aria-label={t("calls.whosePhones")}>
      {shown.map((j) => {
        const on = value.includes(j);
        return (
          <button key={j} type="button" role="checkbox" aria-checked={on} className={`${fieldStyles.chip} ${on ? fieldStyles.chipOn : ""}`} onClick={() => toggle(j)}>
            {on && <Icon name="check" size={14} strokeWidth={2.4} />}
            {t(`calls.jobs.${j}`)}
            {counts && counts[j] > 0 ? ` · ${counts[j]}` : ""}
          </button>
        );
      })}
    </div>
  );
}
