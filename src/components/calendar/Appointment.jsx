import styles from "./Calendar.module.css";
import Badge from "../ui/Badge";
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
      </span>
      {/* "Booked" is the normal state — only outcomes get a badge, which
          keeps the client's name readable on a phone. */}
      {a.status !== "booked" && <AppointmentStatusBadge status={a.status} />}
    </button>
  );
}
