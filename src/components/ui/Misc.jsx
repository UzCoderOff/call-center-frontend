import { useState } from "react";
import styles from "./Misc.module.css";
import Icon from "./Icon";
import Button from "./Button";
import Spinner from "./Spinner";
import { useI18n } from "../../i18n";

export function PageHeader({ title, subtitle, back, actions }) {
  return (
    <div className={styles.pageHeader}>
      {back && (
        <Button
          variant="plain"
          size="small"
          to={back.onClick ? undefined : back.to}
          onClick={back.onClick}
          icon="chevronLeft"
          className={styles.back}
        >
          {back.label}
        </Button>
      )}
      <div className={styles.pageHeaderRow}>
        <div className={styles.pageHeading}>
          <h1 className={styles.pageTitle}>{title}</h1>
          {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
        </div>
        {actions && <div className={styles.pageActions}>{actions}</div>}
      </div>
    </div>
  );
}

export function StatTile({ label, value, sub, dot }) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>
        {dot && <i className={styles.dot} style={{ background: dot }} aria-hidden="true" />}
        {label}
      </span>
      <span className={styles.tileValue}>{value}</span>
      {sub && <span className={styles.tileSub}>{sub}</span>}
    </div>
  );
}

// A duration for a big number display: digits full size, units small —
// "15 soat 21 daq" fits a phone-width tile on one line.
export function DurationValue({ seconds }) {
  const { fmt } = useI18n();
  return (
    <span className={styles.duration}>
      {fmt.durationParts(seconds).map((p) => (
        <span key={p.unit}>
          {p.n}
          <small>{p.unit}</small>
        </span>
      ))}
    </span>
  );
}

export function EmptyState({ icon = "search", title, text, action }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>
        <Icon name={icon} size={22} />
      </span>
      {title && <p className={styles.emptyTitle}>{title}</p>}
      {text && <p className={styles.emptyText}>{text}</p>}
      {action}
    </div>
  );
}

export function LoadingState() {
  const { t } = useI18n();
  return (
    <div className={styles.loading}>
      <Spinner size={22} label={t("common.loading")} />
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  const { t } = useI18n();
  return (
    <EmptyState
      icon="alertTriangle"
      title={t("common.loadError")}
      text={error?.code ? `(${error.code})` : undefined}
      action={
        onRetry && (
          <Button icon="refresh" onClick={onRetry}>
            {t("common.retry")}
          </Button>
        )
      }
    />
  );
}

// Page-level data states: first load shows a spinner; a refetch keeps the
// old content on screen (dimmed) so nothing jumps.
export function AsyncBoundary({ state, children }) {
  if (state.error && !state.data) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (!state.data) return <LoadingState />;
  return <div className={state.loading ? styles.refetching : undefined}>{children(state.data)}</div>;
}

export function Avatar({ name, size = 40 }) {
  const initials = (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
  return (
    <span className={styles.avatar} style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
      {initials}
    </span>
  );
}

export function CopyButton({ value }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (non-HTTPS, permissions) — the value is on screen
      // and selectable anyway.
    }
  }
  return (
    <Button size="small" variant="plain" icon={copied ? "check" : "copy"} onClick={copy}>
      {copied ? t("common.copied") : t("common.copy")}
    </Button>
  );
}

// A label / value pair inside a card, e.g. "Qurilma ID  3f9a…  [Nusxa olish]".
export function KeyValue({ label, children, mono = false }) {
  return (
    <div className={styles.kv}>
      <span className={styles.kvLabel}>{label}</span>
      <span className={`${styles.kvValue} ${mono ? styles.mono : ""}`}>{children}</span>
    </div>
  );
}

export function Banner({ tone = "accent", icon, children, action }) {
  return (
    <div className={`${styles.banner} ${styles[`banner_${tone}`]}`} role="status">
      {icon && <Icon name={icon} size={20} className={styles.bannerIcon} />}
      <div className={styles.bannerText}>{children}</div>
      {action}
    </div>
  );
}
