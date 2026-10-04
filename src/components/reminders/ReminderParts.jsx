import { useState } from "react";
import { Link } from "react-router-dom";
import pageStyles from "../../pages/Pages.module.css";
import taskStyles from "../tasks/Tasks.module.css";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Icon from "../ui/Icon";
import Sheet from "../ui/Sheet";
import { Chips, SelectField, TextAreaField, TextField } from "../ui/Field";
import { List, ListRow } from "../ui/List";
import { KeyValue } from "../ui/Misc";
import { useAuth, isManagerRole } from "../../hooks/useAuth";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { callBridge, canCallInApp } from "../../lib/appBridge";
import { saveFailed } from "../../lib/saveFailed";
import { useI18n } from "../../i18n";

// Reminders: anyone sets them for themselves; the boss and the developer
// also for anyone. At the time the person gets it in the Ledger app and on
// Telegram. "Remind me" on a call coming in makes one with the number.

const pad = (n) => String(n).padStart(2, "0");
// A Date as the value of <input type="datetime-local"> (the phone's time).
function toLocalInput(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Quick times: in an hour, today at 18:00 (if still ahead), tomorrow at 9:00.
function quickTimes() {
  const now = new Date();
  const inHour = new Date(now.getTime() + 60 * 60 * 1000);
  inHour.setSeconds(0, 0);
  const evening = new Date(now);
  evening.setHours(18, 0, 0, 0);
  const morning = new Date(now);
  morning.setDate(morning.getDate() + 1);
  morning.setHours(9, 0, 0, 0);
  return [
    { value: "hour", at: inHour },
    ...(evening.getTime() > now.getTime() + 15 * 60 * 1000 ? [{ value: "evening", at: evening }] : []),
    { value: "morning", at: morning },
  ];
}

// "Bugun 18:00", "Ertaga 9:00", "2-oktabr, 10:00"; red once the time has passed.
export function WhenBadge({ reminder }) {
  const { t, fmt } = useI18n();
  const ms = new Date(reminder.dueAt).getTime();
  if (reminder.doneAt) {
    return (
      <Badge tone="good" icon="check">
        {t("reminders.doneOn", { when: fmt.dateTime(new Date(reminder.doneAt).getTime()) })}
      </Badge>
    );
  }
  const due = new Date(ms);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const label =
    due.toDateString() === today.toDateString()
      ? t("reminders.today", { time: fmt.time(ms) })
      : due.toDateString() === tomorrow.toDateString()
        ? t("reminders.tomorrow", { time: fmt.time(ms) })
        : fmt.dateTime(ms);
  if (ms < Date.now()) {
    return (
      <Badge tone="critical" icon="alarm">
        {label}
      </Badge>
    );
  }
  return (
    <Badge tone={due.toDateString() === today.toDateString() ? "warning" : "neutral"} icon="alarm">
      {label}
    </Badge>
  );
}

function DoneButton({ reminder, onChanged }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      onChanged(await api.updateReminder(reminder.id, { done: !reminder.doneAt }));
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      className={`${taskStyles.doneButton} ${reminder.doneAt ? taskStyles.doneOn : ""}`}
      onClick={toggle}
      disabled={busy}
      aria-label={reminder.doneAt ? t("reminders.markNotDone") : t("reminders.markDone")}
      title={reminder.doneAt ? t("reminders.markNotDone") : t("reminders.markDone")}
    >
      <Icon name="check" size={18} strokeWidth={2.4} />
    </button>
  );
}

// One reminder in a list. `showFor`: the ones I set for others (who it's for).
export function ReminderRow({ reminder, showFor, canTick, onOpen, onChanged }) {
  const { t, fmt } = useI18n();
  const sub = [
    showFor ? reminder.user?.name : reminder.createdBy && reminder.createdBy.id !== reminder.user?.id ? t("reminders.fromName", { name: reminder.createdBy.name }) : null,
    reminder.client?.name,
    reminder.phone && !reminder.client ? fmt.phone(reminder.phone) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <ListRow
      onClick={() => onOpen(reminder)}
      title={<span className={reminder.doneAt ? taskStyles.doneTitle : undefined}>{reminder.title}</span>}
      subtitle={sub || undefined}
      footer={<WhenBadge reminder={reminder} />}
      chevron={false}
      actions={canTick ? <DoneButton reminder={reminder} onChanged={onChanged} /> : undefined}
    />
  );
}

