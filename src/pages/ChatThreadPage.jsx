import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import styles from "../components/chat/Chat.module.css";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { AsyncBoundary, PageHeader } from "../components/ui/Misc";
import { EventSheet, GroupSheet, MessageSheet } from "../components/chat/ChatParts";
import { useAsync } from "../hooks/useAsync";
import { refreshChatUnread } from "../hooks/useChatUnread";
import { api } from "../lib/api";
import { saveFailed } from "../lib/saveFailed";
import { useI18n } from "../i18n";

// One chat: the messages (new ones every few seconds while it's open), and
// writing — text, or an event card (everyone is reminded an hour before and
// at the start). Your own message: tap to change or delete it.

const POLL_MS = 4000;
const nearBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160;
const toBottom = () => window.scrollTo({ top: document.documentElement.scrollHeight });

export default function ChatThreadPage() {
  const { id } = useParams();
  const meta = useAsync(() => api.chat(id), [id]);
  return (
    <AsyncBoundary state={meta}>
      {(conv) => <Thread key={conv.id} conv={conv} onConvChanged={meta.setData} />}
    </AsyncBoundary>
  );
}

// /chat/client/:clientId — a client's chat (made when first opened).
export function ClientChatRedirect() {
  const { clientId } = useParams();
  const state = useAsync(() => api.clientChat(clientId), [clientId]);
  return <AsyncBoundary state={state}>{(conv) => <Navigate to={`/chat/${conv.id}`} replace />}</AsyncBoundary>;
}

