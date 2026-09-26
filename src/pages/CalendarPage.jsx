import { useEffect, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import styles from "../components/calendar/Calendar.module.css";
import pageStyles from "./Pages.module.css";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Icon from "../components/ui/Icon";
import Segmented from "../components/ui/Segmented";
import { AsyncBoundary, Banner, EmptyState, PageHeader } from "../components/ui/Misc";
import DayPicker from "../components/calendar/DayPicker";
import DaySchedule from "../components/calendar/DaySchedule";
import DayEditSheet from "../components/calendar/DayEditSheet";
import CalendarSettingsSheet from "../components/calendar/CalendarSettingsSheet";
import BookingSheet from "../components/calendar/BookingSheet";
import AppointmentSheet from "../components/calendar/AppointmentSheet";
import { AttentionCard } from "../components/calendar/CalendarCards";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { shiftIso, todayIso, weekStartOf } from "../lib/format";
import { useI18n } from "../i18n";

// The lawyer's calendar, one day at a time.
//
// URL: ?cal=<id>&day=<YYYY-MM-DD> (the week follows from the day) — plus,
// when opened from a call or to re-book a cancelled client,
// ?phone=&callId=&name= so the booking form is filled in.
export default function CalendarPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const calendars = useAsync(() => api.calendars(), []);

  return (
    <AsyncBoundary state={calendars}>
      {(list) =>
        list.length === 0 ? (
          <div>
            <PageHeader title={t("calendar.title")} />
            <EmptyState icon="calendar" text={t("calendar.noCalendar")} />
          </div>
        ) : (
          <CalendarView calendars={list} initialId={Number(params.get("cal")) || null} onCalendarChanged={calendars.reload} />
        )
      }
    </AsyncBoundary>
  );
}

// Old links to the separate week planner land on the calendar.
export function PlannerRedirect() {
  const { calendarId, weekStart } = useParams();
  return <Navigate to={`/calendar?cal=${calendarId}&day=${weekStart}`} replace />;
}

