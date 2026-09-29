import { useState } from "react";
import { Link } from "react-router-dom";
import pageStyles from "../../pages/Pages.module.css";
import styles from "./Tasks.module.css";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Icon from "../ui/Icon";
import Sheet from "../ui/Sheet";
import { SelectField, TextAreaField, TextField } from "../ui/Field";
import { List, ListRow } from "../ui/List";
import { KeyValue } from "../ui/Misc";
import { useAuth, isManagerRole } from "../../hooks/useAuth";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { saveFailed } from "../../lib/saveFailed";
import { useI18n } from "../../i18n";

// Tasks: work the boss gives one person, with a due time. The person sees
// them on their home page and in Vazifalar, ticks them done (here or in
// Telegram); the boss sees when.

const pad = (n) => String(n).padStart(2, "0");
// A Date as the value of <input type="datetime-local"> (the phone's time).
function toLocalInput(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// A sensible default due time: today at 18:00, or tomorrow at 10:00 late in the day.
function defaultDue() {
  const d = new Date();
  if (d.getHours() < 17) d.setHours(18, 0, 0, 0);
  else {
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
  }
  return toLocalInput(d);
}

// "Muddati oʻtgan", "Bugun 18:00", "2-oktabr, 10:00" — with a colour and words.
export function DueBadge({ task }) {
  const { t, fmt } = useI18n();
  const due = new Date(task.dueAt);
  const ms = due.getTime();
  if (task.doneAt) {
    return (
      <Badge tone="good" icon="check">
        {t("tasks.doneOn", { when: fmt.dateTime(new Date(task.doneAt).getTime()) })}
      </Badge>
    );
  }
  const today = new Date();
  const sameDay = due.toDateString() === today.toDateString();
  if (ms < Date.now()) {
    return (
      <Badge tone="critical" icon="alertCircle">
        {t("tasks.overdue", { when: sameDay ? fmt.time(ms) : fmt.dateTime(ms) })}
      </Badge>
    );
  }
  return (
    <Badge tone={sameDay ? "warning" : "neutral"} icon="clock">
      {sameDay ? t("tasks.today", { time: fmt.time(ms) }) : fmt.dateTime(ms)}
    </Badge>
  );
}

// The round "done" button at the end of a task row.
function DoneButton({ task, onChanged }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      onChanged(await api.updateTask(task.id, { done: !task.doneAt }));
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      className={`${styles.doneButton} ${task.doneAt ? styles.doneOn : ""}`}
      onClick={toggle}
      disabled={busy}
      aria-label={task.doneAt ? t("tasks.markNotDone") : t("tasks.markDone")}
      title={task.doneAt ? t("tasks.markNotDone") : t("tasks.markDone")}
    >
      <Icon name="check" size={18} strokeWidth={2.4} />
    </button>
  );
}

// One task in a list. `showAssignee`: the boss's lists (who it's for).
export function TaskRow({ task, showAssignee, canTick, onOpen, onChanged }) {
  const { t } = useI18n();
  const sub = [showAssignee ? task.assignee?.name : task.createdBy ? t("tasks.fromName", { name: task.createdBy.name }) : null, task.client?.name].filter(Boolean).join(" · ");
  return (
    <ListRow
      onClick={() => onOpen(task)}
      title={<span className={task.doneAt ? styles.doneTitle : undefined}>{task.title}</span>}
      subtitle={sub || undefined}
      footer={<DueBadge task={task} />}
      chevron={false}
      actions={canTick ? <DoneButton task={task} onChanged={onChanged} /> : undefined}
    />
  );
}

