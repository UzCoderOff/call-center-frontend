import { Link } from "react-router-dom";
import styles from "./StatsOverview.module.css";
import Card from "../ui/Card";
import Icon from "../ui/Icon";
import { DurationValue, StatTile } from "../ui/Misc";
import { List } from "../ui/List";
import CallRow from "../calls/CallRow";
import DailyChart from "../charts/DailyChart";
import FollowUpMeter from "../charts/FollowUpMeter";
import { formatPercent } from "../../lib/format";
import { useI18n } from "../../i18n";

// The stat block shared by the dashboard (company or self) and an
// employee's page: headline tiles, missed-call follow-up, the "call these
// people back" list, and calls per day.
export default function StatsOverview({ data, range, showEmployee, callsLink }) {
  const { t, fmt } = useI18n();
  const s = data.totals;

  return (
    <div className={styles.stack}>
      <div className={styles.tiles}>
        <StatTile label={t("dashboard.totalCalls")} value={fmt.number(s.totalCalls)} />
        <StatTile
          label={t("dashboard.answered")}
          dot="var(--series-answered)"
          value={fmt.number(s.answeredCalls)}
          sub={t("dashboard.answerRate", { pct: formatPercent(s.answeredCalls, s.totalCalls) })}
        />
        <StatTile
          label={t("dashboard.missed")}
          dot="var(--series-missed)"
          value={fmt.number(s.missedCalls)}
          sub={t("dashboard.missRate", { pct: formatPercent(s.missedCalls, s.totalCalls) })}
        />
        <StatTile label={t("dashboard.talkTime")} value={<DurationValue seconds={s.talkSeconds} />} />
      </div>

      <div className={styles.twoCol}>
        <Card title={t("followUp.title")}>
          <FollowUpMeter stats={s} />
        </Card>
        <NeedsCallbackCard preview={data.needsCallback} showEmployee={showEmployee} link={callsLink} />
      </div>

      {range !== "today" && data.daily.length > 1 && (
        <Card title={t("dashboard.perDay")}>
          <DailyChart data={data.daily} />
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