function Thread({ conv, onConvChanged }) {
  const { t, fmt } = useI18n();
  const navigate = useNavigate();
  const [messages, setMessages] = useState(null);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sheet, setSheet] = useState(null); // "event" | "group" | { message }
  const lastIdRef = useRef(0);
  const sinceRef = useRef(0);

  // Adds new messages and puts changed ones (edited, deleted) in place.
  const merge = useCallback((incoming, changed = []) => {
    setMessages((list) => {
      const byId = new Map((list || []).map((m) => [m.id, m]));
      for (const m of [...incoming, ...changed]) byId.set(m.id, m);
      const next = [...byId.values()].sort((a, b) => a.id - b.id);
      if (next.length) lastIdRef.current = Math.max(lastIdRef.current, next[next.length - 1].id);
      return next;
    });
  }, []);

  // First page, then new ones every few seconds.
  useEffect(() => {
    let live = true;
    api
      .chatMessages(conv.id)
      .then((res) => {
        if (!live) return;
        sinceRef.current = res.serverTime;
        setHasOlder(res.hasOlder);
        merge(res.messages);
        requestAnimationFrame(toBottom);
        refreshChatUnread();
      })
      .catch(() => live && setMessages([]));
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await api.chatMessages(conv.id, { after: lastIdRef.current || undefined, since: sinceRef.current || undefined });
        sinceRef.current = res.serverTime;
        if (res.messages.length || res.changed.length) {
          const stick = nearBottom();
          merge(res.messages, res.changed);
          if (stick) requestAnimationFrame(toBottom);
          if (res.messages.length) refreshChatUnread();
        }
      } catch {
        // Offline for a moment: the next round catches up.
      }
    }, POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [conv.id, merge]);

  async function loadOlder() {
    if (!messages?.length) return;
    setLoadingOlder(true);
    const before = document.documentElement.scrollHeight;
    try {
      const res = await api.chatMessages(conv.id, { before: messages[0].id });
      setHasOlder(res.hasOlder);
      merge(res.messages);
      // Keep the same messages in view.
      requestAnimationFrame(() => window.scrollBy(0, document.documentElement.scrollHeight - before));
    } finally {
      setLoadingOlder(false);
    }
  }

  async function send(payload) {
    const message = await api.sendMessage(conv.id, payload);
    merge([message]);
    requestAnimationFrame(toBottom);
  }

  async function sendText(e) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await send({ text: body });
      setText("");
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setSending(false);
    }
  }

  // Enter sends on a computer; on a phone it's a new line (the button sends).
  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !window.matchMedia("(pointer: coarse)").matches) sendText(e);
  }

  async function toggleMute() {
    try {
      const { muted } = await api.muteChat(conv.id, !conv.muted);
      onConvChanged({ ...conv, muted });
    } catch (err) {
      saveFailed(err, t);
    }
  }

  async function deleteGroup() {
    if (!window.confirm(t("chat.deleteGroupConfirm"))) return;
    try {
      await api.deleteGroup(conv.id);
      navigate("/chat", { replace: true });
    } catch (err) {
      saveFailed(err, t);
    }
  }

  const title = conv.kind === "everyone" ? t("chat.everyone") : conv.title;
  const subtitle =
    conv.kind === "everyone"
      ? t("chat.everyoneHint")
      : conv.kind === "group"
        ? t("chat.membersCount", { count: conv.members?.length || 0 })
        : conv.kind === "client"
          ? t("chat.clientHint")
          : t("chat.directHint");

  let lastDay = null;
  let lastAuthor = null;

  return (
    <div>
      <PageHeader
        back={{ to: "/chat", label: t("chat.title") }}
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {conv.kind === "client" && (
              <Button icon="contact" to={`/clients/${conv.clientId}`}>
                {t("chat.openClient")}
              </Button>
            )}
            <Button icon={conv.muted ? "bell" : "bellOff"} onClick={toggleMute}>
              {conv.muted ? t("chat.unmute") : t("chat.mute")}
            </Button>
            {conv.canManage && conv.kind === "group" && (
              <>
                <Button icon="edit" onClick={() => setSheet("group")}>
                  {t("chat.editGroup")}
                </Button>
                <Button variant="destructive" icon="trash" onClick={deleteGroup}>
                  {t("chat.deleteGroup")}
                </Button>
              </>
            )}
          </>
        }
      />

      <div className={styles.thread}>
        {hasOlder && (
          <Button size="small" variant="plain" className={styles.older} busy={loadingOlder} onClick={loadOlder}>
            {t("chat.older")}
          </Button>
        )}
        {messages === null ? null : messages.length === 0 ? (
          <p className={styles.readOnly}>{t("chat.noMessagesYet")}</p>
        ) : (
          messages.map((m) => {
            const ms = new Date(m.createdAt).getTime();
            const day = new Date(ms).toDateString();
            const showDay = day !== lastDay;
            const showAuthor = !m.mine && conv.kind !== "direct" && (showDay || lastAuthor !== m.author?.id);
            lastDay = day;
            lastAuthor = m.author?.id ?? null;
            return (
              <Fragment key={m.id}>
                {showDay && <div className={styles.day}>{fmt.dayHeader(ms)}</div>}
                <div className={`${styles.row} ${m.mine ? styles.rowMine : ""}`}>
                  <div
                    className={`${styles.bubble} ${m.mine ? styles.mine : ""}`}
                    onClick={m.mine && !m.deleted ? () => setSheet({ message: m }) : undefined}
                    role={m.mine && !m.deleted ? "button" : undefined}
                  >
                    {showAuthor && <div className={styles.author}>{m.author?.name || t("chat.someone")}</div>}
                    {m.deleted ? (
                      <span className={styles.deleted}>{t("chat.deleted")}</span>
                    ) : (
                      <>
                        {m.event && (
                          <div className={styles.event}>
                            <span className={styles.eventIcon}>
                              <Icon name="calendar" size={20} />
                            </span>
                            <span>
                              <div className={styles.eventTitle}>{m.event.title}</div>
                              <div className={styles.eventWhen}>{fmt.dateTime(new Date(m.event.at).getTime())}</div>
                            </span>
                          </div>
                        )}
                        {m.text && <span>{m.text}</span>}
                      </>
                    )}
                    <span className={styles.time}>
                      {m.editedAt && !m.deleted ? `${t("chat.edited")} · ` : ""}
                      {fmt.time(ms)}
                    </span>
                  </div>
                </div>
              </Fragment>
            );
          })
        )}
      </div>

      {conv.canWrite ? (
        <form className={styles.composer} onSubmit={sendText}>
          <button type="button" className={styles.iconButton} onClick={() => setSheet("event")} aria-label={t("chat.newEvent")} title={t("chat.newEvent")}>
            <Icon name="calendar" size={20} />
          </button>
          <textarea
            className={styles.input}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
            }}
            onKeyDown={onKeyDown}
            placeholder={t("chat.placeholder")}
            rows={1}
            maxLength={4000}
          />
          <button type="submit" className={`${styles.iconButton} ${styles.send}`} disabled={!text.trim() || sending} aria-label={t("chat.send")}>
            <Icon name="send" size={18} />
          </button>
        </form>
      ) : (
        <p className={styles.readOnly}>{t("chat.readOnly")}</p>
      )}

      {sheet === "event" && (
        <EventSheet
          onClose={() => setSheet(null)}
          onSend={async (payload) => {
            await send(payload);
            setSheet(null);
          }}
        />
      )}
      {sheet === "group" && (
        <GroupSheet
          group={conv}
          onClose={() => setSheet(null)}
          onSaved={(updated) => {
            onConvChanged(updated);
            setSheet(null);
          }}
        />
      )}
      {sheet?.message && (
        <MessageSheet
          message={sheet.message}
          onClose={() => setSheet(null)}
          onEdit={async (newText) => merge([await api.editMessage(conv.id, sheet.message.id, newText)])}
          onDelete={async () => {
            await api.deleteMessage(conv.id, sheet.message.id);
            merge([], [{ ...sheet.message, deleted: true, text: "", event: null }]);
          }}
        />
      )}
    </div>
  );
}
