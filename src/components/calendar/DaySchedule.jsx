import styles from "./Calendar.module.css";
import Icon from "../ui/Icon";
import { AppointmentStatusBadge, bookerName } from "./Appointment";
import { blocksOn, isWholeDay } from "../../lib/calendarDays";
import { useI18n } from "../../i18n";

const ORDER = { block: 0, appt: 1, free: 2 };

// One day, read top to bottom like a paper appointment book: every free
// time (tap to book a client), every booked client, and the lawyer's busy
// time and breaks, in time order.
export default function DaySchedule({ week, date, onBook, onOpen }) {
  const { t } = useI18n();
  const blocks = blocksOn(week.blocks, date);
  const appointments = week.appointments.filter((a) => a.date === date);
  const active = appointments.filter((a) => a.status !== "cancelled");
  // Only the lawyer gets cancelled ones from the server.
  const cancelled = appointments.filter((a) => a.status === "cancelled");
  const free = week.free.filter((s) => s.date === date);
  const wholeDay = blocks.find((b) => b.kind === "busy" && isWholeDay(b));

  const items = [
    ...(wholeDay ? [] : blocks.filter((b) => b.kind !== "available").map((b) => ({ type: "block", start: b.start, b }))),
    ...active.map((a) => ({ type: "appt", start: a.start, a })),
    ...free.map((s) => ({ type: "free", start: s.start, s })),
  ].sort((x, y) => x.start - y.start || ORDER[x.type] - ORDER[y.type]);

  const hasReception = blocks.some((b) => b.kind === "available");
  const noneLeft = hasReception && !wholeDay && free.length === 0 && date >= week.today;

  return (
    <>
      {wholeDay && (
        <div className={styles.wholeDay}>
          <Icon name="briefcase" size={26} />
          <span className={styles.wholeDayTitle}>{t("calendar.wholeDayBusy")}</span>
          {wholeDay.note && <span className={styles.wholeDayNote}>{wholeDay.note}</span>}
        </div>
      )}

      {!wholeDay && items.length === 0 && (
        <div className={styles.emptyDay}>
          <Icon name="calendar" size={24} />
          {hasReception ? t("calendar.noFreeLeft") : t("calendar.noReception")}
        </div>
      )}

      {items.length > 0 && (
        <div className={styles.schedule}>
          {items.map((item) =>
            item.type === "free" ? (
              <FreeRow key={`f${item.start}`} slot={item.s} canBook={week.canBook} onBook={onBook} />
            ) : item.type === "appt" ? (
              <AppointmentItem key={`a${item.a.id}`} appointment={item.a} onOpen={onOpen} />
            ) : (
              <BlockRow key={`b${item.start}`} block={item.b} />
            )
          )}
          {noneLeft && <p className={styles.scheduleNote}>{t("calendar.noFreeLeft")}</p>}
        </div>
      )}

      {cancelled.length > 0 && (
        <>
          <h3 className={styles.subheading}>{t("calendar.cancelledList")}</h3>
          <div className={styles.schedule}>
            {cancelled.map((a) => (
              <AppointmentItem key={a.id} appointment={a} onOpen={onOpen} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Time({ start, end }) {
  const { fmt } = useI18n();
  return (
    <span className={styles.rowTime}>
      <span>{fmt.minutes(start)}</span>
      {end !== undefined && <span className={styles.rowTimeEnd}>{fmt.minutes(end)}</span>}
    </span>
  );
}

function FreeRow({ slot, canBook, onBook }) {
  const { t } = useI18n();
  const content = (
    <>
      <Time start={slot.start} />
      <span className={styles.rowMain}>
        <span className={styles.freeLabel}>{t("calendar.freeRow")}</span>
      </span>
      {canBook && (
        <span className={styles.bookPill}>
          <Icon name="plus" size={15} strokeWidth={2.4} />
          {t("calendar.bookAction")}
        </span>
      )}
    </>
  );
  if (!canBook) return <div className={`${styles.row} ${styles.rowFree}`}>{content}</div>;
  return (
    <button type="button" className={`${styles.row} ${styles.rowFree} ${styles.rowButton}`} onClick={() => onBook(slot)}>
      {content}
    </button>
  );
}

function AppointmentItem({ appointment: a, onOpen }) {
  const { t } = useI18n();
  const booker = bookerName(a);
  return (
    <button
      type="button"
      className={`${styles.row} ${styles.rowAppt} ${styles.rowButton} ${a.status === "cancelled" ? styles.rowCancelled : ""}`}
      onClick={() => onOpen(a)}
    >
      <Time start={a.start} end={a.end} />
      <span className={styles.rowMain}>
        <span className={styles.rowTitle}>{a.clientName}</span>
        <span className={styles.rowSub}>{[a.matter, booker && t("calendar.bookedByLine", { name: booker })].filter(Boolean).join(" · ")}</span>
      </span>
      {a.status !== "booked" && <AppointmentStatusBadge status={a.status} />}
    </button>
  );
}

function BlockRow({ block }) {
  const { t } = useI18n();
  return (
    <div className={`${styles.row} ${styles.rowBlock}`}>
      <Time start={block.start} end={block.end} />
      <span className={styles.rowMain}>
        <span className={styles.rowTitle}>
          <Icon name={block.kind === "break" ? "coffee" : "briefcase"} size={16} />
          {block.note || t(`calendar.kinds.${block.kind}`)}
        </span>
        {block.note && <span className={styles.rowSub}>{t(`calendar.kinds.${block.kind}`)}</span>}
      </span>
    </div>
  );
}