// Setting a reminder (for myself — or, boss / developer, for anyone), or changing one.
export function ReminderSheet({ reminder, client, onClose, onSaved }) {
  const { user } = useAuth();
  const { t, fmt } = useI18n();
  const manager = isManagerRole(user.role);
  const editing = Boolean(reminder);
  const people = useAsync(() => (manager && !editing ? api.reminderPeople() : Promise.resolve([])), [manager, editing]);
  const quick = quickTimes();
  const [title, setTitle] = useState(reminder?.title || "");
  const [notes, setNotes] = useState(reminder?.notes || "");
  const [forId, setForId] = useState(reminder?.user?.id ? String(reminder.user.id) : String(user.id));
  const [due, setDue] = useState(reminder ? toLocalInput(new Date(reminder.dueAt)) : toLocalInput(quick[0].at));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const clientRef = reminder?.client || client || null;
  // Chips show their labels ("1 soatdan keyin", "Ertaga 9:00").
  const quickLabeled = quick.map((q) => ({ ...q, label: t(`reminders.quick.${q.value}`, { time: fmt.time(q.at.getTime()) }) }));
  const quickLabel = quickLabeled.find((q) => toLocalInput(q.at) === due)?.label ?? null;

  async function save(e) {
    e.preventDefault();
    if (!title.trim()) return setError(t("reminders.errTitle"));
    const dueAt = new Date(due);
    if (Number.isNaN(dueAt.getTime())) return setError(t("reminders.errDue"));
    setBusy(true);
    setError("");
    const payload = { title: title.trim(), notes: notes.trim() || null, dueAt: dueAt.toISOString() };
    try {
      onSaved(
        editing
          ? await api.updateReminder(reminder.id, payload)
          : await api.createReminder({ ...payload, userId: Number(forId), clientId: clientRef?.id ?? null, phone: clientRef?.phone ?? null })
      );
    } catch {
      setError(t("reminders.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  // Grouped like the task form: lawyers, then staff by position.
  const groups = new Map();
  for (const p of people.data || []) {
    if (p.id === user.id) continue;
    const group = p.role === "EMPLOYEE" ? p.position || t("tasks.staff") : t(`roles.${p.role}`);
    groups.set(group, [...(groups.get(group) || []), p]);
  }

  return (
    <Sheet title={editing ? t("reminders.edit") : t("reminders.new")} onClose={onClose}>
      <form onSubmit={save} className={pageStyles.formStack}>
        {clientRef && <KeyValue label={t("reminders.client")}>{clientRef.name}</KeyValue>}
        <TextField label={t("reminders.title_")} placeholder={t("reminders.titlePh")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required autoFocus={!editing} />
        {manager && !editing && (
          <SelectField label={t("reminders.forWhom")} value={forId} onChange={(e) => setForId(e.target.value)}>
            <option value={String(user.id)}>{t("reminders.me")}</option>
            {[...groups.entries()].map(([group, list]) => (
              <optgroup key={group} label={group}>
                {list.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </SelectField>
        )}
        <div>
          <Chips
            options={quickLabeled.map((q) => q.label)}
            value={quickLabel}
            onChange={(label) => {
              const q = quickLabeled.find((x) => x.label === label);
              if (q) setDue(toLocalInput(q.at));
            }}
          />
        </div>
        <TextField label={t("reminders.due")} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} required />
        <TextAreaField label={t("reminders.notes")} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        <p className={pageStyles.note}>{t("reminders.deliveryNote")}</p>
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" variant="primary" busy={busy}>
            {editing ? t("common.save") : t("reminders.set")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

// One reminder opened: done / not done, Call for a call back, and edit /
// delete for whoever set it (or a manager).
export function ReminderDetailSheet({ reminder, onClose, onChanged, onEdit, onDeleted }) {
  const { user } = useAuth();
  const { t, fmt } = useI18n();
  const manager = isManagerRole(user.role);
  const mine = reminder.user?.id === user.id;
  const setByMe = reminder.createdBy?.id === user.id;
  const canEdit = setByMe || manager;
  const [busy, setBusy] = useState(null);
  const canCall = reminder.phone && canCallInApp();

  async function run(kind, action) {
    setBusy(kind);
    try {
      await action();
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet title={reminder.title} onClose={onClose}>
      <div>
        <KeyValue label={t("reminders.due")}>
          <WhenBadge reminder={{ ...reminder, doneAt: null }} />
        </KeyValue>
        {!mine && <KeyValue label={t("reminders.forWhom")}>{reminder.user?.name}</KeyValue>}
        {reminder.createdBy && !setByMe && <KeyValue label={t("reminders.setBy")}>{reminder.createdBy.name}</KeyValue>}
        {reminder.client && (
          <KeyValue label={t("reminders.client")}>
            <Link to={`/clients/${reminder.client.id}`} onClick={onClose}>
              {reminder.client.name}
            </Link>
          </KeyValue>
        )}
        {reminder.phone && (
          <KeyValue label={t("reminders.phone")}>
            <a href={`tel:${reminder.phone}`}>{fmt.phone(reminder.phone)}</a>
          </KeyValue>
        )}
      </div>
      {reminder.notes && <p className={taskStyles.notes}>{reminder.notes}</p>}
      <div className={pageStyles.formStack} style={{ marginTop: 12 }}>
        {canCall && (
          <Button variant="primary" size="large" block icon="phone" onClick={() => callBridge("call", reminder.phone)}>
            {t("reminders.call")}
          </Button>
        )}
        {(mine || manager) && (
          <Button
            variant={reminder.doneAt || canCall ? "secondary" : "primary"}
            size="large"
            block
            icon="check"
            busy={busy === "done"}
            onClick={() => run("done", async () => onChanged(await api.updateReminder(reminder.id, { done: !reminder.doneAt })))}
          >
            {reminder.doneAt ? t("reminders.markNotDone") : t("reminders.markDone")}
          </Button>
        )}
        {canEdit && (
          <div className={pageStyles.actionsRow} style={{ marginTop: 0 }}>
            <Button icon="edit" onClick={onEdit}>
              {t("reminders.edit")}
            </Button>
            <Button
              variant="destructive"
              icon="trash"
              busy={busy === "delete"}
              onClick={() =>
                window.confirm(t("reminders.deleteConfirm")) &&
                run("delete", async () => {
                  await api.deleteReminder(reminder.id);
                  onDeleted(reminder);
                })
              }
            >
              {t("reminders.delete")}
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

// Home page: my reminders still to come today and late ones. Hidden when none.
export function MyRemindersCard() {
  const { t } = useI18n();
  const state = useAsync(() => api.reminders({ view: "mine" }), []);
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(null);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const list = (state.data || []).filter((r) => new Date(r.dueAt).getTime() <= endOfToday.getTime());
  if (list.length === 0) return null;
  const replace = (updated) => state.setData((rows) => rows.map((r) => (r.id === updated.id ? updated : r)).filter((r) => !r.doneAt));
  return (
    <Card
      flush
      title={t("reminders.myTitle")}
      subtitle={t("reminders.count", { count: list.length })}
      action={
        <Button size="small" variant="plain" to="/reminders">
          {t("common.seeAll")}
          <Icon name="chevronRight" size={15} />
        </Button>
      }
    >
      <List plain inset={16}>
        {list.slice(0, 5).map((r) => (
          <ReminderRow key={r.id} reminder={r} canTick onOpen={setOpen} onChanged={replace} />
        ))}
      </List>
      {open && (
        <ReminderDetailSheet
          reminder={open}
          onClose={() => setOpen(null)}
          onChanged={(updated) => {
            replace(updated);
            setOpen(null);
          }}
          onEdit={() => {
            setEditing(open);
            setOpen(null);
          }}
          onDeleted={() => {
            state.reload();
            setOpen(null);
          }}
        />
      )}
      {editing && (
        <ReminderSheet
          reminder={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            replace(updated);
            setEditing(null);
          }}
        />
      )}
    </Card>
  );
}
