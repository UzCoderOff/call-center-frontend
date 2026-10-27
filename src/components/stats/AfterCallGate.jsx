import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import sheet from "../ui/Sheet.module.css";
import styles from "./NewCallers.module.css";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import OutcomeChoices from "./OutcomeChoices";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import { useLive } from "../../hooks/useLive";
import { isCallCenter } from "../../lib/access";
import { saveFailed } from "../../lib/saveFailed";
import { useI18n } from "../../i18n";

// Right after a talk with a new caller that didn't end in a booking, Ledger
// asks what came of it — and nothing else can be done until it's answered
// (the firm's ask, 2026-10-27: "enforce what happened after the call").
// The app opens Ledger when such a call ends (CallerCard.askAfter), and the
// server says which calls are waiting (GET /api/call-outcomes/required —
// only calls since this was switched on). Booking them is an answer too, so
// the calendar and the clients pages stay open while it waits.
const FREE = ["/calendar", "/clients", "/profile"];

export default function AfterCallGate() {
  const { t, fmt } = useI18n();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const asked = isCallCenter(user);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (asked) api.requiredOutcomes().then(setData).catch(() => {});
  }, [asked]);
  useEffect(load, [load, location.pathname]);
  useLive(load);

  const item = data?.items?.[0];
  if (!asked || !item || FREE.some((p) => location.pathname.startsWith(p))) return null;
  const phone = item.phone || `+${item.phoneKey}`;

  async function save(outcome, note, followUpOn = null) {
    setBusy(true);
    try {
      await api.setCallOutcome(item.phoneKey, { outcome, note: note || null, followUpOn });
      setData((d) => ({ ...d, items: d.items.filter((r) => r.phoneKey !== item.phoneKey) }));
      load();
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className={sheet.overlay}>
      <div className={sheet.panel} role="dialog" aria-modal="true" aria-labelledby="after-call-title">
        <div className={sheet.grabber} aria-hidden="true" />
        <header className={sheet.header}>
          <h2 id="after-call-title" className={sheet.title}>
            {t("afterCall.title")}
          </h2>
          {data.items.length > 1 && <span className={styles.count}>{data.items.length}</span>}
        </header>
        <div className={sheet.body}>
          <p className={styles.note}>{t("afterCall.text")}</p>
          <div className={styles.head}>
            <a className={styles.phone} href={`tel:${phone}`}>
              <Icon name="phone" size={15} />
              {fmt.phone(phone)}
            </a>
            <span className={styles.meta}>{[fmt.dateTime(item.lastAt), item.calls > 1 ? t("newCallers.calls", { n: item.calls }) : null].filter(Boolean).join(" · ")}</span>
          </div>
          <Button variant="primary" icon="calendar" onClick={() => navigate(`/calendar?phone=${encodeURIComponent(phone)}`)}>
            {t("afterCall.book")}
          </Button>
          <OutcomeChoices key={item.phoneKey} groups={data.groups} outcomes={data.outcomes} busy={busy} onSave={save} />
        </div>
      </div>
    </div>,
    document.body
  );
}
