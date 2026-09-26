import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./Sheet.module.css";
import Icon from "./Icon";
import { useI18n } from "../../i18n";

// A bottom sheet on phones, a centred dialog on wider screens.
export default function Sheet({ title, onClose, children, footer }) {
  const { t } = useI18n();
  const titleId = useId();
  const panelRef = useRef(null);
  // Parents usually pass an inline onClose; reading it through a ref keeps
  // the mount effect below from re-running (and re-focusing) every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previousFocus = document.activeElement;
    const onKey = (e) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    // Focus the first field if there is one, otherwise the dialog itself.
    const firstField = panelRef.current?.querySelector("input, select, textarea");
    (firstField || panelRef.current)?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      previousFocus?.focus?.();
    };
  }, []);

  return createPortal(
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panelRef} tabIndex={-1}>
        <div className={styles.grabber} aria-hidden="true" />
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t("common.close")}>
            <Icon name="x" size={16} strokeWidth={2.2} />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}
