import { useMemo, useState } from "react";
import styles from "./Chat.module.css";
import pageStyles from "../../pages/Pages.module.css";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import Sheet from "../ui/Sheet";
import { SearchField, TextAreaField, TextField } from "../ui/Field";
import { AsyncBoundary } from "../ui/Misc";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";

// Pieces of the staff chat (pages/ChatPage.jsx, pages/ChatThreadPage.jsx).

const initialsOf = (name) =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

// A colour of its own for each name (the same person, the same colour).
const PALETTE = ["#e17076", "#f59f4a", "#7bc862", "#4ab4e0", "#65aadd", "#a695e7", "#ee7aae", "#3fbbb0"];
export function colorFor(name) {
  let h = 0;
  for (const ch of String(name || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// A round picture with initials.
export function PersonAvatar({ name, size = 30 }) {
  return (
    <span className={styles.avatar} style={{ width: size, height: size, background: colorFor(name), fontSize: Math.round(size * 0.38) }}>
      {initialsOf(name)}
    </span>
  );
}

// The round picture in front of a chat: the firm for Everyone, a group
// icon, a client icon, the person's initials for a private chat.
export function ConvIcon({ conv, size = 48 }) {
  const icon = conv.kind === "everyone" ? "users" : conv.kind === "group" ? "messages" : conv.kind === "client" ? "contact" : null;
  if (!icon) return <PersonAvatar name={conv.title} size={size} />;
  const background = conv.kind === "everyone" ? "linear-gradient(135deg, var(--brand-start), var(--brand-end))" : conv.kind === "client" ? "#8e99a8" : colorFor(conv.title);
  return (
    <span className={styles.avatar} style={{ width: size, height: size, background }}>
      <Icon name={icon} size={Math.round(size * 0.44)} />
    </span>
  );
}

// Everyone else, to tick (a group's members) or to pick one (a private chat).
function PeoplePicker({ people, selected, onToggle, single = false }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase();
    return words ? people.filter((p) => p.name.toLowerCase().includes(words)) : people;
  }, [people, q]);
  return (
    <>
      <SearchField value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("chat.searchPeople")} />
      <div className={styles.people}>
        {shown.map((p) => (
          <label key={p.id} className={styles.person}>
            <input type={single ? "radio" : "checkbox"} name="person" checked={selected.includes(p.id)} onChange={() => onToggle(p.id)} />
            <span>{p.name}</span>
            <span className={styles.personRole}>{p.position || t(`roles.${p.role}`)}</span>
          </label>
        ))}
      </div>
    </>
  );
}

// A group (developer): its name and who's in it.
export function GroupSheet({ group, onClose, onSaved }) {
  const { t } = useI18n();
  const people = useAsync(() => api.chatPeople(), []);
  const [title, setTitle] = useState(group?.title || "");
  const [members, setMembers] = useState(() => (group?.members || []).map((m) => m.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toggle = (id) => setMembers((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  async function save(e) {
    e.preventDefault();
    if (!title.trim()) return setError(t("chat.errGroupName"));
    if (members.length === 0) return setError(t("chat.errMembers"));
    setBusy(true);
    setError("");
    try {
      const payload = { title: title.trim(), memberIds: members };
      onSaved(group ? await api.updateGroup(group.id, payload) : await api.createGroup(payload));
    } catch {
      setError(t("chat.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={group ? t("chat.editGroup") : t("chat.newGroup")} onClose={onClose}>
      <form onSubmit={save} className={pageStyles.formStack}>
        <TextField label={t("chat.groupName")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required />
        <AsyncBoundary state={people}>
          {(list) => <PeoplePicker people={list} selected={members} onToggle={toggle} />}
        </AsyncBoundary>
        <p className={pageStyles.note}>{t("chat.membersCount", { count: members.length })}</p>
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" variant="primary" busy={busy}>
            {group ? t("common.save") : t("chat.createGroup")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

// A private chat (boss, developer): who to write to.
export function DirectSheet({ onClose, onOpened }) {
  const { t } = useI18n();
  const people = useAsync(() => api.chatPeople(), []);
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function open(e) {
    e.preventDefault();
    if (!picked) return setError(t("chat.errPerson"));
    setBusy(true);
    setError("");
    try {
      onOpened(await api.directChat(picked));
    } catch {
      setError(t("chat.saveFailed"));
      setBusy(false);
    }
  }

  return (
    <Sheet title={t("chat.newDirect")} onClose={onClose}>
      <form onSubmit={open} className={pageStyles.formStack}>
        <AsyncBoundary state={people}>
          {(list) => <PeoplePicker people={list} selected={picked ? [picked] : []} onToggle={setPicked} single />}
        </AsyncBoundary>
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" variant="primary" busy={busy}>
            {t("chat.write")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

const pad = (n) => String(n).padStart(2, "0");
const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

// An event card: what and when; everyone in the chat is reminded an hour
// before and at the start.
export function EventSheet({ onClose, onSend }) {
  const { t } = useI18n();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const [title, setTitle] = useState("");
  const [at, setAt] = useState(toLocalInput(tomorrow));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(e) {
    e.preventDefault();
    if (!title.trim()) return setError(t("chat.errEventTitle"));
    const when = new Date(at);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now()) return setError(t("chat.errEventTime"));
    setBusy(true);
    setError("");
    try {
      await onSend({ text: note.trim(), event: { title: title.trim(), at: when.toISOString() } });
    } catch {
      setError(t("chat.sendFailed"));
      setBusy(false);
    }
  }

  return (
    <Sheet title={t("chat.newEvent")} onClose={onClose}>
      <form onSubmit={send} className={pageStyles.formStack}>
        <TextField label={t("chat.eventTitle")} placeholder={t("chat.eventTitlePh")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
        <TextField label={t("chat.eventAt")} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} required />
        <TextAreaField label={t("chat.eventNote")} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        <p className={pageStyles.note}>{t("chat.eventHint")}</p>
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" variant="primary" busy={busy}>
            {t("chat.sendEvent")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

// My own message tapped: change it or delete it.
export function MessageSheet({ message, onClose, onEdit, onDelete }) {
  const { t } = useI18n();
  const [text, setText] = useState(message.text);
  const [busy, setBusy] = useState(null);

  async function run(kind, action) {
    setBusy(kind);
    try {
      await action();
      onClose();
    } catch {
      setBusy(null);
    }
  }

  return (
    <Sheet title={t("chat.myMessage")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        {!message.event && <TextAreaField label={t("chat.text")} value={text} onChange={(e) => setText(e.target.value)} rows={4} />}
        <div className={pageStyles.formActions}>
          <Button
            variant="destructive"
            icon="trash"
            busy={busy === "delete"}
            onClick={() => window.confirm(t("chat.deleteConfirm")) && run("delete", onDelete)}
          >
            {message.event ? t("chat.cancelEvent") : t("chat.delete")}
          </Button>
          {!message.event && (
            <Button variant="primary" busy={busy === "edit"} disabled={!text.trim() || text === message.text} onClick={() => run("edit", () => onEdit(text.trim()))}>
              {t("common.save")}
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
