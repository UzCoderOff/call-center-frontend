import Badge from "./ui/Badge";
import { useI18n } from "../i18n";

const STATE_STYLE = {
  ok: { tone: "good", icon: "checkCircle" },
  stale: { tone: "warning", icon: "clock" },
  failing: { tone: "critical", icon: "alertCircle" },
  never: { tone: "neutral", icon: "minusCircle" },
};

// Whether an employee's phone is actually sending data — the early warning
// for "the app stopped syncing and nobody noticed".
export function SyncBadge({ sync }) {
  const { t } = useI18n();
  if (!sync) return null;
  const style = STATE_STYLE[sync.state] || STATE_STYLE.never;
  return (
    <Badge tone={style.tone} icon={style.icon}>
      {t(`sync.${sync.state}`)}
    </Badge>
  );
}

export function syncLine(sync, t, fmt) {
  if (!sync) return null;
  if (sync.lastSyncAt) return t("sync.lastSync", { time: fmt.relative(sync.lastSyncAt) });
  return t(`sync.${sync.state}`);
}

export function isSyncProblem(sync) {
  return sync && (sync.state === "stale" || sync.state === "failing");
}
