import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import styles from "../components/calendar/Calendar.module.css";
import pageStyles from "./Pages.module.css";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Icon from "../components/ui/Icon";
import Sheet from "../components/ui/Sheet";
import Segmented from "../components/ui/Segmented";
import { AsyncBoundary, Banner, EmptyState, PageHeader } from "../components/ui/Misc";
import DayPicker from "../components/calendar/DayPicker";
import DaySchedule from "../components/calendar/DaySchedule";
import DayEditSheet from "../components/calendar/DayEditSheet";
import CalendarSettingsSheet from "../components/calendar/CalendarSettingsSheet";
import BookingSheet from "../components/calendar/BookingSheet";
import AppointmentSheet from "../components/calendar/AppointmentSheet";
import PersonalCalendar from "../components/calendar/PersonalCalendar";
import WhoIsFree from "../components/calendar/WhoIsFree";
import Covers, { useCovers } from "../components/calendar/Covers";
import { AttentionCard } from "../components/calendar/CalendarCards";
import { useAuth } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { isLawyer, isManager } from "../lib/access";
import { STEP, blocksOn, dayMode, isWholeDay, replaceDay, usualDay } from "../lib/calendarDays";
import { shiftIso, todayIso, weekStartOf } from "../lib/format";
import { useI18n } from "../i18n";
import { saveFailed } from "../lib/saveFailed";

// The calendar has two sides (2026-10-14):
//   Mening kunim / Advokatlar kuni  a lawyer's own day — court, meetings,
//        work (components/calendar/PersonalCalendar.jsx). Every lawyer has
//        one; the boss sees them all.
//   Konsultatsiyalar  the consultation calendar staff book clients into —
//        a lawyer can switch theirs off.
//   Kim boʻsh?  every lawyer's busy times on a day, and when the ones picked
//        are all free (components/calendar/WhoIsFree.jsx).
// URL: ?view=mine|free|consult — plus, for consultations, ?cal=<id>&day=<date>
// and, when opened from a call or to re-book a client, ?phone=&callId=&name=
// so the booking form is filled in (always the consultation side).
export default function CalendarPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const personalAllowed = isLawyer(user) || isManager(user);
  const calendars = useAsync(() => api.calendars(), []);
  const people = useAsync(() => (personalAllowed ? api.personalPeople() : Promise.resolve([])), [personalAllowed]);

  const booking = params.get("phone") || params.get("name") || params.get("clientId") || params.get("cal");
  const hasConsult = (calendars.data || []).length > 0;
  const hasPersonal = (people.data || []).length > 0;
  const asked = params.get("view");
  const view =
    asked === "free" && personalAllowed
      ? "free"
      : asked === "mine" && hasPersonal
        ? "mine"
        : asked === "consult" && hasConsult
          ? "consult"
          : !booking && isLawyer(user) && hasPersonal
            ? "mine"
            : hasConsult
              ? "consult"
              : "mine";
  // Lawyers away and who covers for them.
  const covers = useCovers();

  function switchView(v) {
    // Each side keeps its own day.
    setParams(new URLSearchParams({ view: v }), { replace: true });
  }

  const ready = calendars.data && people.data;
  return (
    <div className={`${styles.page} ${view === "mine" || view === "free" ? styles.pageWide : ""}`}>
      <PageHeader
        title={t("calendar.title")}
        actions={
          ready && hasPersonal ? (
            <Segmented
              value={view}
              onChange={switchView}
              label={t("calendar.title")}
              options={[
                { value: "mine", label: isManager(user) ? t("personal.lawyersDay") : t("personal.myDay") },
                { value: "free", label: t("free.tab") },
                ...(hasConsult ? [{ value: "consult", label: t("personal.consultations") }] : []),
              ]}
            />
          ) : null
        }
      />
      <AsyncBoundary state={calendars}>
        {(list) => (
          <AsyncBoundary state={people}>
            {(persons) =>
              view === "free" && personalAllowed ? (
                <WhoIsFree />
              ) : view === "mine" && persons.length > 0 ? (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Covers state={covers} />
                  </div>
                  <PersonalCalendar people={persons} isManager={isManager(user)} onPeopleChanged={() => (people.reload(), calendars.reload())} />
                </>
              ) : list.length === 0 ? (
                <EmptyState icon="calendar" text={t("calendar.noCalendar")} />
              ) : (
                <CalendarView
                  calendars={list}
                  initialId={Number(params.get("cal")) || null}
                  canDelete={user.role === "DEVELOPER"}
                  onCalendarChanged={() => (calendars.reload(), people.reload())}
                />
              )
            }
          </AsyncBoundary>
        )}
      </AsyncBoundary>
    </div>
  );
}

