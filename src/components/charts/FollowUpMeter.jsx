import styles from "./FollowUpMeter.module.css";
import Icon from "../ui/Icon";
import { formatPercent } from "../../lib/format";
import { useI18n } from "../../i18n";

const SEGMENTS = [
  { key: "reached", tone: "good", icon: "checkCircle" },
  { key: "attempted", tone: "warning", icon: "clock" },
  { key: "pending", tone: "critical", icon: "alertCircle" },
  { key: "noNumber", tone: "neutral", icon: "minusCircle" },
];

// "Of the calls we missed, how many did we get back to?" — the number that
// puts the raw miss rate in context. Part-to-whole of missed calls, with
// every count listed beside its icon + label (the meter is never the only
// way to read a value).
export default function FollowUpMeter({ stats }) {
  const { t, fmt } = useI18n();
  const f = stats.followUp;
  const missed = stats.missedCalls;

  if (missed === 0) {
    return (
      <div className={styles.none}>
        <Icon name="checkCircle" size={18} />
        {t("followUp.none")}
      </div>
    );
  }

  const reachablePct = formatPercent(f.reached, missed);
  const rows = SEGMENTS.filter((s) => s.key !== "noNumber" || f.noNumber > 0);

  return (
    <div>
      <div className={styles.hero}>
        <span className={styles.heroValue}>{reachablePct}%</span>
        <span className={styles.heroText}>
          {t("followUp.headline", { missed: fmt.number(missed), reached: fmt.number(f.reached) })}
        </span>
      </div>

      <div className={styles.meter} role="img" aria-label={t("followUp.reachedPct", { pct: reachablePct })}>
        {SEGMENTS.map((s) =>
          f[s.key] > 0 ? (
            <span
              key={s.key}
              className={`${styles.segment} ${styles[s.tone]}`}
              style={{ flexGrow: f[s.key] }}
              title={`${t(`followUp.${s.key}`)}: ${f[s.key]}`}
            />
          ) : null
        )}
      </div>

      <ul className={styles.rows}>
        {rows.map((s) => (
          <li key={s.key} className={styles.row}>
            <Icon name={s.icon} size={16} strokeWidth={2} className={styles[`${s.tone}Icon`]} />
            <span className={styles.rowLabel}>{t(`followUp.${s.key}`)}</span>
            <span className={styles.rowValue}>{fmt.number(f[s.key])}</span>
          </li>
        ))}
      </ul>

      {f.medianCallbackSec != null && (
        <p className={styles.median}>
          <Icon name="clock" size={14} />
          {t("followUp.median", { time: fmt.duration(f.medianCallbackSec) })}
        </p>
      )}
    </div>
  );
}
