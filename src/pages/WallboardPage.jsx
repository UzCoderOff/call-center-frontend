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
// Its look (the user, 2026-10-24, third round: "too big, too crowded,
// make it feel premium — a lava lamp, liquid moving behind"): colour
// flowing slowly behind frosted glass, drawn live on the TV's graphics
// chip (LiquidBackground); calm type at a size made for a 32" 1080p screen;
// today's numbers on the left, the team as one quiet list on the right —
// sound bars and a spinning ring for whoever is talking, a pulse for a
// phone that rings — and one highlight at a time along the bottom. Staff
// names and counts only — never a client's name or number.
const REFRESH_MS = 5 * 1000;
const CELEBRATE_MS = 7 * 1000;
const HIGHLIGHT_MS = 8 * 1000;
const FONTS = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap";

// Each person's colour, by their place in the alphabet, so they all differ.
const PALETTE = ["#5eead4", "#fbbf24", "#f472b6", "#a78bfa", "#60a5fa", "#4ade80"];
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

// "Mohinur Meliqoʻziyeva" -> "Mohinur M."
const shortName = (name) => {
  const [first, second] = name.split(/\s+/).filter(Boolean);
  return second && name.length > 16 ? `${first} ${second[0].toUpperCase()}.` : name;
};

// 96 -> "1:36"
const clockTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

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
        // A consultation booked since the last look: who.
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
        <LiquidBackground />
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
  const names = data.operators.map((o) => o.name);

  return (
    <div className={styles.screen}>
      <LiquidBackground />

      <header className={styles.top}>
        <div className={styles.brand}>
          <BrandMark size={40} />
          <div>
            <div className={styles.title}>{t("tv.kicker")}</div>
            <div className={styles.sub}>
              {greeting} · {fmt.isoDay(data.now.date)}
            </div>
          </div>
        </div>
        <div className={styles.clock}>
          {String(clock.getHours()).padStart(2, "0")}
          <span className={styles.colon}>:</span>
          {String(clock.getMinutes()).padStart(2, "0")}
        </div>
      </header>

      <main className={styles.main}>
        <section className={`${styles.glass} ${styles.today}`}>
          <div className={styles.label}>{t("tv.bookedToday")}</div>
          <div className={styles.hero}>
            <CountUp value={d.booked} />
          </div>
          <div className={styles.heroNote}>{t("tv.consultsToday", { n: d.consultationsToday })}</div>
          <NextConsultation next={data.nextConsultation} more={data.moreConsultationsToday} t={t} fmt={fmt} />
          <div className={styles.rule} />
          <Line label={t("tv.calls")} value={d.calls} note={t("tv.inOut", { inc: d.incoming, out: d.outgoing })} />
          {data.line.on && <Line label={t("tv.talkingNow")} value={talkingNow} live={talkingNow > 0} />}
          {data.line.on && <Line label={t("tv.waiting")} value={data.line.waiting} tone={data.line.waiting > 0 ? "warn" : undefined} />}
          <Line
            label={t("tv.missed")}
            value={d.missed}
            note={d.notCalledBack > 0 ? t("tv.notCalledBack", { n: d.notCalledBack }) : t("tv.allCalledBack")}
            tone={d.notCalledBack > 0 ? "bad" : undefined}
          />
        </section>

        <section className={`${styles.glass} ${styles.team}`}>
          <div className={`${styles.row} ${styles.head}`}>
            <span>{t("tv.team")}</span>
            <span className={styles.num}>{t("tv.calls")}</span>
            <span className={styles.num}>{t("tv.booked")}</span>
            <span className={styles.num}>{t("tv.talk")}</span>
            <span className={styles.rate}>{t("tv.rating")}</span>
          </div>
          {data.operators.map((o) => (
            <Person key={o.name} o={o} colour={colourOf(o.name, names)} leader={leader?.name === o.name} extraSeconds={sinceFetch} t={t} />
          ))}
        </section>
      </main>

      <Highlights data={data} leader={leader} t={t} />

      {party && <Celebration names={party.names} t={t} key={party.at} />}
      {error && <div className={styles.stale}>{t("tv.stale")}</div>}
    </div>
  );
}

