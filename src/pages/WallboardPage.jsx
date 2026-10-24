import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import styles from "./WallboardPage.module.css";
import { BrandMark } from "../components/layout/AppShell";
import { Stars } from "../components/performance/CallRating";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

// The call center on the office TV (backend services/wallboard.js): opened
// once on the TV's browser from the link in Settings, no login, and left
// on. Made to be fun to look at (the user, 2026-10-24: "it looks
// depressing"): each operator a glowing card — sound bars moving while
// they talk, a shaking phone while it rings, a crown for whoever booked
// most today — numbers that count up, confetti when a consultation is
// booked, and a ticker of the day's highlights. Staff names and counts only:
// never a client's name or number.
const REFRESH_MS = 5 * 1000;
const CELEBRATE_MS = 7 * 1000;

export default function WallboardPage() {
  const { token } = useParams();
  const { t, fmt } = useI18n();
  const [data, setData] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [party, setParty] = useState(null); // { names, at }
  const before = useRef(null);

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const next = await api.wallboard(token);
        if (stop) return;
        // A consultation booked since the last look: who, for the confetti.
        const prev = before.current;
        if (prev && next.today.booked > prev.today.booked) {
          const names = next.operators.filter((o) => o.booked > (prev.operators.find((p) => p.name === o.name)?.booked ?? 0)).map((o) => o.name);
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
        <Aurora />
        <div className={styles.center}>{error?.status === 404 ? t("tv.badLink") : t("common.loading")}</div>
      </div>
    );
  }

  const d = data.today;
  const clock = new Date(now);
  const hour = clock.getHours();
  const greeting = hour < 12 ? t("tv.morning") : hour < 17 ? t("tv.afternoon") : t("tv.evening");
  const leader = data.operators.find((o) => o.booked > 0 && o.booked === Math.max(...data.operators.map((x) => x.booked)));
  const sinceFetch = Math.max(0, Math.round((now - fetchedAt) / 1000));
  const talkingNow = data.line.on ? data.line.talking : data.operators.filter((o) => o.status === "talking").length;

  return (
    <div className={styles.screen}>
      <Aurora />
      <header className={styles.top}>
        <div className={styles.brand}>
          <BrandMark size={56} />
          <div>
            <div className={styles.title}>{t("tv.title")}</div>
            <div className={styles.greeting}>{greeting}</div>
          </div>
        </div>
        <div className={styles.when}>
          <span className={styles.clock}>
            {String(clock.getHours()).padStart(2, "0")}
            <span className={styles.colon}>:</span>
            {String(clock.getMinutes()).padStart(2, "0")}
          </span>
          <span>{fmt.isoDay(data.now.date)}</span>
        </div>
      </header>

      <section className={styles.tiles}>
        <Tile emoji="📞" label={t("tv.calls")} value={d.calls} sub={t("tv.inOut", { inc: d.incoming, out: d.outgoing })} tone="blue" />
        {data.line.on && (
          <Tile emoji="🎧" label={t("tv.talkingNow")} value={talkingNow} tone="violet" extra={talkingNow > 0 ? <Equalizer bars={7} /> : null} />
        )}
        {data.line.on && <Tile emoji="⏳" label={t("tv.waiting")} value={data.line.waiting} tone={data.line.waiting > 0 ? "amber" : "slate"} pulse={data.line.waiting > 0} />}
        <Tile
          emoji={d.notCalledBack > 0 ? "⚠️" : "✅"}
          label={t("tv.missed")}
          value={d.missed}
          sub={d.notCalledBack > 0 ? t("tv.notCalledBack", { n: d.notCalledBack }) : t("tv.allCalledBack")}
          tone={d.notCalledBack > 0 ? "red" : "teal"}
          pulse={d.notCalledBack > 0}
        />
        <Tile emoji="🎉" label={t("tv.booked")} value={d.booked} sub={t("tv.consultsToday", { n: d.consultationsToday })} tone="green" glow={d.booked > 0} />
      </section>

      <section className={styles.cards} style={{ "--cols": Math.min(4, Math.max(2, data.operators.length)) }}>
        {data.operators.map((o) => (
          <OperatorCard key={o.name} o={o} leader={leader?.name === o.name} extraSeconds={sinceFetch} t={t} />
        ))}
      </section>

      <Ticker data={data} leader={leader} t={t} />

      {party && <Celebration names={party.names} t={t} key={party.at} />}
      {error && <div className={styles.stale}>{t("tv.stale")}</div>}
    </div>
  );
}

