import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styles from "../components/chat/Chat.module.css";
import Icon from "../components/ui/Icon";
import { AsyncBoundary } from "../components/ui/Misc";
import ChatList from "../components/chat/ChatList";
import ChatThread from "../components/chat/ChatThread";
import { DirectSheet, GroupSheet } from "../components/chat/ChatParts";
import { useAuth, isManagerRole } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

// Chat (/chat and /chat/:id). On a computer: the chats on the left, the
// open one on the right. On a phone: the list, and a chat full screen.
// The developer makes groups; the boss and the developer can write to
// anyone privately.

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

export default function ChatPage() {
  const { id } = useParams();
  const convId = id ? Number(id) : null;
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const wide = useWide();
  const list = useAsync(() => api.chats(), []);
  const meta = useAsync(() => (convId ? api.chat(convId) : Promise.resolve(null)), [convId]);
  const [creating, setCreating] = useState(null); // "group" | "direct"

  // New messages show up in the list while it's open (quietly — no dimming).
  const { setData: setList } = list;
  const refreshList = () => api.chats().then(setList).catch(() => {});
  useEffect(() => {
    const timer = setInterval(() => api.chats().then(setList).catch(() => {}), 10 * 1000);
    return () => clearInterval(timer);
  }, [setList]);

  const developer = user.role === "DEVELOPER";
  const manager = isManagerRole(user.role);

  return (
    <div className={styles.screen}>
      {(wide || !convId) && (
        <section className={styles.listPane} aria-label={t("chat.title")}>
          <div className={styles.listHead}>
            <h1 className={styles.listTitle}>{t("chat.title")}</h1>
            {manager && (
              <button type="button" className={styles.headButton} onClick={() => setCreating("direct")} title={t("chat.newDirect")} aria-label={t("chat.newDirect")}>
                <Icon name="edit" size={20} />
              </button>
            )}
            {developer && (
              <button type="button" className={styles.headButton} onClick={() => setCreating("group")} title={t("chat.newGroup")} aria-label={t("chat.newGroup")}>
                <Icon name="users" size={20} />
              </button>
            )}
          </div>
          <div className={styles.listScroll}>
            <AsyncBoundary state={list}>{(rows) => <ChatList list={rows} activeId={convId} />}</AsyncBoundary>
          </div>
        </section>
      )}

      {(wide || convId) && (
        <section className={styles.threadPane}>
          {convId ? (
            <AsyncBoundary state={meta}>
              {(conv) =>
                conv && (
                  <ChatThread
                    key={conv.id}
                    conv={conv}
                    onConvChanged={(next) => {
                      meta.setData(next);
                      refreshList();
                    }}
                    onActivity={refreshList}
                    onGone={() => {
                      refreshList();
                      navigate("/chat", { replace: true });
                    }}
                  />
                )
              }
            </AsyncBoundary>
          ) : (
            <div className={styles.placeholder}>
              <span className={styles.emptyIcon}>
                <Icon name="messages" size={28} />
              </span>
              {t("chat.pick")}
            </div>
          )}
        </section>
      )}

      {creating === "group" && (
        <GroupSheet
          onClose={() => setCreating(null)}
          onSaved={(conv) => {
            setCreating(null);
            refreshList();
            navigate(`/chat/${conv.id}`);
          }}
        />
      )}
      {creating === "direct" && (
        <DirectSheet
          onClose={() => setCreating(null)}
          onOpened={(conv) => {
            setCreating(null);
            refreshList();
            navigate(`/chat/${conv.id}`);
          }}
        />
      )}
    </div>
  );
}
