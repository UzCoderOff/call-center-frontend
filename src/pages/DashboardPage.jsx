import { useState } from "react";
import styles from "./Pages.module.css";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import RangePicker from "../components/stats/RangePicker";
import JobToggles, { useCallJobs } from "../components/calls/JobToggles";
import { AsyncBoundary, Banner, EmptyState, PageHeader } from "../components/ui/Misc";
import StatsOverview from "../components/stats/StatsOverview";
import EmployeeStatsTable from "../components/stats/EmployeeStatsTable";
import { ReportStatusBadge } from "../components/reports/ReportAnswers";
import { ReportHistory } from "./ReportsPage";
import { AutoBadge, AutoReportHistory, autoLine } from "../components/reports/AutoReport";
import { isRecordingProblem, isSyncProblem, recordingLine, syncLine } from "../components/SyncStatus";
import { MeasureRow } from "../components/performance/Measures";
import perfStyles from "../components/performance/Performance.module.css";
import { callBridge, hasBridge } from "../lib/appBridge";
import { AttentionCard, LawyerCalendarCard, MyAppointmentsCard } from "../components/calendar/CalendarCards";
import { canBookAppointments, canSeeClients, isCallCenter, isCoordinator, isLawyer } from "../lib/access";
import { CoordinatorSummary, MyCasesCard, UnassignedCard, UpcomingDatesCard } from "../components/clients/CaseCards";
import { FollowUpsCard, NoNextStepCard } from "../components/clients/FollowUpCards";
import { MyStrikesCard, TeamStrikesCard } from "../components/performance/Strikes";
import { ToReadCard } from "../components/materials/parts";
import { canSeeFinance } from "../lib/access";
import { MyTasksCard } from "../components/tasks/TaskParts";
import { useAuth, isManagerRole } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { rangeWithPrevious, todayIso } from "../lib/format";
import { useI18n } from "../i18n";

// Home adapts to the person: managers get the company overview; a lawyer
// their day and their cases; a coordinator the cases handed to them (money
// due, dates coming up); call-center staff their call numbers; everyone
// else (translators, document services…) their daily report. By their job
// (Team → person), not by whether their phone is monitored.
export default function DashboardPage() {
  const { user } = useAuth();
  if (isManagerRole(user.role)) return <ManagerHome />;
  if (isLawyer(user)) return <LawyerHome />;
  if (isCoordinator(user)) return <CoordinatorHome />;
  if (isCallCenter(user) && user.employee?.collectCalls) return <CallsHome />;
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

// "Calls" with the period picker right next to the numbers it changes (and,
// for managers, whose phones).
function CallsSection({ title, range, onRange, toggles, children }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <div className={styles.rangePicker}>
          <RangePicker value={range} onChange={onRange} />
        </div>
      </div>
      {toggles ? <div style={{ marginBottom: 12 }}>{toggles}</div> : null}
      {children}
    </section>
  );
}