// A person's own colour, the same every day.
function hueOf(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

// "Mohinur Meliqoʻziyeva" -> "Mohinur M." — read from across the room.
const shortName = (name) => {
  const [first, second] = name.split(/\s+/).filter(Boolean);
  return second && name.length > 14 ? `${first} ${second[0].toUpperCase()}.` : name;
};

// 96 -> "1:36" — a call's time, ticking.
const clockTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

function OperatorCard({ o, leader, extraSeconds, t }) {
  const hue = hueOf(o.name);
  const talking = o.status === "talking";
  const seconds = talking && o.onCallSeconds != null ? o.onCallSeconds + extraSeconds : null;
  return (
    <div className={`${styles.card} ${styles[`card_${o.status}`]} ${leader ? styles.leader : ""}`} style={{ "--hue": hue }}>
      {leader && <span className={styles.crown}>👑</span>}
      <div className={styles.cardHead}>
        <div className={styles.avatar}>
          {initials(o.name)}
          {talking && <span className={styles.ring} />}
        </div>
        <div className={styles.who}>
          <div className={styles.name}>{shortName(o.name)}</div>
          <div className={`${styles.pill} ${styles[`pill_${o.status}`]}`}>
            {o.status === "ringing" && <span className={styles.shake}>📞</span>}
            {t(`tv.status.${o.status}`)}
            {seconds != null && <span className={styles.timer}>{clockTime(seconds)}</span>}
          </div>
        </div>
      </div>
      <div className={styles.wave}>{talking ? <Equalizer bars={18} /> : <span className={styles.flat} />}</div>
      <div className={styles.numbers}>
        <Num label={t("tv.calls")} value={o.calls} />
        <Num label={t("tv.booked")} value={o.booked} big />
        <Num label={t("tv.talk")} value={o.talkMinutes} suffix={t("tv.min")} />
      </div>
      <div className={styles.rating}>
        {o.stars != null ? (
          <>
            <Stars value={o.stars} size={26} />
            <span>{o.stars.toFixed(1)}</span>
          </>
        ) : (
          <span className={styles.dim}>{t("tv.noRating")}</span>
        )}
      </div>
    </div>
  );
}

function Num({ label, value, big, suffix }) {
  return (
    <div className={`${styles.num} ${big ? styles.numBig : ""}`}>
      <span className={styles.numValue}>
        <CountUp value={value} />
        {suffix && <small>{suffix}</small>}
      </span>
      <span className={styles.numLabel}>{label}</span>
    </div>
  );
}

function Tile({ emoji, label, value, sub, tone, pulse, glow, extra }) {
  return (
    <div className={`${styles.tile} ${styles[`tone_${tone}`]} ${pulse ? styles.pulse : ""} ${glow ? styles.glow : ""}`}>
      <div className={styles.tileTop}>
        <span className={styles.tileEmoji}>{emoji}</span>
        <span className={styles.tileLabel}>{label}</span>
      </div>
      <div className={styles.tileValue}>
        <CountUp value={value} />
        {extra}
      </div>
      {sub && <div className={styles.tileSub}>{sub}</div>}
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

// Sound bars going up and down — someone is talking.
function Equalizer({ bars }) {
  return (
    <span className={styles.eq} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} style={{ animationDelay: `${(i * 137) % 900}ms`, animationDuration: `${700 + ((i * 211) % 600)}ms` }} />
      ))}
    </span>
  );
}

function Aurora() {
  return (
    <div className={styles.aurora} aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

// The day's highlights going by along the bottom.
function Ticker({ data, leader, t }) {
  const d = data.today;
  const rated = data.operators.filter((o) => o.stars != null).sort((a, b) => b.stars - a.stars)[0];
  const talker = [...data.operators].sort((a, b) => b.talkMinutes - a.talkMinutes)[0];
  const items = [
    leader ? t("tv.tickLeader", { name: leader.name, n: leader.booked }) : t("tv.tickFirst"),
    d.notCalledBack > 0 ? t("tv.tickCallBack", { n: d.notCalledBack }) : t("tv.tickAllBack"),
    rated ? t("tv.tickStars", { name: rated.name, stars: rated.stars.toFixed(1) }) : null,
    talker?.talkMinutes > 0 ? t("tv.tickTalk", { name: talker.name, n: talker.talkMinutes }) : null,
    d.calls > 0 ? t("tv.tickCalls", { n: d.calls }) : null,
    t("tv.tickMotto1"),
    t("tv.tickMotto2"),
  ].filter(Boolean);
  const line = items.join("     ✦     ");
  return (
    <div className={styles.ticker}>
      <div className={styles.tickerTrack}>
        <span>{line}</span>
        <span aria-hidden="true">{line}</span>
      </div>
    </div>
  );
}

// Confetti and a big "booked!" for a few seconds.
function Celebration({ names, t }) {
  const canvas = useRef(null);
  useEffect(() => {
    const c = canvas.current;
    const ctx = c.getContext("2d");
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    const colors = ["#ffd166", "#06d6a0", "#118ab2", "#ef476f", "#a78bfa", "#f8f9fa"];
    const pieces = Array.from({ length: 260 }, () => ({
      x: c.width / 2 + (Math.random() - 0.5) * c.width * 0.3,
      y: c.height * 0.55,
      vx: (Math.random() - 0.5) * 22,
      vy: -Math.random() * 26 - 8,
      size: 6 + Math.random() * 10,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    let frame;
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      for (const p of pieces) {
        p.vy += 0.45;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.spin;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
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
      <div className={styles.partyText}>
        <div className={styles.partyEmoji}>🎉</div>
        <div>{names.length ? t("tv.partyNames", { names: names.join(", ") }) : t("tv.party")}</div>
      </div>
    </div>
  );
}
