import { Link, Navigate, useSearchParams } from "react-router-dom";
import pageStyles from "./Pages.module.css";
import styles from "../components/performance/Performance.module.css";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { AsyncBoundary, PageHeader } from "../components/ui/Misc";
import { MeasureRow } from "../components/performance/Measures";
import HowCounted from "../components/performance/HowCounted";
import { shiftMonth, useMonthLabel } from "../components/finance/parts";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

// Natijalar — the team's month, each person measured by the work they do:
// people who work with clients (calls, consultations, contracts), office
// staff (the numbers in their daily report form — documents translated,
// people served…), against the targets set for each of them. One card per
// person; the details and "Reja qoʻyish" are on their own page. A staff
// member only has their own page, so they go straight there.
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
        {(data) => {
          if (data.mineOnly) return <Navigate to={`/performance/${data.rows[0]?.employee.id}${month ? `?month=${month}` : ""}`} replace />;
          // By job (Team → person): call center, coordinators, office, the rest.
          const client = data.rows.filter((r) => r.work.client);
          const coordinators = data.rows.filter((r) => !r.work.client && r.work.coordinator);
          const office = data.rows.filter((r) => !r.work.client && !r.work.coordinator && r.work.office);
          const other = data.rows.filter((r) => !r.work.client && !r.work.coordinator && !r.work.office);
          const q = data.month === data.current ? "" : `?month=${data.month}`;
          return (
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
                <Button size="small" icon="download" href={api.performanceExportUrl(data.month)}>
                  {t("perf.export")}
                </Button>
              </div>

              <Card>
                <details className={styles.how}>
                  <summary>{t("perf.intro.title")}</summary>
                  <ul>
                    <li>{t("perf.intro.client")}</li>
                    <li>{t("perf.intro.coordinator")}</li>
                    <li>{t("perf.intro.office")}</li>
                    <li>{t("perf.intro.targets")}</li>
                    <li>{t("perf.intro.kind")}</li>
                    <li>{t("perf.intro.days")}</li>
                  </ul>
                </details>
              </Card>

              {[
                { key: "client", rows: client },
                { key: "coordinator", rows: coordinators },
                { key: "office", rows: office },
                { key: "other", rows: other },
              ]
                .filter((g) => g.rows.length > 0)
                .map((g) => (
                  <section key={g.key} className={styles.group}>
                    <h2 className={styles.groupTitle}>{t(`perf.groups.${g.key}`)}</h2>
                    <p className={styles.groupNote}>{t(`perf.groups.${g.key}Note`)}</p>
                    <div className={styles.cards}>
                      {g.rows.map((r) => (
                        <PersonCard key={r.employee.id} row={r} to={`/performance/${r.employee.id}${q}`} />
                      ))}
                    </div>
                  </section>
                ))}
              <HowCounted finance={data.finance} />
            </div>
          );
        }}
      </AsyncBoundary>
    </div>
  );
}

// One person: where they are on their targets (or their main numbers), the
// days they worked, reports and tasks.
function PersonCard({ row: r, to }) {
  const { t } = useI18n();
  const shown = [...r.metrics.filter((m) => m.target != null), ...r.metrics.filter((m) => m.target == null)].slice(0, 3);
  const away = r.workDays.away.filter((a) => a.kind !== "holiday").length;
  return (
    <Link to={to} className={styles.personCard}>
      <div className={styles.personHead}>
        <span className={styles.personName}>
          {r.employee.name}
          {!r.employee.active && <span className={styles.muted}> · {t("perf.left")}</span>}
        </span>
        <span className={styles.personSub}>{[r.employee.position, r.employee.office].filter(Boolean).join(" · ")}</span>
      </div>
      {shown.length > 0 ? (
        <div className={styles.measures}>
          {shown.map((m) => (
            <MeasureRow key={m.key} measure={m} compact />
          ))}
        </div>
      ) : (
        <p className={styles.emptyNote}>{t("perf.nothingToMeasure")}</p>
      )}
      <div className={styles.personFoot}>
        <span>{t("perf.card.days", { soFar: r.workDays.soFar, total: r.workDays.total })}</span>
        {away > 0 && <span>{t("perf.card.away", { n: away })}</span>}
        <span>{r.reports.due ? t("perf.card.reports", { sent: r.reports.sent, due: r.reports.due }) : r.reports.mode === "auto" ? t("perf.card.reportsAuto") : t("perf.card.noReports")}</span>
        {r.tasks.total > 0 && <span>{t("perf.card.tasks", { onTime: r.tasks.onTime, total: r.tasks.total })}</span>}
      </div>
    </Link>
  );
}
