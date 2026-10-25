import { useState } from "react";
import styles from "./CallReview.module.css";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { BetaBadge } from "../telegram/TgReview";
import { api } from "../../lib/api";
import { saveFailed } from "../../lib/saveFailed";
import { useI18n } from "../../i18n";

// A call's text and its AI review (BETA — the server's services/callReview.js):
// points against the firm's call standard, what was good, what to improve,
// "you said … — better: …". The operator sees their own; managers see all
// and can mark a review right or wrong (that teaches the AI).

const CRITERIA = [
  "greeting",
  "routing",
  "listening",
  "questions",
  "summary",
  "offer",
  "priceTime",
  "closing",
  "manner",
];
const WHO = { staff: "staff", client: "client", mix: "mix" };

const clock = (s) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function tone(points, max) {
  const r = max ? points / max : 0;
  return r >= 0.8 ? styles.good : r >= 0.5 ? styles.mid : styles.low;
}

export function CallReviewCard({ call, canCheck, onChange }) {
  const { t } = useI18n();
  const a = call.analysis;
  const pending =
    call.transcript &&
    call.transcript.status !== "done" &&
    call.transcript.status !== "failed";
  if (!a && !pending) return null;
  if (!a || a.status !== "done") {
    return (
      <Card title={t("callReview.title")} action={<BetaBadge />}>
        <p className={styles.note}>
          {a?.status === "failed"
            ? t("callReview.failed")
            : pending
              ? t("callReview.waitingText")
              : t("callReview.waitingReview")}
        </p>
      </Card>
    );
  }
  const d = a.details || {};
  const byKey = new Map((d.criteria || []).map((c) => [c.key, c]));
  return (
    <Card
      title={t("callReview.title")}
      action={
        <span className={styles.head}>
          <BetaBadge />
          {a.score != null ? (
            <span className={`${styles.score} ${tone(a.score, 100)}`}>
              {a.score}/100
            </span>
          ) : (
            <span className={styles.note}>{t("callReview.unscored")}</span>
          )}
        </span>
      }
    >
      {a.summary && <p className={styles.about}>{a.summary}</p>}
      {d.short ? (
        <p className={styles.note}>{t("callReview.short")}</p>
      ) : (
        d.kind &&
        d.kind !== "lead" && (
          <p className={styles.note}>{t(`callReview.kind.${d.kind}`)}</p>
        )
      )}
      {d.grossErrors?.length > 0 && a.score != null && (
        <div className={styles.gross}>
          <b>{t("callReview.grossErrors")}</b>
          <ul>
            {d.grossErrors.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      {a.score != null && (
        <details className={styles.more}>
          <summary>{t("callReview.details")}</summary>
          <div className={styles.criteria}>
            {CRITERIA.map((key) => {
              const c = byKey.get(key);
              if (!c) return null;
              return (
                <div key={key} className={styles.criterion}>
                  <div className={styles.criterionHead}>
                    <span>{t(`callReview.criteria.${key}`)}</span>
                    <span
                      className={`${styles.points} ${tone(c.points, c.max)}`}
                    >
                      {c.points}/{c.max}
                    </span>
                  </div>
                  <div className={styles.bar}>
                    <span
                      className={tone(c.points, c.max)}
                      style={{
                        width: `${c.max ? (100 * c.points) / c.max : 0}%`,
                      }}
                    />
                  </div>
                  {c.note && <p className={styles.criterionNote}>{c.note}</p>}
                </div>
              );
            })}
          </div>

          {d.good?.length > 0 && (
            <section className={styles.section}>
              <h3>✅ {t("callReview.good")}</h3>
              <ul>
                {d.good.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </section>
          )}
          {d.improve?.length > 0 && (
            <section className={styles.section}>
              <h3>💡 {t("callReview.improve")}</h3>
              <ul>
                {d.improve.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </section>
          )}
          {d.betterLines?.length > 0 && (
            <section className={styles.section}>
              <h3>{t("callReview.betterLines")}</h3>
              {d.betterLines.map((b, i) => (
                <div key={i} className={styles.better}>
                  <p className={styles.said}>
                    <span>{t("callReview.said")}</span> «{b.said}»
                  </p>
                  <p className={styles.betterLine}>
                    <span>{t("callReview.better")}</span> «{b.better}»
                  </p>
                </div>
              ))}
            </section>
          )}
        </details>
      )}
      <p className={styles.betaNote}>{t("callReview.betaNote")}</p>
      {canCheck && <Feedback call={call} onChange={onChange} />}
    </Card>
  );
}

function Feedback({ call, onChange }) {
  const { t } = useI18n();
  const a = call.analysis;
  const [note, setNote] = useState(a.feedbackNote || "");
  const [busy, setBusy] = useState(false);
  async function save(correct) {
    setBusy(true);
    try {
      const row = await api.callReviewFeedback(call.id, {
        correct,
        note: note.trim() || null,
      });
      onChange?.({ ...call, analysis: { ...a, ...row } });
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.feedback}>
      <span className={styles.note}>
        {a.feedbackCorrect == null
          ? t("callReview.checkAsk")
          : a.feedbackCorrect
            ? t("callReview.checkedRight")
            : t("callReview.checkedWrong")}
      </span>
      <textarea
        className={styles.feedbackNote}
        rows={2}
        placeholder={t("callReview.notePh")}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className={styles.feedbackButtons}>
        <Button
          size="small"
          variant={a.feedbackCorrect === true ? "primary" : "secondary"}
          disabled={busy}
          onClick={() => save(true)}
        >
          {t("callReview.right")}
        </Button>
        <Button
          size="small"
          variant={a.feedbackCorrect === false ? "destructive" : "secondary"}
          disabled={busy}
          onClick={() => save(false)}
        >
          {t("callReview.wrong")}
        </Button>
      </div>
    </div>
  );
}

// The call as text: who said what, when.
export function TranscriptCard({ call }) {
  const { t } = useI18n();
  const [all, setAll] = useState(false);
  const tr = call.transcript;
  if (!tr || tr.status !== "done") return null;
  const lines =
    Array.isArray(tr.segments) && tr.segments.length ? tr.segments : null;
  if (!lines)
    return tr.text ? (
      <Card title={t("callDetail.transcript")}>
        <p className={styles.plain}>{tr.text}</p>
      </Card>
    ) : null;
  const shown = all ? lines : lines.slice(0, 14);
  return (
    <Card
      title={t("callDetail.transcript")}
      subtitle={t("callReview.transcriptNote")}
    >
      <div className={styles.lines}>
        {shown.map((s, i) => (
          <div
            key={i}
            className={`${styles.line} ${styles[WHO[s.who] || "mix"]}`}
          >
            <span className={styles.who}>
              {t(`callReview.who.${WHO[s.who] || "mix"}`)} · {clock(s.start)}
            </span>
            <span>{s.text}</span>
          </div>
        ))}
      </div>
      {lines.length > shown.length && (
        <Button size="small" variant="plain" onClick={() => setAll(true)}>
          {t("callReview.showAll", { n: lines.length })}
        </Button>
      )}
    </Card>
  );
}
