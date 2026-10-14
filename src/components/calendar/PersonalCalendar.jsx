import { useState } from "react";
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
import { useI18n } from "../../i18n";

// A lawyer's own calendar — their day (backend routes/personalCalendar.js):
// what they put in it (court, meetings, work, personal time), plus, without
// typing anything, their cases' key dates and the consultations booked with
// them. One day as a timeline — tap an empty hour to add something there,
// tap an item to change or move it — or the whole week as a list. The boss
// sees every lawyer's, one at a time or everyone together.
//
// URL: ?view=mine&who=<userId|all>&day=<YYYY-MM-DD>&span=day|week

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

export default function PersonalCalendar({ people, onPeopleChanged, isManager }) {
  const { t, fmt } = useI18n();
  const navigate = useNavigate();
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
  const span = params.get("span") === "week" ? "week" : "day";

  const state = useAsync(() => api.personalCalendar({ from: weekStart, to: shiftIso(weekStart, 6), userId: who }), [weekStart, who]);
  const [sheet, setSheet] = useState(null); // { event } | { date, start, ownerId }

  function update(changes) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === undefined || v === "") next.delete(k);
      else next.set(k, String(v));
    }
    setParams(next, { replace: true });
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

  return (
    <>
      {many && (
        <div className={styles.whoRow}>
          <Segmented value={String(who)} onChange={(v) => update({ who: v })} label={t("personal.whose")} options={options} />
        </div>
      )}

      {person?.consult && person.canEdit && <ConsultSwitch person={person} onChanged={onPeopleChanged} />}

      <div className={calStyles.weekNav}>
        <button type="button" className={calStyles.navButton} onClick={() => update({ day: shiftIso(day, span === "week" ? -7 : -1) })} aria-label={t("calendar.prevWeek")}>
          <Icon name="chevronLeft" size={18} />
        </button>
        <span className={calStyles.weekLabel}>
          <span>{fmt.isoDateLong(weekStart)} –</span> <span>{fmt.isoDateLong(shiftIso(weekStart, 6))}</span>
        </span>
        <button type="button" className={calStyles.navButton} onClick={() => update({ day: shiftIso(day, span === "week" ? 7 : 1) })} aria-label={t("calendar.nextWeek")}>
          <Icon name="chevronRight" size={18} />
        </button>
        {day !== today && (
          <Button size="small" variant="plain" onClick={() => update({ day: null })}>
            {t("personal.today")}
          </Button>
        )}
      </div>

      <AsyncBoundary state={state}>
        {(data) => (
          <>
            <DayStrip data={data} weekStart={weekStart} selected={day} onSelect={(d) => update({ day: d, span: null })} />

            <div className={styles.controls}>
              <Segmented
                value={span}
                onChange={(v) => update({ span: v === "day" ? null : v })}
                label={t("personal.span")}
                options={[
                  { value: "day", label: t("personal.dayView") },
                  { value: "week", label: t("personal.weekView") },
                ]}
              />
              <span className={styles.spacer} />
              {addOwner && canAddFor(addOwner) && (
                <Button size="small" variant="primary" icon="plus" onClick={() => setSheet({ date: day, start: nextHour(data, day), ownerId: addOwner })}>
                  {t("personal.add")}
                </Button>
              )}
            </div>

            {span === "week" ? (
              <WeekAgenda data={data} weekStart={weekStart} everyone={who === "all"} onOpen={open} onDay={(d) => update({ day: d, span: null })} />
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

            {sheet && (
              <EventSheet
                event={sheet.event || null}
                defaults={sheet.event ? null : { date: sheet.date, start: sheet.start, ownerId: sheet.ownerId }}
                people={people.filter((p) => p.canEdit)}
                onClose={() => setSheet(null)}
                onSaved={(saved) => {
                  setSheet(null);
                  if (saved?.date && saved.date !== day) update({ day: saved.date });
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

