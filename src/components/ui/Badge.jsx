import styles from "./Badge.module.css";
import Icon from "./Icon";
import { useI18n } from "../../i18n";

// tone: good | warning | critical | neutral | accent
export default function Badge({ tone = "neutral", icon, children }) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`}>
      {icon && <Icon name={icon} size={13} strokeWidth={2.2} />}
      {children}
    </span>
  );
}

// Follow-up status of a missed call. Always icon + label — the colour is
// never the only signal.
export const FOLLOW_UP_STYLE = {
  pending: { tone: "critical", icon: "alertCircle" },
  attempted: { tone: "warning", icon: "clock" },
  called_back: { tone: "good", icon: "checkCircle" },
  client_called_again: { tone: "good", icon: "checkCircle" },
  handled: { tone: "good", icon: "check" },
  no_number: { tone: "neutral", icon: "minusCircle" },
};

export function FollowUpBadge({ status }) {
  const { t } = useI18n();
  const style = FOLLOW_UP_STYLE[status];
  if (!style) return null;
  return (
    <Badge tone={style.tone} icon={style.icon}>
      {t(`status.${status}`)}
    </Badge>
  );
}
