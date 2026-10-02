import styles from "./Clients.module.css";
import Card from "../ui/Card";
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
