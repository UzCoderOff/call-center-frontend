import { useId } from "react";
import styles from "./CallRating.module.css";
import Card from "../ui/Card";
import { BetaBadge } from "../telegram/TgReview";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";

// An operator's stars from the AI call reviews (beta; backend
// services/callRating.js): their recent reviewed calls on average, a word
// for it like on a review site, which way it's going, what they do best
// and worst.

// Five stars, filled to `value` (0–5, e.g. 3.7).
export function Stars({ value, size = 18 }) {
  const id = useId().replace(/:/g, "");
  return (
    <span className={styles.stars} role="img" aria-label={`${value} / 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <linearGradient id={`${id}-${i}`}>
                <stop offset={fill} stopColor="var(--star)" />
                <stop offset={fill} stopColor="var(--star-off)" />
              </linearGradient>
            </defs>
            <path fill={`url(#${id}-${i})`} d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
          </svg>
        );
      })}
    </span>
  );
}

// One line for a person's card in Natijalar.
export function RatingLine({ rating }) {
  const { t } = useI18n();
  if (!rating) return null;
  if (!rating.enough) return <span className={styles.lineMuted}>{t("rating.few", { count: rating.count, needed: rating.needed })}</span>;
  return (
    <span className={styles.line}>
      <Stars value={rating.stars} size={14} />
      <strong>{rating.stars.toFixed(1)}</strong>
      <span className={styles[rating.level]}>{t(`rating.levels.${rating.level}`)}</span>
      {rating.trend !== "flat" && <span className={rating.trend === "up" ? styles.up : styles.down}>{rating.trend === "up" ? "↑" : "↓"}</span>}
    </span>
  );
}

export function CallRatingCard({ rating }) {
  const { t, fmt } = useI18n();
  if (!rating) return null;
  return (
    <Card title={t("rating.title")} subtitle={t("rating.subtitle")} action={<BetaBadge />}>
      {!rating.enough ? (
        <p className={styles.few}>{t("rating.fewLong", { count: rating.count, needed: rating.needed })}</p>
      ) : (
        <div className={styles.body}>
          <div className={styles.head}>
            <span className={styles.big}>{rating.stars.toFixed(1)}</span>
            <div>
              <Stars value={rating.stars} size={24} />
              <div className={styles.headLine}>
                <span className={`${styles.level} ${styles[rating.level]}`}>{t(`rating.levels.${rating.level}`)}</span>
                <span>· {t("rating.score", { score: rating.score })}</span>
                {rating.trend !== "flat" && <span className={rating.trend === "up" ? styles.up : styles.down}>{t(`rating.trend.${rating.trend}`)}</span>}
              </div>
              <div className={styles.basis}>{t("rating.basis", { count: rating.count, since: fmt.date(new Date(rating.since).getTime()) })}</div>
            </div>
          </div>

          <div className={styles.parts}>
            {rating.parts.map((p) => (
              <div key={p.key} className={styles.part}>
                <span className={styles.partLabel}>{t(`callReview.criteria.${p.key}`)}</span>
                <span className={styles.bar}>
                  <span className={p.share >= 70 ? styles.barGood : p.share < 50 ? styles.barBad : styles.barMid} style={{ width: `${p.share}%` }} />
                </span>
                <span className={styles.partValue}>{p.share}%</span>
              </div>
            ))}
          </div>

          {(rating.best.length > 0 || rating.worst.length > 0) && (
            <div className={styles.notes}>
              {rating.best.length > 0 && <p>✅ {t("rating.best", { list: rating.best.map((p) => t(`callReview.criteria.${p.key}`)).join(", ") })}</p>}
              {rating.worst.length > 0 && <p>💡 {t("rating.worst", { list: rating.worst.map((p) => t(`callReview.criteria.${p.key}`)).join(", ") })}</p>}
              {rating.gross > 0 && <p>⚠️ {t("rating.gross", { count: rating.gross })}</p>}
            </div>
          )}
          <p className={styles.howNote}>{t("rating.how")}</p>
        </div>
      )}
    </Card>
  );
}

// The profile page (Team → person): fetched on its own.
export function CallRatingFor({ employeeId }) {
  const state = useAsync(() => api.callRating(employeeId), [employeeId]);
  return state.data?.rating ? <CallRatingCard rating={state.data.rating} /> : null;
}
