import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import styles from "../chat/Chat.module.css";
import tg from "./TgInbox.module.css";
import Icon from "../ui/Icon";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Sheet from "../ui/Sheet";
import { TextField } from "../ui/Field";
import { AsyncBoundary } from "../ui/Misc";
import { PersonAvatar } from "../chat/ChatParts";
import { ClientSheet } from "../clients/ClientSheets";
import { TgLinkSheet } from "./TgLinkSheet";
import { useAsync } from "../../hooks/useAsync";
import { useLive } from "../../hooks/useLive";
import { api } from "../../lib/api";
import { saveFailed } from "../../lib/saveFailed";
import { useI18n } from "../../i18n";
import { useAuth } from "../../hooks/useAuth";
import { isManager } from "../../lib/access";
import { ChatReview } from "./TgReview";

// Clients writing to the firm's Telegram account (Telegram Business — the
// server's services/tgInbox.js): the list (Chat → Telegram), one chat, and the
// same chat on the client's page. Read-only for now: the operator answers in
// the Telegram app, Ledger shows both sides.

const KIND_ICON = { photo: "image", voice: "waveform", video: "video", video_note: "video", audio: "music", document: "file", contact: "contact", location: "externalLink" };

// "📷 Rasm", "🎤 Ovozli xabar 0:17", or the words.
export function previewOf(m, t) {
  if (!m) return t("tg.noMessages");
  if (m.deleted) return t("tg.deleted");
  const label = m.kind !== "text" ? t(`tg.kinds.${m.kind}`, { duration: m.duration ? clock(m.duration) : "" }).trim() : "";
  return [label, m.text].filter(Boolean).join(" · ") || t("tg.kinds.other");
}

const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// "12 daq", "3 soat", "2 kun" — how long they've been waiting.
function waited(since, t) {
  const min = Math.max(1, Math.round((Date.now() - new Date(since).getTime()) / 60000));
  if (min < 60) return t("tg.waitMin", { count: min });
  if (min < 48 * 60) return t("tg.waitHours", { count: Math.round(min / 60) });
  return t("tg.waitDays", { count: Math.round(min / 1440) });
}

// ------------------------------------------------------------ the list
export function TgList({ activeId }) {
  const { t, fmt } = useI18n();
  const { user } = useAuth();
  const manager = isManager(user);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  // Managers: the chats taken out of the list (by a person, or by the AI).
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(timer);
  }, [q]);
  const params = { q: query, ...(hidden ? { hidden: 1 } : {}) };
  const state = useAsync(() => api.tgChats(params), [query, hidden]);
  const { setData } = state;
  useLive(() => api.tgChats(params).then(setData).catch(() => {}));

  return (
    <>
      <div className={tg.search}>
        <TextField aria-label={t("tg.search")} placeholder={t("tg.search")} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      </div>
      {manager && (
        <div className={tg.listOptions}>
          <button type="button" className={tg.moreButton} onClick={() => setHidden((v) => !v)}>
            {hidden ? t("tg.showList") : t("tg.showHidden")}
          </button>
        </div>
      )}
      <AsyncBoundary state={state}>
        {({ chats, waiting }) => (
          <>
            {waiting > 0 && !query && !hidden && <div className={tg.waitingLine}>{t("tg.waitingCount", { count: waiting })}</div>}
            {chats.length === 0 ? (
              <div className={styles.placeholder}>{query ? t("tg.nothingFound") : t("tg.empty")}</div>
            ) : (
              chats.map((c) => {
                const at = c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : null;
                const last = c.lastMessage;
                return (
                  <Link key={c.id} to={`/telegram/${c.id}`} className={`${styles.conv} ${c.id === activeId ? styles.convActive : ""}`}>
                    <TgAvatar chat={c} />
                    <span className={styles.convBody}>
                      <span className={styles.convTop}>
                        <span className={styles.convName}>{c.client?.name || c.name}</span>
                        {at && <span className={styles.convTime}>{new Date(at).toDateString() === new Date().toDateString() ? fmt.time(at) : fmt.date(at)}</span>}
                      </span>
                      <span className={styles.convBottom}>
                        <span className={styles.convPreview}>
                          {last?.out ? `${t("tg.firm")}: ` : ""}
                          {previewOf(last, t)}
                        </span>
                        {c.aiHidden ? <span className={tg.waitBadge}>{t("tg.aiHid")}</span> : c.waitingSince && !c.hidden && <span className={tg.waitBadge}>{waited(c.waitingSince, t)}</span>}
                      </span>
                    </span>
                  </Link>
                );
              })
            )}
          </>
        )}
      </AsyncBoundary>
    </>
  );
}

