import { useState } from "react";
import styles from "./Pages.module.css";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import RangePicker from "../components/stats/RangePicker";
import { AsyncBoundary, Banner, EmptyState, PageHeader } from "../components/ui/Misc";
import StatsOverview from "../components/stats/StatsOverview";
import EmployeeStatsTable from "../components/stats/EmployeeStatsTable";
import { ReportStatusBadge } from "../components/reports/ReportAnswers";
import { ReportHistory } from "./ReportsPage";
import { isSyncProblem, syncLine } from "../components/SyncStatus";
import { AttentionCard, LawyerCalendarCard, MyAppointmentsCard } from "../components/calendar/CalendarCards";
import { canBookAppointments } from "../lib/access";
import { useAuth, isManagerRole } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { rangeFor } from "../lib/format";
import { useI18n } from "../i18n";

// Home adapts to the person: managers get the company overview; call-center
// staff their call numbers; everyone else (translators, document services…)
// their daily report.
export default function DashboardPage() {
  const { user } = useAuth();
  if (isManagerRole(user.role)) return <ManagerHome />;
  if (user.employee?.collectCalls) return <CallsHome />;
  return <StaffHome />;
}

function TempPasswordBanner() {
  const { user } = useAuth();
  const { t } = useI18n();
  if (!user.mustChangePassword) return null;
  return (
    <div className={styles.bannerSpace}>
      <Banner
        icon="key"
        action={
          <Button size="small" variant="primary" to="/profile">
            {t("dashboard.changePassword")}
          </Button>
        }
      >
        {t("dashboard.tempPasswordBanner")}
      </Banner>
    </div>
  );
}

function ManagerHome() {
  const { t, fmt } = useI18n();
  const [range, setRange] = useState("7d");
  const state = useAsync(() => api.dashboard(rangeFor(range)), [range]);

  return (
    <div>
      <PageHeader
        title={t("dashboard.titleCompany")}
        subtitle={t("dashboard.subtitleCompany")}
        actions={
          <div className={styles.rangePicker}>
            <RangePicker value={range} onChange={setRange} />
          </div>
        }
      />
      <TempPasswordBanner />
      <div className={styles.stack}>
        <LawyerCalendarCard />
        <TeamReportsCard />
        <AsyncBoundary state={state}>
          {(data) => {
            const problems = data.employees.filter((e) => e.active && e.collectCalls && isSyncProblem(e.sync));
            return (
              <div className={styles.stack}>
                {problems.length > 0 && (
                  <Banner tone="warning" icon="alertTriangle">
                    <strong>{t("dashboard.syncProblems", { count: problems.length })}</strong>
                    <div className={styles.bannerDetail}>
                      {problems.map((e) => `${e.name} — ${syncLine(e.sync, t, fmt)}`).join(" · ")}
                    </div>
                  </Banner>
                )}
                <StatsOverview data={data} range={range} showEmployee />
                <Card flush title={t("dashboard.byEmployee")}>
                  {data.employees.length === 0 ? (
                    <EmptyState icon="users" text={t("dashboard.noEmployees")} />
                  ) : (
                    <EmployeeStatsTable employees={data.employees} />
                  )}
                </Card>
              </div>
            );
          }}
        </AsyncBoundary>
      </div>
    </div>
  );
}

// "7 of 10 reports in today — not yet: Sardor, Kamola."
function TeamReportsCard() {
  const { t } = useI18n();
  const state = useAsync(() => api.reportsDay(), []);
  const data = state.data;
  if (!data || data.rows.length === 0) return null;

  const expected = data.rows.length;
  const submitted = data.rows.filter((r) => r.report).length;
  const missing = data.rows.filter((r) => !r.report).map((r) => r.employee.name.split(" ")[0]);

  return (
    <Card
      title={t("home.teamReports")}
      subtitle={t("home.teamReportsCount", { submitted, expected })}
      action={
        <Button size="small" variant="plain" to="/reports">
          {t("common.seeAll")}
          <Icon name="chevronRight" size={15} />
        </Button>
      }
    >
      <div className={styles.progressTrack} aria-hidden="true">
        <span
          className={submitted >= expected ? styles.progressDone : styles.progressFill}
          style={{ width: `${Math.min(100, (submitted / expected) * 100)}%` }}
        />
      </div>
      <p className={styles.progressNote}>
        {missing.length === 0 ? t("home.teamReportsAll") : t("home.teamReportsMissing", { names: missing.join(", ") })}
      </p>
    </Card>
  );
}

function CallsHome() {
  const { user } = useAuth();
  const { t, fmt } = useI18n();
  const [range, setRange] = useState("7d");
  const state = useAsync(() => api.dashboard(rangeFor(range)), [range]);

  return (
    <div>
      <PageHeader
        title={t("dashboard.titleSelf")}
        subtitle={t("dashboard.subtitleSelf")}
        actions={
          <div className={styles.rangePicker}>
            <RangePicker value={range} onChange={setRange} />
          </div>
        }
      />
      <TempPasswordBanner />
      <div className={styles.stack}>
        {canBookAppointments(user) && <AttentionCard />}
        {user.employee?.hasReport && <TodayReportStatus />}
        {canBookAppointments(user) && <MyAppointmentsCard />}
        <AsyncBoundary state={state}>
          {(data) => (
            <div className={styles.stack}>
              {data.sync && <p className={styles.selfSync}>{syncLine(data.sync, t, fmt)}</p>}
              <StatsOverview data={data} range={range} />
            </div>
          )}
        </AsyncBoundary>
      </div>
    </div>
  );
}

function StaffHome() {
  const { user } = useAuth();
  const { t, fmt } = useI18n();
  const hasReport = Boolean(user.employee?.hasReport);
  const history = useAsync(() => (hasReport ? api.reports({ pageSize: 5 }) : Promise.resolve(null)), [hasReport]);
  const firstName = (user.employee?.name || user.username).split(" ")[0];
  const [today] = useState(() => Date.now());

  return (
    <div>
      <PageHeader title={t("home.greeting", { name: firstName })} subtitle={fmt.date(today)} />
      <TempPasswordBanner />
      <div className={styles.stack}>
        {canBookAppointments(user) && <AttentionCard />}
        {hasReport ? (
          <>
            <TodayReportStatus large />
            {canBookAppointments(user) && <MyAppointmentsCard />}
            {history.data && <ReportHistory reports={history.data.reports} title={t("home.recentReports")} />}
          </>
        ) : canBookAppointments(user) ? (
          <MyAppointmentsCard />
        ) : (
          <EmptyState icon="clipboard" text={t("home.noReportForm")} />
        )}
      </div>
    </div>
  );
}

// Has today's report been sent? One tap to fill it in or look at it.
function TodayReportStatus({ large = false }) {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.todayReport(), []);
  const data = state.data;
  if (!data?.template) return null;
  const report = data.report;

  return (
    <Card title={t("home.todayTitle")} subtitle={data.template.name} action={<ReportStatusBadge report={report} />}>
      <p className={styles.reportStatusText}>
        {report ? t("home.submitted", { time: fmt.time(new Date(report.updatedAt).getTime()) }) : t("home.notSubmitted")}
      </p>
      <div className={styles.actionsRow}>
        <Button to="/reports" variant={report ? "secondary" : "primary"} size={large ? "large" : "medium"} icon="clipboard">
          {report ? t("home.viewReport") : t("home.fillReport")}
        </Button>
      </div>
    </Card>
  );
}