// Giving a task (managers), or changing one.
export function TaskSheet({ task, client, onClose, onSaved }) {
  const { t } = useI18n();
  const editing = Boolean(task);
  const people = useAsync(() => api.taskPeople(), []);
  const [title, setTitle] = useState(task?.title || "");
  const [notes, setNotes] = useState(task?.notes || "");
  const [assigneeId, setAssigneeId] = useState(task?.assignee?.id ? String(task.assignee.id) : "");
  const [due, setDue] = useState(task ? toLocalInput(new Date(task.dueAt)) : defaultDue());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const clientRef = task?.client || client || null;

  async function save(e) {
    e.preventDefault();
    if (!title.trim()) return setError(t("tasks.errTitle"));
    if (!assigneeId) return setError(t("tasks.errAssignee"));
    const dueAt = new Date(due);
    if (Number.isNaN(dueAt.getTime())) return setError(t("tasks.errDue"));
    setBusy(true);
    setError("");
    const payload = { title: title.trim(), notes: notes.trim() || null, assigneeId: Number(assigneeId), dueAt: dueAt.toISOString() };
    try {
      onSaved(editing ? await api.updateTask(task.id, payload) : await api.createTask({ ...payload, clientId: clientRef?.id ?? null }));
    } catch {
      setError(t("tasks.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  // Grouped so the list reads like the firm: lawyers, then staff by position.
  const groups = new Map();
  for (const p of people.data || []) {
    const group = p.role === "EMPLOYEE" ? p.position || t("tasks.staff") : t(`roles.${p.role}`);
    groups.set(group, [...(groups.get(group) || []), p]);
  }

  return (
    <Sheet title={editing ? t("tasks.edit") : t("tasks.new")} onClose={onClose}>
      <form onSubmit={save} className={pageStyles.formStack}>
        {clientRef && <KeyValue label={t("tasks.client")}>{clientRef.name}</KeyValue>}
        <TextField label={t("tasks.title_")} placeholder={t("tasks.titlePh")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
        <SelectField label={t("tasks.assignee")} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} required>
          <option value="">{t("tasks.pickAssignee")}</option>
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
        <TextField label={t("tasks.due")} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} required />
        <TextAreaField label={t("tasks.notes")} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        <p className={pageStyles.note}>{t("tasks.telegramNote")}</p>
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" variant="primary" busy={busy}>
            {editing ? t("common.save") : t("tasks.give")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

// One task opened: everything about it, done / not done, and for managers
// edit and delete.
export function TaskDetailSheet({ task, onClose, onChanged, onEdit, onDeleted }) {
  const { user } = useAuth();
  const { t, fmt } = useI18n();
  const manager = isManagerRole(user.role);
  const mine = task.assignee?.id === user.id;
  const [busy, setBusy] = useState(null);

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
    <Sheet title={task.title} onClose={onClose}>
      <div>
        <KeyValue label={t("tasks.due")}>
          <DueBadge task={{ ...task, doneAt: null }} />
        </KeyValue>
        <KeyValue label={t("tasks.assignee")}>{task.assignee?.name}</KeyValue>
        {task.createdBy && <KeyValue label={t("tasks.givenBy")}>{task.createdBy.name}</KeyValue>}
        {task.client && (
          <KeyValue label={t("tasks.client")}>
            {user.role === "LAWYER" ? (
              task.client.name
            ) : (
              <Link to={`/clients/${task.client.id}`} onClick={onClose}>
                {task.client.name}
              </Link>
            )}
          </KeyValue>
        )}
        {task.doneAt && (
          <KeyValue label={t("tasks.status")}>
            {t("tasks.doneBy", { when: fmt.dateTime(new Date(task.doneAt).getTime()), name: task.doneBy?.name || "" })}
          </KeyValue>
        )}
      </div>
      {task.notes && <p className={styles.notes}>{task.notes}</p>}
      <div className={pageStyles.formStack} style={{ marginTop: 12 }}>
        {(mine || manager) && (
          <Button
            variant={task.doneAt ? "secondary" : "primary"}
            size="large"
            block
            icon="check"
            busy={busy === "done"}
            onClick={() => run("done", async () => onChanged(await api.updateTask(task.id, { done: !task.doneAt })))}
          >
            {task.doneAt ? t("tasks.markNotDone") : t("tasks.markDone")}
          </Button>
        )}
        {manager && (
          <div className={pageStyles.actionsRow} style={{ marginTop: 0 }}>
            <Button icon="edit" onClick={onEdit}>
              {t("tasks.edit")}
            </Button>
            <Button
              variant="destructive"
              icon="trash"
              busy={busy === "delete"}
              onClick={() =>
                window.confirm(t("tasks.deleteConfirm")) &&
                run("delete", async () => {
                  await api.deleteTask(task.id);
                  onDeleted(task);
                })
              }
            >
              {t("tasks.delete")}
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

// Home page: my open tasks, most urgent first. Hidden when there are none.
export function MyTasksCard() {
  const { t } = useI18n();
  const state = useAsync(() => api.tasks({ view: "mine" }), []);
  const [open, setOpen] = useState(null);
  const list = state.data || [];
  if (list.length === 0) return null;
  const late = list.filter((x) => new Date(x.dueAt).getTime() < Date.now()).length;
  const replace = (updated) => state.setData((rows) => rows.map((r) => (r.id === updated.id ? updated : r)).filter((r) => !r.doneAt));
  return (
    <Card
      flush
      title={t("tasks.myTitle")}
      subtitle={late ? t("tasks.countLate", { count: list.length, late }) : t("tasks.count", { count: list.length })}
      action={
        <Button size="small" variant="plain" to="/tasks">
          {t("common.seeAll")}
          <Icon name="chevronRight" size={15} />
        </Button>
      }
    >
      <List plain inset={16}>
        {list.slice(0, 5).map((task) => (
          <TaskRow key={task.id} task={task} canTick onOpen={setOpen} onChanged={replace} />
        ))}
      </List>
      {open && (
        <TaskDetailSheet
          task={open}
          onClose={() => setOpen(null)}
          onChanged={(updated) => {
            replace(updated);
            setOpen(null);
          }}
          onEdit={() => setOpen(null)}
          onDeleted={() => {
            state.reload();
            setOpen(null);
          }}
        />
      )}
    </Card>
  );
}
