import Card from "../ui/Card";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Icon from "../ui/Icon";
import { List, ListRow } from "../ui/List";
import { StatTile } from "../ui/Misc";
import pageStyles from "../../pages/Pages.module.css";
import styles from "./Clients.module.css";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { todayIso } from "../../lib/format";
import { useI18n } from "../../i18n";

// Home-page cards for the work after the contract: the cases a coordinator
// or lawyer looks after (what needs doing first), the dates coming up in
// them, and — for managers — the contracts still waiting for a coordinator
// or a lawyer.

const DATE_ICON = { hearing: "briefcase", summons: "bell", deadline: "clock", meeting: "users", other: "calendar" };
const clock = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function SeeAll({ to }) {
  const { t } = useI18n();
  return (
    <Button size="small" variant="plain" to={to}>
      {t("common.seeAll")}
      <Icon name="chevronRight" size={15} />
    </Button>
  );
}

// Overdue first (biggest), then the next payment due soonest, then the next
// key date — what a coordinator should look at first.
function urgency(k, today) {
  if (k.overdue > 0) return [0, -k.overdue];
  if (k.nextDue && k.nextDue.dueDate <= today) return [1, 0];
  if (k.nextDate && k.nextDate.date === today) return [2, 0];
  const soonest = [k.nextDue?.dueDate, k.nextDate?.date].filter(Boolean).sort()[0];
  return [3, soonest ? Number(soonest.replaceAll("-", "")) : 99999999];
}

// The coordinator's day in four numbers.
export function CoordinatorSummary({ cases }) {
  const { t, fmt } = useI18n();
  const today = todayIso();
  const inTwoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const overdue = cases.filter((k) => k.overdue > 0);
  const dueSoon = cases.filter((k) => k.nextDue && k.nextDue.dueDate <= inTwoWeeks);
  const calls = cases.filter((k) => k.client.nextCallAt && new Date(k.client.nextCallAt).toISOString().slice(0, 10) <= today);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
      <StatTile label={t("coord.activeCases")} value={fmt.number(cases.filter((k) => k.status === "contract").length)} dot="var(--accent)" to="/clients" />
      <StatTile label={t("coord.overdue")} value={fmt.money(overdue.reduce((s, k) => s + k.overdue, 0))} sub={t("coord.overdueCases", { count: overdue.length })} dot="var(--critical)" />
      <StatTile label={t("coord.dueSoon")} value={fmt.number(dueSoon.length)} sub={t("coord.dueSoonSub")} dot="var(--warning)" />
      <StatTile label={t("coord.callsToday")} value={fmt.number(calls.length)} dot="var(--good)" to="/clients?filter=callToday" />
    </div>
  );
}

// The cases this person looks after, what needs doing first on top.
export function MyCasesCard({ cases, title, limit = 8 }) {
  const { t, fmt } = useI18n();
  const today = todayIso();
  const sorted = [...cases].sort((a, b) => {
    const [x1, x2] = urgency(a, today);
    const [y1, y2] = urgency(b, today);
    return x1 - y1 || x2 - y2;
  });
  return (
    <Card flush title={title || t("coord.myCases")} subtitle={t("coord.myCasesHint")} action={<SeeAll to="/clients" />}>
      {sorted.length === 0 ? (
        <p className={pageStyles.note} style={{ padding: "0 16px 16px" }}>
          {t("coord.noCases")}
        </p>
      ) : (
        <List>
          {sorted.slice(0, limit).map((k) => (
            <ListRow
              key={k.id}
              to={`/clients/${k.client.id}`}
              title={k.client.name}
              subtitle={[k.matter, k.legalStage ? t(`cases.stages.${k.legalStage}`) : null, k.stageSince ? t("caseWork.since", { date: fmt.isoDateLong(k.stageSince) }) : null].filter(Boolean).join(" · ")}
              footer={
                <span className={styles.rowBadges}>
                  {k.overdue > 0 && (
                    <Badge tone="critical" icon="alertCircle">
                      {t("coord.overdueBadge", { amount: fmt.money(k.overdue) })}
                    </Badge>
                  )}
                  {!k.overdue && k.nextDue && (
                    <Badge tone={k.nextDue.dueDate <= today ? "warning" : "neutral"} icon="cash">
                      {t("coord.nextDue", { date: fmt.isoDateLong(k.nextDue.dueDate), amount: fmt.money(k.nextDue.left) })}
                    </Badge>
                  )}
                  {k.nextDate && (
                    <Badge tone={k.nextDate.date === today ? "warning" : "accent"} icon={DATE_ICON[k.nextDate.kind] || "calendar"}>
                      {[k.nextDate.title || t(`caseWork.kinds.${k.nextDate.kind}`), fmt.isoDateLong(k.nextDate.date), k.nextDate.time != null ? clock(k.nextDate.time) : null].filter(Boolean).join(" · ")}
                    </Badge>
                  )}
                  {k.remaining > 0 && !k.overdue && <Badge tone="neutral">{t("clients.debt", { amount: fmt.money(k.remaining) })}</Badge>}
                </span>
              }
            />
          ))}
        </List>
      )}
    </Card>
  );
}

// Hearings, summons, deadlines in the coming two weeks.
export function UpcomingDatesCard({ days = 14 }) {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.upcomingDates(days), [days]);
  const rows = state.data || [];
  if (rows.length === 0) return null;
  const today = todayIso();
  return (
    <Card flush title={t("coord.upcomingTitle")} subtitle={t("coord.upcomingHint", { days })}>
      <List>
        {rows.slice(0, 10).map((r) => (
          <ListRow
            key={r.id}
            to={`/clients/${r.case.client.id}`}
            leading={
              <span className={styles.itemIcon}>
                <Icon name={DATE_ICON[r.kind] || "calendar"} size={16} />
              </span>
            }
            title={`${r.title || t(`caseWork.kinds.${r.kind}`)} — ${r.case.client.name}`}
            subtitle={[r.date === today ? t("caseWork.today") : fmt.isoDay(r.date), r.time != null ? clock(r.time) : null, r.place].filter(Boolean).join(" · ")}
          />
        ))}
      </List>
    </Card>
  );
}

// Managers: contracts still without a coordinator or a lawyer.
export function UnassignedCard() {
  const { t } = useI18n();
  const state = useAsync(() => api.cases("unassigned"), []);
  const rows = state.data?.cases || [];
  if (rows.length === 0) return null;
  return (
    <Card flush title={t("coord.unassignedTitle", { count: rows.length })} subtitle={t("coord.unassignedHint")} action={<SeeAll to="/clients?section=unassigned" />}>
      <List>
        {rows.slice(0, 5).map((k) => (
          <ListRow
            key={k.id}
            to={`/clients/${k.client.id}`}
            title={k.client.name}
            subtitle={[k.matter, k.operator?.name && t("coord.broughtBy", { name: k.operator.name })].filter(Boolean).join(" · ")}
            footer={
              <span className={styles.rowBadges}>
                {!k.coordinator && (
                  <Badge tone="critical" icon="alertCircle">
                    {t("clients.noCoordinator")}
                  </Badge>
                )}
                {!k.lawyerId && (
                  <Badge tone="critical" icon="alertCircle">
                    {t("clients.noLawyer")}
                  </Badge>
                )}
              </span>
            }
          />
        ))}
      </List>
    </Card>
  );
}
