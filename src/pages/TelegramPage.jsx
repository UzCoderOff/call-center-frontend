import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import styles from "../components/chat/Chat.module.css";
import Icon from "../components/ui/Icon";
import { TgList, TgThread } from "../components/telegram/TgInbox";
import { useI18n } from "../i18n";

// Mijozlar Telegrami (/telegram, /telegram/:tgId): people writing to the
// firm's Telegram account — its own section, apart from the staff chat
// (2026-10-15). On a computer: the list on the left, the open chat on the
// right; on a phone: the list, and a chat full screen. Who sees which chat:
// the server's services/tgInbox.js (the call center: new people and clients
// before a contract; coordinators: their clients in work; managers: all).

const WIDE = "(min-width: 900px)";

function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE).matches);
  useEffect(() => {
    const query = window.matchMedia(WIDE);
    const onChange = () => setWide(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return wide;
}

export default function TelegramPage() {
  const { tgId: param } = useParams();
  const tgId = param ? Number(param) : null;
  const { t } = useI18n();
  const wide = useWide();

  return (
    <div className={styles.screen}>
      {(wide || !tgId) && (
        <section className={styles.listPane} aria-label={t("tg.tabTelegram")}>
          <div className={styles.listHead}>
            <h1 className={styles.listTitle}>{t("tg.tabTelegram")}</h1>
          </div>
          <div className={styles.listScroll}>
            <TgList activeId={tgId} />
          </div>
        </section>
      )}
      {(wide || tgId) && (
        <section className={styles.threadPane}>
          {tgId ? (
            <TgThread key={tgId} chatId={tgId} />
          ) : (
            <div className={styles.placeholder}>
              <span className={styles.emptyIcon}>
                <Icon name="send" size={28} />
              </span>
              {t("tg.pick")}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
