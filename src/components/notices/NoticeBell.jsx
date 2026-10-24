import { Link } from "react-router-dom";
import styles from "./Notices.module.css";
import Icon from "../ui/Icon";
import { useNoticeUnread } from "../../hooks/useNoticeUnread";
import { useI18n } from "../../i18n";

// The bell at the top of the home page: how many notifications are new.
export default function NoticeBell() {
  const { t } = useI18n();
  const unread = useNoticeUnread();
  const label = unread > 0 ? t("notices.bellNew", { count: unread }) : t("notices.title");
  return (
    <Link to="/notifications" className={styles.bell} aria-label={label} title={label}>
      <Icon name="bell" size={22} />
      {unread > 0 && <span className={styles.bellBadge}>{unread > 99 ? "99+" : unread}</span>}
    </Link>
  );
}

// Which picture goes with which kind of notification (services/telegram/prefs.js).
const ICONS = {
  appointments: "calendar",
  calendar: "calendar",
  missedCalls: "phoneMissed",
  callReviews: "sparkles",
  digest: "home",
  reportReminder: "clipboard",
  aiReports: "sparkles",
  materials: "book",
  planning: "calendar",
  tasks: "checkCircle",
  targets: "target",
  recordings: "micOff",
  cases: "briefcase",
  hearings: "briefcase",
  followUps: "clock",
  reminder: "alarm",
  strikes: "alertTriangle",
  summaries: "note",
  chatEvent: "message",
  news: "sparkles",
  deploys: "refresh",
};

export const noticeIcon = (kind) => ICONS[kind] || "bell";
