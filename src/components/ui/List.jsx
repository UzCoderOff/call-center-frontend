import { Link } from "react-router-dom";
import styles from "./List.module.css";
import Icon from "./Icon";

// iOS-style inset grouped list. Rows are links (`to`), buttons (`onClick`)
// or plain; `actions` sit outside the link so a nested button (e.g. "call
// back") never ends up inside an <a>.
// `inset`: where row separators start (px) — past the leading icon/avatar.
export function List({ className = "", plain = false, inset, children }) {
  return (
    <div
      className={`${styles.list} ${plain ? styles.plain : ""} ${className}`}
      style={inset ? { "--list-inset": `${inset}px` } : undefined}
    >
      {children}
    </div>
  );
}

export function ListSectionHeader({ children, action }) {
  return (
    <div className={styles.sectionHeader}>
      <span>{children}</span>
      {action}
    </div>
  );
}

// `footer` is an optional third line (e.g. a status badge) — it keeps the
// title at full width on narrow phones instead of squeezing it.
export function ListRow({ to, onClick, leading, title, subtitle, footer, trailing, actions, chevron, className = "", ...rest }) {
  const body = (
    <>
      {leading && <div className={styles.leading}>{leading}</div>}
      <div className={styles.main}>
        <div className={styles.title}>{title}</div>
        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
      {trailing !== undefined && trailing !== null && <div className={styles.trailing}>{trailing}</div>}
      {(chevron ?? Boolean(to)) && <Icon name="chevronRight" size={16} className={styles.chevron} />}
    </>
  );

  let inner;
  if (to) {
    inner = (
      <Link to={to} className={`${styles.body} ${styles.interactive}`} {...rest}>
        {body}
      </Link>
    );
  } else if (onClick) {
    inner = (
      <button type="button" onClick={onClick} className={`${styles.body} ${styles.interactive}`} {...rest}>
        {body}
      </button>
    );
  } else {
    inner = (
      <div className={styles.body} {...rest}>
        {body}
      </div>
    );
  }

  return (
    <div className={`${styles.row} ${className}`}>
      {inner}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