// Old links to the separate week planner land on the calendar.
export function PlannerRedirect() {
  const { calendarId, weekStart } = useParams();
  return <Navigate to={`/calendar?view=consult&cal=${calendarId}&day=${weekStart}`} replace />;
}

const MODES = [
  { value: "usual", icon: "calendar" },
  { value: "busy", icon: "briefcase" },
  { value: "off", icon: "minusCircle" },
  { value: "custom", icon: "sliders" },
];

// One free time taken out of reception (the lawyer): the reception around
// it stays, the time itself becomes busy.
function closeTime(dayBlocks, date, start, end, note) {
  const out = [];
  for (const b of dayBlocks) {
    if (b.kind !== "available" || b.end <= start || b.start >= end) {
      out.push(b);
      continue;
    }
    if (start - b.start >= STEP) out.push({ ...b, end: start });
    if (b.end - end >= STEP) out.push({ ...b, start: end });
  }
  out.push({ date, start, end, kind: "busy", ...(note ? { note } : {}) });
  return out.sort((a, b) => a.start - b.start);
}

// Busy time opened again for clients; it joins the reception around it.
function openTime(dayBlocks, block) {
  const rest = dayBlocks.filter((b) => !(b.start === block.start && b.end === block.end && b.kind === block.kind));
  const all = [...rest, { date: block.date, start: block.start, end: block.end, kind: "available" }].sort((a, b) => a.start - b.start);
  const merged = [];
  for (const b of all) {
    const last = merged.at(-1);
    if (last && last.kind === "available" && b.kind === "available" && last.end >= b.start) last.end = Math.max(last.end, b.end);
    else merged.push({ ...b });
  }
  return merged;
}

