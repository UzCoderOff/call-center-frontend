import styles from "./Calendar.module.css";
import Icon from "../ui/Icon";
import { AppointmentMeta, AppointmentStatusBadge, bookerName } from "./Appointment";
import { blocksOn, isWholeDay } from "../../lib/calendarDays";
import { useI18n } from "../../i18n";

const ORDER = { block: 0, appt: 1, free: 2 };

// Free times next to each other, as one stretch: { start, end, slots }.
function freeRuns(slots) {
  const runs = [];
  for (const s of [...slots].sort((a, b) => a.start - b.start)) {
    const last = runs.at(-1);
    if (last && last.end === s.start) {
      last.end = s.end;
      last.slots.push(s);
    } else runs.push({ start: s.start, end: s.end, slots: [s] });
  }
  return runs;
}

// One day, top to bottom: each stretch of free time with its times as
// buttons (tap one to book a client — the lawyer: to book or close it),
// every booked client, and the lawyer's busy time and breaks.
export default function DaySchedule({ week, date, onBook, onOpen, onSlot, onBlock }) {
  const { t } = useI18n();
  const blocks = blocksOn(week.blocks, date);
  const appointments = week.appointments.filter((a) => a.date === date);
  const active = appointments.filter((a) => a.status !== "cancelled");
  // Only the lawyer gets cancelled ones from the server.
  const cancelled = appointments.filter((a) => a.status === "cancelled");
  const runs = freeRuns(week.free.filter((s) => s.date === date));
  const wholeDay = blocks.find((b) => b.kind === "busy" && isWholeDay(b));
  // The lawyer picks what to do with a free time; staff book it straight away.
  const pick = onSlot || (week.canBook ? onBook : null);

  const items = [
    ...(wholeDay ? [] : blocks.filter((b) => b.kind !== "available").map((b) => ({ type: "block", start: b.start, b }))),
    ...active.map((a) => ({ type: "appt", start: a.start, a })),
    ...runs.map((r) => ({ type: "free", start: r.start, r })),
  ].sort((x, y) => x.start - y.start || ORDER[x.type] - ORDER[y.type]);

  const hasReception = blocks.some((b) => b.kind === "available");
  const noneLeft = hasReception && !wholeDay && runs.length === 0 && date >= week.today;

  return (
    <>
      {wholeDay && (
        <button type="button" className={`${styles.wholeDay} ${onBlock ? styles.wholeDayButton : ""}`} onClick={onBlock ? () => onBlock(wholeDay) : undefined} disabled={!onBlock}>
          <Icon name="briefcase" size={26} />
          <span className={styles.wholeDayTitle}>{t("calendar.wholeDayBusy")}</span>
          {wholeDay.note && <span className={styles.wholeDayNote}>{wholeDay.note}</span>}
        </button>
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
              <FreeRun key={`f${item.start}`} run={item.r} onPick={pick} />
            ) : item.type === "appt" ? (
              <AppointmentItem key={`a${item.a.id}`} appointment={item.a} onOpen={onOpen} />
            ) : (
              <BlockRow key={`b${item.start}`} block={item.b} onOpen={item.b.kind === "busy" ? onBlock : null} />
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

function FreeRun({ run, onPick }) {
  const { t, fmt } = useI18n();
  return (
    <div className={`${styles.row} ${styles.rowFree} ${styles.freeRun}`}>
      <Time start={run.start} end={run.end} />
      <span className={styles.rowMain}>
        <span className={styles.freeLabel}>{t("calendar.freeCount", { count: run.slots.length })}</span>
        <span className={styles.slotChips}>
          {run.slots.map((s) =>
            onPick ? (
              <button key={s.start} type="button" className={styles.slotChip} onClick={() => onPick(s)} aria-label={t("calendar.bookAt", { time: fmt.minutes(s.start) })}>
                {fmt.minutes(s.start)}
              </button>
            ) : (
              <span key={s.start} className={`${styles.slotChip} ${styles.slotChipStatic}`}>
                {fmt.minutes(s.start)}
              </span>
            )
          )}
        </span>
      </span>
    </div>
  );
}

function AppointmentItem({ appointment: a, onOpen }) {
  const { t } = useI18n();
  const booker = bookerName(a);
  // Someone else's booking (their client): only that the time is taken.
  if (a.masked) {
    return (
      <div className={`${styles.row} ${styles.rowAppt} ${a.status === "cancelled" ? styles.rowCancelled : ""}`}>
        <Time start={a.start} end={a.end} />
        <span className={styles.rowMain}>
          <span className={styles.rowTitle}>{t("calendar.busyTaken")}</span>
          <span className={styles.rowSub}>{t("calendar.busyTakenHint")}</span>
        </span>
      </div>
    );
  }
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
        <AppointmentMeta appointment={a} />
      </span>
      {a.status !== "booked" && <AppointmentStatusBadge status={a.status} />}
    </button>
  );
}

// Busy time or a break. The lawyer can tap busy time to open it again.
function BlockRow({ block, onOpen }) {
  const { t } = useI18n();
  const content = (
    <>
      <Time start={block.start} end={block.end} />
      <span className={styles.rowMain}>
        <span className={styles.rowTitle}>
          <Icon name={block.kind === "break" ? "coffee" : "briefcase"} size={16} />
          {block.note || t(`calendar.kinds.${block.kind}`)}
        </span>
        {block.note && <span className={styles.rowSub}>{t(`calendar.kinds.${block.kind}`)}</span>}
      </span>
      {onOpen && <Icon name="chevronRight" size={16} />}
    </>
  );
  if (!onOpen) return <div className={`${styles.row} ${styles.rowBlock}`}>{content}</div>;
  return (
    <button type="button" className={`${styles.row} ${styles.rowBlock} ${styles.rowButton}`} onClick={() => onOpen(block)}>
      {content}
    </button>
  );
}
