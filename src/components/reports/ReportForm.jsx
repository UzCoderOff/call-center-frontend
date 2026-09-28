import { useState } from "react";
import styles from "./Reports.module.css";
import Button from "../ui/Button";
import { Chips, TextAreaField, TextField } from "../ui/Field";
import { useI18n } from "../../i18n";

const filled = (v) => v !== undefined && v !== null && String(v).trim() !== "";

function isEmpty(field, value) {
  if (value === undefined || value === null) return true;
  if (field.type === "yesno") return typeof value !== "boolean";
  if (field.type === "checklist") return !Array.isArray(value) || value.length === 0;
  if (field.type === "table") return !Array.isArray(value) || !value.some((row) => row && Object.values(row).some(filled));
  return String(value).trim() === "";
}

const asNumber = (v) => {
  const n = Number(String(v ?? "").replace(/[\s ]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// A table question: rows the person adds (like lines in Excel), one input
// per column, with the number/money columns added up underneath.
function TableInput({ field, value, onChange, disabled }) {
  const { t, fmt } = useI18n();
  const rows = Array.isArray(value) && value.length > 0 ? value : [{}];
  const numeric = field.columns.filter((c) => c.type === "number" || c.type === "money");
  const setCell = (i, id, v) => onChange(rows.map((row, j) => (j === i ? { ...row, [id]: v } : row)));
  const remove = (i) => onChange(rows.length > 1 ? rows.filter((_, j) => j !== i) : [{}]);

  function cell(column, row, i) {
    const common = { value: row[column.id] ?? "", disabled, "aria-label": column.label, className: styles.cellInput };
    if (column.type === "select") {
      return (
        <select {...common} onChange={(e) => setCell(i, column.id, e.target.value)}>
          <option value="">—</option>
          {column.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    }
    if (column.type === "money") return <input {...common} inputMode="numeric" onChange={(e) => setCell(i, column.id, e.target.value.replace(/[^\d\s]/g, ""))} />;
    if (column.type === "number") return <input {...common} inputMode="decimal" onChange={(e) => setCell(i, column.id, e.target.value)} />;
    return <input {...common} onChange={(e) => setCell(i, column.id, e.target.value)} />;
  }

  const cols = `repeat(${field.columns.length}, minmax(0, 1fr)) 36px`;
  return (
    <div className={styles.tableInput}>
      <div className={styles.tableHead} style={{ gridTemplateColumns: cols }}>
        {field.columns.map((c) => (
          <span key={c.id}>{c.label}</span>
        ))}
        <span />
      </div>
      {rows.map((row, i) => (
        <div key={i} className={styles.tableRow} style={{ gridTemplateColumns: cols }}>
          {field.columns.map((c) => (
            <label key={c.id} className={styles.tableCell}>
              <span className={styles.cellLabel}>{c.label}</span>
              {cell(c, row, i)}
            </label>
          ))}
          <button type="button" className={styles.rowRemove} onClick={() => remove(i)} disabled={disabled} aria-label={t("reports.removeRow")} title={t("reports.removeRow")}>
            ×
          </button>
        </div>
      ))}
      <div className={styles.tableFoot}>
        <Button size="small" icon="plus" onClick={() => onChange([...rows, {}])} disabled={disabled}>
          {t("reports.addRow")}
        </Button>
        {numeric.length > 0 && (
          <span className={styles.tableTotals}>
            {numeric
              .map((c) => {
                const total = rows.reduce((s, r) => s + asNumber(r[c.id]), 0);
                return `${c.label}: ${c.type === "money" ? fmt.money(total) : fmt.number(total)}`;
              })
              .join(" · ")}
          </span>
        )}
      </div>
    </div>
  );
}

// Renders any report form from its question list — the same component is
// the employee's daily form and the live preview in the form builder.
export default function ReportForm({ fields, initialAnswers, onSubmit, submitLabel, preview = false, serverErrors }) {
  const { t } = useI18n();
  const [answers, setAnswers] = useState(() => ({ ...(initialAnswers || {}) }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const shownErrors = { ...(serverErrors || {}), ...errors };
  const set = (id) => (value) => {
    setAnswers((a) => ({ ...a, [id]: value }));
    setErrors((e) => ({ ...e, [id]: undefined }));
  };

  async function submit(e) {
    e.preventDefault();
    if (preview) return;
    const missing = {};
    for (const f of fields) if (f.required && isEmpty(f, answers[f.id])) missing[f.id] = "required";
    setErrors(missing);
    if (Object.keys(missing).length > 0) {
      setFormError(t("reports.fixErrors"));
      return;
    }
    setFormError("");
    setBusy(true);
    try {
      await onSubmit(answers);
    } catch (err) {
      if (err?.body?.fields) {
        setErrors(err.body.fields);
        setFormError(t("reports.fixErrors"));
      } else {
        setFormError(t("reports.sendFailed"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={styles.form} noValidate>
      {fields.map((field) => (
        <FieldInput
          key={field.id}
          field={field}
          value={answers[field.id]}
          onChange={set(field.id)}
          error={shownErrors[field.id]}
          // The builder's preview can be tried out (rows added, choices
          // picked) — it just has no Send button.
          disabled={false}
        />
      ))}
      {formError && <p className={styles.formError}>{formError}</p>}
      {!preview && (
        <Button type="submit" variant="primary" size="large" block busy={busy}>
          {busy ? t("reports.sending") : submitLabel || t("reports.send")}
        </Button>
      )}
    </form>
  );
}

function FieldLabel({ field }) {
  const { t } = useI18n();
  return (
    <span className={styles.label}>
      {field.label}
      {field.required && (
        <span className={styles.required} title={t("reports.requiredMark")}>
          {" "}
          *
        </span>
      )}
    </span>
  );
}

function FieldInput({ field, value, onChange, error, disabled }) {
  const { t } = useI18n();
  const errorText = error === "required" ? t("reports.required") : error ? t("reports.invalid") : null;

  let control;
  switch (field.type) {
    case "textarea":
      control = <TextAreaField value={value ?? ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} />;
      break;
    case "number":
      control = (
        <TextField
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          disabled={disabled}
        />
      );
      break;
    case "money":
      control = (
        <div className={styles.money}>
          <TextField
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value.replace(/[^\d\s]/g, ""))}
            inputMode="numeric"
            disabled={disabled}
          />
          <span className={styles.currency}>{t("reports.soum")}</span>
        </div>
      );
      break;
    case "yesno": {
      const yes = t("reports.yes");
      const no = t("reports.no");
      control = (
        <Chips
          options={[yes, no]}
          value={value === true ? yes : value === false ? no : null}
          onChange={(v) => onChange(v === yes ? true : v === no ? false : null)}
          disabled={disabled}
        />
      );
      break;
    }
    case "select":
      control = <Chips options={field.options} value={value ?? null} onChange={onChange} disabled={disabled} />;
      break;
    case "checklist":
      control = <Chips multiple options={field.options} value={value ?? []} onChange={onChange} disabled={disabled} />;
      break;
    case "table":
      control = <TableInput field={field} value={value} onChange={onChange} disabled={disabled} />;
      break;
    default:
      control = <TextField value={value ?? ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} />;
  }

  return (
    <div className={`${styles.question} ${errorText ? styles.hasError : ""}`}>
      <FieldLabel field={field} />
      {field.hint && <span className={styles.hint}>{field.hint}</span>}
      {control}
      {errorText && <span className={styles.error}>{errorText}</span>}
    </div>
  );
}