function TgAvatar({ chat, size = 48 }) {
  return (
    <span className={tg.avatarWrap}>
      <PersonAvatar name={chat.client?.name || chat.name} size={size} />
      <span className={tg.tgMark} aria-hidden="true">
        <Icon name="send" size={Math.round(size * 0.24)} />
      </span>
    </span>
  );
}

// ------------------------------------------------------------ one chat
// `embedded`: inside a sheet on the client's page (no way back to the list).
export function TgThread({ chatId, embedded = false, onChanged }) {
  const { t, fmt } = useI18n();
  const navigate = useNavigate();
  const state = useAsync(() => api.tgChat(chatId), [chatId]);
  const { setData } = state;
  useLive(() => api.tgChat(chatId).then(setData).catch(() => {}));
  const [sheet, setSheet] = useState(null); // "link" | "new"
  const [reviewing, setReviewing] = useState(false);

  async function reviewNow() {
    setReviewing(true);
    try {
      await api.tgReview(chatId);
      setData(await api.tgChat(chatId));
      onChanged?.();
    } catch (err) {
      if (err.body?.message) alert(err.body.message);
      else if (err.code === "nothing_to_review") alert(t("tgReview.nothing"));
      else saveFailed(err, t);
    } finally {
      setReviewing(false);
    }
  }

  async function update(payload) {
    try {
      const saved = await api.tgUpdate(chatId, payload);
      onChanged?.();
      // Linked to a client in work: their coordinator's now — out of this list.
      if (saved.handedOver) {
        alert(t("tg.handedOver", { name: saved.client?.name || "" }));
        if (embedded) return;
        navigate("/telegram", { replace: true });
        return;
      }
      setData(await api.tgChat(chatId));
    } catch (err) {
      saveFailed(err, t);
    }
  }

  return (
    <AsyncBoundary state={state}>
      {({ chat, messages, hasOlder, review }) => (
        <div className={`${styles.thread} ${embedded ? tg.embedded : ""}`}>
          <header className={styles.threadHead}>
            {!embedded && (
              <button type="button" className={`${styles.headButton} ${styles.back}`} onClick={() => navigate("/telegram")} aria-label={t("chat.back")}>
                <Icon name="chevronLeft" size={24} />
              </button>
            )}
            <TgAvatar chat={chat} size={40} />
            <div className={styles.threadTitle}>
              <div className={styles.threadName}>{chat.name}</div>
              <div className={styles.threadSub}>{[chat.username && `@${chat.username}`, chat.phone && fmt.phone(chat.phone)].filter(Boolean).join(" · ") || t("tg.noContact")}</div>
            </div>
            {chat.username && (
              <a href={`https://t.me/${chat.username}`} target="_blank" rel="noreferrer" className={styles.headButton} title={t("tg.openInTelegram")} aria-label={t("tg.openInTelegram")}>
                <Icon name="externalLink" size={20} />
              </a>
            )}
          </header>

          {chat.canManage && (
            <div className={tg.clientBar}>
              {chat.client ? (
                <>
                  <Link to={`/clients/${chat.client.id}`} className={tg.clientChip}>
                    <Icon name="contact" size={16} />
                    {chat.client.name}
                  </Link>
                  <Button size="small" variant="plain" onClick={() => update({ clientId: null })}>
                    {t("tg.unlink")}
                  </Button>
                </>
              ) : (
                <>
                  <span className={tg.notClient}>{t("tg.notLinked")}</span>
                  <Button size="small" icon="link" onClick={() => setSheet("link")}>
                    {t("tg.link")}
                  </Button>
                  <Button size="small" variant="primary" icon="plus" onClick={() => setSheet("new")}>
                    {t("tg.newClient")}
                  </Button>
                </>
              )}
              <Button size="small" variant="plain" icon={chat.hidden ? "eye" : "minusCircle"} onClick={() => update({ hidden: !chat.hidden })}>
                {chat.hidden ? t("tg.unhide") : t("tg.hide")}
              </Button>
            </div>
          )}

          {chat.aiHidden && <div className={tg.aiHiddenNote}>{t("tg.aiHiddenNote")}</div>}
          {chat.canManage && (
            <ChatReview review={review} canReview={chat.canReview} onReview={reviewNow} busy={reviewing} onChecked={(r) => setData((d) => ({ ...d, review: r }))} />
          )}

          <Messages chatId={chat.id} messages={messages} hasOlder={hasOlder} />

          <div className={styles.readOnly}>{t("tg.replyInTelegram")}</div>

          {sheet === "link" && (
            <TgLinkSheet
              chat={chat}
              onClose={() => setSheet(null)}
              onLink={(payload) => {
                setSheet(null);
                update(payload);
              }}
            />
          )}
          {sheet === "new" && (
            <ClientSheet
              prefill={{ name: chat.name.startsWith("@") ? "" : chat.name, phone: chat.phone || "", source: "telegram" }}
              onClose={() => setSheet(null)}
              onSaved={async (client, { bookUrl }) => {
                setSheet(null);
                await update({ clientId: client.id });
                if (bookUrl) navigate(bookUrl);
              }}
            />
          )}
        </div>
      )}
    </AsyncBoundary>
  );
}

