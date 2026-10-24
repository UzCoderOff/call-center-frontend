import styles from "./Performance.module.css";
import Card from "../ui/Card";
import { useI18n } from "../../i18n";

// Natijalar → person: what came of the callers they didn't book this month
// (backend services/callOutcomes.js retryResults) — the ones thinking it
// over, the lost ones, and the second chances: given to them, and theirs
// given to someone else. "Yozildi" = a consultation booked since.
export function RetriesCard({ retries: r }) {
  const { t } = useI18n();
  if (!r) return null;
  const any = r.thinking.total || r.lost.total || r.secondGot.total || r.secondOut.total;
  if (!any) return null;
  const line = (label, part, hint) => (
    <div className={styles.retryRow}>
      <span>
        {label}
        {hint && <span className={styles.retryHint}>{hint}</span>}
      </span>
      <strong>{part.booked == null ? part.total : t("retries.booked", { booked: part.booked, total: part.total })}</strong>
    </div>
  );
  return (
    <Card title={t("retries.title")} subtitle={t("retries.subtitle")}>
      <div className={styles.retries}>
        {r.thinking.total > 0 && line(t("retries.thinking"), r.thinking, t("retries.thinkingHint"))}
        {r.lost.total > 0 && line(t("retries.lost"), r.lost, t("retries.lostHint"))}
        {r.secondGot.total > 0 && line(t("retries.secondGot"), r.secondGot, t("retries.secondGotHint"))}
        {r.secondOut.total > 0 && line(t("retries.secondOut"), r.secondOut, t("retries.secondOutHint"))}
      </div>
    </Card>
  );
}

// One line for a person's card in the team view, when there's anything.
export function retriesLine(r, t) {
  if (!r) return null;
  const parts = [];
  if (r.thinking.total) parts.push(t("retries.cardThinking", { booked: r.thinking.booked, total: r.thinking.total }));
  if (r.secondGot.total) parts.push(t("retries.cardSecond", { booked: r.secondGot.booked, total: r.secondGot.total }));
  return parts.length ? parts.join(" · ") : null;
}
