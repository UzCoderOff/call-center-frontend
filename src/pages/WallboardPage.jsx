import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import styles from "./WallboardPage.module.css";
import { BrandMark } from "../components/layout/AppShell";
import { Stars } from "../components/performance/CallRating";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

// The call center on the office TV (backend services/wallboard.js): opened
// once on the TV's browser from the link in Settings, no login, left on.
//
// Its look (the user, 2026-10-24: "everything is square, no personality"):
// Samarkand at night — deep lapis, turquoise and gold, a faint girih star
// pattern — with big characterful type. Each person is a portrait on a
// stage: sound waves ring out around it while they talk, gold ripples while
// it rings, a slow breath while they're free, a crown for today's leader.
// The day's numbers sit in one scoreboard line; a booking brings a shower of
// gold stars. Staff names and counts only — never a client's name or number.
const REFRESH_MS = 5 * 1000;
const CELEBRATE_MS = 7 * 1000;
const FONTS = "https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800&family=Manrope:wght@500;600;700;800&display=swap";

// A person's colour from the firm's palette (turquoise, gold, coral…):
// by their place in the alphabet, so everyone on the screen differs.
const PALETTE = [
  ["#2ec4b6", "#127c8a"],
  ["#f2c14e", "#c4801f"],
  ["#ff7a6b", "#c23b4e"],
  ["#8f8cff", "#4b3fc4"],
  ["#5ec8ff", "#1f6fc0"],
  ["#7fd88b", "#2e8b57"],
];
function colourOf(name, everyone) {
  const order = [...everyone].sort((a, b) => a.localeCompare(b));
  return PALETTE[Math.max(0, order.indexOf(name)) % PALETTE.length];
}

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

// "Mohinur Meliqoʻziyeva" -> "Mohinur M." — read from across the room.
const shortName = (name) => {
  const [first, second] = name.split(/\s+/).filter(Boolean);
  return second && name.length > 14 ? `${first} ${second[0].toUpperCase()}.` : name;
};

// 96 -> "1:36" — a call's time, ticking.
const clockTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// An eight-pointed girih star (two squares), as polygon points around 0,0.
function starPoints(r, inner = 0.7654) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI / 8) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * inner;
    pts.push(`${(Math.cos(a) * rr).toFixed(2)},${(Math.sin(a) * rr).toFixed(2)}`);
  }
  return pts.join(" ");
}

function useFonts() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONTS}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONTS;
    document.head.appendChild(link);
  }, []);
}

