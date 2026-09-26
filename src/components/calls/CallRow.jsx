import styles from "./CallRow.module.css";
import Icon from "../ui/Icon";
import { ListRow } from "../ui/List";
import { FollowUpBadge } from "../ui/Badge";
import { telHref } from "../../lib/format";
import { useI18n } from "../../i18n";

const TYPE_ICON = {
  incoming: "phoneIncoming",
  outgoing: "phoneOutgoing",
  missed: "phoneMissed",
  rejected: "phoneMissed",
  voicemail: "phoneMissed",
  unknown: "phone",
};

export function CallTypeIcon({ call, size = 36 }) {
  const { t } = useI18n();
  const tone = call.missed ? styles.iconMissed : styles.iconNormal;
  return (
    <span className={`${styles.icon} ${tone}`} style={{ width: size, height: size }}>
      <Icon name={TYPE_ICON[call.callType] || "phone"} size={Math.round(size * 0.46)} title={t(`callType.${call.callType}`)} />
    </span>
  );
}

// One call in a list. Missed calls show where their follow-up stands; a
// call still waiting for a callback gets a one-tap "call" button (it's a
// tel: link — on a phone that's straight into the dialer).
// `compact` (a number's own history) leads with the call type instead of
// repeating the same phone number on every row.
export default function CallRow({ call, showEmployee = false, showCallButton = false, dateStyle = "time", compact = false }) {
  const { t, fmt } = useI18n();
  const when = dateStyle === "time" ? fmt.time(call.callTimestampMs) : fmt.dateTime(call.callTimestampMs);
  const typeLabel = t(`callType.${call.callType}`);
  const title = compact ? typeLabel : fmt.phone(call.phoneNumber);
  const parts = [showEmployee && call.employee?.name, !compact && typeLabel, when].filter(Boolean);
  const needsCallback = call.followUp === "pending" || call.followUp === "attempted";
  const tel = showCallButton && needsCallback ? telHref(call.phoneNumber) : null;

  // Missed calls: the follow-up badge goes on its own line so the phone
  // number keeps its full width next to the call button on a phone.
  const footer = call.missed ? <FollowUpBadge status={call.followUp} /> : null;
  const trailing = call.missed ? null : (
    <span className={styles.meta}>
      {call.recordingPath && <Icon name="waveform" size={15} title={t("callDetail.recording")} />}
      <span className="tabular">{call.durationSeconds > 0 ? fmt.clock(call.durationSeconds) : "—"}</span>
    </span>
  );

  return (
    <ListRow
      to={`/calls/${call.id}`}
      leading={<CallTypeIcon call={call} />}
      title={title}
      subtitle={parts.join(" · ")}
      footer={footer}
      trailing={trailing}
      chevron={false}
      actions={
        tel && (
          <a href={tel} className={styles.callButton} aria-label={`${t("common.call")}: ${fmt.phone(call.phoneNumber)}`}>
            <Icon name="phone" size={17} strokeWidth={2} />
          </a>
        )
      }
    />
  );
}

// Calls grouped under day headers ("Bugun", "Kecha", "Payshanba, 24-sentabr").
export function CallList({ calls, showEmployee, showCallButton }) {
  const { fmt } = useI18n();
  const groups = [];
  for (const call of calls) {
    const label = fmt.dayHeader(call.callTimestampMs);
    if (groups.length === 0 || groups[groups.length - 1].label !== label) groups.push({ label, calls: [] });
    groups[groups.length - 1].calls.push(call);
  }

  return (
    <div className={styles.groups}>
      {groups.map((g) => (
        <section key={g.label}>
          <h3 className={styles.dayHeader}>{g.label}</h3>
          <div className={styles.list}>
            {g.calls.map((c) => (
              <CallRow key={c.id} call={c} showEmployee={showEmployee} showCallButton={showCallButton} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
