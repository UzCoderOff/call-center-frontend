import { useNavigate, useParams } from "react-router-dom";
import pageStyles from "./Pages.module.css";
import styles from "./ReportsPage.module.css";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { AsyncBoundary, PageHeader } from "../components/ui/Misc";
import AutoReportNumbers, { AutoBadge } from "../components/reports/AutoReport";
import { useAuth, isManagerRole } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { useBack } from "../hooks/useBack";
import { api } from "../lib/api";
import { canSeeCalls } from "../lib/access";
import { useI18n } from "../i18n";

function shiftIso(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86400000).toISOString().slice(0, 10);
}

// One person's automatic report for one day, with the day before / after.
export default function AutoReportPage() {
  const { employeeId, date } = useParams();
  const { user } = useAuth();
  const { t, fmt } = useI18n();
  const navigate = useNavigate();
  const goBack = useBack("/reports");
  const isManager = isManagerRole(user.role);
  const state = useAsync(() => api.autoReport({ employeeId, date }), [employeeId, date]);

  if (state.error?.status === 404 || state.error?.status === 400) {
    return <PageHeader back={{ label: t("reports.title"), onClick: goBack }} title={t("reports.notFound")} />;
  }

  const go = (iso) => navigate(`/reports/auto/${employeeId}/${iso}`, { replace: true });

  return (
    <AsyncBoundary state={state}>
      {(data) => {
        const day = data.days[0];
        const isToday = date === data.today;
        return (
          <div>
            <PageHeader
              back={{ label: t("reports.title"), onClick: goBack }}
              title={isManager ? data.employee.name : fmt.isoDateLong(date)}
              subtitle={isManager ? `${fmt.isoDateLong(date)} · ${t("autoReport.name")}` : t("autoReport.name")}
              actions={<AutoBadge />}
            />
            <div className={styles.toolbar}>
              <div className={styles.dateNav}>
                <button type="button" className={styles.navButton} onClick={() => go(shiftIso(date, -1))} aria-label={t("reports.prevDay")}>
                  <Icon name="chevronLeft" size={18} />
                </button>
                <span className={styles.dateLabel}>{isToday ? `${t("reports.today")}, ${fmt.isoDateLong(date)}` : fmt.isoDateLong(date)}</span>
                <button
                  type="button"
                  className={styles.navButton}
                  onClick={() => go(shiftIso(date, 1))}
                  disabled={isToday}
                  aria-label={t("reports.nextDay")}
                >
                  <Icon name="chevronRight" size={18} />
                </button>
              </div>
            </div>
            <div className={pageStyles.stack}>
              <Card title={t("autoReport.dayTitle")} subtitle={isToday ? t("autoReport.todayNote") : t("autoReport.pastNote")}>
                <AutoReportNumbers day={day} />
              </Card>
              {day.calls && canSeeCalls(user) && (
                <div className={pageStyles.actionsRow}>
                  <Button to={`/calls?employeeId=${data.employee.id}&date=${date}`} icon="phone">
                    {t("autoReport.seeCalls")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      }}
    </AsyncBoundary>
  );
}