function Messages({ chatId, messages: first, hasOlder: firstHasOlder }) {
  const { t, fmt } = useI18n();
  const [older, setOlder] = useState([]);
  const [hasOlder, setHasOlder] = useState(firstHasOlder);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const messages = [...older, ...first];
  const lastId = first.at(-1)?.id;

  // New messages: to the bottom (as in any chat).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  async function loadOlder() {
    setLoading(true);
    try {
      const res = await api.tgChat(chatId, { before: messages[0].id });
      setOlder((list) => [...res.messages, ...list]);
      setHasOlder(res.hasOlder);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.messages} ref={scrollRef}>
      {hasOlder && (
        <Button size="small" variant="plain" className={styles.older} busy={loading} onClick={loadOlder}>
          {t("chat.older")}
        </Button>
      )}
      {messages.length === 0 ? (
        <div className={styles.emptyThread}>
          <span className={styles.emptyIcon}>
            <Icon name="send" size={28} />
          </span>
          <div>{t("tg.noMessages")}</div>
        </div>
      ) : (
        messages.map((m, i) => {
          const ms = new Date(m.sentAt).getTime();
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const day = new Date(ms).toDateString();
          const newDay = !prev || new Date(prev.sentAt).toDateString() !== day;
          const sameAsPrev = !newDay && prev && prev.out === m.out && ms - new Date(prev.sentAt).getTime() < 5 * 60 * 1000;
          const sameAsNext = next && next.out === m.out && new Date(next.sentAt).toDateString() === day && new Date(next.sentAt).getTime() - ms < 5 * 60 * 1000;
          return (
            <Fragment key={m.id}>
              {newDay && <div className={styles.day}>{fmt.dayHeader(ms)}</div>}
              <div className={`${styles.row} ${m.out ? styles.rowMine : ""} ${sameAsPrev ? "" : styles.rowFirst}`}>
                <div className={`${styles.bubble} ${m.out ? styles.mine : ""} ${sameAsNext ? "" : styles.bubbleLast}`}>
                  {m.out && m.auto && <div className={styles.author}>{t("tg.autoMessage")}</div>}
                  {m.out && !m.auto && !sameAsPrev && m.answeredBy && <div className={styles.author}>{m.answeredBy}</div>}
                  {m.deleted ? (
                    <span className={styles.deleted}>{t("tg.deleted")}</span>
                  ) : (
                    <>
                      <Attachment m={m} />
                      {m.text && m.kind !== "location" && <span className={tg.text}>{m.text}</span>}
                    </>
                  )}
                  <span className={styles.meta}>
                    {m.edited && !m.deleted && <span>{t("chat.edited")}</span>}
                    <span>{fmt.time(ms)}</span>
                  </span>
                </div>
              </div>
            </Fragment>
          );
        })
      )}
    </div>
  );
}

