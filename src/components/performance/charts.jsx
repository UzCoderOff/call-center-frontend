import { useState } from "react";
import styles from "./Performance.module.css";
import Segmented from "../ui/Segmented";
import { useElementWidth } from "../../hooks/useAsync";
import { useI18n } from "../../i18n";

// The performance page's charts. Colors: consultations blue, contracts
// orange (the finance page's validated set, tokens.css); the plan is always
// neutral ink, never a series color.

function niceCeil(v) {
  if (v <= 1) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  const f = v / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
}

function topRoundedRect(x, y, w, h) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h}Z`;
}

// ------------------------------------------------------- burn-up
const PLOT_H = 170;
const TOP = 10;
const AXIS_W_COUNT = 34;
const AXIS_W_MONEY = 52;
const AXIS_H = 22;

// The month so far: the running total of what was done (series color) and
// where the plan says it should be each day (neutral), with a crosshair and a
// table view. dates: every day of the month; perDay: date -> count (up to
// today); workDates: the working days (the plan spreads over them). money:
// soʻm (the axis in millions).
export function BurnUpChart({ dates, perDay, workDates, target, tone = "s1", label, money = false }) {
  const { t, fmt } = useI18n();
  const AXIS_W = money ? AXIS_W_MONEY : AXIS_W_COUNT;
  const show = (v) => (money ? fmt.money(Math.round(v)) : v);
  const tickText = (v) => (money && v >= 1_000_000 ? `${fmt.number(Math.round((v / 1_000_000) * 10) / 10)} ${t("perf.chart.mln")}` : fmt.number(v));
  const [ref, width] = useElementWidth();
  const [view, setView] = useState("chart");
  const [active, setActive] = useState(null);

  // Running totals: what was done by each day (none after today), and what
  // the target asks for by then.
  const work = new Set(workDates);
  const actual = [];
  const planned = [];
  for (let i = 0, run = 0, workDone = 0; i < dates.length; i++) {
    if (work.has(dates[i])) workDone += 1;
    planned.push(target ? Math.round(((target * workDone) / Math.max(1, workDates.length)) * 10) / 10 : null);
    if (perDay.has(dates[i])) {
      run += perDay.get(dates[i]);
      actual.push(run);
    } else actual.push(null);
  }
  const plan = target ? planned : null;
  const top = niceCeil(Math.max(1, target || 0, ...actual.filter((v) => v != null)));
  const plotW = Math.max(0, width - AXIS_W - 8);
  const x = (i) => AXIS_W + (dates.length > 1 ? (i / (dates.length - 1)) * plotW : 0);
  const y = (v) => PLOT_H - ((PLOT_H - TOP) * v) / top;
  const line = (values) =>
    values
      .map((v, i) => (v == null ? null : `${x(i)},${y(v)}`))
      .filter(Boolean)
      .map((p, i) => `${i ? "L" : "M"}${p}`)
      .join("");
  const lastActual = actual.reduce((last, v, i) => (v != null ? i : last), -1);
  const step = Math.max(1, Math.ceil(dates.length / Math.max(2, Math.floor(plotW / 44))));

  function pick(clientX, rect) {
    const rel = clientX - rect.left - AXIS_W;
    const i = Math.round((rel / Math.max(1, plotW)) * (dates.length - 1));
    setActive(Math.max(0, Math.min(dates.length - 1, i)));
  }

  return (
    <div ref={ref} className={styles.chartWrap}>
      <div className={styles.toolbar}>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <i className={`${styles.lineKey} ${styles[tone]}`} />
            {label}
          </span>
          {plan && (
            <span className={styles.legendItem}>
              <i className={`${styles.lineKey} ${styles.planKey}`} />
              {t("perf.chart.plan", { target: money ? fmt.money(target) : target })}
            </span>
          )}
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
                <th>{t("perf.col.date")}</th>
                <th>{t("perf.chart.thatDay")}</th>
                <th>{t("perf.chart.soFar")}</th>
                {plan && <th>{t("perf.chart.planSoFar")}</th>}
              </tr>
            </thead>
            <tbody>
              {dates
                .map((d, i) => ({ d, i }))
                .filter(({ d }) => perDay.has(d))
                .reverse()
                .map(({ d, i }) => (
                  <tr key={d}>
                    <td>{fmt.isoDateLong(d)}</td>
                    <td>{show(perDay.get(d))}</td>
                    <td>
                      <strong>{show(actual[i])}</strong>
                    </td>
                    {plan && <td>{show(Math.round(plan[i]))}</td>}
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
              role="img"
              aria-label={label}
              tabIndex={0}
              onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
              onPointerDown={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(lastActual >= 0 ? lastActual : 0)}
              onBlur={() => setActive(null)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                e.preventDefault();
                setActive((i) => Math.max(0, Math.min(dates.length - 1, (i ?? lastActual) + (e.key === "ArrowRight" ? 1 : -1))));
              }}
            >
              {[0, top / 2, top].filter((v) => Number.isInteger(v)).map((v) => (
                <g key={v}>
                  <line x1={AXIS_W} x2={width - 8} y1={y(v)} y2={y(v)} className={v === 0 ? styles.baseline : styles.grid} />
                  <text x={AXIS_W - 8} y={y(v)} dy="0.35em" textAnchor="end" className={styles.tick}>
                    {tickText(v)}
                  </text>
                </g>
              ))}
              {dates.map((d, i) =>
                (dates.length - 1 - i) % step === 0 ? (
                  <text key={d} x={x(i)} y={PLOT_H + 16} textAnchor="middle" className={styles.tick}>
                    {Number(d.slice(8, 10))}
                  </text>
                ) : null
              )}
              {plan && <path d={line(plan)} className={styles.planLine} />}
              <path d={line(actual)} className={`${styles.actualLine} ${styles[`${tone}Stroke`]}`} />
              {lastActual >= 0 && <circle cx={x(lastActual)} cy={y(actual[lastActual])} r={4.5} className={`${styles.endDot} ${styles[tone]}`} />}
              {active != null && <line x1={x(active)} x2={x(active)} y1={TOP} y2={PLOT_H} className={styles.crosshair} />}
            </svg>
          )}
          {active != null && width > 0 && (
            <div className={styles.tooltip} style={{ left: Math.min(Math.max(x(active), 90), width - 90) }} role="status">
              <div className={styles.tooltipTitle}>{fmt.isoDateLong(dates[active])}</div>
              <div className={styles.tooltipRow}>
                <i className={`${styles.key} ${styles[tone]}`} />
                <strong>{actual[active] != null ? show(actual[active]) : "—"}</strong>
                <span>{t("perf.chart.soFar")}</span>
              </div>
              {plan && (
                <div className={styles.tooltipRow}>
                  <i className={`${styles.key} ${styles.planKeyBg}`} />
                  <strong>{show(Math.round(plan[active]))}</strong>
                  <span>{t("perf.chart.planSoFar")}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// One measure over the last months (e.g. documents translated), one column
// per month with its number on top — few columns, so every value is labelled.
// rows: [{ month, value }]; show: value -> text.
export function MeasureMonthsChart({ rows, monthLabel, show, label }) {
  const [ref, width] = useElementWidth();
  const top = niceCeil(Math.max(1, ...rows.map((r) => r.value)));
  const plotW = Math.max(0, width - 8);
  const band = rows.length ? plotW / rows.length : 0;
  const barW = Math.max(6, Math.min(28, Math.floor(band * 0.45)));
  const h = 150;
  const y = (v) => h - ((h - 22) * v) / top;
  return (
    <div ref={ref} className={styles.chartWrap}>
      {width > 0 && (
        <svg width={width} height={h + 22} className={styles.svg} role="img" aria-label={label}>
          <line x1={0} x2={width} y1={h} y2={h} className={styles.baseline} />
          {rows.map((r, i) => {
            const cx = 4 + i * band + band / 2;
            const bh = h - y(r.value);
            return (
              <g key={r.month}>
                {bh > 0 && <path d={topRoundedRect(cx - barW / 2, y(r.value), barW, bh)} className={styles.s1} />}
                <text x={cx} y={y(r.value) - 6} textAnchor="middle" className={styles.tick}>
                  {show(r.value)}
                </text>
                <text x={cx} y={h + 16} textAnchor="middle" className={styles.tick}>
                  {monthLabel(r.month, true)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