function CalendarView({ calendars, initialId, canDelete, onCalendarChanged }) {
  const { t, fmt } = useI18n();
  const [params, setParams] = useSearchParams();
  const fallback = calendars.find((c) => c.isMine && c.active) || calendars.find((c) => c.active) || calendars[0];
  const calendar = calendars.find((c) => c.id === initialId) || fallback;
  // Switched-off calendars (only their owner and the developer see them) stay
  // out of the way until asked for.
  const offCount = calendars.filter((c) => !c.active).length;
  const [showOff, setShowOff] = useState(false);
  const pickable = calendars.filter((c) => c.active || showOff || c.id === calendar.id);

  const today = todayIso();
  const asked = params.get("day") || params.get("week");
  const weekStart = weekStartOf(asked || today);
  const day = asked && weekStartOf(asked) === weekStart && params.get("day") ? asked : weekStart === weekStartOf(today) ? today : weekStart;
  const prefill = params.get("phone") || params.get("name") || params.get("clientId")
    ? {
        phone: params.get("phone") || "",
        name: params.get("name") || "",
        callId: Number(params.get("callId")) || null,
        // Booking from the client's page: that client's consultation.
        clientId: Number(params.get("clientId")) || null,
      }
    : null;
  const navigate = useNavigate();

  const state = useAsync(() => api.calendarWeek(calendar.id, weekStart), [calendar.id, weekStart]);
  const [booking, setBooking] = useState(null); // slot
  const [slot, setSlot] = useState(null); // the lawyer tapped a free time
  const [open, setOpen] = useState(null); // appointment
  const [editing, setEditing] = useState(null); // { mode?, conflicts? }
  const [settings, setSettings] = useState(false);
  const [flash, setFlash] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
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
    next.set("view", "consult");
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
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setPublishing(false);
    }
  }

  // Saves the day's new blocks. Clients booked into time that goes away:
  // the day editor asks first (`mode`: the choice that caused it).
  async function saveDay(week, dayBlocks, mode, message) {
    setSaving(true);
    try {
      await api.saveCalendarWeek(week.calendar.id, week.weekStart, replaceDay(week.blocks, day, dayBlocks));
      setFlash(message);
      state.reload();
    } catch (err) {
      if (err.code === "appointments_conflict") setEditing({ mode, conflicts: err.body.appointments });
      else saveFailed(err, t);
    } finally {
      setSaving(false);
    }
  }

  // The day's quick choices: an ordinary day and a day off save at once;
  // busy (needs a reason) and own times open the editor.
  function pickMode(week, mode) {
    setFlash("");
    if (mode === "usual") return saveDay(week, usualDay(week.usual, day), mode, t("calendar.savedDay"));
    if (mode === "off") return saveDay(week, [], mode, t("calendar.savedDay"));
    setEditing({ mode });
  }

  async function toggleActive(on) {
    try {
      await api.updateCalendar(calendar.id, { active: on });
      onCalendarChanged();
    } catch (err) {
      saveFailed(err, t);
    }
  }

  return (
    <>
      <div className={styles.toolbar}>
        {pickable.length > 1 ? (
          <div className={styles.toolbarGrow}>
            <Segmented
              wrap
              value={calendar.id}
              onChange={(id) => update({ cal: id, day: null })}
              label={t("calendar.title")}
              options={pickable.map((c) => ({ value: c.id, label: c.active ? c.name : `${c.name} · ${t("personal.off")}` }))}
            />
          </div>
        ) : (
          <span className={`${styles.toolbarGrow} ${pageStyles.note}`}>{calendar.name}</span>
        )}
        {offCount > 0 && (
          <Button size="small" variant="plain" icon={showOff ? "eye" : "minusCircle"} onClick={() => setShowOff(!showOff)}>
            {showOff ? t("calendar.hideOff") : t("calendar.showOff", { count: offCount })}
          </Button>
        )}
        {calendar.canManage && (
          <Button size="small" icon="settings" onClick={() => setSettings(true)}>
            {t("calendar.settings")}
          </Button>
        )}
      </div>

      {!calendar.active && (
        <div className={pageStyles.bannerSpace}>
          <Banner
            tone="warning"
            icon="minusCircle"
            action={
              calendar.canSwitch ? (
                <Button size="small" variant="primary" onClick={() => toggleActive(true)}>
                  {t("personal.turnOn")}
                </Button>
              ) : null
            }
          >
            {t("personal.consultIsOff")}
          </Banner>
        </div>
      )}

      {prefill && (
        <div className={pageStyles.bannerSpace}>
          <Banner
            icon="phone"
            action={
              <Button size="small" variant="plain" icon="x" onClick={() => update({ phone: null, callId: null, name: null, clientId: null })}>
                {t("common.close")}
              </Button>
            }
          >
            {t(prefill.clientId ? "calendar.forClient" : "calendar.fromCall", { who: [prefill.name, prefill.phone && fmt.phone(prefill.phone)].filter(Boolean).join(", ") })}
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
        {(week) => {
          const manage = week.canManage && day >= week.today;
          const mode = dayMode(blocksOn(week.blocks, day), week.usual, day);
          return (
            <>
              {week.canManage && <WeekStatus status={week.status} publishing={publishing} onPublish={publish} past={shiftIso(weekStart, 6) < week.today} />}
              {flash && (
                <div className={pageStyles.bannerSpace}>
                  <Banner icon="checkCircle">{flash}</Banner>
                </div>
              )}

              <DayPicker week={week} selected={day} onSelect={(date) => (setFlash(""), update({ day: date }))} />

              <section className={styles.daySection} aria-live="polite">
                <div className={styles.dayHead}>
                  <h2 className={styles.dayTitle}>
                    {fmt.isoDay(day)}
                    {day === week.today && <Badge tone="accent">{t("calendar.todayBadge")}</Badge>}
                  </h2>
                </div>

                {manage && (
                  <div className={styles.modes} role="radiogroup" aria-label={t("calendar.editDay")}>
                    {MODES.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        role="radio"
                        aria-checked={mode === m.value}
                        disabled={saving}
                        className={`${styles.modeButton} ${mode === m.value ? styles.modeOn : ""}`}
                        onClick={() => (m.value === mode && m.value !== "custom" && m.value !== "busy" ? null : pickMode(week, m.value))}
                      >
                        <Icon name={m.icon} size={20} />
                        {t(`dayEdit.short.${m.value}`)}
                      </button>
                    ))}
                  </div>
                )}

                {!week.canManage && week.status !== "published" ? (
                  <EmptyState icon="calendar" text={t("calendar.notPublished")} />
                ) : (
                  <>
                    {week.canBook && day >= week.today && week.free.some((s) => s.date === day) && <p className={styles.bookHint}>{manage ? t("calendar.ownerHint") : t("calendar.bookHint")}</p>}
                    <DaySchedule
                      week={week}
                      date={day}
                      onBook={setBooking}
                      onOpen={setOpen}
                      onSlot={manage ? setSlot : null}
                      onBlock={
                        manage
                          ? (block) => {
                              if (block.kind !== "busy" || !window.confirm(t("calendar.reopenConfirm"))) return;
                              // Busy all day: back to an ordinary working day, not 00:00–24:00.
                              if (isWholeDay(block)) return saveDay(week, usualDay(week.usual, day), "usual", t("calendar.reopened"));
                              saveDay(week, openTime(blocksOn(week.blocks, day), block), "custom", t("calendar.reopened"));
                            }
                          : null
                      }
                    />
                    {week.nextFree && week.nextFree.date !== day && !week.free.some((s) => s.date === day) && (
                      <Button className={styles.nextFree} variant="primary" icon="arrowRight" block onClick={() => update({ day: week.nextFree.date })}>
                        {t("calendar.nextFree", { when: `${fmt.isoDay(week.nextFree.date)}, ${fmt.minutes(week.nextFree.start)}` })}
                      </Button>
                    )}
                  </>
                )}
              </section>

              {slot && (
                <Sheet title={t("calendar.slotTitle")} onClose={() => setSlot(null)}>
                  <p className={styles.slotSheetTime}>
                    {fmt.minutes(slot.start)}–{fmt.minutes(slot.end)}
                  </p>
                  <p className={styles.slotSheetDay}>{fmt.isoDay(slot.date)}</p>
                  <div className={styles.slotActions}>
                    {week.canBook && calendar.active && (
                      <Button variant="primary" icon="plus" block onClick={() => (setBooking(slot), setSlot(null))}>
                        {t("calendar.bookAction")}
                      </Button>
                    )}
                    <Button
                      icon="minusCircle"
                      block
                      busy={saving}
                      onClick={async () => {
                        await saveDay(week, closeTime(blocksOn(week.blocks, day), day, slot.start, slot.end, t("calendar.closedNote")), "custom", t("calendar.closedNow"));
                        setSlot(null);
                      }}
                    >
                      {t("calendar.closeTime")}
                    </Button>
                  </div>
                </Sheet>
              )}
              {booking && (
                <BookingSheet
                  calendar={week.calendar}
                  slot={booking}
                  free={week.free}
                  prefill={prefill}
                  onClose={() => setBooking(null)}
                  onBooked={() => {
                    setBooking(null);
                    // Booked from the client's page: back to the client.
                    if (prefill?.clientId) return navigate(`/clients/${prefill.clientId}`);
                    setFlash(t("calendar.bookedNow"));
                    setBookings((n) => n + 1);
                    if (prefill) update({ phone: null, callId: null, name: null, clientId: null });
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
                  startMode={editing.mode}
                  startConflicts={editing.conflicts}
                  onClose={() => setEditing(null)}
                  onSaved={(saved) => {
                    setEditing(null);
                    setFlash(saved.cancelled > 0 ? t("calendar.savedCancelled", { count: saved.cancelled }) : t("calendar.savedDay"));
                    state.reload();
                  }}
                />
              )}
            </>
          );
        }}
      </AsyncBoundary>

      {settings && (
        <CalendarSettingsSheet
          calendar={calendar}
          canDelete={canDelete}
          onDeleted={() => {
            setSettings(false);
            update({ cal: null, day: null });
            onCalendarChanged();
          }}
          onClose={() => setSettings(false)}
          onSaved={() => {
            setSettings(false);
            setFlash(t("calSettings.saved"));
            onCalendarChanged();
            state.reload();
          }}
        />
      )}
    </>
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
