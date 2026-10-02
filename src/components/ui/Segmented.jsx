import styles from "./Segmented.module.css";

// iOS-style segmented control. options: [{ value, label }]. When the options
// don't fit, the row scrolls sideways — or, with `wrap`, continues on a
// second row so none is hidden.
export default function Segmented({ options, value, onChange, label, full = false, wrap = false, size = "medium" }) {
  function onKeyDown(e) {
    const index = options.findIndex((o) => o.value === value);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = (index + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
      onChange(options[next].value);
    }
  }

  return (
    <div className={`${styles.scroller} ${full ? styles.full : ""} ${wrap ? styles.wrap : ""}`}>
      <div className={`${styles.segmented} ${styles[size]}`} role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
        {options.map((o, i) => {
          const selected = o.value === value;
          // Nothing chosen yet: the first one takes the keyboard focus.
          const focusable = selected || (i === 0 && !options.some((x) => x.value === value));
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={focusable ? 0 : -1}
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
