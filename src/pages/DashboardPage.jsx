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
import { AutoBadge, AutoReportHistory, autoLine } from "../components/reports/AutoReport";
import { isSyncProblem, syncLine } from "../components/SyncStatus";
import { AttentionCard, LawyerCalendarCard, MyAppointmentsCard } from "../components/calendar/CalendarCards";
import { canBookAppointments, canSeeClients, isLawyer } from "../lib/access";
import { StatusBadge } from "../components/clients/parts";
import { List, ListRow } from "../components/ui/List";
import { CallTodayCard } from "../components/clients/ClientCards";
import { ToReadCard } from "../components/materials/parts";
import { canSeeFinance } from "../lib/access";
import { MyTasksCard } from "../components/tasks/TaskParts";
import { useAuth, isManagerRole } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { rangeFor, todayIso } from "../lib/format";
import { useI18n } from "../i18n";

// Home adapts to the person: managers get the company overview; a lawyer
// their day and their cases; call-center staff their call numbers; everyone
// else (translators, document services…) their daily report.
export default function DashboardPage() {
  const { user } = useAuth();
  if (isManagerRole(user.role)) return <ManagerHome />;
  if (isLawyer(user)) return <LawyerHome />;
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

// "Calls" with the period picker right next to the numbers it changes.
function CallsSection({ title, range, onRange, children }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <div className={styles.rangePicker}>
          <RangePicker value={range} onChange={onRange} />
        </div>
      </div>
      {children}
    </section>
  );
}

function ManagerHome() {
  const { user } = useAuth();
  const { t, fmt } = useI18n();
  const [range, setRange] = useState("7d");
  const state = useAsync(() => api.dashboard(rangeFor(range)), [range]);

  return (
    <div>
      <PageHeader title={t("dashboard.titleCompany")} subtitle={fmt.isoDay(todayIso())} />
      <TempPasswordBanner />
      <div className={styles.stack}>
        {canSeeFinance(user) && <FinanceCard />}
        <MyTasksCard />
        <LawyerCalendarCard />
        <CallTodayCard />
        <TeamReportsCard />
        <CallsSection title={t("dashboard.callsSection")} range={range} onRange={setRange}>
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
        </CallsSection>
      </div>
    </div>
  );
}

// This month's money from clients, for the head of the firm — one tap to
// the full Moliya page.
function FinanceCard() {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.finance(), []);
  const data = state.data;
  if (!data) return null;
  return (
    <Card
      title={t("finance.homeTitle")}
      action={
        <Button size="small" variant="plain" to="/finance">
          {t("common.seeAll")}
          <Icon name="chevronRight" size={15} />
        </Button>
      }
    >
      <p className={styles.reportStatusText}>
        {t("finance.homeLine", { received: fmt.money(data.received.total), contracted: fmt.money(data.contracted.total), owed: fmt.money(data.owed.total) })}
      </p>
    </Card>
  );
}

// "7 of 10 reports in today — not yet: Sardor, Kamola."
function TeamReportsCard() {
  const { t } = useI18n();
  const state = useAsync(() => api.reportsDay(), []);
  const data = state.data;
  if (!data || data.rows.length === 0) return null;

  // Per person. An automatic report is always in; someone who also (or
  // only) fills in a form is done when the form is sent.
  const people = new Map();
  for (const r of data.rows) {
    const p = people.get(r.employee.id) ?? { name: r.employee.name, needsForm: false, sent: false };
    if (r.template) p.needsForm = true;
    if (r.report) p.sent = true;
    people.set(r.employee.id, p);
  }
  for (const p of people.values()) p.done = p.sent || !p.needsForm;
  const expected = people.size;
  const submitted = [...people.values()].filter((p) => p.done).length;
  const missing = [...people.values()].filter((p) => !p.done).map((p) => p.name.split(" ")[0]);

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
      <PageHeader title={t("dashboard.titleSelf")} subtitle={fmt.isoDay(todayIso())} />
      <TempPasswordBanner />
      <div className={styles.stack}>
        {canBookAppointments(user) && <AttentionCard />}
        <MyTasksCard />
        {canSeeClients(user) && <CallTodayCard />}
        <ToReadCard />
        {user.employee?.hasReport && <TodayReportStatus />}
        {canBookAppointments(user) && <MyAppointmentsCard />}
        <CallsSection title={t("dashboard.myCallsSection")} range={range} onRange={setRange}>
          <AsyncBoundary state={state}>
            {(data) => (
              <div className={styles.stack}>
                <StatsOverview data={data} range={range} />
                {data.sync && <p className={styles.selfSync}>{syncLine(data.sync, t, fmt)}</p>}
              </div>
            )}
          </AsyncBoundary>
        </CallsSection>
      </div>
    </div>
  );
}

