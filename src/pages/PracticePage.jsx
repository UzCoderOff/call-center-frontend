import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import pageStyles from "./Pages.module.css";
import styles from "./PracticePage.module.css";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";
import Icon from "../components/ui/Icon";
import { List, ListRow, ListSectionHeader } from "../components/ui/List";
import { AsyncBoundary, Banner, PageHeader } from "../components/ui/Misc";
import { CallReviewCard } from "../components/calls/CallReview";
import { useAuth, isManagerRole } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { saveFailed } from "../lib/saveFailed";
import { useI18n } from "../i18n";

// Practice (the server's services/practice): the AI plays a made-up client —
// a bank loan with a house at stake, a summons, "how much?", "I'll think
// about it", an arrest — and the staff member answers as on the phone or in
// Telegram, typed (pasting is off: their own words). At the end the AI scores
// them by the firm's call standard, the same as real calls. Managers see the
// team's month.

const LEVELS = { 1: "easy", 2: "medium", 3: "hard" };
const OUTCOME_TONE = { booked: "good", callback: "accent", routed: "good", declined: "good", left: "critical", stopped: "neutral" };

export default function PracticePage() {
  const { id } = useParams();
  return id ? <Session id={Number(id)} /> : <Home />;
}

function Home() {
  const { t, fmt } = useI18n();
  const { user } = useAuth();
  const manager = isManagerRole(user.role);
  const navigate = useNavigate();
  const state = useAsync(() => api.practice(), []);
  const [starting, setStarting] = useState(null);

  async function start(scenario) {
    setStarting(scenario);
    try {
      const s = await api.practiceStart(scenario);
      navigate(`/practice/${s.id}`);
    } catch (err) {
      if (err.code === "practice_off") alert(t("practice.off"));
      else if (err.body?.message) alert(err.body.message);
      else saveFailed(err, t);
      setStarting(null);
    }
  }

  return (
    <div>
      <PageHeader title={t("practice.title")} subtitle={t("practice.subtitle")} />
      <AsyncBoundary state={state}>
        {({ on, scenarios, mine, team }) => {
          const titleOf = (sid) => scenarios.find((s) => s.id === sid)?.title || sid;
          return (
            <div className={pageStyles.stack}>
              {manager && !on && (
                <Banner tone="warning" icon="alertTriangle">
                  {t("practice.offForStaff")}
                </Banner>
              )}
              <Banner icon="sparkles">{t("practice.how")}</Banner>
              <section>
                <ListSectionHeader>{t("practice.pick")}</ListSectionHeader>
                <List>
                  {/* Whole titles and briefs, also on a phone. */}
                  {scenarios.map((s) => (
                    <div key={s.id} className={styles.scenario}>
                      <Icon name={s.channel === "call" ? "phone" : "send"} size={20} className={styles.scenarioIcon} />
                      <div className={styles.scenarioBody}>
                        <div className={styles.scenarioTitle}>{s.title}</div>
                        <div className={styles.scenarioBrief}>{s.brief}</div>
                        <div className={styles.rowMeta}>
                          <span className={`${styles.level} ${styles[`level${s.level}`]}`}>{t(`practice.levels.${LEVELS[s.level]}`)}</span>
                          <span>{t(s.channel === "call" ? "practice.call" : "practice.chat")}</span>
                          {s.tries > 0 && <span>{t("practice.best", { score: s.best ?? "—", tries: s.tries })}</span>}
                        </div>
                      </div>
                      <Button size="small" variant="primary" busy={starting === s.id} disabled={Boolean(starting)} onClick={() => start(s.id)}>
                        {t("practice.start")}
                      </Button>
                    </div>
                  ))}
                </List>
              </section>

              {mine.length > 0 && (
                <section>
                  <ListSectionHeader>{t("practice.mine")}</ListSectionHeader>
                  <List>
                    {mine.slice(0, 10).map((r) => (
                      <ListRow
                        key={r.id}
                        to={`/practice/${r.id}`}
                        chevron
                        title={titleOf(r.scenario)}
                        subtitle={fmt.dateTime(new Date(r.at).getTime())}
                        trailing={<Result score={r.score} outcome={r.status === "active" ? "active" : r.outcome} />}
                      />
                    ))}
                  </List>
                </section>
              )}

              {manager && team && (
                <section>
                  <ListSectionHeader>{t("practice.team", { month: team.month })}</ListSectionHeader>
                  {team.people.length === 0 ? (
                    <List>
                      <div className={styles.empty}>{t("practice.teamEmpty")}</div>
                    </List>
                  ) : (
                    <List>
                      {team.people.map((p) => (
                        <ListRow
                          key={p.user.id}
                          to={p.user.employeeId ? `/performance/${p.user.employeeId}` : undefined}
                          chevron={Boolean(p.user.employeeId)}
                          title={p.user.name}
                          subtitle={t("practice.teamLine", { sessions: p.sessions, avg: p.averageScore ?? "—", best: p.bestScore ?? "—", booked: (p.outcomes.booked || 0) + (p.outcomes.callback || 0) })}
                        />
                      ))}
                    </List>
                  )}
                </section>
              )}
            </div>
          );
        }}
      </AsyncBoundary>
    </div>
  );
}