const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// The consultation going on now or coming next: when, how soon, with which
// lawyer, office or video, who booked it — never the client.
function NextConsultation({ next, more, t, fmt }) {
  if (!next) {
    return (
      <div className={styles.next}>
        <div className={styles.label}>{t("tv.nextTitle")}</div>
        <div className={styles.nextNone}>{t("tv.nextNone")}</div>
      </div>
    );
  }
  const when = next.now ? t("tv.nextNow") : next.today ? (next.inMinutes < 60 ? t("tv.nextIn", { n: next.inMinutes }) : t("tv.nextLater")) : fmt.isoDay(next.date);
  return (
    <div className={`${styles.next} ${next.now ? styles.nextLive : ""}`}>
      <div className={styles.label}>{next.now ? t("tv.nextNowTitle") : t("tv.nextTitle")}</div>
      <div className={styles.nextRow}>
        <span className={styles.nextTime}>{hhmm(next.start)}</span>
        <span className={styles.nextWhen}>{when}</span>
      </div>
      <div className={styles.nextWho}>
        {[next.lawyer, next.online ? t("tv.online") : t("tv.office")].filter(Boolean).join(" · ")}
      </div>
      {(next.bookedBy || more > 0) && (
        <div className={styles.nextMore}>
          {[next.bookedBy ? t("tv.nextBookedBy", { name: shortName(next.bookedBy) }) : null, more > 0 ? t("tv.nextMore", { n: more }) : null].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}

function Line({ label, value, note, tone, live }) {
  return (
    <div className={`${styles.line} ${tone ? styles[tone] : ""}`}>
      <div>
        <div className={styles.lineLabel}>
          {live && <span className={styles.liveDot} />}
          {label}
        </div>
        {note && <div className={styles.lineNote}>{note}</div>}
      </div>
      <div className={styles.lineValue}>
        <CountUp value={value} />
      </div>
    </div>
  );
}

function Person({ o, colour, leader, extraSeconds, t }) {
  const talking = o.status === "talking";
  const seconds = talking && o.onCallSeconds != null ? o.onCallSeconds + extraSeconds : null;
  return (
    <div className={`${styles.row} ${styles.person} ${styles[`is_${o.status}`]}`} style={{ "--c": colour }}>
      <div className={styles.who}>
        <div className={styles.avatar}>
          <span className={styles.halo} />
          <span className={styles.face}>{initials(o.name)}</span>
        </div>
        <div className={styles.whoText}>
          <div className={styles.name}>
            {shortName(o.name)}
            {leader && (
              <svg className={styles.crown} viewBox="0 0 64 44" aria-label={t("tv.leader")}>
                <path d="M4 36 L9 10 L21 23 L32 4 L43 23 L55 10 L60 36 Z" />
                <rect x="4" y="38" width="56" height="5" rx="2" />
              </svg>
            )}
          </div>
          <div className={styles.status}>
            {talking && <Bars />}
            <span>{t(`tv.status.${o.status}`)}</span>
            {seconds != null && <span className={styles.timer}>{clockTime(seconds)}</span>}
          </div>
        </div>
      </div>
      <span className={styles.num}>
        <CountUp value={o.calls} />
      </span>
      <span className={`${styles.num} ${o.booked > 0 ? styles.booked : ""}`}>
        <CountUp value={o.booked} />
      </span>
      <span className={styles.num}>
        <CountUp value={o.talkMinutes} />
        <small>{t("tv.min")}</small>
      </span>
      <span className={styles.rate}>
        {o.stars != null ? (
          <>
            <Stars value={o.stars} size={18} />
            <b>{o.stars.toFixed(1)}</b>
          </>
        ) : (
          <span className={styles.dim}>—</span>
        )}
      </span>
    </div>
  );
}

// Small sound bars next to "talking".
function Bars() {
  return (
    <span className={styles.bars} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} style={{ animationDelay: `${i * 140}ms` }} />
      ))}
    </span>
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

// One highlight of the day at a time, fading from one to the next.
function Highlights({ data, leader, t }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setI((n) => n + 1), HIGHLIGHT_MS);
    return () => clearInterval(timer);
  }, []);
  const d = data.today;
  const rated = data.operators.filter((o) => o.stars != null).sort((a, b) => b.stars - a.stars)[0];
  const talker = [...data.operators].sort((a, b) => b.talkMinutes - a.talkMinutes)[0];
  const items = [
    leader ? t("tv.tickLeader", { name: shortName(leader.name), n: leader.booked }) : t("tv.tickFirst"),
    d.notCalledBack > 0 ? t("tv.tickCallBack", { n: d.notCalledBack }) : t("tv.tickAllBack"),
    rated ? t("tv.tickStars", { name: shortName(rated.name), stars: rated.stars.toFixed(1) }) : null,
    talker?.talkMinutes > 0 ? t("tv.tickTalk", { name: shortName(talker.name), n: talker.talkMinutes }) : null,
    t("tv.tickMotto1"),
    t("tv.tickMotto2"),
  ].filter(Boolean);
  const text = items[i % items.length];
  return (
    <footer className={styles.footer}>
      <span className={styles.onAir}>
        <span className={styles.onAirDot} />
        {t("tv.live")}
      </span>
      <span key={text} className={styles.highlight}>
        {text}
      </span>
    </footer>
  );
}

