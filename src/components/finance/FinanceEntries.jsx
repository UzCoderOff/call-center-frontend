import { useState } from "react";
import styles from "./Finance.module.css";
import pageStyles from "../../pages/Pages.module.css";
import Card from "../ui/Card";
import Icon from "../ui/Icon";
import Segmented from "../ui/Segmented";
import { List, ListRow } from "../ui/List";
import { EmptyState } from "../ui/Misc";
import { useI18n } from "../../i18n";

// Moliya → Barcha yozuvlar: every amount the month's figures are made of —
// client payments (open the client) and report money (open the report).
export default function FinanceEntries({ data }) {
  const { t, fmt } = useI18n();
  const firm = data.scope === "firm";
  const [show, setShow] = useState("all");

  const payments = data.payments.map((p) => ({ type: "payment", date: p.date, amount: p.amount, p }));
  const reports = data.reportEntries.map((e) => ({ type: e.kind, date: e.date, amount: e.amount, e }));
  const rows = [...payments, ...reports]
    .filter((r) => show === "all" || (show === "clients" ? r.type === "payment" : r.type === show))
    .sort((a, b) => (a.date === b.date ? b.amount - a.amount : a.date < b.date ? 1 : -1));

  return (
    <div className={pageStyles.stack}>
      {firm && (
        <Segmented
          wrap
          value={show}
          onChange={setShow}
          label={t("finance.e.filter")}
          options={[
            { value: "all", label: t("finance.e.all") },
            { value: "clients", label: t("finance.e.clients") },
            { value: "income", label: t("finance.e.reportIncome") },
            { value: "expense", label: t("finance.e.expenses") },
          ]}
        />
      )}
      <Card flush title={t("finance.e.title")} subtitle={t("finance.e.count", { count: rows.length })}>
        {rows.length === 0 ? (
          <EmptyState icon="cash" text={t("finance.noPayments")} />
        ) : (
          <List plain inset={52}>
            {rows.map((r, i) =>
              r.type === "payment" ? (
                <ListRow
                  key={`p${r.p.id}`}
                  to={`/clients/${r.p.client.id}`}
                  leading={<Icon name="cash" size={20} />}
                  title={r.p.client.name}
                  subtitle={[
                    fmt.isoDateLong(r.p.date),
                    r.p.kind ? t(`payments.kinds.${r.p.kind}`) : null,
                    r.p.format === "online" ? t("calendar.format.online") : null,
                    r.p.method ? t(`payments.methods.${r.p.method}`) : t("finance.methodNone"),
                    r.p.lawyer,
                    r.p.recordedBy ? t("finance.recordedBy", { name: r.p.recordedBy }) : null,
                    r.p.note,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  trailing={<strong>{fmt.money(r.p.amount)}</strong>}
                />
              ) : (
                <ListRow
                  key={`r${r.e.reportId}-${i}`}
                  to={`/reports/${r.e.reportId}`}
                  leading={<Icon name={r.type === "income" ? "clipboard" : "minusCircle"} size={20} />}
                  title={[r.e.column ? `${r.e.label} → ${r.e.column}` : r.e.label, r.e.service].filter(Boolean).join(" · ")}
                  subtitle={[fmt.isoDateLong(r.e.date), r.e.person, r.e.form, t(r.type === "income" ? "finance.e.fromReport" : "finance.e.expense")].filter(Boolean).join(" · ")}
                  trailing={<strong className={r.type === "expense" ? styles.expenseAmount : undefined}>{`${r.type === "expense" ? "−" : ""}${fmt.money(r.amount)}`}</strong>}
                />
              )
            )}
          </List>
        )}
      </Card>
    </div>
  );
}
