import styles from "./Reports.module.css";
import Badge from "../ui/Badge";
import { useI18n } from "../../i18n";

// A submitted report, read-only. Uses the question snapshot stored with the
// report, so it reads correctly even after the form was edited.
export default function ReportAnswers({ fields, answers }) {
  const { t, fmt } = useI18n();

  function render(field, value) {
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
      return <span className={styles.empty}>—</span>;
    }
    switch (field.type) {
      case "money":
        return `${fmt.number(value)} ${t("reports.soum")}`;
      case "number":
        return fmt.number(value);
      case "yesno":
        // Neutral either way: whether "yes" is good depends on the question
        // ("Any problems?" vs "Called everyone back?").
        return (
          <Badge tone="neutral" icon={value ? "check" : "minusCircle"}>
            {value ? t("reports.yes") : t("reports.no")}
          </Badge>
        );
      case "checklist":
        return (
          <span className={styles.answerChips}>
            {value.map((v) => (
              <span key={v} className={styles.answerChip}>
                {v}
              </span>
            ))}
          </span>
        );
      default:
        return <span className={styles.longText}>{String(value)}</span>;
    }
  }

  return (
    <dl className={styles.answers}>
      {fields.map((field) => (
        <div key={field.id} className={styles.answerRow}>
          <dt>{field.label}</dt>
          <dd>{render(field, answers?.[field.id])}</dd>
        </div>
      ))}
    </dl>
  );
}

// "Submitted" / "Reviewed" / "Not submitted" — icon + label, never colour alone.
export function ReportStatusBadge({ report }) {
  const { t } = useI18n();
  if (!report) {
    return (
      <Badge tone="critical" icon="alertCircle">
        {t("reports.notSubmitted")}
      </Badge>
    );
  }
  if (report.reviewedAt) {
    return (
      <Badge tone="good" icon="checkCircle">
        {t("reports.reviewed")}
      </Badge>
    );
  }
  return (
    <Badge tone="accent" icon="check">
      {t("reports.submitted")}
    </Badge>
  );
}
