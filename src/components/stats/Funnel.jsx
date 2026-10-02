import styles from "./Funnel.module.css";
import Card from "../ui/Card";
import Icon from "../ui/Icon";
import { useI18n } from "../../i18n";

const STEPS = ["numbers", "reached", "booked", "came", "signed"];

// Under the call numbers: from calls to contracts, counted by people (one
// number = one person, however many times they called). Each step with
// its share of the step before. Then who slipped away — never talked to —
// and why consultations didn't continue. `money`: the estimate in so'm
// (managers only; it's a guess and says so).
export default function FunnelCard({ funnel: f, money = false }) {
  const { t, fmt } = useI18n();
  if (!f || f.numbers === 0) return null;
  const value = { numbers: f.numbers, reached: f.reached, booked: f.booked, came: f.came, signed: f.signed };
  const reasons = (f.lostReasons || []).filter((r) => r.count > 0);
  const reasonMax = Math.max(1, ...reasons.map((r) => r.count));

  return (
    <Card title={t("funnel.title")} subtitle={t("funnel.subtitle")}>
      <ol className={styles.steps}>
        {STEPS.map((key, i) => {
          const pct = key === "numbers" ? null : f.rates[key];
          const width = f.numbers > 0 ? Math.max(value[key] > 0 ? 2 : 0, Math.round((value[key] / f.numbers) * 100)) : 0;
          return (
            <li key={key} className={styles.step}>
              <div className={styles.stepHead}>
                <span className={styles.stepLabel}>{t(`funnel.steps.${key}`)}</span>
                <span className={styles.stepValue}>{fmt.number(value[key])}</span>
              </div>
              <div className={styles.track} aria-hidden="true">
                <div className={styles.bar} style={{ width: `${width}%`, opacity: 1 - i * 0.12 }} />
              </div>
              <span className={styles.stepSub}>
                {key === "numbers"
                  ? t("funnel.newReturning", { new: fmt.number(f.new), returning: fmt.number(f.returning) })
                  : pct == null
                    ? "—"
                    : // No one marked "came" yet: contracts are counted against bookings.
                      t(`funnel.of.${key === "signed" && f.came === 0 ? "signedOfBooked" : key}`, { pct })}
              </span>
            </li>
          );
        })}
      </ol>

      {f.lost > 0 && (
        <div className={styles.lost}>
          <Icon name="alertTriangle" size={18} />
          <div>
            <strong>{t("funnel.lost", { count: fmt.number(f.lost), new: fmt.number(f.lostNew) })}</strong>
            <p>{t("funnel.lostHint")}</p>
            {money && f.expectedLost > 0 && (
              <p>
                {t("funnel.lostMoney", {
                  money: fmt.money(f.expectedLost),
                  count: fmt.number(f.lostNew),
                  share: f.bookingShare,
                  fee: fmt.money(f.fee),
                })}
              </p>
            )}
          </div>
        </div>
      )}

      {reasons.length > 0 && (
        <div className={styles.reasons}>
          <h3>{t("funnel.reasonsTitle")}</h3>
          <ul>
            {reasons.map((r) => (
              <li key={r.reason}>
                <span className={styles.reasonLabel}>{r.reason === "none" ? t("funnel.reasonNone") : t(`clientWork.lost.${r.reason}`)}</span>
                <span className={styles.reasonTrack} aria-hidden="true">
                  <span style={{ width: `${Math.round((r.count / reasonMax) * 100)}%` }} />
                </span>
                <span className={styles.reasonCount}>{fmt.number(r.count)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className={styles.how}>
        <summary>{t("funnel.howTitle")}</summary>
        <ul>
          {["numbers", "reached", "booked", "came", "signed", "lost", ...(money ? ["money"] : [])].map((k) => (
            <li key={k}>{t(`funnel.how.${k}`)}</li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
