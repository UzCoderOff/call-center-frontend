import styles from "./Segmented.module.css";

// iOS-style segmented control. options: [{ value, label }]
export default function Segmented({ options, value, onChange, label, full = false, size = "medium" }) {
  function onKeyDown(e) {
    const index = options.findIndex((o) => o.value === value);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = (index + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
      onChange(options[next].value);
    }
  }

  return (
    <div className={`${styles.scroller} ${full ? styles.full : ""}`}>
      <div className={`${styles.segmented} ${styles[size]}`} role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              className={`${styles.item} ${selected ? styles.selected : ""}`}
              onClick={() => onChange(o.value)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
