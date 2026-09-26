import { useState } from "react";
import styles from "./DailyChart.module.css";
import Segmented from "../ui/Segmented";
import { useElementWidth } from "../../hooks/useAsync";
import { useI18n } from "../../i18n";

const PLOT_H = 170;
const TOP_PAD = 8;
const AXIS_W = 32;
const AXIS_H = 24;
const MAX_BAR = 24;
const GAP = 2;

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

// Calls per day, answered + missed stacked. Hover/tap or arrow keys show a
// day's numbers; the Table view shows every value without hovering.
export default function DailyChart({ data }) {
  const { t, fmt } = useI18n();
  const [ref, width] = useElementWidth();
  const [view, setView] = useState("chart");
  const [active, setActive] = useState(null);

  const n = data.length;
  const plotW = Math.max(0, width - AXIS_W);
  const top = niceCeil(Math.max(1, ...data.map((d) => d.total)));
  const ticks = [...new Set([0, top / 2, top])].filter(Number.isInteger);
  const scale = (v) => ((PLOT_H - TOP_PAD) * v) / top;
  const band = n ? plotW / n : 0;
  const barW = Math.max(2, Math.min(MAX_BAR, Math.floor(band * 0.62)));

  const maxLabels = Math.max(2, Math.floor(plotW / 52));
  const step = Math.max(1, Math.ceil(n / maxLabels));
  const labelled = (i) => (n - 1 - i) % step === 0;

  const centerX = (i) => AXIS_W + i * band + band / 2;
  const activeDay = active != null ? data[active] : null;

  function onKeyDown(e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setActive((i) => {
      const current = i ?? n - 1;
      return Math.max(0, Math.min(n - 1, current + (e.key === "ArrowRight" ? 1 : -1)));
    });
  }

  return (
    <div className={styles.wrap} ref={ref}>
      <div className={styles.toolbar}>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <i className={`${styles.swatch} ${styles.answeredSwatch}`} />
            {t("dashboard.answered")}
          </span>
          <span className={styles.legendItem}>
            <i className={`${styles.swatch} ${styles.missedSwatch}`} />
            {t("dashboard.missed")}
          </span>
        </div>
        <Segmented
          size="small"
          value={view}
          onChange={setView}
          label={t("dashboard.perDay")}
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
                <th>{t("dashboard.date")}</th>
                <th>{t("dashboard.total")}</th>
                <th>{t("dashboard.answered")}</th>
                <th>{t("dashboard.missed")}</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.date}>
                  <td>{fmt.isoDateLong(d.date)}</td>
                  <td>{fmt.number(d.total)}</td>
                  <td>{fmt.number(d.total - d.missed)}</td>
                  <td>{fmt.number(d.missed)}</td>
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
              aria-label={t("dashboard.perDay")}
              onPointerLeave={() => setActive(null)}
              onBlur={() => setActive(null)}
              onFocus={() => setActive((i) => i ?? n - 1)}
              onKeyDown={onKeyDown}
            >
              {ticks.map((v) => (
                <g key={v}>
                  <line
                    x1={AXIS_W}
                    x2={width}
                    y1={PLOT_H - scale(v)}
                    y2={PLOT_H - scale(v)}
                    className={v === 0 ? styles.baseline : styles.grid}
                  />
                  <text x={AXIS_W - 8} y={PLOT_H - scale(v)} dy="0.35em" textAnchor="end" className={styles.tick}>
                    {fmt.number(v)}
                  </text>
                </g>
              ))}

              {data.map((d, i) => {
                const answered = d.total - d.missed;
                const hA = scale(answered);
                const hM = scale(d.missed);
                const x = centerX(i) - barW / 2;
                const gap = hA > 0 && hM > 0 ? GAP : 0;
                const dim = active != null && active !== i;
                return (
                  <g key={d.date} className={dim ? styles.dim : undefined}>
                    {hA > 0 && (
                      <path
                        className={styles.answered}
                        d={hM > 0 ? `M${x},${PLOT_H}V${PLOT_H - hA}H${x + barW}V${PLOT_H}Z` : topRoundedRect(x, PLOT_H - hA, barW, hA)}
                      />
                    )}
                    {hM > 0 && (
                      <path className={styles.missed} d={topRoundedRect(x, PLOT_H - hA - gap - hM, barW, hM)} />
                    )}
                  </g>
                );
              })}

              {data.map((d, i) =>
                labelled(i) ? (
                  <text
                    key={`l-${d.date}`}
                    x={Math.min(Math.max(centerX(i), AXIS_W + 14), width - 16)}
                    y={PLOT_H + 17}
                    textAnchor="middle"
                    className={styles.tick}
                  >
                    {fmt.axisDate(d.date)}
                  </text>
                ) : null
              )}

              {/* Hit targets: the whole day column, not just the painted bar. */}
              {data.map((d, i) => (
                <rect
                  key={`h-${d.date}`}
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

          {activeDay && (
            <div
              className={styles.tooltip}
              style={{ left: Math.min(Math.max(centerX(active), 90), width - 90) }}
              role="status"
            >
              <div className={styles.tooltipDate}>{fmt.isoDateLong(activeDay.date)}</div>
              <div className={styles.tooltipRow}>
                <i className={`${styles.key} ${styles.answeredSwatch}`} />
                <strong>{fmt.number(activeDay.total - activeDay.missed)}</strong>
                <span>{t("dashboard.answered")}</span>
              </div>
              <div className={styles.tooltipRow}>
                <i className={`${styles.key} ${styles.missedSwatch}`} />
                <strong>{fmt.number(activeDay.missed)}</strong>
                <span>{t("dashboard.missed")}</span>
              </div>
              <div className={`${styles.tooltipRow} ${styles.tooltipTotal}`}>
                <i className={styles.keySpacer} />
                <strong>{fmt.number(activeDay.total)}</strong>
                <span>{t("dashboard.total")}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
