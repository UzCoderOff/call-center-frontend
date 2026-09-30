import { Link, Navigate, useSearchParams } from "react-router-dom";
import pageStyles from "./Pages.module.css";
import styles from "../components/performance/Performance.module.css";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { AsyncBoundary, PageHeader } from "../components/ui/Misc";
import { TargetBars } from "../components/performance/charts";
import HowCounted from "../components/performance/HowCounted";
import { shiftMonth, useMonthLabel } from "../components/finance/parts";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

// Natijalar — the team's month: who is where against their targets (and
// where they should be by today), and one line per person with calls,
// bookings, consultations, contracts, conversion, money, cost, reports and
// tasks. A staff member only has their own page, so they go straight there.
export default function PerformancePage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const month = params.get("month");
  const state = useAsync(() => api.performance(month || undefined), [month]);
  const monthLabel = useMonthLabel();

  return (
    <div>
      <PageHeader title={t("perf.title")} subtitle={t("perf.subtitle")} />
      <AsyncBoundary state={state}>
        {(data) =>
          data.mineOnly ? (
            <Navigate to={`/performance/${data.rows[0]?.employee.id}${month ? `?month=${month}` : ""}`} replace />
          ) : (
            <div className={pageStyles.stack}>
              <div className={styles.topBar}>
                <div className={styles.monthBar}>
                  <Button icon="chevronLeft" onClick={() => setParams({ month: shiftMonth(data.month, -1) }, { replace: true })} aria-label={t("finance.prevMonth")} />
                  <span className={styles.monthLabel}>{monthLabel(data.month)}</span>
                  <Button
                    icon="chevronRight"
                    disabled={data.month >= data.current}
                    onClick={() => {
                      const next = shiftMonth(data.month, 1);
                      setParams(next === data.current ? {} : { month: next }, { replace: true });
                    }}
                    aria-label={t("finance.nextMonth")}
                  />
                </div>
                <span className={styles.pace}>{t("perf.paceNote", { soFar: data.workDaysSoFar, total: data.workDays })}</span>
                <Button size="small" icon="download" href={api.performanceExportUrl(data.month)}>
                  {t("perf.export")}
                </Button>
              </div>
              <Targets data={data} />
              <TeamTable data={data} />
              <HowCounted finance={data.finance} />
            </div>
          )
        }
      </AsyncBoundary>
    </div>
  );
}

function Targets({ data }) {
  const { t } = useI18n();
  const withTargetOr = (key) => data.rows.filter((r) => r[key].target != null || r[key].count > 0);
  const bars = (key) =>
    withTargetOr(key)
      .map((r) => ({ key: r.employee.id, name: r.employee.name, value: r[key].count, target: r[key].target, expected: r[key].expected }))
      .sort((a, b) => b.value - a.value);
  return (
    <div className={styles.columns}>
      <Card title={t("perf.consultationsTarget")} subtitle={t("perf.targetsSubtitle")}>
        <TargetBars rows={bars("consultations")} tone="s1" emptyText={t("perf.noTargets")} />
      </Card>
      <Card title={t("perf.contractsTarget")} subtitle={t("perf.targetsSubtitle")}>
        <TargetBars rows={bars("contracts")} tone="s2" emptyText={t("perf.noTargets")} />
      </Card>
    </div>
  );
}

function TeamTable({ data }) {
  const { t, fmt } = useI18n();
  const f = data.finance;
  const q = data.month === data.current ? "" : `?month=${data.month}`;
  const rows = data.rows;
  const sum = (pick) => rows.reduce((s, r) => s + (pick(r) || 0), 0);
  const ratio = (r) => (r.cost?.ratio != null ? `×${String(r.cost.ratio).replace(".", ",")}` : "—");

  return (
    <Card title={t("perf.teamTitle")} subtitle={t("perf.teamSubtitle")}>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t("perf.col.person")}</th>
              <th>{t("perf.col.workDays")}</th>
              <th>{t("perf.col.calls")}</th>
              <th>{t("perf.col.calledBack")}</th>
              <th>{t("perf.col.booked")}</th>
              <th>{t("perf.col.consultations")}</th>
              <th>{t("perf.col.contracts")}</th>
              <th>{t("perf.col.conversion")}</th>
              <th>{f ? t("perf.col.brought") : t("perf.col.fees")}</th>
              {f && <th>{t("perf.col.cost")}</th>}
              {f && <th>{t("perf.col.return")}</th>}
              <th>{t("perf.col.reports")}</th>
              <th>{t("perf.col.tasks")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.employee.id}>
                <td>
                  <Link to={`/performance/${r.employee.id}${q}`}>{r.employee.name}</Link>
                  <span className={styles.cellNote}>{[r.employee.position, r.employee.active ? null : t("perf.left")].filter(Boolean).join(" · ")}</span>
                </td>
                <td>
                  {`${r.workDays.soFar} / ${r.workDays.total}`}
                  {r.workDays.away.some((a) => a.kind !== "holiday") && (
                    <span className={styles.cellNote}>{t("perf.awayCount", { n: r.workDays.away.filter((a) => a.kind !== "holiday").length })}</span>
                  )}
                </td>
                <td>{r.calls ? `${r.calls.answered} / ${r.calls.total}` : "—"}</td>
                <td>{r.calls && r.calls.missed ? `${r.calls.reachedRate}%` : "—"}</td>
                <td>{r.bookings.made}</td>
                <td>
                  {r.consultations.count}
                  {r.consultations.target != null && <span className={styles.cellNote}>/ {r.consultations.target}</span>}
                </td>
                <td>
                  {r.contracts.count}
                  {r.contracts.target != null && <span className={styles.cellNote}>/ {r.contracts.target}</span>}
                </td>
                <td>{r.conversion.rate != null ? `${r.conversion.rate}%` : "—"}</td>
                <td>{fmt.number(r.money.brought.total + (r.money.reportIncome || 0))}</td>
                {f && <td>{r.cost?.amount != null ? fmt.number(r.cost.amount) : "—"}</td>}
                {f && <td className={r.cost?.ratio != null ? (r.cost.ratio >= 1 ? styles.good : styles.bad) : undefined}>{ratio(r)}</td>}
                <td>{r.reports.due ? `${r.reports.sent} / ${r.reports.due}` : r.reports.mode === "auto" ? t("perf.autoShort") : "—"}</td>
                <td>{r.tasks.total ? `${r.tasks.onTime} / ${r.tasks.total}` : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>{t("perf.total")}</td>
              <td />
              <td>{`${sum((r) => r.calls?.answered)} / ${sum((r) => r.calls?.total)}`}</td>
              <td />
              <td>{sum((r) => r.bookings.made)}</td>
              <td>{sum((r) => r.consultations.count)}</td>
              <td>{sum((r) => r.contracts.count)}</td>
              <td />
              <td>{fmt.number(sum((r) => r.money.brought.total + (r.money.reportIncome || 0)))}</td>
              {f && <td>{fmt.number(sum((r) => r.cost?.amount))}</td>}
              {f && <td />}
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className={pageStyles.note} style={{ marginTop: 10 }}>
        {f ? t("perf.teamNoteFinance") : t("perf.teamNote")}
      </p>
    </Card>
  );
}