export default function WallboardPage() {
  const { token } = useParams();
  const { t, fmt } = useI18n();
  const [data, setData] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [party, setParty] = useState(null); // { names, at }
  const before = useRef(null);
  useFonts();

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const next = await api.wallboard(token);
        if (stop) return;
        // A consultation booked since the last look: who, for the stars.
        const prev = before.current;
        if (prev && next.today.booked > prev.today.booked) {
          const names = next.operators.filter((o) => o.booked > (prev.operators.find((p) => p.name === o.name)?.booked ?? 0)).map((o) => shortName(o.name));
          setParty({ names, at: Date.now() });
        }
        before.current = next;
        setData(next);
        setFetchedAt(Date.now());
        setError(null);
      } catch (err) {
        if (!stop) setError(err);
      }
    }
    load();
    const timer = setInterval(load, REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stop = true;
      clearInterval(timer);
      clearInterval(tick);
    };
  }, [token]);

  // A TV left on for weeks: a fresh page now and then picks up new versions.
  useEffect(() => {
    const timer = setTimeout(() => window.location.reload(), 6 * 60 * 60 * 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!party) return undefined;
    const timer = setTimeout(() => setParty(null), CELEBRATE_MS);
    return () => clearTimeout(timer);
  }, [party]);

  if (error?.status === 404 || !data) {
    return (
      <div className={styles.screen}>
        <div className={styles.pattern} />
        <div className={styles.center}>{error?.status === 404 ? t("tv.badLink") : t("common.loading")}</div>
      </div>
    );
  }

  const d = data.today;
  const clock = new Date(now);
  const hour = clock.getHours();
  const greeting = hour < 12 ? t("tv.morning") : hour < 17 ? t("tv.afternoon") : t("tv.evening");
  const best = Math.max(0, ...data.operators.map((x) => x.booked));
  const leader = best > 0 ? data.operators.find((o) => o.booked === best) : null;
  const sinceFetch = Math.max(0, Math.round((now - fetchedAt) / 1000));
  const talkingNow = data.line.on ? data.line.talking : data.operators.filter((o) => o.status === "talking").length;
  const people = data.operators.length;
  const size = people <= 4 ? 8.4 : people <= 6 ? 6.8 : 5.4;
  const names = data.operators.map((o) => o.name);

  return (
    <div className={styles.screen}>
      <div className={styles.pattern} />
      <div className={styles.vignette} />

      <header className={styles.top}>
        <div className={styles.brand}>
          <BrandMark size={58} />
          <div>
            <div className={styles.kicker}>{t("tv.kicker")}</div>
            <div className={styles.greeting}>{greeting}</div>
          </div>
        </div>
        <div className={styles.when}>
          <div className={styles.clock}>
            {String(clock.getHours()).padStart(2, "0")}
            <span className={styles.colon}>:</span>
            {String(clock.getMinutes()).padStart(2, "0")}
          </div>
          <div className={styles.date}>{fmt.isoDay(data.now.date)}</div>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.medal}>
          <svg className={styles.medalStar} viewBox="-100 -100 200 200" aria-hidden="true">
            <polygon points={starPoints(96)} className={styles.starOuter} />
            <polygon points={starPoints(84)} className={styles.starInner} />
            <circle r="56" className={styles.starCore} />
          </svg>
          <div className={styles.medalText}>
            <div className={styles.medalValue}>
              <CountUp value={d.booked} />
            </div>
            <div className={styles.medalLabel}>{t("tv.bookedToday")}</div>
          </div>
        </div>
        <div className={styles.board}>
          <Score value={d.calls} label={t("tv.calls")} note={t("tv.inOut", { inc: d.incoming, out: d.outgoing })} />
          {data.line.on && <Score value={talkingNow} label={t("tv.talkingNow")} tone="turquoise" live={talkingNow > 0} />}
          {data.line.on && <Score value={data.line.waiting} label={t("tv.waiting")} tone={data.line.waiting > 0 ? "gold" : undefined} alert={data.line.waiting > 0} />}
          <Score
            value={d.missed}
            label={t("tv.missed")}
            tone={d.notCalledBack > 0 ? "coral" : undefined}
            alert={d.notCalledBack > 0}
            note={d.notCalledBack > 0 ? t("tv.notCalledBack", { n: d.notCalledBack }) : t("tv.allCalledBack")}
          />
          <Score value={d.consultationsToday} label={t("tv.consultsTodayShort")} />
        </div>
      </section>

      <section className={styles.stage} style={{ "--size": `${size}vw` }}>
        {data.operators.map((o) => (
          <Person key={o.name} o={o} colours={colourOf(o.name, names)} leader={leader?.name === o.name} extraSeconds={sinceFetch} t={t} />
        ))}
      </section>

      <Ticker data={data} leader={leader} t={t} />

      {party && <Celebration names={party.names} t={t} key={party.at} />}
      {error && <div className={styles.stale}>{t("tv.stale")}</div>}
    </div>
  );
}

function Score({ value, label, note, tone, live, alert }) {
  return (
    <div className={`${styles.score} ${tone ? styles[tone] : ""} ${alert ? styles.alert : ""}`}>
      <div className={styles.scoreValue}>
        <CountUp value={value} />
        {live && <span className={styles.liveDot} />}
      </div>
      <div className={styles.scoreLabel}>{label}</div>
      {note && <div className={styles.scoreNote}>{note}</div>}
    </div>
  );
}

const RAYS = 40;

function Person({ o, colours, leader, extraSeconds, t }) {
  const [light, deep] = colours;
  const talking = o.status === "talking";
  const seconds = talking && o.onCallSeconds != null ? o.onCallSeconds + extraSeconds : null;
  return (
    <div className={`${styles.person} ${styles[`is_${o.status}`]} ${leader ? styles.leader : ""}`} style={{ "--light": light, "--deep": deep }}>
      <div className={styles.portrait}>
        {talking && (
          <div className={styles.rays} aria-hidden="true">
            {Array.from({ length: RAYS }, (_, i) => (
              <span key={i} style={{ "--a": `${(360 / RAYS) * i}deg` }}>
                <i style={{ animationDelay: `${(i * 173) % 1100}ms`, animationDuration: `${620 + ((i * 97) % 520)}ms` }} />
              </span>
            ))}
          </div>
        )}
        {o.status === "ringing" && (
          <div className={styles.ripples} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )}
        {leader && (
          <svg className={styles.crown} viewBox="0 0 64 40" aria-hidden="true">
            <path d="M4 34 L8 10 L20 22 L32 4 L44 22 L56 10 L60 34 Z" />
            <rect x="4" y="34" width="56" height="5" rx="2" />
          </svg>
        )}
        <div className={styles.face}>{initials(o.name)}</div>
      </div>
      <div className={styles.name}>{shortName(o.name)}</div>
      <div className={styles.status}>
        {o.status === "ringing" && <span className={styles.wobble}>☎</span>}
        {t(`tv.status.${o.status}`)}
        {seconds != null && <span className={styles.timer}>{clockTime(seconds)}</span>}
      </div>
      <div className={styles.stats}>
        <span>
          <b>
            <CountUp value={o.calls} />
          </b>{" "}
          {t("tv.callsShort")}
        </span>
        <span className={styles.statBooked}>
          <b>
            <CountUp value={o.booked} />
          </b>{" "}
          {t("tv.bookedShort")}
        </span>
        <span>
          <b>
            <CountUp value={o.talkMinutes} />
          </b>{" "}
          {t("tv.min")}
        </span>
      </div>
      <div className={styles.rating}>
        {o.stars != null ? (
          <>
            <Stars value={o.stars} size={24} />
            <span>{o.stars.toFixed(1)}</span>
          </>
        ) : (
          <span className={styles.dim}>{t("tv.noRating")}</span>
        )}
      </div>
    </div>
  );
}