function CalendarView({ calendars, initialId, onCalendarChanged }) {
  const { t, fmt } = useI18n();
  const [params, setParams] = useSearchParams();
  const fallback = calendars.find((c) => c.isMine) || calendars[0];
  const calendar = calendars.find((c) => c.id === initialId) || fallback;

  const today = todayIso();
  const asked = params.get("day") || params.get("week");
  const weekStart = weekStartOf(asked || today);
  const day = asked && weekStartOf(asked) === weekStart && params.get("day") ? asked : weekStart === weekStartOf(today) ? today : weekStart;
  const prefill = params.get("phone") || params.get("name")
    ? { phone: params.get("phone") || "", name: params.get("name") || "", callId: Number(params.get("callId")) || null }
    : null;

  const state = useAsync(() => api.calendarWeek(calendar.id, weekStart), [calendar.id, weekStart]);
  const [booking, setBooking] = useState(null); // slot
  const [open, setOpen] = useState(null); // appointment
  const [editing, setEditing] = useState(false);
  const [settings, setSettings] = useState(false);
  const [flash, setFlash] = useState("");
  const [publishing, setPublishing] = useState(false);
  // Bumped after each booking: re-booking a cancelled client clears them
  // from the "tell the client" card, so it reloads.
  const [bookings, setBookings] = useState(0);

  // Opening the calendar to book a client on a closed or full day is a dead
  // end — start on the day of the nearest free time instead.
  const loaded = state.data;
  const explicitDay = Boolean(params.get("day"));
  useEffect(() => {
    if (!loaded || explicitDay || !loaded.nextFree || loaded.weekStart !== weekStart) return;
    if (!loaded.free.some((s) => s.date === day)) update({ day: loaded.nextFree.date });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  function update(changes) {
    const next = new URLSearchParams(params);
    next.delete("week");
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === undefined || v === "") next.delete(k);
      else next.set(k, String(v));
    }
    setParams(next, { replace: true });
  }

  function goToWeek(monday) {
    setFlash("");
    update({ day: monday === weekStartOf(today) ? today : monday });
  }

  async function publish() {
    setPublishing(true);
    try {
      await api.publishCalendarWeek(calendar.id, weekStart);
      setFlash(t("calendar.publishedNow"));
      state.reload();
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title={t("calendar.title")}
        subtitle={calendar.name}
        actions={
          <>
            {calendars.length > 1 && (
              <Segmented
                value={calendar.id}
                onChange={(id) => update({ cal: id })}
                label={t("calendar.title")}
                options={calendars.map((c) => ({ value: c.id, label: c.name }))}
              />
            )}
            {calendar.canManage && (
              <Button size="small" icon="settings" onClick={() => setSettings(true)}>
                {t("calendar.settings")}
              </Button>
            )}
          </>
        }
      />

      {prefill && (
        <div className={pageStyles.bannerSpace}>
          <Banner
            icon="phone"
            action={
              <Button size="small" variant="plain" icon="x" onClick={() => update({ phone: null, callId: null, name: null })}>
                {t("common.close")}
              </Button>
            }
          >
            {t("calendar.fromCall", { who: [prefill.name, prefill.phone && fmt.phone(prefill.phone)].filter(Boolean).join(", ") })}
          </Banner>
        </div>
      )}

      <AttentionCard key={bookings} />

      <div className={styles.weekNav}>
        <button type="button" className={styles.navButton} onClick={() => goToWeek(shiftIso(weekStart, -7))} aria-label={t("calendar.prevWeek")}>
          <Icon name="chevronLeft" size={18} />
        </button>
        <span className={styles.weekLabel}>
          <span>{fmt.isoDateLong(weekStart)} –</span> <span>{fmt.isoDateLong(shiftIso(weekStart, 6))}</span>
        </span>
        <button type="button" className={styles.navButton} onClick={() => goToWeek(shiftIso(weekStart, 7))} aria-label={t("calendar.nextWeek")}>
          <Icon name="chevronRight" size={18} />
        </button>
        {weekStart !== weekStartOf(today) && (
          <Button size="small" variant="plain" onClick={() => goToWeek(weekStartOf(today))}>
            {t("calendar.thisWeek")}
          </Button>
        )}
      </div>

      <AsyncBoundary state={state}>
        {(week) => (
          <>
            {week.canManage && (
              <WeekStatus status={week.status} publishing={publishing} onPublish={publish} past={shiftIso(weekStart, 6) < week.today} />
            )}
            {flash && (
              <div className={pageStyles.bannerSpace}>
                <Banner icon="checkCircle">{flash}</Banner>
              </div>
            )}

            <DayPicker week={week} selected={day} onSelect={(date) => update({ day: date })} />

            <section className={styles.daySection} aria-live="polite">
              <div className={styles.dayHead}>
                <h2 className={styles.dayTitle}>
                  {fmt.isoDay(day)}
                  {day === week.today && <Badge tone="accent">{t("calendar.todayBadge")}</Badge>}
                </h2>
                {week.canManage && day >= week.today && (
                  <Button size="small" icon="sliders" onClick={() => setEditing(true)}>
                    {t("calendar.editDay")}
                  </Button>
                )}
              </div>

              {!week.canManage && week.status !== "published" ? (
                <EmptyState icon="calendar" text={t("calendar.notPublished")} />
              ) : (
                <>
                  {week.canBook && day >= week.today && week.free.some((s) => s.date === day) && (
                    <p className={styles.bookHint}>{t("calendar.bookHint")}</p>
                  )}
                  <DaySchedule week={week} date={day} onBook={setBooking} onOpen={setOpen} />
                  {week.nextFree && week.nextFree.date !== day && !week.free.some((s) => s.date === day) && (
                    <Button className={styles.nextFree} variant="primary" icon="arrowRight" block onClick={() => update({ day: week.nextFree.date })}>
                      {t("calendar.nextFree", { when: `${fmt.isoDay(week.nextFree.date)}, ${fmt.minutes(week.nextFree.start)}` })}
                    </Button>
                  )}
                </>
              )}
            </section>

            {booking && (
              <BookingSheet
                calendar={week.calendar}
                slot={booking}
                free={week.free}
                prefill={prefill}
                onClose={() => setBooking(null)}
                onBooked={() => {
                  setBooking(null);
                  setFlash(t("calendar.bookedNow"));
                  setBookings((n) => n + 1);
                  if (prefill) update({ phone: null, callId: null, name: null });
                  state.reload();
                }}
              />
            )}
            {open && (
              <AppointmentSheet
                appointment={open}
                canManage={week.canManage}
                today={week.today}
                onClose={() => setOpen(null)}
                onChanged={(updated) => {
                  setOpen(updated);
                  state.reload();
                }}
              />
            )}
            {editing && (
              <DayEditSheet
                week={week}
                date={day}
                onClose={() => setEditing(false)}
                onSaved={(saved) => {
                  setEditing(false);
                  setFlash(saved.cancelled > 0 ? t("calendar.savedCancelled", { count: saved.cancelled }) : t("calendar.savedDay"));
                  state.reload();
                }}
              />
            )}
          </>
        )}
      </AsyncBoundary>

      {settings && (
        <CalendarSettingsSheet
          calendar={calendar}
          onClose={() => setSettings(false)}
          onSaved={() => {
            setSettings(false);
            setFlash(t("calSettings.saved"));
            onCalendarChanged();
            state.reload();
          }}
        />
      )}
    </div>
  );
}

// For the lawyer: whether staff can see this week yet.
function WeekStatus({ status, publishing, onPublish, past }) {
  const { t } = useI18n();
  if (status === "published") {
    return (
      <p className={styles.weekPublished}>
        <Icon name="checkCircle" size={16} />
        {t("calendar.weekPublished")}
      </p>
    );
  }
  if (past) return null;
  return (
    <div className={pageStyles.bannerSpace}>
      <Banner
        tone="warning"
        icon="alertCircle"
        action={
          <Button size="small" variant="primary" icon="check" busy={publishing} onClick={onPublish}>
            {t("calendar.publish")}
          </Button>
        }
      >
        {t("calendar.weekDraft")}
      </Banner>
    </div>
  );
}
