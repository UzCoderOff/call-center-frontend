import styles from "./Finance.module.css";
import { useI18n } from "../../i18n";

// Small pieces the Moliya tabs share.

export function shiftMonth(month, by) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
}

export function useMonthLabel() {
  const { t } = useI18n();
  const months = t("time.months");
  return (month, short = false) => {
    const [y, m] = month.split("-").map(Number);
    const name = Array.isArray(months) ? months[m - 1] : String(m);
    const cap = `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
    // Short: without the year (Uzbek "Iyun"/"Iyul" can't be cut to 3 letters).
    return short ? cap : `${cap} ${y}`;
  };
}

// "Oʻtgan oy: 4 200 000 soʻm (+12%)" — this month against the last one.
export function useVsPrev() {
  const { t, fmt } = useI18n();
  return (now, before) => {
    if (!before && !now) return t("finance.prevNone");
    if (!before) return t("finance.prevZero");
    const pct = Math.round(((now - before) / Math.abs(before)) * 100);
    return t("finance.prevLine", { amount: fmt.money(before), delta: `${pct > 0 ? "+" : pct < 0 ? "−" : "±"}${Math.abs(pct)}%` });
  };
}

export const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// One part-to-whole bar (e.g. consultation / contract / other income) with
// its legend: each part's amount and share, so nothing depends on color.
export function ShareBar({ parts, total }) {
  const { fmt } = useI18n();
  const shown = parts.filter((p) => p.amount > 0);
  if (total <= 0 || shown.length === 0) return null;
  return (
    <div className={styles.share}>
      <div className={styles.shareBar} role="img" aria-label={shown.map((p) => `${p.label}: ${percent(p.amount, total)}%`).join(", ")}>
        {shown.map((p) => (
          <span key={p.key} className={`${styles.shareSeg} ${styles[p.cls]}`} style={{ flexGrow: p.amount }} title={`${p.label}: ${fmt.money(p.amount)}`} />
        ))}
      </div>
      <div className={styles.shareLegend}>
        {parts.map((p) => (
          <span key={p.key} className={styles.shareItem}>
            <i className={`${styles.swatch} ${styles[p.cls]}`} />
            <span className={styles.shareLabel}>{p.label}</span>
            <strong>{fmt.money(p.amount)}</strong>
            <span className={styles.muted}>{percent(p.amount, total)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// A line of the "where the money came from" breakdown. level 0: a source,
// 1: its part, 2: a part of that; "total": a sum line.
export function Line({ level = 0, label, note, amount, negative = false, total = false }) {
  const { fmt } = useI18n();
  return (
    <div className={`${styles.line} ${styles[`level${level}`] || ""} ${total ? styles.lineTotal : ""}`}>
      <span className={styles.lineLabel}>
        {label}
        {note && <span className={styles.lineNote}>{note}</span>}
      </span>
      <span className={styles.lineAmount}>
        {negative && amount > 0 ? "−" : ""}
        {fmt.money(amount)}
      </span>
    </div>
  );
}

// A label with an amount and a thin bar for its size (one series — one
// color); `max` is the biggest amount in the list.
export function MeterRow({ label, sub, amount, max, extra }) {
  const { fmt } = useI18n();
  return (
    <div className={styles.meterRow}>
      <div className={styles.meterHead}>
        <span className={styles.meterLabel}>{label}</span>
        <strong className={styles.meterAmount}>{fmt.money(amount)}</strong>
      </div>
      <span className={styles.meterTrack} aria-hidden="true">
        <span className={styles.meterFill} style={{ width: `${max > 0 ? Math.max(1, (amount / max) * 100) : 0}%` }} />
      </span>
      {(sub || extra) && (
        <div className={styles.meterSub}>
          {sub}
          {extra}
        </div>
      )}
    </div>
  );
}

// A plain table that scrolls sideways on a phone instead of squeezing.
export function Table({ head, rows, empty }) {
  if (rows.length === 0) return empty ? <p className={styles.emptyNote}>{empty}</p> : null;
  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i}>
              {cells.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
