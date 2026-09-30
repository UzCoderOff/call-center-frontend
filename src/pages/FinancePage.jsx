import { useSearchParams } from "react-router-dom";
import pageStyles from "./Pages.module.css";
import styles from "../components/finance/Finance.module.css";
import Button from "../components/ui/Button";
import Segmented from "../components/ui/Segmented";
import { AsyncBoundary, PageHeader } from "../components/ui/Misc";
import FinanceOverview from "../components/finance/FinanceOverview";
import FinanceConsultations from "../components/finance/FinanceConsultations";
import { FinanceContracts, FinanceDebts } from "../components/finance/FinanceContracts";
import FinanceEntries from "../components/finance/FinanceEntries";
import FinanceCash from "../components/finance/FinanceCash";
import { useAuth, isManagerRole } from "../hooks/useAuth";
import { shiftMonth, useMonthLabel } from "../components/finance/parts";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

// Moliya — the firm's money, for the developer and the accounts given the
// "Moliya" switch (the head of the firm). A month at a time, in tabs: the
// overview (where the money came from), consultations, contracts, debts,
// and every entry the figures are made of. Each figure says how it's
// counted (server: src/services/financeReport.js). Nobody else can open it;
// the server refuses them too.

const TABS = ["overview", "consultations", "contracts", "debts", "cash", "entries"];

export default function FinancePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const month = params.get("month"); // null: this month
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "overview";
  const state = useAsync(() => api.finance(month || undefined), [month]);
  const monthLabel = useMonthLabel();

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };

  return (
    <div>
      <PageHeader title={t("finance.title")} subtitle={t("finance.subtitle")} />
      <AsyncBoundary state={state}>
        {(data) => (
          <div className={pageStyles.stack}>
            <div className={styles.topBar}>
              <div className={styles.monthBar}>
                <Button icon="chevronLeft" onClick={() => update({ month: shiftMonth(data.month, -1) })} aria-label={t("finance.prevMonth")} />
                <span className={styles.monthLabel}>{monthLabel(data.month)}</span>
                <Button
                  icon="chevronRight"
                  onClick={() => update({ month: shiftMonth(data.month, 1) === data.current ? null : shiftMonth(data.month, 1) })}
                  disabled={data.month >= data.current}
                  aria-label={t("finance.nextMonth")}
                />
              </div>
              <Segmented
                wrap
                value={tab}
                onChange={(value) => update({ tab: value === "overview" ? null : value })}
                label={t("finance.title")}
                // Kassa: the boss and the developer (not a lawyer's own view).
                options={TABS.filter((v) => v !== "cash" || (data.scope === "firm" && isManagerRole(user.role))).map((value) => ({ value, label: t(`finance.tabs.${value}`) }))}
              />
              <Button size="small" icon="download" href={api.financeExportUrl(data.month)}>
                {t("finance.export")}
              </Button>
            </div>
            {data.scope === "lawyer" && <p className={pageStyles.note}>{t("finance.lawyerScope")}</p>}
            {tab === "overview" && <FinanceOverview data={data} />}
            {tab === "consultations" && <FinanceConsultations data={data} />}
            {tab === "contracts" && <FinanceContracts data={data} />}
            {tab === "debts" && <FinanceDebts data={data} />}
            {tab === "entries" && <FinanceEntries data={data} />}
            {tab === "cash" && data.scope === "firm" && isManagerRole(user.role) && <FinanceCash />}
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}
