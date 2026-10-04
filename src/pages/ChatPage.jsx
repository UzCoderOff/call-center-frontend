import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../components/chat/Chat.module.css";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { List, ListRow } from "../components/ui/List";
import { AsyncBoundary, EmptyState, PageHeader } from "../components/ui/Misc";
import { ConvIcon, DirectSheet, GroupSheet } from "../components/chat/ChatParts";
import { useAuth, isManagerRole } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { refreshChatUnread } from "../hooks/useChatUnread";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

// Chat: the Everyone chat on top, then groups, private chats and client
// chats by their last message. The developer makes groups; the boss and the
// developer can write to anyone privately.
export default function ChatPage() {
  const { user } = useAuth();
  const { t, fmt } = useI18n();
  const navigate = useNavigate();
  const state = useAsync(() => api.chats(), []);
  const [creating, setCreating] = useState(null); // "group" | "direct"

  // New messages show up while the list is open (quietly — no dimming).
  const { setData } = state;
  useEffect(() => {
    const timer = setInterval(() => api.chats().then(setData).catch(() => {}), 10 * 1000);
    return () => clearInterval(timer);
  }, [setData]);
  useEffect(() => {
    refreshChatUnread();
  }, [state.data]);

  const developer = user.role === "DEVELOPER";
  const manager = isManagerRole(user.role);

  return (
    <div>
      <PageHeader
        title={t("chat.title")}
        subtitle={t("chat.subtitle")}
        actions={
          <>
            {manager && (
              <Button icon="message" onClick={() => setCreating("direct")}>
                {t("chat.newDirect")}
              </Button>
            )}
            {developer && (
              <Button variant="primary" icon="plus" onClick={() => setCreating("group")}>
                {t("chat.newGroup")}
              </Button>
            )}
          </>
        }
      />
      <AsyncBoundary state={state}>
        {(list) =>
          list.length === 0 ? (
            <List>
              <EmptyState icon="messages" title={t("chat.empty")} />
            </List>
          ) : (
            <List inset={72}>
              {list.map((conv) => {
                const last = conv.lastMessage;
                const preview = last ? `${last.mine ? `${t("chat.you")}: ` : conv.kind !== "direct" && last.author ? `${last.author}: ` : ""}${last.eventTitle ? `📅 ${last.eventTitle}` : last.text}` : t("chat.noMessages");
                return (
                  <ListRow
                    key={conv.id}
                    to={`/chat/${conv.id}`}
                    leading={<ConvIcon conv={conv} />}
                    title={conv.kind === "everyone" ? t("chat.everyone") : conv.title}
                    subtitle={preview}
                    chevron={false}
                    trailing={
                      <span className={styles.convMeta}>
                        {last && <span>{fmt.relative(new Date(last.createdAt).getTime())}</span>}
                        {conv.unread > 0 ? (
                          <span className={`${styles.unread} ${conv.muted ? styles.unreadMuted : ""}`}>{conv.unread > 99 ? "99+" : conv.unread}</span>
                        ) : conv.muted ? (
                          <Icon name="bellOff" size={14} />
                        ) : null}
                      </span>
                    }
                  />
                );
              })}
            </List>
          )
        }
      </AsyncBoundary>

      {creating === "group" && (
        <GroupSheet
          onClose={() => setCreating(null)}
          onSaved={(conv) => {
            setCreating(null);
            navigate(`/chat/${conv.id}`);
          }}
        />
      )}
      {creating === "direct" && (
        <DirectSheet
          onClose={() => setCreating(null)}
          onOpened={(conv) => {
            setCreating(null);
            navigate(`/chat/${conv.id}`);
          }}
        />
      )}
    </div>
  );
}
