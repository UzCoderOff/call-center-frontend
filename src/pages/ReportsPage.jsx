import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import styles from "./ReportsPage.module.css";
import pageStyles from "./Pages.module.css";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { SelectField } from "../components/ui/Field";
import { List, ListRow, ListSectionHeader } from "../components/ui/List";
import { AsyncBoundary, Avatar, EmptyState, PageHeader } from "../components/ui/Misc";
import ReportForm from "../components/reports/ReportForm";
import ReportAnswers, { ReportStatusBadge } from "../components/reports/ReportAnswers";
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
function ManagerReports() {
  const { t, fmt } = useI18n();
  const [params, setParams] = useSearchParams();
  const date = params.get("date") || "";
  const officeId = params.get("office") || "";
  const offices = useAsync(() => api.offices(), []);
  const state = useAsync(() => api.reportsDay({ date: date || undefined, officeId: officeId || undefined }), [date, officeId]);

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

  return (
    <div>
      <PageHeader
        title={t("reports.title")}
        subtitle={shownDate ? `${isToday ? `${t("reports.today")}, ` : ""}${fmt.isoDateLong(shownDate)}` : t("reports.subtitleManager")}
      />

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
        <SelectField
          aria-label={t("settings.offices")}
          value={officeId}
          onChange={(e) => update({ office: e.target.value })}
          className={styles.officeSelect}
        >
          <option value="">{t("reports.allOffices")}</option>
          {(offices.data || []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </SelectField>
      </div>

      <AsyncBoundary state={state}>
        {(data) => <DayView data={data} />}
      </AsyncBoundary>
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
        {data.forms.map((f) => (
          <FormSummary key={f.template.id} form={f} />
        ))}
      </div>

      {ordered.map(([office, rows]) => (
        <section key={office || "none"}>
          <ListSectionHeader>{office || t("reports.noOffice")}</ListSectionHeader>
          <List inset={68}>
            {rows.map((row) => (
              <ListRow
                key={row.employee.id}
                to={row.report ? `/reports/${row.report.id}` : undefined}
                leading={<Avatar name={row.employee.name} size={40} />}
                title={row.employee.name}
                subtitle={row.template.name}
                trailing={<ReportStatusBadge report={row.report} />}
              />
            ))}
          </List>
        </section>
      ))}
    </div>
  );
}

function FormSummary({ form }) {
  const { t, fmt } = useI18n();
  const complete = form.submitted >= form.expected;
  return (
    <Card title={form.template.name} subtitle={t("reports.submittedCount", { submitted: form.submitted, expected: form.expected })}>
      <div className={styles.progress} aria-hidden="true">
        <span
          className={complete ? styles.progressDone : styles.progressFill}
          style={{ width: `${form.expected ? Math.min(100, (form.submitted / form.expected) * 100) : 0}%` }}
        />
      </div>
      {form.totals.length > 0 && (
        <ul className={styles.totals}>
          {form.totals.map((total) =>
            total.counts ? (
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
      )}
    </Card>
  );
}

// ----------------------------------------------------------- employees
function MyReports() {
  const { t } = useI18n();
  const today = useAsync(() => api.todayReport(), []);
  const history = useAsync(() => api.reports({ pageSize: 30 }), []);

  return (
    <div>
      <PageHeader title={t("reports.title")} subtitle={t("reports.subtitleSelf")} />
      <div className={pageStyles.stack}>
        <AsyncBoundary state={today}>
          {(data) =>
            data.template ? (
              <TodayReportCard
                data={data}
                onSaved={(report) => {
                  today.setData((d) => ({ ...d, report }));
                  history.reload();
                }}
              />
            ) : (
              <EmptyState icon="alertCircle" text={t("home.noReportForm")} />
            )
          }
        </AsyncBoundary>

        <AsyncBoundary state={history}>
          {(data) => <ReportHistory reports={data.reports} />}
        </AsyncBoundary>
      </div>
    </div>
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
