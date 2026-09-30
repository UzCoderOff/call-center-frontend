import { useState } from "react";
import Badge from "../components/ui/Badge";
import { useSearchParams } from "react-router-dom";
import styles from "./ReportsPage.module.css";
import pageStyles from "./Pages.module.css";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { SelectField, TextField } from "../components/ui/Field";
import Segmented from "../components/ui/Segmented";
import { List, ListRow, ListSectionHeader } from "../components/ui/List";
import { AsyncBoundary, Avatar, EmptyState, PageHeader } from "../components/ui/Misc";
import ReportForm from "../components/reports/ReportForm";
import ReportAnswers, { ReportStatusBadge } from "../components/reports/ReportAnswers";
import AutoReportNumbers, { AutoBadge, AutoReportHistory, autoLine } from "../components/reports/AutoReport";
import { useAuth, isManagerRole } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

export default function ReportsPage() {
  const { user } = useAuth();
  return isManagerRole(user.role) ? <ManagerReports /> : <MyReports />;
}

function shiftIso(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86400000).toISOString().slice(0, 10);
}

// ------------------------------------------------------------ managers
// One day (who sent their report, the day's totals), or a period — a
// week, a month, any dates — with the totals, per person, and Excel.
function ManagerReports() {
  const { t, fmt } = useI18n();
  const [params, setParams] = useSearchParams();
  const mode = params.get("mode") === "period" ? "period" : "day";
  const date = params.get("date") || "";
  const officeId = params.get("office") || "";
  const offices = useAsync(() => api.offices(), []);
  const state = useAsync(
    () => (mode === "day" ? api.reportsDay({ date: date || undefined, officeId: officeId || undefined }) : Promise.resolve(null)),
    [mode, date, officeId]
  );

  function update(changes) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  }

  const shownDate = state.data?.date;
  const isToday = shownDate && shownDate === state.data?.today;
  const officeSelect = (
    <SelectField aria-label={t("settings.offices")} value={officeId} onChange={(e) => update({ office: e.target.value })} className={styles.officeSelect}>
      <option value="">{t("reports.allOffices")}</option>
      {(offices.data || []).map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </SelectField>
  );

  return (
    <div>
      <PageHeader
        title={t("reports.title")}
        subtitle={
          mode === "period"
            ? t("reports.periodSubtitle")
            : shownDate
              ? `${isToday ? `${t("reports.today")}, ` : ""}${fmt.isoDateLong(shownDate)}`
              : t("reports.subtitleManager")
        }
      />
      <div className={styles.modeRow}>
        <Segmented
          value={mode}
          onChange={(v) => update({ mode: v === "period" ? "period" : "" })}
          label={t("reports.title")}
          options={[
            { value: "day", label: t("reports.modeDay") },
            { value: "period", label: t("reports.modePeriod") },
          ]}
        />
      </div>

      {mode === "period" ? (
        <PeriodView params={params} update={update} officeId={officeId} officeSelect={officeSelect} />
      ) : (
        <>
      <div className={styles.toolbar}>
        <div className={styles.dateNav}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => shownDate && update({ date: shiftIso(shownDate, -1) })}
            aria-label={t("reports.prevDay")}
          >
            <Icon name="chevronLeft" size={18} />
          </button>
          <span className={styles.dateLabel}>{shownDate ? fmt.isoDateLong(shownDate) : "…"}</span>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => shownDate && update({ date: shiftIso(shownDate, 1) })}
            disabled={isToday}
            aria-label={t("reports.nextDay")}
          >
            <Icon name="chevronRight" size={18} />
          </button>
          {!isToday && shownDate && (
            <Button size="small" variant="plain" onClick={() => update({ date: "" })}>
              {t("reports.today")}
            </Button>
          )}
        </div>
        {officeSelect}
      </div>

      <AsyncBoundary state={state}>
        {(data) => data && <DayView data={data} />}
      </AsyncBoundary>
        </>
      )}
    </div>
  );
}

// "YYYY-MM-DD" helpers for the period presets (the browser's calendar).
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function presetRange(key) {
  const now = new Date();
  if (key === "week") {
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return { from: iso(monday), to: iso(now) };
  }
  if (key === "lastMonth") {
    return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) };
  }
  return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
}

