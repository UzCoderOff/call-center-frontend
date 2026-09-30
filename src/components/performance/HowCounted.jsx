import styles from "./Performance.module.css";
import Card from "../ui/Card";
import { useI18n } from "../../i18n";

// "How is this counted?" — every figure on the performance pages explained.
export default function HowCounted({ finance }) {
  const { t } = useI18n();
  const points = ["office", "calls", "booked", "consultations", "conversion", "pace", ...(finance ? ["brought", "cost"] : ["fees"]), "taken", "reports", "tasks"];
  return (
    <Card>
      <details className={styles.how}>
        <summary>{t("perf.how.title")}</summary>
        <ul>
          {points.map((p) => (
            <li key={p}>{t(`perf.how.${p}`)}</li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
