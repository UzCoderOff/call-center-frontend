import styles from "./Reports.module.css";
import Badge from "../ui/Badge";
import { List, ListRow, ListSectionHeader } from "../ui/List";
import { AsyncBoundary, EmptyState } from "../ui/Misc";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";

// Automatic daily reports (call-center staff): the day's numbers, worked out
// by the server from their calls, bookings and clients — nobody fills them in.

// Nothing happened that day (a Sunday, a day off).
export const isEmptyDay = (day) =>
  (day.calls?.total || 0) + day.booked + day.newClients + day.consultations + day.contracts + (day.payments?.count || 0) === 0;

export function AutoBadge() {
  const { t } = useI18n();
  return (
    <Badge tone="good" icon="checkCircle">
      {t("autoReport.badge")}
    </Badge>
  );
}

// "23 calls · 2 missed · 3 booked" — one line for lists.
export function autoLine(day, t) {
  const parts = [];
  if (day.calls) {
    parts.push(t("autoReport.lineCalls", { n: day.calls.total }));
    if (day.calls.needsCallback > 0) parts.push(t("autoReport.lineNeeds", { n: day.calls.needsCallback }));
  }
  if (day.booked > 0) parts.push(t("autoReport.lineBooked", { n: day.booked }));
  if (day.contracts > 0) parts.push(t("autoReport.lineContracts", { n: day.contracts }));
  return parts.join(" · ") || t("autoReport.lineNothing");
}

// The numbers themselves, in two plain groups.
export default function AutoReportNumbers({ day }) {
  const { t, fmt } = useI18n();
  const groups = [];
  if (day.calls) {
    const c = day.calls;
    groups.push({
      title: t("autoReport.callsTitle"),
      rows: [
        [t("autoReport.total"), fmt.number(c.total)],
        [t("autoReport.answered"), `${fmt.number(c.answered)} (${t("autoReport.inOut", { incoming: c.incoming, outgoing: c.outgoing })})`],
        [t("autoReport.missed"), fmt.number(c.missed)],
        [t("autoReport.reached"), fmt.number(c.reached)],
        // Shown as a warning while any are left.
        [t("autoReport.needsCallback"), fmt.number(c.needsCallback), c.needsCallback > 0],
        [t("autoReport.talk"), c.talkSeconds > 0 ? fmt.duration(c.talkSeconds) : "—"],
      ],
    });
  }
  groups.push({
    title: t("autoReport.clientsTitle"),
    rows: [
      [t("autoReport.booked"), fmt.number(day.booked)],
      [t("autoReport.newClients"), fmt.number(day.newClients)],
      [t("autoReport.consultations"), fmt.number(day.consultations)],
      [t("autoReport.contracts"), fmt.number(day.contracts)],
      // Only for people who see client money — the server leaves it out
      // for everyone else.
      ...(day.payments ? [[t("autoReport.payments"), day.payments.count > 0 ? `${day.payments.count} · ${fmt.money(day.payments.amount)}` : "0"]] : []),
    ],
  });

  return (
    <div className={styles.autoGroups}>
      {groups.map((g) => (
        <section key={g.title}>
          <h3 className={styles.autoTitle}>{g.title}</h3>
          <dl className={styles.answers}>
            {g.rows.map(([label, value, alert]) => (
              <div key={label} className={styles.answerRow}>
                <dt>{label}</dt>
                <dd>
                  {alert ? (
                    <Badge tone="critical" icon="alertCircle">
                      {value}
                    </Badge>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

// The last two weeks, newest first; days when nothing happened are left out.
export function AutoReportHistory({ employeeId, title }) {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.autoReport({ employeeId, days: 14 }), [employeeId]);
  return (
    <section>
      <ListSectionHeader>{title || t("autoReport.history")}</ListSectionHeader>
      <AsyncBoundary state={state}>
        {(data) => {
          const days = data.days.filter((d) => d.date === data.today || !isEmptyDay(d));
          return days.length === 0 ? (
            <List>
              <EmptyState icon="search" text={t("reports.historyEmpty")} />
            </List>
          ) : (
            <List inset={16}>
              {days.map((d) => (
                <ListRow
                  key={d.date}
                  to={`/reports/auto/${data.employee.id}/${d.date}`}
                  title={d.date === data.today ? `${t("reports.today")}, ${fmt.isoDateLong(d.date)}` : fmt.isoDateLong(d.date)}
                  subtitle={autoLine(d, t)}
                />
              ))}
            </List>
          );
        }}
      </AsyncBoundary>
    </section>
  );
}
