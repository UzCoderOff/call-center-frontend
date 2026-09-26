import { Link } from "react-router-dom";
import styles from "./EmployeeStatsTable.module.css";
import Icon from "../ui/Icon";
import { Avatar } from "../ui/Misc";
import { SyncBadge } from "../SyncStatus";
import { formatPercent } from "../../lib/format";
import { useI18n } from "../../i18n";

// One row per employee: volume, missed, and — the part that matters — how
// many missed calls are still waiting for someone to call back. A real
// table on desktop; each row collapses to two lines on a phone.
export default function EmployeeStatsTable({ employees }) {
  const { t, fmt } = useI18n();
  const rows = [...employees].sort((a, b) => b.totalCalls - a.totalCalls);

  return (
    <div className={styles.table} role="table">
      <div className={`${styles.row} ${styles.head}`} role="row">
        <span role="columnheader">{t("calls.employee")}</span>
        <span role="columnheader" className={styles.num}>
          {t("dashboard.total")}
        </span>
        <span role="columnheader" className={styles.num}>
          {t("dashboard.missed")}
        </span>
        <span role="columnheader" className={styles.num}>
          {t("followUp.reached")}
        </span>
        <span role="columnheader" className={styles.num}>
          {t("followUp.needsCallback")}
        </span>
        <span role="columnheader" className={styles.num}>
          {t("dashboard.talkTime")}
        </span>
      </div>

      {rows.map((e) => {
        const f = e.followUp;
        return (
          <Link key={e.id} to={`/team/${e.id}`} className={styles.row} role="row">
            <span className={styles.who} role="cell">
              <Avatar name={e.name} size={34} />
              <span className={styles.whoText}>
                <span className={styles.name}>{e.name}</span>
                <span className={styles.mobileLine}>
                  {fmt.number(e.totalCalls)} · {t("dashboard.missRate", { pct: formatPercent(e.missedCalls, e.totalCalls) })}
                  {f.needsCallback > 0 && (
                    <>
                      {" · "}
                      <span className={styles.pendingText}>
                        {t("followUp.needsCallback")}: {f.needsCallback}
                      </span>
                    </>
                  )}
                </span>
                <span className={styles.syncLine}>
                  <SyncBadge sync={e.sync} />
                </span>
              </span>
            </span>
            <span className={styles.num} role="cell">
              {fmt.number(e.totalCalls)}
            </span>
            <span className={styles.num} role="cell">
              {fmt.number(e.missedCalls)}
              <span className={styles.pct}>{formatPercent(e.missedCalls, e.totalCalls)}%</span>
            </span>
            <span className={styles.num} role="cell">
              {fmt.number(f.reached)}
              <span className={styles.pct}>{e.missedCalls ? `${formatPercent(f.reached, e.missedCalls)}%` : "—"}</span>
            </span>
            <span className={styles.num} role="cell">
              {f.needsCallback > 0 ? (
                <span className={styles.pending}>
                  <Icon name="alertCircle" size={13} strokeWidth={2.2} />
                  {fmt.number(f.needsCallback)}
                </span>
              ) : (
                <span className={styles.zero}>0</span>
              )}
            </span>
            <span className={styles.num} role="cell">
              {fmt.duration(e.talkSeconds)}
            </span>
            <Icon name="chevronRight" size={16} className={styles.chevron} />
          </Link>
        );
      })}
    </div>
  );
}
