import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import styles from "./WallboardPage.module.css";
import { BrandMark } from "../components/layout/AppShell";
import { Stars } from "../components/performance/CallRating";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

// The call center on the office TV (backend services/wallboard.js): opened
// once on the TV's browser from the link in Settings, no login, and left
// on. Big, dark, readable across the room; it refreshes itself every few
// seconds. Staff names and counts only — never a client's name or number.
const REFRESH_MS = 10 * 1000;

export default function WallboardPage() {
  const { token } = useParams();
  const { t, fmt } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const next = await api.wallboard(token);
        if (!stop) {
          setData(next);
          setError(null);
        }
      } catch (err) {
        if (!stop) setError(err);
      }
    }
    load();
    const timer = setInterval(load, REFRESH_MS);
    const tick = setInterval(() => setClock(new Date()), 1000);
    return () => {
      stop = true;
      clearInterval(timer);
      clearInterval(tick);
    };
  }, [token]);

  // A TV left on for weeks: a fresh page every night picks up new versions.
  useEffect(() => {
    const timer = setTimeout(() => window.location.reload(), 6 * 60 * 60 * 1000);
    return () => clearTimeout(timer);
  }, []);

  if (error?.status === 404) {
    return (
      <div className={styles.screen}>
        <div className={styles.center}>{t("tv.badLink")}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className={styles.screen}>
        <div className={styles.center}>{t("common.loading")}</div>
      </div>
    );
  }
  const d = data.today;
  const time = `${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}`;
  return (
    <div className={styles.screen}>
      <header className={styles.top}>
        <div className={styles.brand}>
          <BrandMark size={48} />
          <span>{t("tv.title")}</span>
        </div>
        <div className={styles.when}>
          <span className={styles.clock}>{time}</span>
          <span>{fmt.isoDay(data.now.date)}</span>
        </div>
      </header>

      <section className={styles.tiles}>
        {data.line.on && <Tile label={t("tv.talkingNow")} value={data.line.talking} tone="accent" />}
        {data.line.on && <Tile label={t("tv.waiting")} value={data.line.waiting} tone={data.line.waiting > 0 ? "warn" : undefined} />}
        <Tile label={t("tv.calls")} value={d.calls} sub={t("tv.inOut", { inc: d.incoming, out: d.outgoing })} />
        <Tile label={t("tv.missed")} value={d.missed} sub={d.notCalledBack > 0 ? t("tv.notCalledBack", { n: d.notCalledBack }) : t("tv.allCalledBack")} tone={d.notCalledBack > 0 ? "bad" : undefined} />
        <Tile label={t("tv.booked")} value={d.booked} sub={t("tv.consultsToday", { n: d.consultationsToday })} tone="good" />
      </section>

      <section className={styles.people}>
        <div className={`${styles.row} ${styles.head}`}>
          <span>{t("tv.operator")}</span>
          <span>{t("tv.now")}</span>
          <span className={styles.num}>{t("tv.calls")}</span>
          <span className={styles.num}>{t("tv.missedShort")}</span>
          <span className={styles.num}>{t("tv.talk")}</span>
          <span className={styles.num}>{t("tv.booked")}</span>
          <span>{t("tv.rating")}</span>
        </div>
        {data.operators.map((o, i) => (
          <div key={o.name} className={styles.row}>
            <span className={styles.name}>
              {i === 0 && o.booked > 0 && <span className={styles.crown}>🏆</span>}
              {o.name}
            </span>
            <span className={`${styles.status} ${styles[o.status]}`}>
              {t(`tv.status.${o.status}`)}
              {o.onCallSeconds != null && ` · ${fmt.duration(o.onCallSeconds)}`}
            </span>
            <span className={styles.num}>{o.calls}</span>
            <span className={`${styles.num} ${o.missed > 0 ? styles.badText : ""}`}>{o.missed}</span>
            <span className={styles.num}>{t("tv.minutes", { n: o.talkMinutes })}</span>
            <span className={`${styles.num} ${styles.bookedNum}`}>{o.booked}</span>
            <span>{o.stars != null ? <span className={styles.stars}><Stars value={o.stars} size={22} /> {o.stars.toFixed(1)}</span> : <span className={styles.dim}>—</span>}</span>
          </div>
        ))}
      </section>
      {error && <div className={styles.stale}>{t("tv.stale")}</div>}
    </div>
  );
}

function Tile({ label, value, sub, tone }) {
  return (
    <div className={`${styles.tile} ${tone ? styles[tone] : ""}`}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>{value}</span>
      {sub && <span className={styles.tileSub}>{sub}</span>}
    </div>
  );
}
