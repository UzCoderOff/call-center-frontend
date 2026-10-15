import { useState } from "react";
import { Link } from "react-router-dom";
import tg from "./TgInbox.module.css";
import Badge from "../ui/Badge";
import Card from "../ui/Card";
import Icon from "../ui/Icon";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";

// The AI's review of a Telegram chat (BETA — the server's services/tgReview.js):
// what happened, how the operator did, what to do next time. Always marked
// Beta and "don't trust it completely".

const OUTCOME_TONE = { booked: "good", lost_by_us: "critical", lost_not_serious: "neutral", lost_other: "warning", open: "accent", not_client: "neutral" };

export function BetaBadge() {
  const { t } = useI18n();
  return <span className={tg.beta}>{t("tgReview.beta")}</span>;
}

export function Stars({ score }) {
  if (!score) return null;
  return (
    <span className={tg.stars} aria-label={`${score}/5`}>
      {"★".repeat(score)}
      <span className={tg.starsOff}>{"★".repeat(5 - score)}</span>
    </span>
  );
}

// One review: the verdict line, the summary, and the advice folded.
export function ReviewBody({ review, open: startOpen = false }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(startOpen);
  const advice = review.good.length > 0 || review.improve.length > 0 || review.betterReply;
  return (
    <div className={tg.review}>
      <div className={tg.reviewLine}>
        <Badge tone={OUTCOME_TONE[review.outcome] || "neutral"}>{t(`tgReview.outcomes.${review.outcome}`)}</Badge>
        <Stars score={review.score} />
        {review.topic && <span className={tg.topic}>{review.topic}</span>}
      </div>
      {review.summary && <p className={tg.reviewText}>{review.summary}</p>}
      {review.lossReason && (
        <p className={tg.reviewText}>
          <strong>{t("tgReview.why")}:</strong> {review.lossReason}
        </p>
      )}
      {advice && (
        <>
          <button type="button" className={tg.moreButton} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? t("tgReview.hideAdvice") : t("tgReview.showAdvice")}
          </button>
          {open && (
            <div className={tg.advice}>
              {review.good.length > 0 && (
                <div>
                  <strong>{t("tgReview.good")}</strong>
                  <ul>
                    {review.good.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
              {review.improve.length > 0 && (
                <div>
                  <strong>{t("tgReview.improve")}</strong>
                  <ul>
                    {review.improve.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
              {review.betterReply && (
                <div>
                  <strong>{t("tgReview.betterReply")}</strong>
                  <div className={tg.betterReply}>{review.betterReply}</div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// On the chat: the latest review (or none yet), with "review now" for managers.
export function ChatReview({ review, canReview, onReview, busy }) {
  const { t, fmt } = useI18n();
  if (!review && !canReview) return null;
  return (
    <div className={tg.reviewBox}>
      <div className={tg.reviewHead}>
        <Icon name="sparkles" size={16} />
        <strong>{t("tgReview.title")}</strong>
        <BetaBadge />
        <span className={tg.reviewWhen}>{review ? [review.operator, fmt.dateTime(new Date(review.at).getTime())].filter(Boolean).join(" · ") : t("tgReview.none")}</span>
        {canReview && (
          <button type="button" className={tg.moreButton} onClick={onReview} disabled={busy}>
            {busy ? t("tgReview.reviewing") : review ? t("tgReview.again") : t("tgReview.now")}
          </button>
        )}
      </div>
      {review && <ReviewBody review={review} />}
      <p className={tg.betaNote}>{t("tgReview.betaNote")}</p>
    </div>
  );
}

// Natijalar → someone's page: their Telegram chats as the AI saw them this month.
export function TgReviewsCard({ employeeId, month }) {
  const { t } = useI18n();
  const state = useAsync(() => api.tgReviews(employeeId, month), [employeeId, month]);
  const data = state.data;
  if (!data || data.reviews.length === 0) return null;
  const order = ["booked", "lost_by_us", "lost_not_serious", "lost_other", "open"];
  return (
    <Card
      title={
        <span className={tg.cardHeading}>
          {t("tgReview.cardTitle")} <BetaBadge />
        </span>
      }
      subtitle={t("tgReview.cardSubtitle")}
    >
      <div className={tg.reviewCounts}>
        {order
          .filter((k) => data.counts[k])
          .map((k) => (
            <span key={k} className={tg.reviewCount}>
              <Badge tone={OUTCOME_TONE[k]}>{t(`tgReview.outcomes.${k}`)}</Badge> {data.counts[k]}
            </span>
          ))}
        {data.averageScore != null && (
          <span className={tg.reviewCount}>
            {t("tgReview.average")}: <strong>{data.averageScore}</strong> / 5
          </span>
        )}
      </div>
      <div className={tg.reviewList}>
        {data.reviews.map((r) => (
          <div key={r.id} className={tg.reviewItem}>
            <Link to={r.chat.clientId ? `/clients/${r.chat.clientId}` : `/telegram/${r.chat.id}`} className={tg.reviewWho}>
              {r.chat.name}
            </Link>
            <ReviewBody review={r} />
          </div>
        ))}
      </div>
      <p className={tg.betaNote}>{t("tgReview.betaNote")}</p>
    </Card>
  );
}