// A card slides in, with a soft burst of light, when someone books.
function Celebration({ names, t }) {
  const canvas = useRef(null);
  useEffect(() => {
    const c = canvas.current;
    const ctx = c.getContext("2d");
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    const cx = c.width / 2;
    const cy = c.height * 0.2;
    const colours = ["255,214,120", "255,255,255", "94,234,212", "244,114,182"];
    const sparks = Array.from({ length: 120 }, () => {
      const a = Math.random() * Math.PI * 2;
      const v = 2 + Math.random() * 7;
      return { x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, r: 1 + Math.random() * 2.6, life: 1, colour: colours[Math.floor(Math.random() * colours.length)] };
    });
    let frame;
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      for (const s of sparks) {
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.97;
        s.vy = s.vy * 0.97 + 0.05;
        s.life -= 0.008;
        if (s.life <= 0) continue;
        ctx.beginPath();
        ctx.fillStyle = `rgba(${s.colour},${s.life})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className={styles.party}>
      <canvas ref={canvas} className={styles.sparks} />
      <div className={styles.toast}>
        <div className={styles.toastLabel}>{t("tv.party")}</div>
        {names.length > 0 && <div className={styles.toastNames}>{names.join(", ")}</div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ the liquid
// Colour flowing like a lava lamp: a small WebGL picture (warped noise
// mixing the palette), drawn at a third of the screen's size — it's soft
// anyway — and stretched to fill it, ~30 frames a second. Without WebGL
// the CSS gradient under it stays.
const VERTEX = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
const FRAGMENT = `
precision mediump float;
uniform vec2 r;
uniform float t;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/r;
  vec2 p=uv*vec2(r.x/r.y,1.)*1.4;
  float s=t*.045;
  vec2 q=vec2(fbm(p+vec2(0.,s)),fbm(p+vec2(5.2,1.3)-s));
  vec2 w=vec2(fbm(p+2.8*q+vec2(1.7,9.2)+s*1.3),fbm(p+2.8*q+vec2(8.3,2.8)-s*.8));
  float f=fbm(p+3.2*w);
  vec3 col=vec3(.10,.04,.30);
  col=mix(col,vec3(.55,.12,.95),smoothstep(.20,.60,f));
  col=mix(col,vec3(.10,.55,1.0),smoothstep(.35,.75,w.x));
  col=mix(col,vec3(1.0,.28,.62),smoothstep(.45,.85,q.y)*.85);
  col=mix(col,vec3(.10,.90,.80),smoothstep(.55,.90,w.y)*.7);
  col=mix(col,vec3(1.0,.62,.25),smoothstep(.65,.95,f)*.55);
  col*=.85+.35*f;
  col*=1.-.22*length(uv-.5);
  gl_FragColor=vec4(col,1.);
}`;

function LiquidBackground() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) return undefined;
    const shader = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = shader(gl.VERTEX_SHADER, VERTEX);
    const fs = shader(gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vs || !fs) return undefined;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return undefined;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(prog, "r");
    const uT = gl.getUniformLocation(prog, "t");
    const size = () => {
      canvas.width = Math.max(320, Math.round(window.innerWidth / 3));
      canvas.height = Math.max(180, Math.round(window.innerHeight / 3));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    size();
    window.addEventListener("resize", size);
    const began = performance.now();
    let frame;
    let last = 0;
    const draw = (ts) => {
      frame = requestAnimationFrame(draw);
      if (ts - last < 33) return;
      last = ts;
      gl.uniform2f(uR, canvas.width, canvas.height);
      gl.uniform1f(uT, (ts - began) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    frame = requestAnimationFrame(draw);
    canvas.classList.add(styles.liquidOn);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", size);
    };
  }, []);
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <canvas ref={ref} className={styles.liquid} />
      <div className={styles.shade} />
    </div>
  );
}
