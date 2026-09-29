import { useState } from "react";
import pageStyles from "./Pages.module.css";
import styles from "./FinancePage.module.css";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Icon from "../components/ui/Icon";
import { List, ListRow } from "../components/ui/List";
import { AsyncBoundary, EmptyState, PageHeader, StatTile } from "../components/ui/Misc";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

// Moliya — the money from clients, for the developer and the accounts given
// the "Moliya" switch (the head of the firm). A month at a time: what came
// in, contracts signed, who still owes, per lawyer, and every payment.
// Nobody else can open it; the server refuses them too.

function shiftMonth(month, by) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

function useMonthLabel() {
  const { t } = useI18n();
  const months = t("time.months");
  return (month) => {
    const [y, m] = month.split("-").map(Number);
    const name = Array.isArray(months) ? months[m - 1] : String(m);
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
  };
}

export default function FinancePage() {
  const { t } = useI18n();
  const [month, setMonth] = useState(null); // null: this month
  const state = useAsync(() => api.finance(month || undefined), [month]);
  const monthLabel = useMonthLabel();

  return (
    <div>
      <PageHeader title={t("finance.title")} subtitle={t("finance.subtitle")} />
      <AsyncBoundary state={state}>
        {(data) => (
          <div className={pageStyles.stack}>
            <div className={styles.monthBar}>
              <Button icon="chevronLeft" onClick={() => setMonth(shiftMonth(data.month, -1))} aria-label={t("finance.prevMonth")} />
              <span className={styles.monthLabel}>{monthLabel(data.month)}</span>
              <Button
                icon="chevronRight"
                onClick={() => setMonth(shiftMonth(data.month, 1) === data.current ? null : shiftMonth(data.month, 1))}
                disabled={data.month >= data.current}
                aria-label={t("finance.nextMonth")}
              />
            </div>
            <Overview data={data} />
            <div className={styles.columns}>
              <div className={pageStyles.stack}>
                <Trend data={data} monthLabel={monthLabel} />
                <ByLawyer data={data} />
                <Owed data={data} />
              </div>
              <Payments data={data} />
            </div>
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}

function Overview({ data }) {
  const { t, fmt } = useI18n();
  const methods = Object.entries(data.received.byMethod).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <div className={styles.tiles}>
        <StatTile label={t("finance.received")} value={fmt.money(data.received.total)} sub={t("finance.paymentsCount", { count: data.received.count })} dot="var(--good)" />
        <StatTile label={t("finance.contracted")} value={fmt.money(data.contracted.total)} sub={t("finance.contractsCount", { count: data.contracted.count })} dot="var(--accent)" />
        <StatTile label={t("finance.owed")} value={fmt.money(data.owed.total)} sub={t("finance.owedClients", { count: data.owed.clients })} dot="var(--warning)" />
      </div>
      {methods.length > 0 && (
        <p className={pageStyles.note}>
          {methods.map(([method, amount]) => `${method === "none" ? t("finance.methodNone") : t(`payments.methods.${method}`)}: ${fmt.money(amount)}`).join(" · ")}
        </p>
      )}
    </>
  );
}

// Six months of income as plain bars with the amount written next to each.
function Trend({ data, monthLabel }) {
  const { t, fmt } = useI18n();
  const max = Math.max(1, ...data.trend.map((m) => m.received));
  return (
    <Card title={t("finance.trendTitle")} subtitle={t("finance.trendSubtitle")}>
      <div className={styles.bars}>
        {data.trend.map((m) => (
          <div key={m.month} className={`${styles.barRow} ${m.month === data.month ? styles.barCurrent : ""}`}>
            <span className={styles.barLabel}>{monthLabel(m.month)}</span>
            <span className={styles.barTrack} aria-hidden="true">
              <span className={styles.barFill} style={{ width: `${(m.received / max) * 100}%` }} />
            </span>
            <span className={styles.barValue}>{fmt.money(m.received)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ByLawyer({ data }) {
  const { t, fmt } = useI18n();
  if (data.lawyers.length === 0) return null;
  return (
    <Card flush title={t("finance.byLawyer")}>
      <List plain inset={16}>
        {data.lawyers.map((l) => (
          <ListRow
            key={l.lawyer || "-"}
            title={l.lawyer || t("finance.noLawyer")}
            subtitle={[
              t("finance.lawyerContracts", { count: l.contracts, amount: fmt.money(l.contracted) }),
              t("finance.lawyerReceived", { amount: fmt.money(l.received) }),
              l.owed > 0 ? t("finance.lawyerOwed", { amount: fmt.money(l.owed) }) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        ))}
      </List>
    </Card>
  );
}

function Owed({ data }) {
  const { t, fmt } = useI18n();
  return (
    <Card flush title={t("finance.owedTitle")} subtitle={t("finance.owedSubtitle")}>
      {data.owed.top.length === 0 ? (
        <EmptyState icon="checkCircle" text={t("finance.nobodyOwes")} />
      ) : (
        <List plain inset={16}>
          {data.owed.top.map((c) => (
            <ListRow
              key={c.client.id}
              to={`/clients/${c.client.id}`}
              title={c.client.name}
              subtitle={[c.lawyers.join(", "), c.client.archived ? t("finance.archived") : null].filter(Boolean).join(" · ") || undefined}
              trailing={<strong className={styles.owedAmount}>{fmt.money(c.owed)}</strong>}
            />
          ))}
        </List>
      )}
    </Card>
  );
}

function Payments({ data }) {
  const { t, fmt } = useI18n();
  return (
    <Card flush title={t("finance.paymentsTitle")} subtitle={t("finance.paymentsCount", { count: data.received.count })}>
      {data.payments.length === 0 ? (
        <EmptyState icon="cash" text={t("finance.noPayments")} />
      ) : (
        <List plain inset={52}>
          {data.payments.map((p) => (
            <ListRow
              key={p.id}
              to={`/clients/${p.client.id}`}
              leading={<Icon name="cash" size={20} />}
              title={p.client.name}
              subtitle={[
                fmt.isoDateLong(p.date),
                p.kind ? t(`payments.kinds.${p.kind}`) : null,
                p.method ? t(`payments.methods.${p.method}`) : null,
                p.lawyer,
                p.recordedBy ? t("finance.recordedBy", { name: p.recordedBy }) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              trailing={<strong>{fmt.money(p.amount)}</strong>}
            />
          ))}
        </List>
      )}
    </Card>
  );
}
