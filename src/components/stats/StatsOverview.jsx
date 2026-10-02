import { Link } from "react-router-dom";
import styles from "./StatsOverview.module.css";
import Card from "../ui/Card";
import Icon from "../ui/Icon";
import { DurationValue, StatTile } from "../ui/Misc";
import { List } from "../ui/List";
import CallRow from "../calls/CallRow";
import DailyChart from "../charts/DailyChart";
import FollowUpMeter from "../charts/FollowUpMeter";
import FunnelCard from "./Funnel";
import { formatPercent } from "../../lib/format";
import { useI18n } from "../../i18n";

// A link to the Calls page showing the calls behind a number: same period,
// same person (`callsLink`, e.g. "employeeId=3"), plus `extra` filters.
function callsUrl(range, callsLink, extra = {}) {
  const params = new URLSearchParams(callsLink || "");
  for (const [key, value] of Object.entries({ ...extra, period: range })) if (value) params.set(key, value);
  return `/calls?${params}`;
}

// The stat block shared by the dashboard (company or self) and an
// employee's page: headline tiles (each opens its calls), missed-call
// follow-up, the "call these people back" list, and calls per day (each day
// opens its calls). Under the tiles: from calls to contracts, by people
// (`money`: with the estimate of what was lost — managers).
export default function StatsOverview({ data, range, showEmployee, callsLink, money = false }) {
  const { t, fmt } = useI18n();
  const s = data.totals;
  const link = (extra) => callsUrl(range, callsLink, extra);
  // Against the same stretch before (the same days of last month…).
  const prev = data.previous?.totalCalls;
  const change = prev > 0 ? Math.round(((s.totalCalls - prev) / prev) * 100) : null;
  const versus =
    prev == null
      ? undefined
      : `${change == null ? "" : change > 0 ? `↑ ${change}% · ` : change < 0 ? `↓ ${Math.abs(change)}% · ` : "= · "}${t(`dashboard.vs.${range}`, { n: fmt.number(prev) })}`;

  return (
    <div className={styles.stack}>
      <div className={styles.tiles}>
        <StatTile label={t("dashboard.totalCalls")} value={fmt.number(s.totalCalls)} sub={versus} to={link()} />
        <StatTile
          label={t("dashboard.answered")}
          dot="var(--series-answered)"
          value={fmt.number(s.answeredCalls)}
          sub={t("dashboard.answerRate", { pct: formatPercent(s.answeredCalls, s.totalCalls) })}
          to={link({ view: "answered" })}
        />
        <StatTile
          label={t("dashboard.missed")}
          dot="var(--series-missed)"
          value={fmt.number(s.missedCalls)}
          sub={t("dashboard.missRate", { pct: formatPercent(s.missedCalls, s.totalCalls) })}
          to={link({ view: "missed" })}
        />
        <StatTile
          label={t("dashboard.talkTime")}
          value={<DurationValue seconds={s.talkSeconds} />}
          sub={s.answeredCalls > 0 ? t("dashboard.avgCall", { time: fmt.duration(Math.round(s.talkSeconds / s.answeredCalls)) }) : undefined}
          to={link({ view: "answered", sort: "longest" })}
        />
      </div>

      <FunnelCard funnel={data.funnel} money={money} />

      <div className={styles.twoCol}>
        <Card title={t("followUp.title")}>
          <FollowUpMeter stats={s} />
        </Card>
        <NeedsCallbackCard preview={data.needsCallback} showEmployee={showEmployee} link={callsLink} />
      </div>

      {range !== "today" && data.daily.length > 1 && (
        <Card title={t("dashboard.perDay")}>
          <DailyChart data={data.daily} dayLink={(date) => callsUrl("", callsLink, { date })} />
        </Card>
      )}
    </div>
  );
}

function NeedsCallbackCard({ preview, showEmployee, link }) {
  const { t } = useI18n();
  const moreLink = `/calls?view=needsCallback${link ? `&${link}` : ""}`;

  return (
    <Card
      flush
      title={t("followUp.needsCallback")}
      subtitle={t("followUp.needsCallbackHint")}
      action={preview.count > 0 && <span className={styles.count}>{preview.count}</span>}
    >
      {preview.items.length === 0 ? (
        <div className={styles.allDone}>
          <Icon name="checkCircle" size={18} />
          {t("followUp.needsCallbackEmpty")}
        </div>
      ) : (
        <>
          <List plain>
            {preview.items.map((call) => (
              <CallRow key={call.id} call={{ ...call, missed: true }} showEmployee={showEmployee} showCallButton dateStyle="dateTime" />
            ))}
          </List>
          {preview.count > preview.items.length && (
            <Link to={moreLink} className={styles.more}>
              {t("common.seeAll")} ({preview.count})
              <Icon name="chevronRight" size={15} />
            </Link>
          )}
        </>
      )}
    </Card>
  );
}