// Numbers roll to their new value instead of jumping.
function CountUp({ value }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return undefined;
    const began = performance.now();
    let frame;
    const step = (ts) => {
      const p = Math.min(1, (ts - began) / 900);
      const eased = 1 - (1 - p) ** 3;
      setShown(Math.round(start + (value - start) * eased));
      if (p < 1) frame = requestAnimationFrame(step);
      else from.current = value;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span className={styles.count}>{shown}</span>;
}

// The day's highlights going by along the bottom, behind a LIVE sign.
function Ticker({ data, leader, t }) {
  const d = data.today;
  const rated = data.operators.filter((o) => o.stars != null).sort((a, b) => b.stars - a.stars)[0];
  const talker = [...data.operators].sort((a, b) => b.talkMinutes - a.talkMinutes)[0];
  const items = [
    leader ? t("tv.tickLeader", { name: shortName(leader.name), n: leader.booked }) : t("tv.tickFirst"),
    d.notCalledBack > 0 ? t("tv.tickCallBack", { n: d.notCalledBack }) : t("tv.tickAllBack"),
    rated ? t("tv.tickStars", { name: shortName(rated.name), stars: rated.stars.toFixed(1) }) : null,
    talker?.talkMinutes > 0 ? t("tv.tickTalk", { name: shortName(talker.name), n: talker.talkMinutes }) : null,
    d.calls > 0 ? t("tv.tickCalls", { n: d.calls }) : null,
    t("tv.tickMotto1"),
    t("tv.tickMotto2"),
  ].filter(Boolean);
  return (
    <div className={styles.ticker}>
      <div className={styles.onAir}>
        <span className={styles.onAirDot} />
        {t("tv.live")}
      </div>
      <div className={styles.tickerWindow}>
        <div className={styles.tickerTrack}>
          {[0, 1].map((copy) => (
            <span key={copy} aria-hidden={copy === 1 || undefined}>
              {items.map((text, i) => (
                <span key={i} className={styles.tickItem}>
                  {text}
                  <svg viewBox="-10 -10 20 20" className={styles.tickStar} aria-hidden="true">
                    <polygon points={starPoints(9)} />
                  </svg>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// A shower of gold girih stars and the news, for a few seconds.
function Celebration({ names, t }) {
  const canvas = useRef(null);
  useEffect(() => {
    const c = canvas.current;
    const ctx = c.getContext("2d");
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    const colours = ["#f2c14e", "#ffd97a", "#2ec4b6", "#ff7a6b", "#f6efe2"];
    const star = (r) => {
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (Math.PI / 8) * i;
        const rr = i % 2 === 0 ? r : r * 0.62;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    };
    const pieces = Array.from({ length: 220 }, () => ({
      x: Math.random() * c.width,
      y: -Math.random() * c.height * 0.6,
      vy: 2 + Math.random() * 4,
      sway: Math.random() * Math.PI * 2,
      size: 5 + Math.random() * 12,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.08,
      colour: colours[Math.floor(Math.random() * colours.length)],
    }));
    let frame;
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      for (const p of pieces) {
        p.y += p.vy;
        p.sway += 0.03;
        p.rot += p.spin;
        ctx.save();
        ctx.translate(p.x + Math.sin(p.sway) * 18, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.colour;
        star(p.size);
        ctx.restore();
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className={styles.party}>
      <canvas ref={canvas} className={styles.confetti} />
      <div className={styles.partyCard}>
        <svg viewBox="-100 -100 200 200" className={styles.partyStar} aria-hidden="true">
          <polygon points={starPoints(96)} />
        </svg>
        <div className={styles.partyTitle}>{t("tv.party")}</div>
        {names.length > 0 && <div className={styles.partyNames}>{t("tv.partyNames", { names: names.join(", ") })}</div>}
      </div>
    </div>
  );
}
