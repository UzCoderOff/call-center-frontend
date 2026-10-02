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

// ------------------------------------------------------------ recordings
// "Is this phone recording calls?" (server: services/syncHealth.js). The app
// can't record calls itself; it sends what the phone's own recorder saved.
const RECORDING_STYLE = {
  ok: { tone: "good", icon: "checkCircle" },
  partial: { tone: "warning", icon: "alertTriangle" },
  none: { tone: "critical", icon: "micOff" },
  noAccess: { tone: "critical", icon: "lock" },
  unknown: { tone: "neutral", icon: "minusCircle" },
};

export function isRecordingProblem(recordings) {
  return Boolean(recordings) && ["none", "noAccess", "partial"].includes(recordings.status);
}

export function RecordingBadge({ recordings }) {
  const { t } = useI18n();
  if (!recordings) return null;
  const style = RECORDING_STYLE[recordings.status] || RECORDING_STYLE.unknown;
  return (
    <Badge tone={style.tone} icon={style.icon}>
      {t("recordings.label")}: {t(`recordings.status.${recordings.status}`)}
    </Badge>
  );
}

// One line for lists: "Aziz — 0 of 19 calls recorded".
export function recordingLine(r, t) {
  if (r.status === "noAccess") return t("recordings.lineNoAccess");
  return t(r.status === "partial" ? "recordings.linePartial" : "recordings.lineNone", { calls: r.calls7d, recorded: r.recorded7d });
}
