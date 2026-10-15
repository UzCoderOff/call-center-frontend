import { useState } from "react";
import styles from "../cases/Cases.module.css";
import pageStyles from "../../pages/Pages.module.css";
import fieldStyles from "../ui/Field.module.css";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { TextField } from "../ui/Field";
import { AsyncBoundary } from "../ui/Misc";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { shiftIso, todayIso } from "../../lib/format";
import { useI18n } from "../../i18n";

// "Kim boʻsh?" — one day, every lawyer: when each is busy (court, meetings,
// consultations, their cases' dates), and — for the ones picked — the times
// they're all free, to go to a hearing together or meet. A lawyer sees what
// kind of thing the others have, not what it is (server: GET
// /api/personal-calendar/free).

const FROM = 8 * 60;
const TO = 20 * 60;
const WORK = [9 * 60, 18 * 60];
const MIN_GAP = 30;
const clock = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const pct = (m) => `${((Math.min(TO, Math.max(FROM, m)) - FROM) / (TO - FROM)) * 100}%`;

// The times in the working day when none of `people` is busy.
function commonFree(people) {
  const busy = people
    .flatMap((p) => p.busy)
    .filter((b) => b.start != null)
    .map((b) => [b.start, b.end ?? b.start + 60])
    .sort((a, b) => a[0] - b[0]);
  if (people.some((p) => p.busy.some((b) => b.start == null && b.kind === "court"))) return [];
  const out = [];
  let at = WORK[0];
  for (const [s, e] of busy) {
    if (s > at && Math.min(s, WORK[1]) - at >= MIN_GAP) out.push([at, Math.min(s, WORK[1])]);
    at = Math.max(at, e);
    if (at >= WORK[1]) break;
  }
  if (WORK[1] - at >= MIN_GAP) out.push([at, WORK[1]]);
  return out;
}

export default function WhoIsFree() {
  const { t, fmt } = useI18n();
  const [date, setDate] = useState(todayIso());
  const state = useAsync(() => api.personalFree(date), [date]);
  const [picked, setPicked] = useState([]);
  const toggle = (id) => setPicked((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  const hours = [];
  for (let h = FROM; h <= TO; h += 120) hours.push(h);

  return (
    <Card title={t("free.title")} subtitle={t("free.subtitle")}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
        <Button icon="chevronLeft" aria-label={t("personal.previous")} onClick={() => setDate(shiftIso(date, -1))} />
        <TextField label={t("free.day")} type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <Button icon="chevronRight" aria-label={t("personal.next")} onClick={() => setDate(shiftIso(date, 1))} />
        <span className={pageStyles.note}>{fmt.isoDay(date)}</span>
      </div>
      <AsyncBoundary state={state}>
        {(data) => {
          const chosen = data.people.filter((p) => picked.includes(p.id));
          const free = chosen.length >= 2 ? commonFree(chosen) : null;
          return (
            <div className={styles.freeGrid}>
              <div className={fieldStyles.chips} role="group" aria-label={t("free.pick")}>
                {data.people.map((p) => {
                  const on = picked.includes(p.id);
                  return (
                    <button key={p.id} type="button" role="checkbox" aria-checked={on} className={`${fieldStyles.chip} ${on ? fieldStyles.chipOn : ""}`} onClick={() => toggle(p.id)}>
                      {on && <Icon name="check" size={14} strokeWidth={2.4} />}
                      {p.isMe ? t("personal.me") : p.name}
                    </button>
                  );
                })}
              </div>
              <p className={pageStyles.note}>{chosen.length >= 2 ? t("free.together", { count: chosen.length }) : t("free.pickHint")}</p>
              {free && (
                <div className={styles.freeCommon}>
                  {free.length === 0 ? (
                    <span className={pageStyles.note}>{t("free.noneTogether")}</span>
                  ) : (
                    free.map(([s, e]) => (
                      <span key={s} className={`${fieldStyles.chip} ${fieldStyles.chipOn}`}>
                        {clock(s)}–{clock(e)}
                      </span>
                    ))
                  )}
                </div>
              )}
              <div className={styles.freeRow}>
                <span />
                <span className={styles.freeHours} aria-hidden="true">
                  {hours.map((h) => (
                    <span key={h} className={styles.freeHour} style={{ left: pct(h) }}>
                      {clock(h)}
                    </span>
                  ))}
                </span>
              </div>
              {data.people
                .filter((p) => !picked.length || picked.includes(p.id))
                .map((p) => {
                  const allDay = p.busy.filter((b) => b.start == null);
                  return (
                    <div key={p.id} className={styles.freeRow}>
                      <span className={styles.freeName} title={p.name}>
                        {p.isMe ? t("personal.me") : p.name}
                        {allDay.length > 0 && (
                          <span className={pageStyles.note} style={{ display: "block", fontWeight: 400 }}>
                            {t("free.allDay", { what: allDay.map((b) => b.title || t(`free.kinds.${b.type === "caseDate" ? "caseDate" : b.kind}`)).join(", ") })}
                          </span>
                        )}
                      </span>
                      <span className={styles.freeTrack} role="img" aria-label={t("free.busyLabel", { name: p.name, count: p.busy.length })}>
                        {p.busy
                          .filter((b) => b.start != null)
                          .map((b, i) => (
                            <span
                              key={i}
                              className={styles.freeBusy}
                              style={{ left: pct(b.start), width: `calc(${pct(b.end ?? b.start + 60)} - ${pct(b.start)})` }}
                              title={`${clock(b.start)}–${clock(b.end ?? b.start + 60)} · ${b.title || t(`free.kinds.${b.type === "caseDate" ? "caseDate" : b.kind}`)}`}
                            >
                              {b.title || t(`free.kinds.${b.type === "caseDate" ? "caseDate" : b.kind}`)}
                            </span>
                          ))}
                      </span>
                    </div>
                  );
                })}
            </div>
          );
        }}
      </AsyncBoundary>
    </Card>
  );
}
