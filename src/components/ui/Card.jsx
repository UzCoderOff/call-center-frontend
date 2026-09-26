import styles from "./Card.module.css";

export default function Card({ title, subtitle, action, flush = false, className = "", children, ...rest }) {
  return (
    <section className={`${styles.card} ${flush ? styles.flush : ""} ${className}`} {...rest}>
      {(title || action) && (
        <header className={styles.header}>
          <div className={styles.heading}>
            {title && <h2 className={styles.title}>{title}</h2>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {action && <div className={styles.action}>{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
