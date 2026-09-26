import styles from "./Calendar.module.css";
import { blocksOn, isWholeDay } from "../../lib/calendarDays";
import { shiftIso } from "../../lib/format";
import { useI18n } from "../../i18n";

// One word under each day, so the week reads at a glance: how many free
// times are left, or why there are none.
export function daySummary(week, date) {
  const blocks = blocksOn(week.blocks, date);
  if (blocks.some((b) => b.kind === "busy" && isWholeDay(b))) return { key: "busy", tone: "muted" };
  if (!blocks.some((b) => b.kind === "available")) return { key: "closed", tone: "muted" };
  if (date < week.today) return { key: "past", tone: "muted" };
  const free = week.free.filter((s) => s.date === date).length;
  return free > 0 ? { key: "free", tone: "good", count: free } : { key: "full", tone: "muted" };
}

// The week's seven days as big buttons.
export default function DayPicker({ week, selected, onSelect }) {
  const { t, fmt } = useI18n();
  const dates = Array.from({ length: 7 }, (_, i) => shiftIso(week.weekStart, i));

  return (
    <div className={styles.dayPicker} role="tablist" aria-label={fmt.weekRange(week.weekStart)}>
      {dates.map((date) => {
        const summary = week.status === "none" && !week.canManage ? null : daySummary(week, date);
        const text = summary ? t(`calendar.day.${summary.key}`, { count: summary.count }) : "";
        const cls = [
          styles.dayButton,
          date === selected ? styles.daySelected : "",
          date === week.today ? styles.dayToday : "",
          date < week.today ? styles.dayPast : "",
        ].join(" ");
        return (
          <button
            key={date}
            type="button"
            role="tab"
            aria-selected={date === selected}
            aria-label={`${fmt.isoDay(date)}${text ? `, ${text}` : ""}`}
            className={cls}
            onClick={() => onSelect(date)}
          >
            <span className={styles.dayWeekday}>{fmt.weekdayShort(date)}</span>
            <span className={styles.dayNumber}>{fmt.dayOfMonth(date)}</span>
            <span className={`${styles.daySummary} ${summary?.tone === "good" ? styles.summaryGood : ""}`}>{text}</span>
          </button>
        );
      })}
    </div>
  );
}
