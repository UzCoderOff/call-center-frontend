import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import styles from "./Personal.module.css";
import calStyles from "./Calendar.module.css";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Icon from "../ui/Icon";
import Segmented from "../ui/Segmented";
import { Switch } from "../ui/Field";
import { AsyncBoundary, EmptyState } from "../ui/Misc";
import EventSheet from "./EventSheet";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { shiftIso, todayIso, weekStartOf } from "../../lib/format";
import { saveFailed } from "../../lib/saveFailed";
import { readPref, writePref } from "../../lib/prefs";
import { useI18n } from "../../i18n";

// A lawyer's own calendar — their day (backend routes/personalCalendar.js):
// what they put in it (court, meetings, work, personal time), plus, without
// typing anything, their cases' key dates and the consultations booked with
// them. A day as a timeline (tap an empty hour to add something there, tap
// an item to change or move it), a week (seven columns on a computer, a list
// on a phone), or a month. The boss sees every lawyer's, one at a time or
// everyone together.
//
// URL: ?view=mine&who=<userId|all>&day=<YYYY-MM-DD>&span=day|week|month

const HOUR_PX = 56;
const DAY_FROM = 8 * 60;
const DAY_TO = 19 * 60;

const keyOf = (i) => `${i.type}:${i.id}:${i.ownerId}`;
const endOf = (i) => (i.end != null && i.end > i.start ? i.end : i.start + (i.type === "caseDate" ? 60 : 45));

// The colour of an item: its kind for one's own, else what it is.
function toneOf(item) {
  if (item.type === "consultation") return "consult";
  if (item.type === "caseDate") return "case";
  return item.kind || "other";
}

function itemTitle(item, t) {
  if (item.type === "consultation") return t("personal.consultWith", { name: item.title || "—" });
  if (item.type === "caseDate") return item.title || t(`caseWork.kinds.${item.kind || "other"}`);
  return item.title;
}

// Where room is short (the week's columns, the month): a consultation is
// just the client's name — its colour says what it is.
const shortTitle = (item, t) => (item.type === "consultation" && item.title ? item.title : itemTitle(item, t));

function itemSub(item, t) {
  if (item.type === "consultation") return [item.matter, item.format === "online" ? t("calendar.format.online") : null].filter(Boolean).join(" · ");
  if (item.type === "caseDate") return [item.case?.clientName, item.place].filter(Boolean).join(" · ");
  return [item.place, item.case?.clientName, item.addedBy && t("personal.addedBy", { name: item.addedBy })].filter(Boolean).join(" · ");
}

const ICONS = { consult: "user", case: "briefcase", court: "briefcase", meeting: "users", work: "clipboard", personal: "coffee", other: "calendar" };

// Side by side when items overlap: each gets a lane within its cluster.
function lanesOf(items) {
  const out = new Map();
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    const n = Math.max(1, ...cluster.map((c) => c.lane + 1));
    for (const c of cluster) out.set(c.key, { lane: c.lane, lanes: n });
    cluster = [];
  };
  for (const it of [...items].sort((a, b) => a.start - b.start || endOf(b) - endOf(a))) {
    if (cluster.length && it.start >= clusterEnd) flush();
    const used = new Set(cluster.filter((c) => c.end > it.start).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane += 1;
    cluster.push({ key: keyOf(it), lane, end: endOf(it) });
    clusterEnd = Math.max(clusterEnd, endOf(it));
  }
  if (cluster.length) flush();
  return out;
}

