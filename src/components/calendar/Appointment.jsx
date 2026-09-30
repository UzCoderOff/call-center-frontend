import styles from "./Calendar.module.css";
import Badge from "../ui/Badge";
import Icon from "../ui/Icon";
import { useI18n } from "../../i18n";

export const APPOINTMENT_TONE = {
  booked: { tone: "accent", icon: "calendar" },
  attended: { tone: "good", icon: "checkCircle" },
  no_show: { tone: "critical", icon: "alertCircle" },
  cancelled: { tone: "neutral", icon: "minusCircle" },
};

export function AppointmentStatusBadge({ status }) {
  const { t } = useI18n();
  const s = APPOINTMENT_TONE[status] || APPOINTMENT_TONE.booked;
  return (
    <Badge tone={s.tone} icon={s.icon}>
      {t(`calendar.appointmentStatus.${status}`)}
    </Badge>
  );
}

export const bookerName = (a) => a.bookedBy?.employee?.name || a.bookedBy?.username;

// Under the client's name: online or not, and whether the consultation fee
// is paid — icon + word, never color alone. Nothing for someone else's
// booking (no details) or, for the fee, a cancelled one.
export function AppointmentMeta({ appointment: a }) {
  const { t, fmt } = useI18n();
  if (a.masked) return null;
  const fee = a.payments?.[0];
  const showFee = a.status !== "cancelled" && Array.isArray(a.payments);
  if (a.format !== "online" && !showFee) return null;
  return (
    <span className={styles.meta}>
      {a.format === "online" && (
        <span className={`${styles.chip} ${styles.chipNeutral}`}>
          <Icon name="video" size={12} strokeWidth={2.2} />
          {t("calendar.format.online")}
        </span>
      )}
      {showFee &&
        (fee ? (
          <span className={`${styles.chip} ${styles.chipGood}`}>
            <Icon name="check" size={12} strokeWidth={2.4} />
            {t("calendar.paidChip", { amount: fmt.number(fee.amount) })}
          </span>
        ) : (
          <span className={`${styles.chip} ${styles.chipWarn}`}>
            <Icon name="cash" size={12} strokeWidth={2.2} />
            {t("calendar.feeNotPaid")}
          </span>
        ))}
    </span>
  );
}

// One appointment in a list (home cards, a call's page). `showDate` for
// lists that span several days.
export function AppointmentRow({ appointment, onOpen, showDate = false }) {
  const { t, fmt } = useI18n();
  const a = appointment;
  const booker = bookerName(a);
  return (
    <button type="button" className={`${styles.appointment} ${a.status === "cancelled" ? styles.cancelled : ""}`} onClick={() => onOpen(a)}>
      <span className={styles.apptTime}>
        {showDate && <span className={styles.apptDate}>{fmt.isoDateLong(a.date)}</span>}
        {fmt.minutes(a.start)}–{fmt.minutes(a.end)}
      </span>
      <span className={styles.apptMain}>
        <span className={styles.apptClient}>{a.clientName}</span>
        <span className={styles.apptSub}>{[a.matter, booker && t("calendar.bookedByLine", { name: booker })].filter(Boolean).join(" · ")}</span>
        <AppointmentMeta appointment={a} />
      </span>
      {/* "Booked" is the normal state — only outcomes get a badge, which
          keeps the client's name readable on a phone. */}
      {a.status !== "booked" && <AppointmentStatusBadge status={a.status} />}
    </button>
  );
}
