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
      case "table":
        return <AnswerTable field={field} rows={value} />;
      default:
        return <span className={styles.longText}>{String(value)}</span>;
    }
  }

  return (
    <dl className={styles.answers}>
      {fields.map((field) => (
        // A table takes the full width, under its question.
        <div key={field.id} className={styles.answerRow} style={field.type === "table" ? { gridTemplateColumns: "minmax(0, 1fr)" } : undefined}>
          <dt>{field.label}</dt>
          <dd>{render(field, answers?.[field.id])}</dd>
        </div>
      ))}
    </dl>
  );
}

// A table answer: its rows, and the number/money columns added up.
export function AnswerTable({ field, rows }) {
  const { fmt } = useI18n();
  const numeric = (c) => c.type === "number" || c.type === "money";
  const show = (c, v) => (v === undefined || v === null || v === "" ? "—" : c.type === "money" ? fmt.money(v) : c.type === "number" ? fmt.number(v) : v);
  const hasNumbers = field.columns.some(numeric);
  return (
    <div className={styles.answerTableWrap}>
      <table className={styles.answerTable}>
        <thead>
          <tr>
            {field.columns.map((c) => (
              <th key={c.id} className={numeric(c) ? styles.num : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {field.columns.map((c) => (
                <td key={c.id} className={numeric(c) ? styles.num : undefined}>
                  {show(c, row[c.id])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {hasNumbers && rows.length > 1 && (
          <tfoot>
            <tr>
              {field.columns.map((c, j) => (
                <td key={c.id} className={numeric(c) ? styles.num : undefined}>
                  {numeric(c) ? show(c, rows.reduce((s, r) => s + (Number(r[c.id]) || 0), 0)) : j === 0 ? "Σ" : ""}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
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
