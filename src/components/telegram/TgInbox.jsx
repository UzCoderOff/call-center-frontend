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
// server's services/tgInbox.js) and, since 2026-10-26, to its Instagram
// (services/igInbox.js): the list («Mijozlar xabarlari»), one chat, and the
// same chat on the client's page. Staff answer in the Telegram / Instagram
// app; the AI may answer new people (services/aiReply) — its card on the chat
// shows what it is doing, who agreed to a consultation, and lets staff stop it.

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
  // "" | "telegram" | "instagram" | "agreed" | "handoff"
  const [show, setShow] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(timer);
  }, [q]);
  const params = {
    q: query,
    ...(hidden ? { hidden: 1 } : {}),
    ...(["telegram", "instagram"].includes(show) ? { platform: show } : {}),
    ...(["agreed", "handoff"].includes(show) ? { ai: show } : {}),
  };
  const state = useAsync(() => api.tgChats(params), [query, hidden, show]);
  const { setData } = state;
  useLive(() => api.tgChats(params).then(setData).catch(() => {}));
  const counts = state.data?.ai || {};
  const filters = [
    ["", t("tg.showAll")],
    ["telegram", "Telegram"],
    ["instagram", "Instagram"],
    ...(counts.agreed || show === "agreed" ? [["agreed", t("tgAi.filterAgreed", { count: counts.agreed || 0 })]] : []),
    ...(counts.handoff || show === "handoff" ? [["handoff", t("tgAi.filterHandoff", { count: counts.handoff || 0 })]] : []),
  ];

  return (
    <>
      <div className={tg.search}>
        <TextField aria-label={t("tg.search")} placeholder={t("tg.search")} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      </div>
      <div className={tg.filters} role="group" aria-label={t("tg.showAll")}>
        {filters.map(([key, label]) => (
          <button key={key || "all"} type="button" className={`${tg.filter} ${show === key ? tg.filterOn : ""} ${key === "agreed" ? tg.filterGood : key === "handoff" ? tg.filterWarn : ""}`} aria-pressed={show === key} onClick={() => setShow(key)}>
            {label}
          </button>
        ))}
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
            {waiting > 0 && !query && !hidden && !show && <div className={tg.waitingLine}>{t("tg.waitingCount", { count: waiting })}</div>}
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
                          {last?.out ? `${last.ai ? t("tgAi.author") : t("tg.firm")}: ` : ""}
                          {previewOf(last, t)}
                        </span>
                        <AiBadge state={c.ai} />
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

// What the AI did in a chat, in the list: they agreed, a person is needed, or it is talking.
function AiBadge({ state }) {
  const { t } = useI18n();
  if (state === "agreed") return <span className={`${tg.aiBadge} ${tg.aiBadgeGood}`}>{t("tgAi.badgeAgreed")}</span>;
  if (state === "handoff") return <span className={`${tg.aiBadge} ${tg.aiBadgeWarn}`}>{t("tgAi.badgeHandoff")}</span>;
  if (state === "on") return <span className={tg.aiBadge}>AI</span>;
  return null;
}

const isInstagram = (chat) => chat.platform === "instagram";

function TgAvatar({ chat, size = 48 }) {
  return (
    <span className={tg.avatarWrap}>
      <PersonAvatar name={chat.client?.name || chat.name} size={size} />
      <span className={`${tg.tgMark} ${isInstagram(chat) ? tg.igMark : ""}`} aria-hidden="true">
        <Icon name={isInstagram(chat) ? "instagram" : "send"} size={Math.round(size * 0.24)} />
      </span>
    </span>
  );
}

// Their profile in the app they wrote from.
const profileUrl = (chat) => (chat.username ? (isInstagram(chat) ? `https://instagram.com/${chat.username}` : `https://t.me/${chat.username}`) : null);

// ------------------------------------------------------------ the AI in a chat
// What the AI is doing here: talking, they agreed (call them to confirm the
// time and the payment), it handed over, stopped — its suggested reply in
// "only suggest" mode; and stopping it ("I'll answer") or giving it back.
function AiPanel({ chat, ai, onChanged }) {
  const { t, fmt } = useI18n();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!ai || (!ai.state && !ai.draft)) return null;
  const lead = ai.lead || {};
  const paused = ai.pausedUntil && new Date(ai.pausedUntil).getTime() > Date.now();
  const format = lead.format === "office" ? t("tgAi.office") : lead.format === "online" ? t("tgAi.online") : "";
  const rows = [
    [t("tgAi.name"), lead.name],
    [t("tgAi.phone"), lead.phone ? fmt.phone(lead.phone) : chat.phone ? fmt.phone(chat.phone) : ""],
    [t("tgAi.matter"), lead.problem],
    [t("tgAi.consultation"), [format, lead.time].filter(Boolean).join(", ")],
  ].filter(([, v]) => v);
  const tone = ai.state === "agreed" ? tg.aiGood : ai.state === "handoff" ? tg.aiWarn : "";
  const title =
    ai.state === "agreed"
      ? t("tgAi.agreedTitle")
      : ai.state === "handoff"
        ? t("tgAi.handoffTitle")
        : ai.state === "off"
          ? t("tgAi.offTitle")
          : ai.state === "done"
            ? t("tgAi.doneTitle")
            : ai.state === "on"
              ? paused
                ? t("tgAi.pausedTitle", { time: fmt.time(new Date(ai.pausedUntil).getTime()) })
                : t("tgAi.onTitle")
              : t("tgAi.draftTitle");

  async function setOn(on) {
    setBusy(true);
    try {
      await api.tgChatAi(chat.id, on);
      onChanged();
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(ai.draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={`${tg.aiPanel} ${tone}`}>
      <div className={tg.aiHead}>
        <Icon name={ai.state === "agreed" ? "checkCircle" : ai.state === "handoff" ? "alertTriangle" : "sparkles"} size={18} />
        <strong>{title}</strong>
        {["on", "agreed"].includes(ai.state) && (
          <Button size="small" variant="plain" busy={busy} className={tg.aiAction} onClick={() => setOn(false)}>
            {t("tgAi.stop")}
          </Button>
        )}
        {["off", "handoff", "done"].includes(ai.state) && (
          <Button size="small" variant="plain" busy={busy} className={tg.aiAction} onClick={() => setOn(true)}>
            {t("tgAi.giveBack")}
          </Button>
        )}
      </div>
      {ai.state === "agreed" && <p className={tg.aiHint}>{t("tgAi.agreedHint")}</p>}
      {ai.state === "handoff" && ai.note && <p className={tg.aiHint}>{ai.note}</p>}
      {rows.length > 0 && (
        <dl className={tg.aiRows}>
          {rows.map(([label, value]) => (
            <Fragment key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </Fragment>
          ))}
        </dl>
      )}
      {ai.draft && (
        <div className={tg.aiDraft}>
          <div className={tg.aiDraftHead}>
            <span>{t("tgAi.draft")}</span>
            <Button size="small" icon={copied ? "check" : "copy"} onClick={copy}>
              {copied ? t("tgAi.copied") : t("tgAi.copy")}
            </Button>
          </div>
          <div className={tg.text}>{ai.draft}</div>
          <div className={tg.aiDraftNote}>{t(isInstagram(chat) ? "tgAi.draftNoteIg" : "tgAi.draftNoteTg")}</div>
        </div>
      )}
    </div>
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
      {({ chat, messages, hasOlder, review, ai }) => (
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
            {profileUrl(chat) && (
              <a
                href={profileUrl(chat)}
                target="_blank"
                rel="noreferrer"
                className={styles.headButton}
                title={t(isInstagram(chat) ? "tg.openInInstagram" : "tg.openInTelegram")}
                aria-label={t(isInstagram(chat) ? "tg.openInInstagram" : "tg.openInTelegram")}
              >
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
          {chat.canManage && <AiPanel chat={chat} ai={ai} onChanged={() => api.tgChat(chatId).then(setData).catch(() => {})} />}
          {chat.canManage && (
            <ChatReview review={review} canReview={chat.canReview} onReview={reviewNow} busy={reviewing} onChecked={(r) => setData((d) => ({ ...d, review: r }))} />
          )}

          <Messages chatId={chat.id} messages={messages} hasOlder={hasOlder} />

          <div className={styles.readOnly}>{t(isInstagram(chat) ? "tg.replyInInstagram" : "tg.replyInTelegram")}</div>

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
                  {m.out && m.ai && !sameAsPrev && <div className={styles.author}>{t("tgAi.author")}</div>}
                  {m.out && !m.auto && !m.ai && !sameAsPrev && m.answeredBy && <div className={styles.author}>{m.answeredBy}</div>}
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
              <span>{isInstagram(c) ? "Instagram" : "Telegram"}</span>
              {c.username && (
                <a href={profileUrl(c)} target="_blank" rel="noreferrer">
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
