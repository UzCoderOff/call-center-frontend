import { useState } from "react";
import styles from "./Finance.module.css";
import Segmented from "../ui/Segmented";
import { useElementWidth } from "../../hooks/useAsync";
import { useI18n } from "../../i18n";

const PLOT_H = 180;
const TOP_PAD = 8;
const AXIS_W = 52;
const AXIS_H = 24;
const MAX_BAR = 24;
const GAP = 2;

// Where the money came from, bottom to top (colors: tokens.css, validated).
export const SERIES = [
  { key: "consultation", cls: "s1" },
  { key: "contract", cls: "s2" },
  { key: "otherIncome", cls: "s3" },
];

// 1, 2, 5, 10, 20, 50… — the smallest "clean" number >= v.
function niceCeil(v) {
  if (v <= 1) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  const f = v / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
}

// Column with a 4px rounded data-end on top, square at the baseline.
function topRoundedRect(x, y, w, h) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h}Z`;
}

// "12,5 mln", "450 ming" — for axis ticks, where full amounts don't fit.
export function useCompactMoney() {
  const { t, lang } = useI18n();
  return (n) => {
    const abs = Math.abs(n);
    const one = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1)).replace(".", lang === "uz" ? "," : ".");
    if (abs >= 1e9) return t("finance.compact.b", { n: one(Math.round(n / 1e8) / 10) });
    if (abs >= 1e6) return t("finance.compact.m", { n: one(Math.round(n / 1e5) / 10) });
    if (abs >= 1e3) return t("finance.compact.k", { n: one(Math.round(n / 100) / 10) });
    return String(n);
  };
}

// Income over time as stacked columns — consultation fees, contract
// payments, and other income (report income + other payments) — one column
// per row (a month, or a day). Hover/tap or arrow keys show a column's
// numbers, with expenses and net; the table view shows every value.
// rows: [{ key, axis, title, consultation, contract, otherIncome, expenses }]
export default function FinanceChart({ rows, label, showExpenses = true }) {
  const { t, fmt } = useI18n();
  const compact = useCompactMoney();
  const [ref, width] = useElementWidth();
  const [view, setView] = useState("chart");
  const [active, setActive] = useState(null);

  const total = (r) => r.consultation + r.contract + r.otherIncome;
  const n = rows.length;
  const plotW = Math.max(0, width - AXIS_W);
  const top = niceCeil(Math.max(1, ...rows.map(total)));
  const ticks = [0, top / 2, top];
  const scale = (v) => ((PLOT_H - TOP_PAD) * v) / top;
  const band = n ? plotW / n : 0;
  const barW = Math.max(2, Math.min(MAX_BAR, Math.floor(band * 0.62)));
  const maxLabels = Math.max(2, Math.floor(plotW / 48));
  const step = Math.max(1, Math.ceil(n / maxLabels));
  const labelled = (i) => (n - 1 - i) % step === 0;
  const centerX = (i) => AXIS_W + i * band + band / 2;
  const activeRow = active != null ? rows[active] : null;

  function onKeyDown(e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setActive((i) => Math.max(0, Math.min(n - 1, (i ?? n - 1) + (e.key === "ArrowRight" ? 1 : -1))));
  }

  return (
    <div className={styles.chartWrap} ref={ref}>
      <div className={styles.toolbar}>
        <div className={styles.legend}>
          {SERIES.map((s) => (
            <span key={s.key} className={styles.legendItem}>
              <i className={`${styles.swatch} ${styles[s.cls]}`} />
              {t(`finance.series.${s.key}`)}
            </span>
          ))}
        </div>
        <Segmented
          size="small"
          value={view}
          onChange={setView}
          label={label}
          options={[
            { value: "chart", label: t("dashboard.chartView") },
            { value: "table", label: t("dashboard.tableView") },
          ]}
        />
      </div>

      {view === "table" ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{label}</th>
                {SERIES.map((s) => (
                  <th key={s.key}>{t(`finance.series.${s.key}`)}</th>
                ))}
                <th>{t("finance.incomeShort")}</th>
                {showExpenses && <th>{t("finance.expensesShort")}</th>}
                {showExpenses && <th>{t("finance.netShort")}</th>}
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.key}>
                  <td>{r.title}</td>
                  {SERIES.map((s) => (
                    <td key={s.key}>{fmt.number(r[s.key])}</td>
                  ))}
                  <td>
                    <strong>{fmt.number(total(r))}</strong>
                  </td>
                  {showExpenses && <td>{fmt.number(r.expenses)}</td>}
                  {showExpenses && <td>{fmt.number(total(r) - r.expenses)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.plot}>
          {width > 0 && (
            <svg
              width={width}
              height={PLOT_H + AXIS_H}
              className={styles.svg}
              tabIndex={0}
              role="img"
              aria-label={label}
              onPointerLeave={() => setActive(null)}
              onBlur={() => setActive(null)}
              onFocus={() => setActive((i) => i ?? n - 1)}
              onKeyDown={onKeyDown}
            >
              {ticks.map((v) => (
                <g key={v}>
                  <line x1={AXIS_W} x2={width} y1={PLOT_H - scale(v)} y2={PLOT_H - scale(v)} className={v === 0 ? styles.baseline : styles.grid} />
                  <text x={AXIS_W - 8} y={PLOT_H - scale(v)} dy="0.35em" textAnchor="end" className={styles.tick}>
                    {compact(v)}
                  </text>
                </g>
              ))}

              {rows.map((r, i) => {
                const x = centerX(i) - barW / 2;
                const parts = SERIES.map((s) => ({ ...s, h: scale(r[s.key]) })).filter((p) => p.h > 0);
                // Each segment takes its own height; from the second one up,
                // its bottom 2px are left as the surface gap.
                let base = PLOT_H;
                return (
                  <g key={r.key} className={active != null && active !== i ? styles.dim : undefined}>
                    {parts.map((p, j) => {
                      const yTop = base - p.h;
                      const bottom = j > 0 ? base - GAP : base;
                      base = yTop;
                      const h = Math.max(1, bottom - yTop);
                      const last = j === parts.length - 1;
                      const d = last ? topRoundedRect(x, yTop, barW, h) : `M${x},${yTop}V${yTop + h}H${x + barW}V${yTop}Z`;
                      return <path key={p.key} className={styles[p.cls]} d={d} />;
                    })}
                  </g>
                );
              })}

              {rows.map((r, i) =>
                labelled(i) ? (
                  <text key={`l-${r.key}`} x={Math.min(Math.max(centerX(i), AXIS_W + 14), width - 16)} y={PLOT_H + 17} textAnchor="middle" className={styles.tick}>
                    {r.axis}
                  </text>
                ) : null
              )}

              {/* Hit targets: the whole column, not just the painted bar. */}
              {rows.map((r, i) => (
                <rect
                  key={`h-${r.key}`}
                  x={AXIS_W + i * band}
                  y={0}
                  width={band}
                  height={PLOT_H}
                  className={styles.hit}
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={() => setActive(i)}
                />
              ))}
            </svg>
          )}

          {activeRow && (
            <div className={styles.tooltip} style={{ left: Math.min(Math.max(centerX(active), 110), width - 110) }} role="status">
              <div className={styles.tooltipTitle}>{activeRow.title}</div>
              {SERIES.map((s) => (
                <div key={s.key} className={styles.tooltipRow}>
                  <i className={`${styles.key} ${styles[s.cls]}`} />
                  <strong>{fmt.number(activeRow[s.key])}</strong>
                  <span>{t(`finance.series.${s.key}`)}</span>
                </div>
              ))}
              <div className={`${styles.tooltipRow} ${styles.tooltipTotal}`}>
                <i className={styles.keySpacer} />
                <strong>{fmt.number(total(activeRow))}</strong>
                <span>{t("finance.incomeShort")}</span>
              </div>
              {showExpenses && activeRow.expenses > 0 && (
                <>
                  <div className={styles.tooltipRow}>
                    <i className={styles.keySpacer} />
                    <strong>−{fmt.number(activeRow.expenses)}</strong>
                    <span>{t("finance.expensesShort")}</span>
                  </div>
                  <div className={styles.tooltipRow}>
                    <i className={styles.keySpacer} />
                    <strong>{fmt.number(total(activeRow) - activeRow.expenses)}</strong>
                    <span>{t("finance.netShort")}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