// A lawyer's home: today's appointments in their calendar (and the "plan
// next week" reminder), and their clients whose cases are open.
function LawyerHome() {
  const { user } = useAuth();
  const { t, fmt } = useI18n();
  const [today] = useState(() => Date.now());
  const firstName = (user.name || user.username).split(" ")[0];
  const cases = useAsync(() => api.clients({ filter: "active" }), []);
  return (
    <div>
      <PageHeader title={t("home.greeting", { name: firstName })} subtitle={fmt.date(today)} />
      <TempPasswordBanner />
      <div className={styles.stack}>
        <MyTasksCard />
        {canSeeFinance(user) && <FinanceCard />}
        <LawyerCalendarCard />
        <ToReadCard />
        <Card
          flush
          title={t("lawyer.myCases")}
          subtitle={cases.data ? t("lawyer.openCount", { count: cases.data.pagination.total }) : undefined}
          action={
            <Button size="small" variant="plain" to="/clients">
              {t("common.seeAll")}
              <Icon name="chevronRight" size={15} />
            </Button>
          }
        >
          <AsyncBoundary state={cases}>
            {(data) =>
              data.clients.length === 0 ? (
                <EmptyState icon="briefcase" text={t("lawyer.noCases")} />
              ) : (
                <List>
                  {data.clients.slice(0, 8).map((c) => (
                    <ListRow
                      key={c.id}
                      to={`/clients/${c.id}`}
                      title={c.name}
                      subtitle={c.latestCase?.legalStage ? t(`cases.stages.${c.latestCase.legalStage}`) : c.phone ? fmt.phone(c.phone) : undefined}
                      trailing={c.latestCase && <StatusBadge status={c.latestCase.status} />}
                    />
                  ))}
                </List>
              )
            }
          </AsyncBoundary>
        </Card>
      </div>
    </div>
  );
}

function StaffHome() {
  const { user } = useAuth();
  const { t, fmt } = useI18n();
  const hasReport = Boolean(user.employee?.hasReport);
  const auto = Boolean(user.employee?.autoReport);
  const form = Boolean(user.employee?.reportForm);
  const history = useAsync(() => (form ? api.reports({ pageSize: 5 }) : Promise.resolve(null)), [form]);
  const firstName = (user.employee?.name || user.username).split(" ")[0];
  const [today] = useState(() => Date.now());

  return (
    <div>
      <PageHeader title={t("home.greeting", { name: firstName })} subtitle={fmt.date(today)} />
      <TempPasswordBanner />
      <div className={styles.stack}>
        {canBookAppointments(user) && <AttentionCard />}
        <MyTasksCard />
        <ToReadCard />
        {hasReport ? (
          <>
            <TodayReportStatus large />
            {canBookAppointments(user) && <MyAppointmentsCard />}
            {auto && <AutoReportHistory employeeId={user.employee.id} title={t("home.recentReports")} />}
            {form && history.data && <ReportHistory reports={history.data.reports} title={auto ? t("autoReport.formHistory") : t("home.recentReports")} />}
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

// Today's report: the automatic numbers, the form to fill in, or both
// (for "automatic + form" the form comes first — it's what needs doing).
function TodayReportStatus({ large = false }) {
  const state = useAsync(() => api.todayReport(), []);
  const data = state.data;
  if (!data || (!data.auto && !data.template)) return null;
  return (
    <>
      {data.template && <TodayFormCard data={data} large={large} />}
      {data.auto && <TodayAutoCard data={data} large={large && !data.template} />}
    </>
  );
}

function TodayAutoCard({ data, large }) {
  const { t } = useI18n();
  return (
    <Card title={t("home.todayTitle")} subtitle={t("autoReport.name")} action={<AutoBadge />}>
      <p className={styles.reportStatusText}>{t("autoReport.homeLine", { summary: autoLine(data.auto, t) })}</p>
      <div className={styles.actionsRow}>
        <Button to="/reports" variant="secondary" size={large ? "large" : "medium"} icon="clipboard">
          {t("home.viewReport")}
        </Button>
      </div>
    </Card>
  );
}

// Has today's form been sent? One tap to fill it in or look at it.
function TodayFormCard({ data, large }) {
  const { t, fmt } = useI18n();
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