// A computer screen: the week as seven columns (like a desk calendar app);
// a phone: one day at a time.
const WIDE = "(min-width: 900px)";
function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE).matches);
  useEffect(() => {
    const query = window.matchMedia(WIDE);
    const change = () => setWide(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  return wide;
}

const SPANS = ["day", "week", "month"];
const monthOf = (iso) => `${iso.slice(0, 7)}-01`;
function shiftMonth(iso, n) {
  const [y, m] = iso.slice(0, 7).split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

export default function PersonalCalendar({ people, onPeopleChanged, isManager }) {
  const { t, fmt } = useI18n();
  const navigate = useNavigate();
  const wide = useWide();
  const [params, setParams] = useSearchParams();
  const me = people.find((p) => p.isMe);
  const many = people.length > 1;
  const whoParam = params.get("who");
  const who =
    whoParam === "all" && many
      ? "all"
      : people.find((p) => String(p.id) === whoParam)?.id ?? (isManager && many ? "all" : me?.id ?? people[0].id);
  const person = who === "all" ? null : people.find((p) => p.id === who);
  const today = todayIso();
  const day = /^\d{4}-\d\d-\d\d$/.test(params.get("day") || "") ? params.get("day") : today;
  const weekStart = weekStartOf(day);
  // Day / week / month — the last choice is remembered on this device; at
  // first a computer opens on the week, a phone on the day.
  const asked = params.get("span");
  const span = SPANS.includes(asked) ? asked : SPANS.includes(readPref("personalSpan", "")) ? readPref("personalSpan", "") : wide ? "week" : "day";
  // The month view shows whole weeks: from the Monday on or before the 1st, six of them.
  const gridStart = weekStartOf(monthOf(day));
  const from = span === "month" ? gridStart : weekStart;
  const to = span === "month" ? shiftIso(gridStart, 41) : shiftIso(weekStart, 6);

  const state = useAsync(() => api.personalCalendar({ from, to, userId: who }), [from, to, who]);
  const [sheet, setSheet] = useState(null); // { event } | { date, start, ownerId }

  function update(changes) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === undefined || v === "") next.delete(k);
      else next.set(k, String(v));
    }
    setParams(next, { replace: true });
  }

  function setSpan(v) {
    writePref("personalSpan", v);
    update({ span: v });
  }

  // A day picked from the week or month: open it.
  const openDay = (d) => (writePref("personalSpan", "day"), update({ day: d, span: "day" }));

  function step(n) {
    if (span === "month") return update({ day: shiftMonth(day, n) });
    update({ day: shiftIso(day, span === "week" ? 7 * n : n) });
  }

  function open(item) {
    if (item.type === "event") return setSheet({ event: item });
    if (item.type === "caseDate") return item.case?.clientId && navigate(`/clients/${item.case.clientId}`);
    if (item.type === "consultation") return navigate(`/consultations/${item.id}`);
  }

  const canAddFor = (ownerId) => people.find((p) => p.id === ownerId)?.canEdit;
  const addOwner = person ? person.id : me?.id ?? people.find((p) => p.canEdit)?.id;
  const options = [
    ...(many && isManager ? [{ value: "all", label: t("personal.everyone") }] : []),
    ...people.map((p) => ({ value: String(p.id), label: p.isMe ? t("personal.me") : p.name })),
  ];
  const [y, m] = day.split("-").map(Number);
  const label =
    span === "month" ? (
      <span>
        {String(t("time.months")[m - 1]).replace(/^./, (c) => c.toUpperCase())} {y}
      </span>
    ) : span === "day" && wide ? (
      <span>{fmt.isoDay(day)}</span>
    ) : (
      <>
        <span>{fmt.isoDateLong(weekStart)} –</span> <span>{fmt.isoDateLong(shiftIso(weekStart, 6))}</span>
      </>
    );
  const weekGrid = span === "week" && wide && who !== "all";

  return (
    <>
      {many && (
        <div className={styles.whoRow}>
          {/* Every name in sight: the row wraps instead of scrolling away. */}
          <Segmented wrap value={String(who)} onChange={(v) => update({ who: v })} label={t("personal.whose")} options={options} />
        </div>
      )}

      {person?.consult && person.canEdit && <ConsultSwitch person={person} onChanged={onPeopleChanged} />}

      <div className={styles.toolbar}>
        <div className={styles.navGroup}>
          <button type="button" className={calStyles.navButton} onClick={() => step(-1)} aria-label={t("personal.previous")}>
            <Icon name="chevronLeft" size={18} />
          </button>
          <button type="button" className={calStyles.navButton} onClick={() => step(1)} aria-label={t("personal.next")}>
            <Icon name="chevronRight" size={18} />
          </button>
          <span className={styles.periodLabel}>{label}</span>
          {day !== today && (
            <Button size="small" variant="plain" onClick={() => update({ day: null })}>
              {t("personal.today")}
            </Button>
          )}
        </div>
        <div className={styles.navGroup}>
          <Segmented
            size="small"
            value={span}
            onChange={setSpan}
            label={t("personal.span")}
            options={SPANS.map((s) => ({ value: s, label: t(`personal.${s}View`) }))}
          />
          {addOwner && canAddFor(addOwner) && (
            <Button size="small" variant="primary" icon="plus" onClick={() => setSheet({ date: day, start: nextHour(state.data || { today, nowMinutes: 0 }, day), ownerId: addOwner })}>
              {t("personal.add")}
            </Button>
          )}
        </div>
      </div>

      <AsyncBoundary state={state}>
        {(data) => (
          <>
            {span === "month" ? (
              <MonthGrid data={data} gridStart={gridStart} month={monthOf(day)} everyone={who === "all"} onDay={openDay} onOpen={open} />
            ) : weekGrid ? (
              <WeekGrid
                data={data}
                weekStart={weekStart}
                canAdd={Boolean(person?.canEdit)}
                onSlot={(date, start) => setSheet({ date, start, ownerId: person.id })}
                onOpen={open}
                onDay={openDay}
              />
            ) : (
              <>
                <DayStrip data={data} weekStart={weekStart} selected={day} onSelect={(d) => update({ day: d })} />
                {span === "week" ? (
                  <WeekAgenda data={data} weekStart={weekStart} everyone={who === "all"} onOpen={open} onDay={openDay} />
                ) : (
                  <section className={calStyles.daySection} aria-live="polite">
                    <div className={calStyles.dayHead}>
                      <h2 className={calStyles.dayTitle}>
                        {fmt.isoDay(day)}
                        {day === data.today && <Badge tone="accent">{t("calendar.todayBadge")}</Badge>}
                      </h2>
                    </div>
                    {who === "all" ? (
                      <EveryoneDay data={data} date={day} onOpen={open} />
                    ) : (
                      <OneDay
                        items={data.items.filter((i) => i.date === day)}
                        date={day}
                        data={data}
                        canAdd={Boolean(person?.canEdit)}
                        onSlot={(start) => setSheet({ date: day, start, ownerId: person.id })}
                        onOpen={open}
                      />
                    )}
                  </section>
                )}
              </>
            )}

            {sheet && (
              <EventSheet
                event={sheet.event || null}
                defaults={sheet.event ? null : { date: sheet.date, start: sheet.start, ownerId: sheet.ownerId }}
                people={people.filter((p) => p.canEdit)}
                onClose={() => setSheet(null)}
                onSaved={(saved) => {
                  setSheet(null);
                  if (saved?.date && saved.date !== day && span === "day") update({ day: saved.date });
                  state.reload();
                }}
              />
            )}
          </>
        )}
      </AsyncBoundary>
    </>
  );
}