// A period: this week / this month / last month or any dates; per form the
// totals (table questions per column and per kind), each person's totals,
// and the reports as an Excel file.
function PeriodView({ params, update, officeId, officeSelect }) {
  const { t, fmt } = useI18n();
  const [month] = useState(() => presetRange("month"));
  const from = params.get("from") || month.from;
  const to = params.get("to") || month.to;
  const state = useAsync(() => api.reportsSummary({ from, to, officeId: officeId || undefined }), [from, to, officeId]);
  const preset = ["week", "month", "lastMonth"].find((k) => {
    const r = presetRange(k);
    return r.from === from && r.to === to;
  });

  return (
    <div className={pageStyles.stack}>
      <div className={styles.periodBar}>
        <Segmented
          wrap
          value={preset || ""}
          onChange={(k) => update(presetRange(k))}
          label={t("reports.modePeriod")}
          options={[
            { value: "week", label: t("reports.thisWeek") },
            { value: "month", label: t("reports.thisMonth") },
            { value: "lastMonth", label: t("reports.lastMonth") },
          ]}
        />
        <div className={styles.periodDates}>
          <TextField type="date" aria-label={t("reports.from")} label={t("reports.from")} value={from} max={to} onChange={(e) => e.target.value && update({ from: e.target.value })} />
          <TextField type="date" aria-label={t("reports.to")} label={t("reports.to")} value={to} min={from} onChange={(e) => e.target.value && update({ to: e.target.value })} />
        </div>
        {officeSelect}
      </div>

      <AsyncBoundary state={state}>
        {(data) =>
          data.forms.length === 0 ? (
            <EmptyState icon="clipboard" text={t("reports.periodEmpty")} />
          ) : (
            data.forms.map((f) => (
              <Card
                key={f.template.id}
                title={f.template.name}
                subtitle={t("reports.periodCount", { reports: f.reports, days: f.days, from: fmt.isoDateLong(data.from), to: fmt.isoDateLong(data.to) })}
                action={
                  <Button size="small" icon="note" href={api.reportsExportUrl({ templateId: f.template.id, from: data.from, to: data.to, officeId: officeId || undefined })} download>
                    {t("reports.excel")}
                  </Button>
                }
              >
                <TotalsList totals={f.totals} />
                <PeopleTable people={f.people} />
              </Card>
            ))
          )
        }
      </AsyncBoundary>
    </div>
  );
}

