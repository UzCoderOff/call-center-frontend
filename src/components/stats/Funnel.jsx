import styles from "./Funnel.module.css";
import Card from "../ui/Card";
import Icon from "../ui/Icon";
import { AsyncBoundary } from "../ui/Misc";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { rangeFor } from "../../lib/format";
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
  // Why new callers they talked to didn't book (the operators' taps).
  const outcomes = (f.outcomes || []).filter((r) => r.count > 0);
  const outcomeMax = Math.max(1, ...outcomes.map((r) => r.count));

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

      {(outcomes.length > 0 || f.outcomeMissing > 0) && (
        <div className={styles.reasons}>
          <h3>{t("funnel.outcomesTitle")}</h3>
          {outcomes.length > 0 && (
            <ul>
              {outcomes.map((r) => (
                <li key={r.outcome}>
                  <span className={styles.reasonLabel}>{t(`newCallers.outcomes.${r.outcome}`)}</span>
                  <span className={styles.reasonTrack} aria-hidden="true">
                    <span style={{ width: `${Math.round((r.count / outcomeMax) * 100)}%` }} />
                  </span>
                  <span className={styles.reasonCount}>{fmt.number(r.count)}</span>
                </li>
              ))}
            </ul>
          )}
          {f.outcomeMissing > 0 && <p className={styles.missing}>{t("funnel.outcomeMissing", { count: fmt.number(f.outcomeMissing) })}</p>}
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
          {["numbers", "reached", "booked", "came", "signed", "lost", "outcomes", ...(money ? ["money"] : [])].map((k) => (
            <li key={k}>{t(`funnel.how.${k}`)}</li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

// The call center side by side (managers): each person's funnel — the
// numbers their phone talked to (a number that called two of them counts
// for both), how many booked, came, signed, and new callers still without
// a reason. `rangeKey`: the dashboard's period ("month", "today"…).
export function FunnelByEmployeeCard({ rangeKey }) {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.funnelByEmployee(rangeFor(rangeKey)), [rangeKey]);
  return (
    <Card flush title={t("funnel.byEmployeeTitle")} subtitle={t("funnel.byEmployeeSubtitle")}>
      <AsyncBoundary state={state}>
        {({ rows }) =>
          rows.length === 0 ? (
            <p className={styles.empty}>{t("funnel.byEmployeeEmpty")}</p>
          ) : (
            <ul className={styles.people}>
              {rows.map((r) => (
                <li key={r.id}>
                  <strong>{r.name}</strong>
                  <span className={styles.peopleLine}>
                    <span>{t("funnel.p.numbers", { n: fmt.number(r.numbers), fresh: fmt.number(r.new) })}</span>
                    <span>{t("funnel.p.reached", { n: fmt.number(r.reached) })}</span>
                    <span>{t("funnel.p.booked", { n: fmt.number(r.booked), pct: r.rates?.booked ?? 0 })}</span>
                    <span>{t("funnel.p.came", { n: fmt.number(r.came) })}</span>
                    <span>{t("funnel.p.signed", { n: fmt.number(r.signed) })}</span>
                    {r.outcomeMissing > 0 && <span className={styles.cellWarn}>{t("funnel.p.noReason", { n: fmt.number(r.outcomeMissing) })}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )
        }
      </AsyncBoundary>
    </Card>
  );
}