// The week as seven columns of hours, today's date in a circle; tap an
// empty hour to add something there, a date to open that day.
function WeekGrid({ data, weekStart, canAdd, onSlot, onOpen, onDay }) {
  const { t, fmt } = useI18n();
  const dates = Array.from({ length: 7 }, (_, i) => shiftIso(weekStart, i));
  const timed = data.items.filter((i) => i.start != null);
  const allDay = data.items.filter((i) => i.start == null);
  const first = Math.min(DAY_FROM, ...timed.map((i) => Math.floor(i.start / 60) * 60));
  const last = Math.max(DAY_TO, ...timed.map((i) => Math.ceil(endOf(i) / 60) * 60));
  const hours = [];
  for (let m = first; m < last; m += 60) hours.push(m);
  const y = (m) => ((m - first) / 60) * HOUR_PX;

  return (
    <div className={styles.week}>
      <div className={styles.weekHead}>
        <span />
        {dates.map((d) => (
          <button key={d} type="button" className={`${styles.weekDay} ${d === data.today ? styles.weekToday : ""} ${d < data.today ? styles.weekPastHead : ""}`} onClick={() => onDay(d)}>
            <span className={styles.weekDayName}>{fmt.weekdayShort(d)}</span>
            <span className={styles.weekDayNum}>{fmt.dayOfMonth(d)}</span>
          </button>
        ))}
      </div>
      {allDay.length > 0 && (
        <div className={styles.weekAllDay}>
          <span className={styles.weekAllDayLabel}>{t("personal.allDayShort")}</span>
          {dates.map((d) => (
            <div key={d} className={styles.weekAllDayCell}>
              {allDay
                .filter((i) => i.date === d)
                .map((i) => (
                  <button key={keyOf(i)} type="button" className={`${styles.weekChip} ${styles[`tone_${toneOf(i)}`]}`} onClick={() => onOpen(i)} title={itemTitle(i, t)}>
                    <span className={styles.ellipsis}>{itemTitle(i, t)}</span>
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
      <div className={styles.weekBody} style={{ height: ((last - first) / 60) * HOUR_PX }}>
        <div className={styles.weekHours}>
          {hours.map((m) => (
            <span key={m} style={{ top: y(m) }}>
              {fmt.minutes(m)}
            </span>
          ))}
        </div>
        {dates.map((d) => {
          const dayItems = timed.filter((i) => i.date === d);
          const lanes = lanesOf(dayItems);
          return (
            <div key={d} className={`${styles.weekCol} ${d === data.today ? styles.weekColToday : ""}`}>
              {canAdd &&
                hours.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={styles.weekSlot}
                    style={{ top: y(m), height: HOUR_PX }}
                    onClick={() => onSlot(d, m)}
                    aria-label={`${fmt.isoDay(d)}, ${t("personal.addAt", { time: fmt.minutes(m) })}`}
                  />
                ))}
              {d === data.today && data.nowMinutes >= first && data.nowMinutes <= last && <div className={styles.weekNow} style={{ top: y(data.nowMinutes) }} aria-hidden="true" />}
              {dayItems.map((i) => {
                const { lane, lanes: n } = lanes.get(keyOf(i)) || { lane: 0, lanes: 1 };
                const height = Math.max(22, ((endOf(i) - i.start) / 60) * HOUR_PX - 3);
                const title = shortTitle(i, t);
                return (
                  <button
                    key={keyOf(i)}
                    type="button"
                    className={`${styles.block} ${styles.weekBlock} ${styles[`tone_${toneOf(i)}`]} ${i.status === "no_show" ? styles.faded : ""}`}
                    style={{ top: y(i.start) + 1, height, left: `calc(${(lane / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)` }}
                    onClick={() => onOpen(i)}
                    title={`${fmt.minutes(i.start)} ${itemTitle(i, t)}`}
                  >
                    {height < 44 ? (
                      // Short: one line, time first.
                      <span className={styles.weekBlockLine}>
                        <b>{fmt.minutes(i.start)}</b> {title}
                      </span>
                    ) : (
                      <>
                        <span className={styles.weekBlockTime}>{fmt.minutes(i.start)}</span>
                        <span className={styles.weekBlockTitle}>{title}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      <Legend />
    </div>
  );
}

// Six weeks around the month; each day shows its first few things. Tap a day
// to open it.
function MonthGrid({ data, gridStart, month, everyone, onDay, onOpen }) {
  const { t, fmt } = useI18n();
  const dates = Array.from({ length: 42 }, (_, i) => shiftIso(gridStart, i));
  const nameOf = (id) => data.people.find((p) => p.id === id)?.name?.split(" ")[0];
  const SHOWN = 3;
  return (
    <div className={styles.month}>
      <div className={styles.monthHead}>
        {dates.slice(0, 7).map((d) => (
          <span key={d}>{fmt.weekdayShort(d)}</span>
        ))}
      </div>
      <div className={styles.monthGrid}>
        {dates.map((d) => {
          const items = data.items.filter((i) => i.date === d);
          const outside = d.slice(0, 7) !== month.slice(0, 7);
          return (
            <div
              key={d}
              className={`${styles.monthCell} ${outside ? styles.monthOutside : ""} ${d === data.today ? styles.monthToday : ""}`}
              onClick={() => onDay(d)}
            >
              <button type="button" className={styles.monthNum} onClick={(e) => (e.stopPropagation(), onDay(d))} aria-label={fmt.isoDay(d)}>
                {fmt.dayOfMonth(d)}
              </button>
              <div className={styles.monthItems}>
                {items.slice(0, SHOWN).map((i) => (
                  <button
                    key={keyOf(i)}
                    type="button"
                    className={`${styles.monthItem} ${styles[`tone_${toneOf(i)}`]}`}
                    onClick={(e) => (e.stopPropagation(), onOpen(i))}
                    title={itemTitle(i, t)}
                  >
                    <span className={styles.monthDot} aria-hidden="true" />
                    <span className={styles.monthText}>
                      {i.start != null ? `${fmt.minutes(i.start)} ` : ""}
                      {everyone ? `${nameOf(i.ownerId) || ""}: ` : ""}
                      {shortTitle(i, t)}
                    </span>
                  </button>
                ))}
                {items.length > SHOWN && <span className={styles.monthMore}>{t("personal.more", { count: items.length - SHOWN })}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <Legend />
    </div>
  );
}

// The next whole hour from now (today) or 9:00 — where "Add" starts.
function nextHour(data, date) {
  if (date !== data.today) return 9 * 60;
  return Math.min(22 * 60, Math.ceil((data.nowMinutes + 1) / 60) * 60);
}

// "Taking consultations": the person's consultation calendar on or off.
function ConsultSwitch({ person, onChanged }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  async function change(on) {
    if (!on && !window.confirm(t("personal.consultOffConfirm"))) return;
    setBusy(true);
    try {
      await api.updateCalendar(person.consult.id, { active: on });
      onChanged();
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.consultRow}>
      <Switch
        label={t("personal.consultOn")}
        hint={person.consult.active ? t("personal.consultOnHint") : t("personal.consultOffHint")}
        checked={person.consult.active}
        disabled={busy}
        onChange={change}
      />
    </div>
  );
}

// The week's days, each with how many things are on it.
function DayStrip({ data, weekStart, selected, onSelect }) {
  const { t, fmt } = useI18n();
  const dates = Array.from({ length: 7 }, (_, i) => shiftIso(weekStart, i));
  return (
    <div className={calStyles.dayPicker} role="tablist" aria-label={fmt.weekRange(weekStart)}>
      {dates.map((date) => {
        const count = data.items.filter((i) => i.date === date).length;
        const cls = [calStyles.dayButton, date === selected ? calStyles.daySelected : "", date === data.today ? calStyles.dayToday : "", date < data.today ? calStyles.dayPast : ""].join(" ");
        return (
          <button key={date} type="button" role="tab" aria-selected={date === selected} className={cls} onClick={() => onSelect(date)}>
            <span className={calStyles.dayWeekday}>{fmt.weekdayShort(date)}</span>
            <span className={calStyles.dayNumber}>{fmt.dayOfMonth(date)}</span>
            <span className={`${calStyles.daySummary} ${count ? calStyles.summaryGood : ""}`}>{count ? t("personal.count", { count }) : t("personal.free")}</span>
          </button>
        );
      })}
    </div>
  );
}

// One person's day: the whole-day things on top, then the hours.
function OneDay({ items, date, data, canAdd, onSlot, onOpen }) {
  const { t, fmt } = useI18n();
  const allDay = items.filter((i) => i.start == null);
  const timed = items.filter((i) => i.start != null);
  const first = Math.min(DAY_FROM, ...timed.map((i) => Math.floor(i.start / 60) * 60));
  const last = Math.max(DAY_TO, ...timed.map((i) => Math.ceil(endOf(i) / 60) * 60));
  const hours = [];
  for (let m = first; m < last; m += 60) hours.push(m);
  const lanes = lanesOf(timed);
  const y = (m) => ((m - first) / 60) * HOUR_PX;
  const showNow = date === data.today && data.nowMinutes >= first && data.nowMinutes <= last;

  return (
    <>
      {allDay.length > 0 && (
        <div className={styles.allDay}>
          <span className={styles.allDayLabel}>{t("personal.allDay")}</span>
          {allDay.map((i) => (
            <button key={keyOf(i)} type="button" className={`${styles.allDayItem} ${styles[`tone_${toneOf(i)}`]}`} onClick={() => onOpen(i)}>
              <Icon name={ICONS[toneOf(i)]} size={14} />
              <span className={styles.ellipsis}>{itemTitle(i, t)}</span>
            </button>
          ))}
        </div>
      )}
      {items.length === 0 && <p className={styles.emptyLine}>{canAdd ? t("personal.emptyDayAdd") : t("personal.emptyDay")}</p>}
      <div className={styles.grid} style={{ height: (last - first) / 60 * HOUR_PX }}>
        {hours.map((m) => (
          <div key={m} className={styles.hour} style={{ top: y(m), height: HOUR_PX }}>
            <span className={styles.hourLabel}>{fmt.minutes(m)}</span>
            {canAdd ? (
              <button type="button" className={styles.hourSlot} onClick={() => onSlot(m)} aria-label={t("personal.addAt", { time: fmt.minutes(m) })}>
                <Icon name="plus" size={14} />
              </button>
            ) : (
              <span className={styles.hourSlot} />
            )}
          </div>
        ))}
        {showNow && <div className={styles.now} style={{ top: y(data.nowMinutes) }} aria-hidden="true" />}
        <div className={styles.layer}>
          {timed.map((i) => {
            const { lane, lanes: n } = lanes.get(keyOf(i)) || { lane: 0, lanes: 1 };
            const height = Math.max(26, ((endOf(i) - i.start) / 60) * HOUR_PX - 3);
            const sub = itemSub(i, t);
            return (
              <button
                key={keyOf(i)}
                type="button"
                className={`${styles.block} ${styles[`tone_${toneOf(i)}`]} ${i.status === "no_show" ? styles.faded : ""}`}
                style={{ top: y(i.start) + 1, height, left: `calc(${(lane / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)` }}
                onClick={() => onOpen(i)}
              >
                <span className={styles.blockTitle}>
                  <Icon name={ICONS[toneOf(i)]} size={13} />
                  <span className={styles.ellipsis}>{itemTitle(i, t)}</span>
                </span>
                {height >= 40 && (
                  <span className={styles.blockSub}>
                    {fmt.minutes(i.start)}
                    {i.end != null ? `–${fmt.minutes(i.end)}` : ""}
                    {sub ? ` · ${sub}` : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <Legend />
    </>
  );
}

function Legend() {
  const { t } = useI18n();
  return (
    <p className={styles.legend}>
      {["case", "consult"].map((k) => (
        <span key={k} className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles[`tone_${k}`]}`} aria-hidden="true" />
          {t(`personal.legend.${k}`)}
        </span>
      ))}
    </p>
  );
}

// A list of items, time first.
function Agenda({ items, people, onOpen }) {
  const { t, fmt } = useI18n();
  const nameOf = (id) => people?.find((p) => p.id === id)?.name;
  return (
    <div className={calStyles.schedule}>
      {items.map((i) => {
        const sub = itemSub(i, t);
        return (
          <button key={keyOf(i)} type="button" className={`${calStyles.row} ${calStyles.rowButton} ${styles.agendaRow} ${styles[`tone_${toneOf(i)}`]}`} onClick={() => onOpen(i)}>
            <span className={calStyles.rowTime}>
              {i.start == null ? (
                <span className={styles.allDayWord}>{t("personal.allDayShort")}</span>
              ) : (
                <>
                  <span>{fmt.minutes(i.start)}</span>
                  {i.end != null && <span className={calStyles.rowTimeEnd}>{fmt.minutes(i.end)}</span>}
                </>
              )}
            </span>
            <span className={calStyles.rowMain}>
              <span className={calStyles.rowTitle}>
                <Icon name={ICONS[toneOf(i)]} size={15} />
                <span className={styles.ellipsis}>{itemTitle(i, t)}</span>
              </span>
              {(sub || people) && <span className={calStyles.rowSub}>{[people && nameOf(i.ownerId), sub].filter(Boolean).join(" · ")}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Everyone's day (managers): one list per person who has anything.
function EveryoneDay({ data, date, onOpen }) {
  const { t } = useI18n();
  const items = data.items.filter((i) => i.date === date);
  if (items.length === 0) return <EmptyState icon="calendar" text={t("personal.everyoneFree")} />;
  return data.people
    .filter((p) => items.some((i) => i.ownerId === p.id))
    .map((p) => (
      <div key={p.id} className={styles.personBlock}>
        <h3 className={calStyles.subheading}>{p.name}</h3>
        <Agenda items={items.filter((i) => i.ownerId === p.id)} onOpen={onOpen} />
      </div>
    ));
}

// The week as a list, day by day.
function WeekAgenda({ data, weekStart, everyone, onOpen, onDay }) {
  const { t, fmt } = useI18n();
  const dates = Array.from({ length: 7 }, (_, i) => shiftIso(weekStart, i));
  if (data.items.length === 0) return <EmptyState icon="calendar" text={t("personal.emptyWeek")} />;
  return dates
    .filter((d) => data.items.some((i) => i.date === d))
    .map((d) => (
      <div key={d} className={styles.personBlock}>
        <button type="button" className={`${calStyles.subheading} ${styles.dayLink}`} onClick={() => onDay(d)}>
          {fmt.isoDay(d)}
          {d === data.today ? ` · ${t("calendar.todayBadge")}` : ""}
        </button>
        <Agenda items={data.items.filter((i) => i.date === d)} people={everyone ? data.people : null} onOpen={onOpen} />
      </div>
    ));
}