function Result({ score, outcome }) {
  const { t } = useI18n();
  if (outcome === "active") return <Badge tone="accent">{t("practice.active")}</Badge>;
  return (
    <span className={styles.result}>
      {outcome && <Badge tone={OUTCOME_TONE[outcome] || "neutral"}>{t(`practice.outcomes.${outcome}`)}</Badge>}
      {score != null && <strong>{score}</strong>}
    </span>
  );
}

function Session({ id }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const state = useAsync(() => api.practiceSession(id), [id]);
  const { setData } = state;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(null); // "say" | "finish"
  const [pasteNote, setPasteNote] = useState(false);
  const scrollRef = useRef(null);
  const count = state.data?.messages?.length || 0;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count, busy]);
  useEffect(() => {
    if (!pasteNote) return undefined;
    const timer = setTimeout(() => setPasteNote(false), 4000);
    return () => clearTimeout(timer);
  }, [pasteNote]);

  async function act(kind, fn) {
    setBusy(kind);
    try {
      setData(await fn());
      if (kind === "say") setText("");
    } catch (err) {
      if (err.body?.message) alert(err.body.message);
      else saveFailed(err, t);
    } finally {
      setBusy(null);
    }
  }
  const send = () => text.trim() && !busy && act("say", () => api.practiceSay(id, text.trim()));

  return (
    <div>
      <AsyncBoundary state={state}>
        {(s) => {
          const done = s.status === "done";
          return (
            <>
              <PageHeader
                title={s.scenario.title}
                subtitle={[t(s.scenario.channel === "call" ? "practice.call" : "practice.chat"), s.user?.name].filter(Boolean).join(" · ")}
                back={{ to: "/practice", label: t("practice.title") }}
                actions={
                  !done && (
                    <Button busy={busy === "finish"} disabled={Boolean(busy)} onClick={() => act("finish", () => api.practiceFinish(id))}>
                      {t("practice.finish")}
                    </Button>
                  )
                }
              />
              <div className={pageStyles.stack}>
                <div className={styles.talk} ref={scrollRef}>
                  {s.messages.map((m, i) => (
                    <div key={i} className={`${styles.line} ${m.from === "staff" ? styles.mine : ""}`}>
                      <div className={styles.bubble}>{m.text}</div>
                      <div className={styles.who}>{m.from === "staff" ? t("practice.you") : t("practice.client")}</div>
                    </div>
                  ))}
                  {busy === "say" && <div className={styles.typing}>{t("practice.typing")}</div>}
                  {busy === "finish" && <div className={styles.typing}>{t("practice.scoring")}</div>}
                </div>

                {!done ? (
                  <div className={styles.composer}>
                    <textarea
                      className={styles.input}
                      rows={2}
                      value={text}
                      maxLength={1500}
                      placeholder={t(s.scenario.channel === "call" ? "practice.placeholderCall" : "practice.placeholderChat")}
                      onChange={(e) => setText(e.target.value)}
                      onPaste={(e) => {
                        // Practice is in their own words.
                        e.preventDefault();
                        setPasteNote(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      disabled={Boolean(busy)}
                    />
                    <Button variant="primary" icon="send" busy={busy === "say"} disabled={!text.trim() || Boolean(busy)} onClick={send}>
                      {t("practice.send")}
                    </Button>
                  </div>
                ) : (
                  <>
                    <Card>
                      <div className={styles.endLine}>
                        <Result score={s.score} outcome={s.outcome} />
                        <span>{t(`practice.endNote.${s.outcome || "stopped"}`)}</span>
                      </div>
                    </Card>
                    {s.result ? (
                      <CallReviewCard call={{ analysis: { status: "done", score: s.score, summary: s.result.about, details: s.result } }} open betaNote={t("practice.betaNote")} />
                    ) : (
                      <p className={pageStyles.note}>{t("practice.tooShort")}</p>
                    )}
                    <div className={pageStyles.formActions} style={{ justifyContent: "flex-start" }}>
                      <Button variant="primary" icon="refresh" onClick={async () => navigate(`/practice/${(await api.practiceStart(s.scenario.id)).id}`)}>
                        {t("practice.again")}
                      </Button>
                      <Button to="/practice">{t("practice.other")}</Button>
                    </div>
                  </>
                )}
                {pasteNote && <p className={styles.pasteNote}>{t("practice.noPaste")}</p>}
              </div>
            </>
          );
        }}
      </AsyncBoundary>
    </div>
  );
}

// Natijalar → someone's page: their practice this month.
export function PracticeCard({ employeeId, month }) {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.practicePerson(employeeId, month), [employeeId, month]);
  const d = state.data;
  if (!d) return null;
  return (
    <Card title={t("practice.cardTitle")} subtitle={t("practice.cardSubtitle")}>
      {d.sessions === 0 ? (
        <p className={pageStyles.note} style={{ margin: 0 }}>
          {t("practice.cardNone")}
        </p>
      ) : (
        <>
          <p className={styles.cardLine}>{t("practice.teamLine", { sessions: d.sessions, avg: d.averageScore ?? "—", best: d.bestScore ?? "—", booked: (d.outcomes.booked || 0) + (d.outcomes.callback || 0) })}</p>
          <div className={styles.cardList}>
            {d.last.map((r) => (
              <Link key={r.id} to={`/practice/${r.id}`} className={styles.cardItem}>
                <span>{fmt.date(new Date(r.at).getTime())}</span>
                <Result score={r.score} outcome={r.outcome} />
              </Link>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
