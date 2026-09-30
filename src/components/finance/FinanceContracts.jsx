import styles from "./Finance.module.css";
import pageStyles from "../../pages/Pages.module.css";
import Card from "../ui/Card";
import { List, ListRow } from "../ui/List";
import { EmptyState, StatTile } from "../ui/Misc";
import { MeterRow, Table, percent } from "./parts";
import { useI18n } from "../../i18n";

// Moliya → Shartnomalar: contracts signed this month — how much, paid so
// far, what's left — and per lawyer.
export function FinanceContracts({ data }) {
  const { t, fmt } = useI18n();
  const k = data.contracts;
  const paid = k.list.reduce((s, c) => s + c.paid, 0);
  return (
    <div className={pageStyles.stack}>
      <div className={styles.tiles}>
        <StatTile label={t("finance.k.count")} value={fmt.number(k.count)} sub={t("finance.k.countSub")} dot="var(--series-contract)" />
        <StatTile label={t("finance.k.total")} value={fmt.money(k.total)} sub={t("finance.k.average", { amount: fmt.money(k.average) })} dot="var(--accent)" />
        <StatTile label={t("finance.k.paid")} value={fmt.money(paid)} sub={t("finance.k.paidSub", { percent: percent(paid, k.total) })} dot="var(--good)" />
        <StatTile label={t("finance.k.left")} value={fmt.money(Math.max(0, k.total - paid))} sub={t("finance.k.leftSub")} dot="var(--warning)" />
      </div>

      <Card flush title={t("finance.k.listTitle")} subtitle={t("finance.k.listSubtitle")}>
        {k.list.length === 0 ? (
          <EmptyState icon="briefcase" text={t("finance.k.empty")} />
        ) : (
          <List plain inset={16}>
            {k.list.map((c) => (
              <ListRow
                key={c.caseId}
                to={`/clients/${c.client.id}`}
                title={c.client.name}
                subtitle={[fmt.isoDateLong(c.date), c.lawyer, c.matter].filter(Boolean).join(" · ")}
                footer={<Progress paid={c.paid} amount={c.amount} />}
                trailing={<strong>{fmt.money(c.amount)}</strong>}
              />
            ))}
          </List>
        )}
      </Card>

      <Card title={t("finance.k.byLawyerTitle")}>
        <Table
          empty={t("finance.lawyersEmpty")}
          head={[t("finance.col.lawyer"), t("finance.col.contracts"), t("finance.col.contractPayments"), t("finance.col.owed")]}
          rows={data.lawyers
            .filter((l) => l.contracts || l.contractPayments || l.owed)
            .map((l) => [
              <strong key="n">{l.lawyer || t("finance.noLawyer")}</strong>,
              l.contracts ? t("finance.cell.contracts", { count: l.contracts, amount: fmt.money(l.contracted) }) : "—",
              l.contractPayments ? fmt.money(l.contractPayments) : "—",
              l.owed ? fmt.money(l.owed) : "—",
            ])}
        />
      </Card>
    </div>
  );
}

// "Paid 3 000 000 of 10 000 000 · 7 000 000 left" with a thin bar.
function Progress({ paid, amount }) {
  const { t, fmt } = useI18n();
  const left = Math.max(0, amount - paid);
  return (
    <span className={styles.progress}>
      <span className={styles.progressTrack} aria-hidden="true">
        <span className={styles.progressFill} style={{ width: `${Math.min(100, percent(paid, amount))}%` }} />
      </span>
      <span className={styles.progressText}>
        {left > 0 ? t("finance.k.progress", { paid: fmt.money(paid), left: fmt.money(left) }) : t("finance.k.progressDone", { paid: fmt.money(paid) })}
      </span>
    </span>
  );
}