function ManagerHome() {
  const { user } = useAuth();
  const { t, fmt } = useI18n();
  // This month by default: on the 2nd, two days' calls, not the last week's.
  const [range, setRange] = useState("month");
  // The call center by default; coordinators' and office phones on demand.
  const [jobs, setJobs] = useCallJobs();
  const state = useAsync(() => api.dashboard({ ...rangeWithPrevious(range), jobs: jobs.join(",") }), [range, jobs.join(",")]);

  return (
    <div>
      <PageHeader title={t("dashboard.titleCompany")} subtitle={fmt.isoDay(todayIso())} />
      <TempPasswordBanner />
      {user.role === "DEVELOPER" && <HolidayReviewBanner />}
      {state.data?.disk?.low && <DiskBanner disk={state.data.disk} />}
      <div className={styles.stack}>
        <DaysOffCard />
        {canSeeFinance(user) && <FinanceCard />}
        <UnassignedCard />
        <MyTasksCard />
        <UpcomingDatesCard days={7} />
        <LawyerCalendarCard />
        <FollowUpsCard team />
        <NoNextStepCard team />
        <TeamReportsCard />
        <CallsSection title={t("dashboard.callsSection")} range={range} onRange={setRange} toggles={<JobToggles value={jobs} onChange={setJobs} counts={state.data?.phonesByJob || null} />}>
          <AsyncBoundary state={state}>
            {(data) => {
              const problems = data.employees.filter((e) => e.active && e.collectCalls && isSyncProblem(e.sync));
              const notRecording = data.employees.filter((e) => e.active && e.collectCalls && isRecordingProblem(e.sync?.recordings));
              return (
                <div className={styles.stack}>
                  {notRecording.length > 0 && (
                    <Banner tone="critical" icon="micOff">
                      <strong>{t("recordings.managerTitle", { count: notRecording.length })}</strong>
                      <div className={styles.bannerDetail}>{notRecording.map((e) => `${e.name} — ${recordingLine(e.sync.recordings, t)}`).join(" · ")}</div>
                      <div className={styles.bannerDetail}>{t("recordings.managerHint")}</div>
                    </Banner>
                  )}
                  {problems.length > 0 && (
                    <Banner tone="warning" icon="alertTriangle">
                      <strong>{t("dashboard.syncProblems", { count: problems.length })}</strong>
                      <div className={styles.bannerDetail}>
                        {problems.map((e) => `${e.name} — ${syncLine(e.sync, t, fmt)}`).join(" · ")}
                      </div>
                    </Banner>
                  )}
                  <StatsOverview data={data} range={range} showEmployee money />
                  {data.strikeRules && <TeamStrikesCard employees={data.employees} rules={data.strikeRules} />}
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

// The developer: the server's disk is getting full (recordings only grow).
function DiskBanner({ disk }) {
  const { t } = useI18n();
  const gb = (disk.freeBytes / 1024 ** 3).toFixed(1).replace(".", ",");
  return (
    <div className={styles.bannerSpace}>
      <Banner tone="critical" icon="hardDrive">
        <strong>{t("recordings.diskLowTitle", { free: gb, pct: Math.round((disk.freeShare || 0) * 100) })}</strong>
        <div className={styles.bannerDetail}>{t("recordings.diskLowText")}</div>
      </Banner>
    </div>
  );
}

// "Your phone isn't recording calls" — with the way to fix it: in the app,
// the phone-setup guide opens right here.
function MyRecordingBanner({ recordings: r }) {
  const { t } = useI18n();
  const kind = r.status === "noAccess" ? "NoAccess" : r.status === "partial" ? "Partial" : "None";
  const canOpen = hasBridge("openSetup");
  return (
    <div className={styles.bannerSpace}>
      <Banner
        tone={r.status === "partial" ? "warning" : "critical"}
        icon={r.status === "noAccess" ? "lock" : "micOff"}
        action={
          canOpen ? (
            <Button size="small" variant="primary" icon="smartphone" onClick={() => callBridge("openSetup")}>
              {t("recordings.setup")}
            </Button>
          ) : undefined
        }
      >
        <strong>{t(`recordings.self${kind}Title`)}</strong>
        <div className={styles.bannerDetail}>{t(`recordings.self${kind}Text`, { calls: r.calls7d, recorded: r.recorded7d })}</div>
        {!canOpen && <div className={styles.bannerDetail}>{t("recordings.setupWhere")}</div>}
      </Banner>
    </div>
  );
}

// The plan a manager set for me this month (Natijalar), and how far along I
// am — one tap to my full Natijalar page. Nothing when there's no plan.
function MyPlanCard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const state = useAsync(() => api.performance(), []);
  const row = state.data?.rows?.find((r) => r.employee.id === user.employee?.id);
  const planned = (row?.metrics || []).filter((m) => m.target != null || m.hasTarget);
  if (planned.length === 0) return null;
  return (
    <Card
      title={t("home.myPlanTitle")}
      subtitle={t("home.myPlanSubtitle")}
      action={
        <Button size="small" variant="plain" to={`/performance/${user.employee.id}`}>
          {t("common.seeAll")}
          <Icon name="chevronRight" size={15} />
        </Button>
      }
    >
      <div className={perfStyles.measures}>
        {planned.map((m) => (
          <MeasureRow key={m.key} measure={m} compact />
        ))}
      </div>
    </Card>
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
        {t("finance.homeLine", { received: fmt.money(data.summary.income), contracted: fmt.money(data.summary.contracted), owed: fmt.money(data.summary.owed) })}
      </p>
    </Card>
  );
}

// "7 of 10 reports in today — not yet: Sardor, Kamola."
// The developer confirms the holidays Ledger suggests — this asks when one is
// coming up (within 60 days) and still unconfirmed.
function HolidayReviewBanner() {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.holidayReview(), []);
  const soon = state.data?.soon || [];
  if (soon.length === 0) return null;
  return (
    <div className={styles.bannerSpace}>
      <Banner
        tone="warning"
        icon="calendar"
        action={
          <Button size="small" variant="primary" to="/days-off">
            {t("daysOff.review")}
          </Button>
        }
      >
        <strong>{t("daysOff.reviewTitle")}</strong>
        <div className={styles.bannerDetail}>{soon.map((h) => `${fmt.isoDateLong(h.date)} — ${h.name}`).join(" · ")}</div>
      </Banner>
    </div>
  );
}

// Requests waiting for approval, and who isn't working today.
function DaysOffCard() {
  const { t } = useI18n();
  const state = useAsync(() => api.absenceSummary(), []);
  const d = state.data;
  if (!d || (d.pending === 0 && d.away.length === 0 && !d.holiday)) return null;
  const reason = (off) => (off.kind === "holiday" ? t("daysOff.holiday") : t(`daysOff.kinds.${off.kind}`).toLowerCase());
  return (
    <Card
      title={t("daysOff.homeTitle")}
      action={
        <Button size="small" variant="plain" to="/days-off">
          {t("common.seeAll")}
          <Icon name="chevronRight" size={15} />
        </Button>
      }
    >
      <p className={styles.progressNote} style={{ marginTop: 0 }}>
        {[
          d.holiday ? t("daysOff.homeHoliday", { name: d.holiday }) : null,
          d.pending ? t("daysOff.homePending", { n: d.pending }) : null,
          d.away.length ? t("daysOff.homeAway", { names: d.away.map((a) => `${a.employee.name.split(" ")[0]} (${reason(a.off)})`).join(", ") }) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </Card>
  );
}

function TeamReportsCard() {
  const { t } = useI18n();
  const state = useAsync(() => api.reportsDay(), []);
  const data = state.data;
  if (!data || data.rows.length === 0) return null;

  // Per person. An automatic report is always in; someone who also (or
  // only) fills in a form is done when the form is sent.
  const people = new Map();
  // Someone not working today (their day off, a holiday, away) isn't counted.
  for (const r of data.rows) {
    const p = people.get(r.employee.id) ?? { name: r.employee.name, needsForm: false, sent: false, off: Boolean(r.off) };
    if (r.template) p.needsForm = true;
    if (r.report) p.sent = true;
    people.set(r.employee.id, p);
  }
  for (const p of people.values()) p.done = p.sent || !p.needsForm;
  const working = [...people.values()].filter((p) => !p.off || p.sent);
  const expected = working.length;
  if (expected === 0) return null;
  const submitted = working.filter((p) => p.done).length;
  const missing = working.filter((p) => !p.done).map((p) => p.name.split(" ")[0]);

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
  const [range, setRange] = useState("month");
  const state = useAsync(() => api.dashboard(rangeWithPrevious(range)), [range]);

  return (
    <div>
      <PageHeader title={t("dashboard.titleSelf")} subtitle={fmt.isoDay(todayIso())} />
      <TempPasswordBanner />
      {isRecordingProblem(state.data?.sync?.recordings) && <MyRecordingBanner recordings={state.data.sync.recordings} />}
      <div className={styles.stack}>
        {canBookAppointments(user) && <AttentionCard />}
        <MyTasksCard />
        <MyPlanCard />
        {canSeeClients(user) && <FollowUpsCard />}
        {canSeeClients(user) && <NoNextStepCard />}
        <ToReadCard />
        {user.employee?.hasReport && <TodayReportStatus />}
        {canBookAppointments(user) && <MyAppointmentsCard />}
        <CallsSection title={t("dashboard.myCallsSection")} range={range} onRange={setRange}>
          <AsyncBoundary state={state}>
            {(data) => (
              <div className={styles.stack}>
                <StatsOverview data={data} range={range} />
                {data.sync && <p className={styles.selfSync}>{syncLine(data.sync, t, fmt)}</p>}
                {data.strikes && <MyStrikesCard strikes={data.strikes} />}
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
  // Their cases: where each stands, since when, the next date in it.
  const cases = useAsync(() => api.cases("mine"), []);
  return (
    <div>
      <PageHeader title={t("home.greeting", { name: firstName })} subtitle={fmt.date(today)} />
      <TempPasswordBanner />
      <div className={styles.stack}>
        <MyTasksCard />
        <FollowUpsCard />
        {canSeeFinance(user) && <FinanceCard />}
        <UpcomingDatesCard />
        <LawyerCalendarCard />
        <ToReadCard />
        <AsyncBoundary state={cases}>{(data) => <MyCasesCard cases={data.cases} title={t("lawyer.myCases")} />}</AsyncBoundary>
      </div>
    </div>
  );
}

// A coordinator's home: the cases handed to them since the contract — money
// overdue or due soon, dates coming up, clients to call — what needs doing
// first on top.
function CoordinatorHome() {
  const { user } = useAuth();
  const { t, fmt } = useI18n();
  const [today] = useState(() => Date.now());
  const firstName = (user.employee?.name || user.username).split(" ")[0];
  const cases = useAsync(() => api.cases("mine"), []);
  return (
    <div>
      <PageHeader title={t("home.greeting", { name: firstName })} subtitle={`${fmt.date(today)} · ${t("coord.role")}`} />
      <TempPasswordBanner />
      <div className={styles.stack}>
        <AsyncBoundary state={cases}>
          {(data) => (
            <>
              <CoordinatorSummary cases={data.cases} />
              <MyCasesCard cases={data.cases} />
            </>
          )}
        </AsyncBoundary>
        <MyTasksCard />
        <UpcomingDatesCard />
        <FollowUpsCard />
        <MyPlanCard />
        <ToReadCard />
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
        <MyPlanCard />
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
