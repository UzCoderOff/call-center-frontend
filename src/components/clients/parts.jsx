import styles from "./Clients.module.css";
import Badge from "../ui/Badge";
import { useI18n } from "../../i18n";

export const STATUSES = ["consultation", "call_again", "contract", "done", "declined"];
export const LEGAL_STAGES = [
  "inquiry",
  "investigation",
  "sent_to_court",
  "first_instance",
  "appeal",
  "cassation",
  "review",
  "supreme_review",
];
export const SOURCES = ["call", "telegram", "instagram", "referral", "walk_in", "other"];

const STATUS_STYLE = {
  consultation: { tone: "accent", icon: "calendar" },
  call_again: { tone: "warning", icon: "phone" },
  contract: { tone: "good", icon: "checkCircle" },
  done: { tone: "neutral", icon: "check" },
  declined: { tone: "neutral", icon: "minusCircle" },
};

export function StatusBadge({ status }) {
  const { t } = useI18n();
  if (!status) return null;
  const s = STATUS_STYLE[status] || STATUS_STYLE.consultation;
  return (
    <Badge tone={s.tone} icon={s.icon}>
      {t(`cases.statuses.${status}`)}
    </Badge>
  );
}

const PAY_TONE = { paid: "good", partial: "warning", unpaid: "critical" };

export function PayBadge({ state }) {
  const { t } = useI18n();
  if (!PAY_TONE[state]) return null;
  return <Badge tone={PAY_TONE[state]}>{t(`cases.payState.${state}`)}</Badge>;
}

// Where a case stands in the courts: one segment per stage, filled up to
// the current one, with its name written out.
export function StageTrack({ stage }) {
  const { t } = useI18n();
  const at = LEGAL_STAGES.indexOf(stage);
  return (
    <div>
      <div className={styles.stages} aria-hidden="true">
        {LEGAL_STAGES.map((s, i) => (
          <span key={s} className={`${styles.stage} ${i <= at ? styles.stageOn : ""}`} />
        ))}
      </div>
      <p className={styles.stageLabel}>
        {t("cases.legalStage")}: <strong>{at >= 0 ? t(`cases.stages.${stage}`) : t("cases.noStage")}</strong>
      </p>
    </div>
  );
}

// Contract amount, paid, left — with a bar.
export function MoneyBlock({ item }) {
  const { t, fmt } = useI18n();
  const { contractAmount, paid, remaining, state } = item;
  if (!contractAmount && !paid) return null;
  const pct = contractAmount ? Math.min(100, Math.round((paid / contractAmount) * 100)) : 100;
  return (
    <div className={styles.money}>
      {contractAmount ? (
        <div className={styles.moneyLine}>
          <span>{t("cases.contractTotal")}</span>
          <strong>{fmt.money(contractAmount)}</strong>
        </div>
      ) : null}
      <div className={styles.track} aria-hidden="true">
        <div className={`${styles.fill} ${state === "paid" ? styles.fillDone : ""}`} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.moneyLine}>
        <span>
          {t("cases.paidLabel")} <strong>{fmt.money(paid)}</strong>
        </span>
        {remaining > 0 && (
          <span>
            {t("cases.remainingLabel")} <strong>{fmt.money(remaining)}</strong>
          </span>
        )}
        <PayBadge state={state} />
      </div>
    </div>
  );
}

// "23 / 60" with a bar; without a target just the number.
export function Meter({ label, done, target }) {
  const { t, fmt } = useI18n();
  const pct = target ? Math.min(100, Math.round((done / target) * 100)) : 0;
  return (
    <div className={styles.meter}>
      <div className={styles.meterHead}>
        <span>{label}</span>
        <span className={styles.meterValue}>
          {target ? t("clients.ofTarget", { done: fmt.number(done), target: fmt.number(target) }) : fmt.number(done)}
        </span>
      </div>
      {target ? (
        <div className={styles.track} role="progressbar" aria-valuenow={done} aria-valuemax={target} aria-label={label}>
          <div className={`${styles.fill} ${done >= target ? styles.fillDone : ""}`} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

export const personName = (p) => p?.employee?.name || p?.username || "";
