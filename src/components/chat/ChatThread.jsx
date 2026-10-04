import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import styles from "./Chat.module.css";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { ConvIcon, EventSheet, GroupSheet, MessageSheet, PersonAvatar, colorFor } from "./ChatParts";
import { markReadHere } from "../../hooks/useChatUnread";
import { useLive } from "../../hooks/useLive";
import { api } from "../../lib/api";
import { saveFailed } from "../../lib/saveFailed";
import { useI18n } from "../../i18n";

// One chat: its header, the messages (new ones every few seconds while it's
// open) and the box to write in, at the bottom. Text, or an event card —
// everyone in the chat is reminded an hour before and at the start. Your own
// message: tap it to change or delete it.

// The live updates bring new messages at once; this is only the safety net.
const FALLBACK_MS = 30 * 1000;

export default function ChatThread({ conv, onConvChanged, onActivity, onGone }) {
  const { t, fmt } = useI18n();
  const navigate = useNavigate();
  const [messages, setMessages] = useState(null);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sheet, setSheet] = useState(null); // "event" | "group" | { message }
  const [menu, setMenu] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const lastIdRef = useRef(0);
  const sinceRef = useRef(0);
  const stickRef = useRef(true);

  const atBottom = () => {
    const el = scrollRef.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };
  const toBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

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

  // After new messages: stay at the bottom if that's where they were.
  useLayoutEffect(() => {
    if (stickRef.current) toBottom();
  }, [messages]);

  // What's new since what's on screen: new messages, and edits/deletions.
  const fetchNew = useCallback(async () => {
    if (!lastIdRef.current && !sinceRef.current) return;
    try {
      const res = await api.chatMessages(conv.id, { after: lastIdRef.current || undefined, since: sinceRef.current || undefined });
      sinceRef.current = res.serverTime;
      if (res.messages.length || res.changed.length) {
        stickRef.current = atBottom();
        merge(res.messages, res.changed);
        if (res.messages.length) onActivity?.();
      }
    } catch {
      // Offline for a moment: the next round catches up.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.id, merge]);

  // The first page; then new ones the moment the server has them (useLive),
  // with a slow check as a fallback.
  useEffect(() => {
    let live = true;
    api
      .chatMessages(conv.id)
      .then((res) => {
        if (!live) return;
        sinceRef.current = res.serverTime;
        setHasOlder(res.hasOlder);
        stickRef.current = true;
        merge(res.messages);
      })
      .catch(() => live && setMessages([]));
    const timer = setInterval(() => document.visibilityState === "visible" && fetchNew(), FALLBACK_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [conv.id, merge, fetchNew]);
  useLive(fetchNew);

  // Read the moment it's on screen — the server hears in the background.
  useEffect(() => {
    if (messages?.length) markReadHere(conv.id, messages[messages.length - 1].id);
  }, [conv.id, messages]);

  async function loadOlder() {
    const el = scrollRef.current;
    if (!messages?.length || !el) return;
    setLoadingOlder(true);
    const before = el.scrollHeight;
    try {
      const res = await api.chatMessages(conv.id, { before: messages[0].id });
      setHasOlder(res.hasOlder);
      stickRef.current = false;
      merge(res.messages);
      // Keep the same messages in view.
      requestAnimationFrame(() => {
        el.scrollTop += el.scrollHeight - before;
      });
    } finally {
      setLoadingOlder(false);
    }
  }

  async function send(payload) {
    const message = await api.sendMessage(conv.id, payload);
    stickRef.current = true;
    merge([message]);
    onActivity?.();
  }

  async function sendText(e) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await send({ text: body });
      setText("");
      if (inputRef.current) inputRef.current.style.height = "";
      inputRef.current?.focus();
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
    setMenu(false);
    try {
      const { muted } = await api.muteChat(conv.id, !conv.muted);
      onConvChanged({ ...conv, muted });
    } catch (err) {
      saveFailed(err, t);
    }
  }

  async function deleteGroup() {
    setMenu(false);
    if (!window.confirm(t("chat.deleteGroupConfirm"))) return;
    try {
      await api.deleteGroup(conv.id);
      onGone();
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
  const showAuthors = conv.kind !== "direct";

  return (
    <div className={styles.thread}>
      <header className={styles.threadHead}>
        <button type="button" className={`${styles.headButton} ${styles.back}`} onClick={() => navigate("/chat")} aria-label={t("chat.back")}>
          <Icon name="chevronLeft" size={24} />
        </button>
        <ConvIcon conv={{ ...conv, title }} size={40} />
        <div className={styles.threadTitle}>
          <div className={styles.threadName}>{title}</div>
          <div className={styles.threadSub}>{conv.muted ? `🔕 ${subtitle}` : subtitle}</div>
        </div>
        {conv.kind === "client" && (
          <Link to={`/clients/${conv.clientId}`} className={styles.headButton} title={t("chat.openClient")} aria-label={t("chat.openClient")}>
            <Icon name="contact" size={20} />
          </Link>
        )}
        <button type="button" className={styles.headButton} onClick={() => setMenu((m) => !m)} aria-label={t("chat.more")} aria-expanded={menu}>
          <Icon name="more" size={20} />
        </button>
        {menu && (
          <div className={styles.menu} role="menu" onMouseLeave={() => setMenu(false)}>
            <button type="button" className={styles.menuItem} onClick={toggleMute} role="menuitem">
              <Icon name={conv.muted ? "bell" : "bellOff"} size={18} />
              {conv.muted ? t("chat.unmute") : t("chat.mute")}
            </button>
            {conv.canManage && conv.kind === "group" && (
              <>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    setMenu(false);
                    setSheet("group");
                  }}
                  role="menuitem"
                >
                  <Icon name="edit" size={18} />
                  {t("chat.editGroup")}
                </button>
                <button type="button" className={`${styles.menuItem} ${styles.menuDanger}`} onClick={deleteGroup} role="menuitem">
                  <Icon name="trash" size={18} />
                  {t("chat.deleteGroup")}
                </button>
              </>
            )}
          </div>
        )}
      </header>

      <div className={styles.messages} ref={scrollRef} onClick={() => menu && setMenu(false)}>
        {hasOlder && (
          <Button size="small" variant="plain" className={styles.older} busy={loadingOlder} onClick={loadOlder}>
            {t("chat.older")}
          </Button>
        )}
        {messages === null ? null : messages.length === 0 ? (
          <div className={styles.emptyThread}>
            <span className={styles.emptyIcon}>
              <Icon name="message" size={28} />
            </span>
            <div>{t("chat.noMessagesYet")}</div>
          </div>
        ) : (
          messages.map((m, i) => {
            const ms = new Date(m.createdAt).getTime();
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const day = new Date(ms).toDateString();
            const newDay = !prev || new Date(prev.createdAt).toDateString() !== day;
            const sameAsPrev = !newDay && prev && prev.author?.id === m.author?.id && ms - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
            const sameAsNext = next && next.author?.id === m.author?.id && new Date(next.createdAt).toDateString() === day && new Date(next.createdAt).getTime() - ms < 5 * 60 * 1000;
            const authorName = m.author?.name || t("chat.someone");
            const tappable = m.mine && !m.deleted;
            return (
              <Fragment key={m.id}>
                {newDay && <div className={styles.day}>{fmt.dayHeader(ms)}</div>}
                <div className={`${styles.row} ${m.mine ? styles.rowMine : ""} ${sameAsPrev ? "" : styles.rowFirst}`}>
                  {!m.mine && showAuthors && (sameAsNext ? <span className={styles.avatarSpace} /> : <PersonAvatar name={authorName} />)}
                  <div
                    className={`${styles.bubble} ${m.mine ? styles.mine : ""} ${sameAsNext ? "" : styles.bubbleLast}`}
                    onClick={tappable ? () => setSheet({ message: m }) : undefined}
                    role={tappable ? "button" : undefined}
                  >
                    {!m.mine && showAuthors && !sameAsPrev && (
                      <div className={styles.author} style={{ color: colorFor(authorName) }}>
                        {authorName}
                      </div>
                    )}
                    {m.deleted ? (
                      <span className={styles.deleted}>{t("chat.deleted")}</span>
                    ) : (
                      <>
                        {m.event && <EventCard event={m.event} />}
                        {m.text && <span>{m.text}</span>}
                      </>
                    )}
                    <span className={styles.meta}>
                      {m.editedAt && !m.deleted && <span>{t("chat.edited")}</span>}
                      <span>{fmt.time(ms)}</span>
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
          <button type="button" className={styles.roundButton} onClick={() => setSheet("event")} aria-label={t("chat.newEvent")} title={t("chat.newEvent")}>
            <Icon name="calendar" size={20} />
          </button>
          <textarea
            ref={inputRef}
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
          <button type="submit" className={`${styles.roundButton} ${styles.send}`} disabled={!text.trim() || sending} aria-label={t("chat.send")}>
            <Icon name="send" size={18} />
          </button>
        </form>
      ) : (
        <div className={styles.readOnly}>{t("chat.readOnly")}</div>
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

// An event card: the date like a calendar page, what, when, and how soon.
function EventCard({ event }) {
  const { t, fmt } = useI18n();
  const at = new Date(event.at);
  const ms = at.getTime();
  const minutes = Math.round((ms - Date.now()) / 60000);
  const soon =
    minutes < -60
      ? t("chat.eventPast")
      : minutes <= 0
        ? t("chat.eventNow")
        : minutes < 60
          ? t("chat.eventInMinutes", { count: minutes })
          : minutes < 24 * 60
            ? t("chat.eventInHours", { count: Math.round(minutes / 60) })
            : null;
  return (
    <div className={styles.event}>
      <span className={styles.eventDate}>
        <span className={styles.eventMonth}>{fmt.monthShort(ms)}</span>
        <span className={styles.eventDay}>{at.getDate()}</span>
      </span>
      <span>
        <div className={styles.eventTitle}>{event.title}</div>
        <div className={styles.eventWhen}>{fmt.dateTime(ms)}</div>
        {soon && <span className={styles.eventSoon}>{soon}</span>}
      </span>
    </div>
  );
}
