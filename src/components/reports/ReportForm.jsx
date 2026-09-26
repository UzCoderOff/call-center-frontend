import { useState } from "react";
import styles from "./Reports.module.css";
import Button from "../ui/Button";
import { Chips, TextAreaField, TextField } from "../ui/Field";
import { useI18n } from "../../i18n";

function isEmpty(field, value) {
  if (value === undefined || value === null) return true;
  if (field.type === "yesno") return typeof value !== "boolean";
  if (field.type === "checklist") return !Array.isArray(value) || value.length === 0;
  return String(value).trim() === "";
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
          disabled={preview}
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
