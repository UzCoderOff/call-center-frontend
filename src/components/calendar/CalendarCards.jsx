import { useState } from "react";
import styles from "./Calendar.module.css";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { Banner } from "../ui/Misc";
import AppointmentSheet from "./AppointmentSheet";
import { AppointmentRow } from "./Appointment";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { telHref, todayIso, weekStartOf } from "../../lib/format";
import { useI18n } from "../../i18n";
import pageStyles from "../../pages/Pages.module.css";

// Home, for the lawyer: is next week confirmed (the weekly reminder — shown
// from Thursday until it is), and today's appointments.
export function LawyerCalendarCard() {
  const { t, fmt } = useI18n();
  const calendars = useAsync(() => api.calendars(), []);
  const mine = calendars.data?.find((c) => c.isMine);
  const today = todayIso();
  const week = useAsync(() => (mine ? api.calendarWeek(mine.id, weekStartOf(today)) : Promise.resolve(null)), [mine?.id]);
  const [open, setOpen] = useState(null);
  if (!mine) return null;

  const next = mine.planning.nextWeek;
  const todays = (week.data?.appointments || []).filter((a) => a.date === today && a.status !== "cancelled");

  return (
    <>
      {next.status !== "published" && mine.planning.remind ? (
        <Banner
          tone="warning"
          icon="calendar"
          action={
            <Button size="small" variant="primary" to={`/calendar?cal=${mine.id}&day=${next.weekStart}`}>
              {t("calendar.planNextWeek")}
            </Button>
          }
        >
          {t("calendar.nextWeekPending", { range: fmt.weekRange(next.weekStart) })}
        </Banner>
      ) : null}

      <Card
        flush
        title={t("calendar.today")}
        subtitle={next.status === "published" ? t("calendar.nextWeekPublished", { range: fmt.weekRange(next.weekStart) }) : undefined}
        action={
          <Button size="small" variant="plain" to={`/calendar?cal=${mine.id}`}>
            {t("calendar.title")}
            <Icon name="chevronRight" size={15} />
          </Button>
        }
      >
        {todays.length === 0 ? (
          <p className={pageStyles.note} style={{ padding: "0 16px 16px" }}>
            {t("calendar.noneToday")}
          </p>
        ) : (
          <div style={{ padding: "0 12px 12px" }}>
            {todays.map((a) => (
              <AppointmentRow key={a.id} appointment={a} onOpen={setOpen} />
            ))}
          </div>
        )}
      </Card>

      {open && (
        <AppointmentSheet
          appointment={open}
          canManage
          today={week.data.today}
          onClose={() => setOpen(null)}
          onChanged={(updated) => {
            setOpen(updated);
            week.reload();
          }}
        />
      )}
    </>
  );
}

// For whoever booked them: appointments the lawyer cancelled (usually by
// changing their day — court in another city…). Call the client, book a new
// time if they want one, then tick "told the client". Renders nothing when
// there's nothing to do.
export function AttentionCard() {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.appointments({ attention: "true" }), []);
  const [done, setDone] = useState(null);
  const list = state.data || [];
  if (list.length === 0) return null;

  async function informed(a) {
    setDone(a.id);
    try {
      await api.updateAppointment(a.id, { clientInformed: true });
      state.setData((rows) => rows.filter((r) => r.id !== a.id));
    } finally {
      setDone(null);
    }
  }

  return (
    <Card title={t("attention.title")} subtitle={t("attention.hint")} className={styles.attentionCard}>
      <div className={styles.attentionList}>
        {list.map((a) => {
          const tel = telHref(a.clientPhone);
          const rebook = `/calendar?cal=${a.calendar.id}${a.clientPhone ? `&phone=${encodeURIComponent(a.clientPhone)}` : ""}&name=${encodeURIComponent(a.clientName)}`;
          return (
            <div key={a.id} className={styles.attentionItem}>
              <div>
                <p className={styles.rowTitle}>{a.clientName}</p>
                <p className={styles.rowSub}>
                  {fmt.isoDay(a.date)}, {fmt.minutes(a.start)}
                  {a.cancelReason ? ` · ${t("attention.reason", { reason: a.cancelReason })}` : ""}
                </p>
                {a.clientPhone && <p className={styles.rowSub}>{fmt.phone(a.clientPhone)}</p>}
              </div>
              <div className={styles.attentionActions}>
                {tel && (
                  <Button size="small" variant="primary" icon="phone" href={tel}>
                    {t("common.call")}
                  </Button>
                )}
                <Button size="small" icon="calendar" to={rebook}>
                  {t("attention.rebook")}
                </Button>
                <Button size="small" icon="check" busy={done === a.id} onClick={() => informed(a)}>
                  {t("attention.informed")}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// Home, for staff who book: the appointments they've booked that are still ahead.
export function MyAppointmentsCard() {
  const { t } = useI18n();
  const state = useAsync(() => api.appointments({ mine: "true" }), []);
  const [open, setOpen] = useState(null);
  if (!state.data) return null;

  return (
    <Card
      flush
      title={t("calendar.myUpcoming")}
      action={
        <Button size="small" variant="plain" to="/calendar">
          {t("calendar.title")}
          <Icon name="chevronRight" size={15} />
        </Button>
      }
    >
      {state.data.length === 0 ? (
        <p className={pageStyles.note} style={{ padding: "0 16px 16px" }}>
          {t("calendar.noneUpcoming")}
        </p>
      ) : (
        <div style={{ padding: "0 12px 12px" }}>
          {state.data.slice(0, 5).map((a) => (
            <AppointmentRow key={a.id} appointment={a} onOpen={setOpen} showDate />
          ))}
        </div>
      )}
      {open && (
        <AppointmentSheet
          appointment={open}
          canManage={false}
          today={todayIso()}
          onClose={() => setOpen(null)}
          onChanged={(updated) => {
            setOpen(updated);
            state.reload();
          }}
        />
      )}
    </Card>
  );
}

// On a call's page: upcoming appointments with this caller, and a button to
// book one (linked to the call).
export function CallerAppointmentsCard({ call, canBook }) {
  const { t } = useI18n();
  const state = useAsync(() => (call.phoneKey ? api.appointments({ phone: call.phoneNumber }) : Promise.resolve([])), [call.id]);
  const list = state.data || [];
  if (!canBook && list.length === 0) return null;
  const bookLink = `/calendar?phone=${encodeURIComponent(call.phoneNumber)}&callId=${call.id}`;

  return (
    <Card
      title={t("calendar.forCaller")}
      action={
        canBook &&
        call.phoneKey && (
          <Button size="small" variant="primary" icon="calendar" to={bookLink}>
            {t("calendar.book")}
          </Button>
        )
      }
    >
      {list.length === 0 ? (
        <p className={pageStyles.note}>{t("calendar.noneUpcoming")}</p>
      ) : (
        list.map((a) => <AppointmentRow key={a.id} appointment={a} onOpen={() => {}} showDate />)
      )}
    </Card>
  );
}