// A photo shows; a voice message plays; anything else is a file to open.
function Attachment({ m }) {
  const { t } = useI18n();
  if (m.kind === "text" || m.kind === "sticker") return null;
  // A place they shared: open it on the map.
  if (m.kind === "location" && /^-?[\d.]+,-?[\d.]+$/.test(m.text || "")) {
    return (
      <a href={`https://maps.google.com/?q=${m.text}`} target="_blank" rel="noreferrer" className={tg.fileLine}>
        {t("tg.kinds.location")}
        <Icon name="externalLink" size={14} />
      </a>
    );
  }
  if (!m.hasFile) {
    return (
      <span className={tg.fileLine}>
        <Icon name={KIND_ICON[m.kind] || "file"} size={16} />
        {t(`tg.kinds.${m.kind}`, { duration: "" }).trim()}
      </span>
    );
  }
  const url = api.tgFileUrl(m.id);
  if (m.kind === "photo") {
    return (
      <a href={url} target="_blank" rel="noreferrer" className={tg.photo}>
        <img src={url} alt={t("tg.kinds.photo", { duration: "" }).trim()} loading="lazy" />
      </a>
    );
  }
  if (m.kind === "voice" || m.kind === "audio") {
    return (
      <span className={tg.voice}>
        <audio controls preload="none" src={url} />
        {m.duration ? <span className={tg.duration}>{clock(m.duration)}</span> : null}
      </span>
    );
  }
  return (
    <a href={api.tgFileUrl(m.id, { download: true })} className={tg.fileLine}>
      <Icon name={KIND_ICON[m.kind] || "file"} size={16} />
      {m.fileName || t(`tg.kinds.${m.kind}`, { duration: m.duration ? clock(m.duration) : "" }).trim()}
      <Icon name="download" size={14} />
    </a>
  );
}

// ------------------------------------------------------------ on the client's page
// Their Telegram: name, @username, number, the last message — the whole chat
// in a sheet.
export function TelegramCard({ client }) {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.tgClientChats(client.id), [client.id]);
  const [open, setOpen] = useState(null);
  const chats = state.data || [];
  if (chats.length === 0) return null;
  return (
    <section className={tg.card} aria-label={t("tg.cardTitle")}>
      <h2 className={tg.cardTitle}>
        <Icon name="send" size={18} />
        {t("tg.cardTitle")}
      </h2>
      {chats.map((c) => (
        <div key={c.id} className={tg.cardRow}>
          <div className={tg.cardWho}>
            <strong>{c.name}</strong>
            <span className={tg.cardSub}>
              {c.username && (
                <a href={`https://t.me/${c.username}`} target="_blank" rel="noreferrer">
                  @{c.username}
                </a>
              )}
              {c.phone && <span>{fmt.phone(c.phone)}</span>}
            </span>
            <span className={tg.cardLast}>
              {c.lastMessage?.out ? `${t("tg.firm")}: ` : ""}
              {previewOf(c.lastMessage, t)}
            </span>
            <span className={tg.cardSub}>
              {t("tg.messageCount", { count: c.messageCount })}
              {c.lastMessageAt ? ` · ${fmt.dateTime(new Date(c.lastMessageAt).getTime())}` : ""}
              {c.waitingSince ? (
                <>
                  {" · "}
                  <Badge tone="warning">{t("tg.waiting", { time: waited(c.waitingSince, t) })}</Badge>
                </>
              ) : null}
            </span>
          </div>
          <Button size="small" icon="messages" onClick={() => setOpen(c.id)}>
            {t("tg.openChat")}
          </Button>
        </div>
      ))}
      {open && (
        <Sheet title={t("tg.cardTitle")} onClose={() => setOpen(null)}>
          <TgThread chatId={open} embedded onChanged={() => state.reload?.()} />
        </Sheet>
      )}
    </section>
  );
}