// Each person's numbers over the period, side by side.
function PeopleTable({ people }) {
  const { t, fmt } = useI18n();
  const measures = people[0]?.measures || [];
  if (people.length === 0) return null;
  return (
    <div className={styles.peopleWrap}>
      <table className={styles.peopleTable}>
        <thead>
          <tr>
            <th>{t("reports.person")}</th>
            <th className={styles.num}>{t("reports.reportsCount")}</th>
            {measures.map((m) => (
              <th key={m.id} className={styles.num} title={m.group ? `${m.group}: ${m.label}` : m.label}>
                {m.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.employee.id}>
              <td>{p.employee.name}</td>
              <td className={styles.num}>{fmt.number(p.reports)}</td>
              {p.measures.map((m) => (
                <td key={m.id} className={styles.num}>
                  {m.type === "money" ? fmt.money(m.total) : fmt.number(m.total)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DayView({ data }) {
  const { t } = useI18n();
  if (data.rows.length === 0) return <EmptyState icon="users" text={t("reports.nobodyExpected")} />;

  // Group people by office, offices alphabetically, "no office" last.
  const groups = new Map();
  for (const row of data.rows) {
    const key = row.employee.office?.name || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));

  return (
    <div className={pageStyles.stack}>
      <div className={styles.forms}>
        {data.auto && <AutoSummary auto={data.auto} />}
        {data.forms.map((f) => (
          <FormSummary key={f.template.id} form={f} />
        ))}
      </div>

      {ordered.map(([office, rows]) => (
        <section key={office || "none"}>
          <ListSectionHeader>{office || t("reports.noOffice")}</ListSectionHeader>
          <List inset={68}>
            {rows.map((row) =>
              row.auto ? (
                <ListRow
                  key={`auto-${row.employee.id}`}
                  to={`/reports/auto/${row.employee.id}/${data.date}`}
                  leading={<Avatar name={row.employee.name} size={40} />}
                  title={row.employee.name}
                  subtitle={autoLine(row.auto, t)}
                  trailing={<AutoBadge />}
                />
              ) : (
                <ListRow
                  key={row.report ? `report-${row.report.id}` : `form-${row.employee.id}`}
                  to={row.report ? `/reports/${row.report.id}` : undefined}
                  leading={<Avatar name={row.employee.name} size={40} />}
                  title={row.employee.name}
                  subtitle={row.template.name}
                  trailing={
                    // Not a working day for them: no report expected.
                    !row.report && row.off ? (
                      <Badge tone="neutral" icon="coffee">
                        {row.off.kind === "holiday" ? t("daysOff.holiday") : row.off.kind === "weekly" ? t("daysOff.weeklyOff") : t(`daysOff.kinds.${row.off.kind}`)}
                      </Badge>
                    ) : (
                      <ReportStatusBadge report={row.report} />
                    )
                  }
                />
              )
            )}
          </List>
        </section>
      ))}
    </div>
  );
}

// The automatic reports of the day added up: the call center at a glance.
function AutoSummary({ auto }) {
  const { t, fmt } = useI18n();
  const s = auto.totals;
  const items = [
    ...(s.calls
      ? [
          [t("autoReport.total"), fmt.number(s.calls.total)],
          [t("autoReport.answered"), fmt.number(s.calls.answered)],
          [t("autoReport.missed"), fmt.number(s.calls.missed)],
          [t("autoReport.needsCallback"), fmt.number(s.calls.needsCallback)],
          [t("autoReport.talk"), s.calls.talkSeconds > 0 ? fmt.duration(s.calls.talkSeconds) : "—"],
        ]
      : []),
    [t("autoReport.booked"), fmt.number(s.booked)],
    [t("autoReport.consultations"), fmt.number(s.consultations)],
    [t("autoReport.contracts"), fmt.number(s.contracts)],
  ];
  return (
    <Card title={t("autoReport.teamTitle")} subtitle={t("autoReport.teamSubtitle", { n: auto.people })}>
      <ul className={styles.totals}>
        {items.map(([label, value]) => (
          <li key={label}>
            <span className={styles.totalLabel}>{label}</span>
            <span className={styles.totalValue}>{value}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function FormSummary({ form }) {
  const { t } = useI18n();
  const complete = form.submitted >= form.expected;
  return (
    <Card title={form.template.name} subtitle={t("reports.submittedCount", { submitted: form.submitted, expected: form.expected })}>
      <div className={styles.progress} aria-hidden="true">
        <span
          className={complete ? styles.progressDone : styles.progressFill}
          style={{ width: `${form.expected ? Math.min(100, (form.submitted / form.expected) * 100) : 0}%` }}
        />
      </div>
      <TotalsList totals={form.totals} />
    </Card>
  );
}

// The totals of a form's questions — for a day or a period.
function TotalsList({ totals }) {
  const { t, fmt } = useI18n();
  if (!totals || totals.length === 0) return null;
  return (
    <ul className={styles.totals}>
      {totals.map((total) =>
        total.type === "table" ? (
          <li key={total.id} className={styles.choiceTotal}>
            <span className={styles.totalLabel}>{total.label}</span>
            <TableTotals total={total} />
          </li>
        ) : total.counts ? (
          // Choice questions: one chip per option that was picked, with its count.
          <li key={total.id} className={styles.choiceTotal}>
            <span className={styles.totalLabel}>{total.label}</span>
            <span className={styles.choiceChips}>
              {Object.entries(total.counts).filter(([, n]) => n > 0).length === 0
                ? "—"
                : Object.entries(total.counts)
                    .filter(([, n]) => n > 0)
                    .map(([opt, n]) => (
                      <span key={opt} className={styles.choiceChip}>
                        {opt} <b>{n}</b>
                      </span>
                    ))}
            </span>
          </li>
        ) : (
          <li key={total.id}>
            <span className={styles.totalLabel}>{total.label}</span>
            <span className={styles.totalValue}>
              {total.type === "money"
                ? `${fmt.number(total.total)} ${t("reports.soum")}`
                : total.type === "number"
                  ? fmt.number(total.total)
                  : t("reports.yesCount", { yes: total.yes, answered: total.answered })}
            </span>
          </li>
        )
      )}
    </ul>
  );
}

// A table question added up: per kind (e.g. per service) how many lines and
// the number/money totals, then everything together.
function TableTotals({ total }) {
  const { t, fmt } = useI18n();
  const show = (c, v) => (c.type === "money" ? fmt.money(v) : fmt.number(v));
  if (total.rows === 0) return <span className={styles.totalValue}>—</span>;
  return (
    <div className={styles.peopleWrap}>
      <table className={styles.peopleTable}>
        <thead>
          <tr>
            <th>{total.by?.label || ""}</th>
            <th className={styles.num}>{t("reports.lines")}</th>
            {total.columns.map((c) => (
              <th key={c.id} className={styles.num}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(total.groups.length > 0 ? total.groups : []).map((g, i) => (
            <tr key={g.name ?? `none-${i}`}>
              <td>{g.name || t("reports.notSpecified")}</td>
              <td className={styles.num}>{fmt.number(g.rows)}</td>
              {total.columns.map((c) => (
                <td key={c.id} className={styles.num}>
                  {show(c, g.totals[c.id])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>{t("reports.allTogether")}</td>
            <td className={styles.num}>{fmt.number(total.rows)}</td>
            {total.columns.map((c) => (
              <td key={c.id} className={styles.num}>
                {show(c, c.total)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ----------------------------------------------------------- employees
function MyReports() {
  const { t } = useI18n();
  const { user } = useAuth();
  const auto = Boolean(user.employee?.autoReport);
  const form = Boolean(user.employee?.reportForm);
  const today = useAsync(() => api.todayReport(), []);
  const history = useAsync(() => api.reports({ pageSize: 30 }), []);

  return (
    <div>
      <PageHeader title={t("reports.title")} subtitle={t("reports.subtitleSelf")} />
      <div className={pageStyles.stack}>
        <AsyncBoundary state={today}>
          {(data) =>
            !data.auto && !data.template ? (
              <EmptyState icon="alertCircle" text={t("home.noReportForm")} />
            ) : (
              <>
                {/* Automatic numbers, and/or the form to fill in (both for
                    "automatic + form"). */}
                {data.auto && <AutoTodayCard data={data} employeeId={user.employee.id} />}
                {data.template && (
                  <TodayReportCard
                    data={data}
                    onSaved={(report) => {
                      today.setData((d) => ({ ...d, report }));
                      history.reload();
                    }}
                  />
                )}
              </>
            )
          }
        </AsyncBoundary>

        {auto && <AutoReportHistory employeeId={user.employee.id} />}

        {/* Reports filled in by hand (for someone now on automatic: the old ones, if any). */}
        <AsyncBoundary state={history}>
          {(data) => (!auto || form || data.reports.length > 0) && <ReportHistory reports={data.reports} title={auto ? t("autoReport.formHistory") : undefined} />}
        </AsyncBoundary>
      </div>
    </div>
  );
}

// Today's automatic report: nothing to fill in, the numbers so far.
function AutoTodayCard({ data, employeeId }) {
  const { t, fmt } = useI18n();
  return (
    <Card title={`${t("reports.todayForm")} · ${fmt.isoDateLong(data.date)}`} subtitle={t("autoReport.name")} action={<AutoBadge />}>
      <p className={pageStyles.note}>{t("autoReport.selfNote")}</p>
      <AutoReportNumbers day={data.auto} />
      <div className={pageStyles.actionsRow}>
        <Button to={`/reports/auto/${employeeId}/${data.date}`} variant="plain">
          {t("autoReport.open")}
        </Button>
      </div>
    </Card>
  );
}

export function CallStatsLine({ stats, title }) {
  const { t } = useI18n();
  if (!stats) return null;
  return (
    <div className={styles.callStats}>
      <Icon name="phone" size={16} />
      <div>
        <div className={styles.callStatsTitle}>{title}</div>
        <div className={styles.callStatsText}>
          {t("reports.callsSummary", {
            total: stats.totalCalls,
            missed: stats.missedCalls,
            needs: stats.followUp.needsCallback,
          })}
        </div>
      </div>
    </div>
  );
}

export function TodayReportCard({ data, onSaved }) {
  const { t, fmt } = useI18n();
  const [editing, setEditing] = useState(!data.report);
  const [justSent, setJustSent] = useState(false);
  const report = data.report;

  async function submit(answers) {
    const saved = await api.submitTodayReport(answers);
    setEditing(false);
    setJustSent(true);
    onSaved(saved);
  }

  return (
    <Card
      title={`${t("reports.todayForm")} · ${fmt.isoDateLong(data.date)}`}
      subtitle={data.template.name}
      action={report && !editing && <ReportStatusBadge report={report} />}
    >
      <CallStatsLine stats={data.callStats} title={t("reports.callsToday")} />

      {editing ? (
        <ReportForm
          fields={data.template.fields}
          initialAnswers={report?.answers}
          onSubmit={submit}
          submitLabel={report ? t("reports.update") : t("reports.send")}
        />
      ) : (
        <>
          {justSent && <p className={styles.sent}>{t("reports.sent")}</p>}
          <ReportAnswers fields={report.fields} answers={report.answers} />
          {report.reviewedAt ? (
            <p className={pageStyles.note}>{t("reports.lockedReviewed")}</p>
          ) : (
            <div className={pageStyles.actionsRow}>
              <Button icon="sliders" onClick={() => setEditing(true)}>
                {t("reports.edit")}
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export function ReportHistory({ reports, showEmployee = false, title }) {
  const { t, fmt } = useI18n();
  return (
    <section>
      <ListSectionHeader>{title || t("reports.history")}</ListSectionHeader>
      {reports.length === 0 ? (
        <List>
          <EmptyState icon="search" text={t("reports.historyEmpty")} />
        </List>
      ) : (
        <List inset={16}>
          {reports.map((r) => (
            <ListRow
              key={r.id}
              to={`/reports/${r.id}`}
              title={showEmployee ? r.employee?.name : fmt.isoDateLong(r.date)}
              subtitle={showEmployee ? `${fmt.isoDateLong(r.date)} · ${r.template.name}` : r.template.name}
              trailing={<ReportStatusBadge report={r} />}
            />
          ))}
        </List>
      )}
    </section>
  );
}
