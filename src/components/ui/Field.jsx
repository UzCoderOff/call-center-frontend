import { useId } from "react";
import styles from "./Field.module.css";
import Icon from "./Icon";

export function TextField({ label, hint, className = "", ...inputProps }) {
  const id = useId();
  return (
    <label className={`${styles.field} ${className}`} htmlFor={id}>
      {label && <span className={styles.label}>{label}</span>}
      <input id={id} className={styles.input} {...inputProps} />
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}

export function SelectField({ label, hint, children, className = "", ...selectProps }) {
  const id = useId();
  return (
    <label className={`${styles.field} ${className}`} htmlFor={id}>
      {label && <span className={styles.label}>{label}</span>}
      <span className={styles.selectWrap}>
        <select id={id} className={`${styles.input} ${styles.select}`} {...selectProps}>
          {children}
        </select>
        <Icon name="chevronDown" size={16} className={styles.selectIcon} />
      </span>
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}

export function TextAreaField({ label, hint, className = "", ...props }) {
  const id = useId();
  return (
    <label className={`${styles.field} ${className}`} htmlFor={id}>
      {label && <span className={styles.label}>{label}</span>}
      <textarea id={id} className={`${styles.input} ${styles.textarea}`} rows={3} {...props} />
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}

// iOS-style on/off switch with its label (and optional explanation) on the left.
export function Switch({ label, hint, checked, onChange, disabled }) {
  const id = useId();
  return (
    <div className={styles.switchRow}>
      <label htmlFor={id} className={styles.switchText}>
        <span className={styles.switchLabel}>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={`${styles.switch} ${checked ? styles.switchOn : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.knob} />
      </button>
    </div>
  );
}

// Tappable choices — one (`multiple` false) or several. Big targets for phones.
export function Chips({ options, value, onChange, multiple = false, disabled }) {
  const selected = multiple ? value || [] : value;
  const isOn = (o) => (multiple ? selected.includes(o) : selected === o);
  function toggle(o) {
    if (multiple) onChange(isOn(o) ? selected.filter((x) => x !== o) : [...selected, o]);
    else onChange(isOn(o) ? null : o);
  }
  return (
    <div className={styles.chips} role={multiple ? "group" : "radiogroup"}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role={multiple ? "checkbox" : "radio"}
          aria-checked={isOn(o)}
          disabled={disabled}
          className={`${styles.chip} ${isOn(o) ? styles.chipOn : ""}`}
          onClick={() => toggle(o)}
        >
          {multiple && isOn(o) && <Icon name="check" size={14} strokeWidth={2.4} />}
          {o}
        </button>
      ))}
    </div>
  );
}

export function SearchField({ className = "", ...inputProps }) {
  return (
    <span className={`${styles.search} ${className}`}>
      <Icon name="search" size={16} className={styles.searchIcon} />
      <input type="search" className={`${styles.input} ${styles.searchInput}`} {...inputProps} />
    </span>
  );
}
