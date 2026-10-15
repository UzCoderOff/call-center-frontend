import { useEffect, useState } from "react";
import pageStyles from "../../pages/Pages.module.css";
import styles from "../clients/Clients.module.css";
import Button from "../ui/Button";
import Sheet from "../ui/Sheet";
import { TextField } from "../ui/Field";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";

// Whose chat is it: find the client by name or number. A number can also
// belong to a client the operator can't open (one in work, with a
// coordinator): then it's linked by the number — and goes to the coordinator.
export function TgLinkSheet({ chat, onClose, onLink }) {
  const { t } = useI18n();
  const [query, setQuery] = useState(chat.phone || "");
  const [results, setResults] = useState(null);
  const [owner, setOwner] = useState(null);
  const digits = query.replace(/\D/g, "");
  const byNumber = digits.length >= 9;

  useEffect(() => {
    if (query.trim().length < 2) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .clients({ q: query })
        .then((data) => !cancelled && setResults(data.clients.slice(0, 10)))
        .catch(() => !cancelled && setResults([]));
      if (byNumber) {
        api
          .tgPhoneOwner(chat.id, query)
          .then((data) => !cancelled && setOwner(data))
          .catch(() => !cancelled && setOwner(null));
      } else setOwner(null);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, byNumber, chat.id]);

  const searching = query.trim().length >= 2;
  return (
    <Sheet title={t("tg.linkTitle")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <TextField label={t("tg.linkWho")} placeholder={t("tg.linkPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" autoFocus />
        {owner?.restricted && (
          <div className={pageStyles.bannerSpace}>
            <p className={pageStyles.note} style={{ margin: 0 }}>
              {owner.restricted.inWork
                ? t("tg.ownerInWork", { coordinator: owner.restricted.coordinator || "—" })
                : t("tg.ownerOther", { operator: owner.restricted.operator || "—" })}
            </p>
            <div className={pageStyles.actionsRow}>
              <Button variant="primary" icon="link" onClick={() => onLink({ phone: query })}>
                {t("tg.linkByNumber")}
              </Button>
            </div>
          </div>
        )}
        {owner?.several && <p className={pageStyles.note}>{t("tg.ownerSeveral")}</p>}
        {searching && results && results.length === 0 && !owner?.restricted && <p className={pageStyles.note}>{t("pickClient.none")}</p>}
        {searching && results && results.length > 0 && (
          <div className={styles.results}>
            {results.map((r) => (
              <button key={r.id} type="button" className={styles.result} onClick={() => onLink({ clientId: r.id })}>
                <strong>{r.name}</strong>
                <span className={styles.linkSub}>{[r.phone, r.latestCase?.matter].filter(Boolean).join(" · ") || "—"}</span>
              </button>
            ))}
          </div>
        )}
        <p className={pageStyles.note}>{t("tg.linkHint")}</p>
      </div>
    </Sheet>
  );
}
