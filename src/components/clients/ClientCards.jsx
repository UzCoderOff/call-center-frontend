import { Link } from "react-router-dom";
import styles from "./Clients.module.css";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { Meter } from "./parts";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";

// This month's consultations and contracts against the targets (Settings ->
// Positions). Staff see their own bars; managers one row per operator.
export function TargetsCard({ manager }) {
  const { t } = useI18n();
  const state = useAsync(() => api.clientTargets(), []);
  const rows = state.data?.rows || [];
  if (rows.length === 0) return null;
  const monthName = (() => {
    const [y, m] = state.data.month.split("-").map(Number);
    return `${t("time.months")[m - 1]} ${y}`;
  })();

  return (
    <Card title={t("clients.targets")} subtitle={monthName}>
      <div className={styles.targets}>
        {rows.map((r) => (
          <div key={r.employee.id} className={`${styles.targetRow} ${manager ? styles.withName : ""}`}>
            {manager && <span className={styles.targetName}>{r.employee.name}</span>}
            <Meter label={t("clients.consultations")} done={r.consultations} target={r.targetConsultations} />
            <Meter label={t("clients.contracts")} done={r.contracts} target={r.targetContracts} />
          </div>
        ))}
      </div>
    </Card>
  );
}

// The client's money altogether (Moliya, or the coordinator of their case):
// what the contracts come to, what they've given, what's left — and what's
// overdue and the next payment due. Server: routes/clients.js clientMoney.
// With the buttons for adding money right here (`onPay`: a payment;
// `onContract`: the contract amount) — no hunting through the case below.
export function MoneySummaryCard({ money, onPay, onContract }) {
  const { t, fmt } = useI18n();
  const empty = !money || (!money.contract && !money.paid && !money.consultationFees);
  if (!money && !onContract) return null;
  if (empty && !onPay && !onContract) return null;
  const share = money?.contract ? Math.min(100, Math.round((money.paid / money.contract) * 100)) : 0;
  const done = money?.contract > 0 && money.remaining === 0;
  const actions = (onPay || onContract) && (
    <div className={styles.moneyActions}>
      {onPay && (
        <Button size="small" variant="primary" icon="plus" onClick={onPay}>
          {t("clientMoney.addPayment")}
        </Button>
      )}
      {onContract && (
        <Button size="small" icon="edit" onClick={onContract}>
          {money?.contract ? t("clientMoney.changeContract") : t("clientMoney.setContract")}
        </Button>
      )}
    </div>
  );
  if (empty) {
    return (
      <Card title={t("clientMoney.title")} className={styles.moneyCard}>
        <p className={styles.moneyNote}>{t("clientMoney.nothingYet")}</p>
        {actions}
      </Card>
    );
  }
  return (
    <Card title={t("clientMoney.title")} subtitle={money.cases > 1 ? t("clientMoney.cases", { count: money.cases }) : undefined} className={styles.moneyCard}>
      {money.contract > 0 && (
        <>
          <div className={styles.moneyFigures}>
            <div className={styles.moneyFigure}>
              <span className={styles.moneyLabel}>{t("clientMoney.contract")}</span>
              <span className={styles.moneyValue}>{fmt.money(money.contract)}</span>
            </div>
            <div className={styles.moneyFigure}>
              <span className={styles.moneyLabel}>{t("clientMoney.paid")}</span>
              <span className={`${styles.moneyValue} ${styles.moneyGood}`}>{fmt.money(money.paid)}</span>
            </div>
            <div className={styles.moneyFigure}>
              <span className={styles.moneyLabel}>{t("clientMoney.left")}</span>
              <span className={`${styles.moneyValue} ${money.remaining > 0 ? styles.moneyWarn : styles.moneyGood}`}>{fmt.money(money.remaining)}</span>
            </div>
          </div>
          <div className={styles.track} role="img" aria-label={t("clientMoney.share", { share })}>
            <div className={`${styles.fill} ${done ? styles.fillDone : ""}`} style={{ width: `${share}%` }} />
          </div>
          <p className={styles.moneyNote}>{done ? t("clientMoney.allPaid") : t("clientMoney.share", { share })}</p>
        </>
      )}
      <ul className={styles.moneyLines}>
        {money.overdue > 0 && (
          <li className={styles.moneyOverdue}>{t("clientMoney.overdue", { amount: fmt.money(money.overdue), date: fmt.isoDateLong(money.overdueSince) })}</li>
        )}
        {money.next && <li>{t("clientMoney.next", { amount: fmt.money(money.next.left), date: fmt.isoDateLong(money.next.dueDate) })}</li>}
        {money.unscheduled > 0 && money.remaining > 0 && <li>{t("clientMoney.unscheduled", { amount: fmt.money(money.unscheduled) })}</li>}
        {money.consultationFees > 0 && <li>{t("clientMoney.fees", { amount: fmt.money(money.consultationFees) })}</li>}
      </ul>
      {actions}
    </Card>
  );
}

// The top of "Mijozlar" — the cases being worked on: how many, what's
// coming up in them this week (hearings, deadlines…), and who owes.
export function WorkOverviewCard({ overview, onDebt }) {
  const { t, fmt } = useI18n();
  if (!overview) return null;
  return (
    <Card className={styles.overview}>
      <div className={styles.overviewTop}>
        <div className={styles.overviewStat}>
          <span className={styles.overviewNumber}>{fmt.number(overview.active)}</span>
          <span className={styles.overviewLabel}>{t("workOverview.active")}</span>
        </div>
        <div className={styles.overviewStat}>
          <span className={styles.overviewNumber}>{fmt.number(overview.week.length)}</span>
          <span className={styles.overviewLabel}>{t("workOverview.thisWeek")}</span>
        </div>
        {overview.debtors != null && (
          <button type="button" className={`${styles.overviewStat} ${styles.overviewButton}`} onClick={onDebt}>
            <span className={`${styles.overviewNumber} ${overview.debtors ? styles.moneyWarn : ""}`}>{fmt.number(overview.debtors)}</span>
            <span className={styles.overviewLabel}>{t("workOverview.debtors")}</span>
          </button>
        )}
      </div>
      {overview.week.length > 0 && (
        <ul className={styles.weekList}>
          {overview.week.slice(0, 6).map((d) => (
            <li key={d.id}>
              <Link to={`/clients/${d.clientId}`} className={styles.weekItem}>
                <span className={styles.weekWhen}>
                  {fmt.isoDay(d.date)}
                  {d.time != null ? `, ${fmt.minutes(d.time)}` : ""}
                </span>
                <span className={styles.weekWhat}>
                  {d.title || t(`caseWork.kinds.${d.kind || "other"}`)} · <strong>{d.clientName}</strong>
                </span>
              </Link>
            </li>
          ))}
          {overview.week.length > 6 && <li className={styles.weekMore}>{t("workOverview.more", { count: overview.week.length - 6 })}</li>}
        </ul>
      )}
    </Card>
  );
}