// Moliya → Qarzlar: what clients still owe on contracts, by how old the
// contract is, and who owes most.
export function FinanceDebts({ data }) {
  const { t, fmt } = useI18n();
  const o = data.owed;
  const buckets = ["d30", "d90", "d180", "older", "noDate"].map((key) => ({ key, ...o.aging[key] }));
  const max = Math.max(0, ...buckets.map((b) => b.amount));
  return (
    <div className={pageStyles.stack}>
      <div className={styles.tiles}>
        <StatTile label={t("finance.owed")} value={fmt.money(o.total)} sub={t("finance.owedClients", { count: o.clients })} dot="var(--warning)" />
        <StatTile
          label={t("finance.d.overdue")}
          value={fmt.money(o.plan.overdue)}
          sub={o.plan.overdueCases ? t("finance.d.overdueSub", { n: o.plan.overdueCases }) : t("finance.d.overdueNone")}
          dot="var(--critical)"
        />
        <StatTile label={t("finance.d.soon")} value={fmt.money(o.plan.dueSoon)} sub={t("finance.d.soonSub")} dot="var(--warning)" />
        <StatTile label={t("finance.d.later")} value={fmt.money(o.plan.later)} sub={t("finance.d.laterSub")} dot="var(--accent)" />
        <StatTile label={t("finance.d.unscheduled")} value={fmt.money(o.plan.unscheduled)} sub={t("finance.d.unscheduledSub")} dot="var(--neutral)" />
      </div>

      <Card flush title={t("finance.d.overdueTitle")} subtitle={t("finance.d.overdueSubtitle")}>
        {o.overdueList.length === 0 ? (
          <EmptyState icon="checkCircle" text={t("finance.d.overdueEmpty")} />
        ) : (
          <List plain inset={16}>
            {o.overdueList.map((x) => (
              <ListRow
                key={x.caseId}
                to={`/clients/${x.client.id}`}
                title={x.client.name}
                subtitle={[
                  x.lawyer,
                  t("finance.d.lateSince", { date: fmt.isoDateLong(x.since), days: x.daysLate }),
                  x.next ? t("finance.d.nextDue", { date: fmt.isoDateLong(x.next.dueDate), amount: fmt.money(x.next.left) }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                trailing={<strong className={styles.expenseAmount}>{fmt.money(x.amount)}</strong>}
              />
            ))}
          </List>
        )}
      </Card>

      {o.soonList.length > 0 && (
        <Card flush title={t("finance.d.soonTitle")} subtitle={t("finance.d.soonSubtitle")}>
          <List plain inset={16}>
            {o.soonList.map((x, i) => (
              <ListRow
                key={`${x.caseId}-${i}`}
                to={`/clients/${x.client.id}`}
                title={x.client.name}
                subtitle={[fmt.isoDateLong(x.dueDate), x.lawyer].filter(Boolean).join(" · ")}
                trailing={<strong>{fmt.money(x.amount)}</strong>}
              />
            ))}
          </List>
        </Card>
      )}

      <Card title={t("finance.d.agingTitle")} subtitle={t("finance.d.agingSubtitle")}>
        {o.total === 0 ? (
          <p className={styles.emptyNote}>{t("finance.nobodyOwes")}</p>
        ) : (
          <div className={styles.meters}>
            {buckets
              .filter((b) => b.count > 0 || b.key !== "noDate")
              .map((b) => (
                <MeterRow key={b.key} label={t(`finance.d.aging.${b.key}`)} amount={b.amount} max={max} sub={t("finance.d.contracts", { count: b.count })} />
              ))}
          </div>
        )}
      </Card>

      <Card flush title={t("finance.d.topTitle")} subtitle={t("finance.d.topSubtitle")}>
        {o.top.length === 0 ? (
          <EmptyState icon="checkCircle" text={t("finance.nobodyOwes")} />
        ) : (
          <List plain inset={16}>
            {o.top.map((c) => (
              <ListRow
                key={c.client.id}
                to={`/clients/${c.client.id}`}
                title={c.client.name}
                subtitle={[
                  c.lawyers.join(", "),
                  c.since ? t("finance.d.since", { date: fmt.isoDateLong(c.since) }) : null,
                  c.lastPayment ? t("finance.d.lastPayment", { date: fmt.isoDateLong(c.lastPayment) }) : t("finance.d.neverPaid"),
                  c.client.archived ? t("finance.archived") : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                footer={<span className={styles.muted}>{t("finance.d.paidOf", { paid: fmt.money(c.paid), amount: fmt.money(c.contracted) })}</span>}
                trailing={<strong className={styles.owedAmount}>{fmt.money(c.owed)}</strong>}
              />
            ))}
          </List>
        )}
      </Card>
    </div>
  );
}
