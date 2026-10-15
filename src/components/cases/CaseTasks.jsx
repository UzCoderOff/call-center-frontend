import { useState } from "react";
import styles from "./Cases.module.css";
import clientStyles from "../clients/Clients.module.css";
import pageStyles from "../../pages/Pages.module.css";
import Card from "../ui/Card";
import Sheet from "../ui/Sheet";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { SelectField, TextField } from "../ui/Field";
import { AsyncBoundary } from "../ui/Misc";
import { useAuth } from "../../hooks/useAuth";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { todayIso } from "../../lib/format";
import { saveFailed } from "../../lib/saveFailed";
import { useI18n } from "../../i18n";

// A case's tasks (routes/tasks.js): what's to be done on it, by whom, by
// when — the people on the case give them to each other, tick them off, or
// put a ready-made list on it at once ("Yangi shartnoma"…). Each is also the
// person's own task (Home, Telegram reminders), and the case's history says
// when it was given and done.

export const TEAM_ROLES = ["manager", "lawyer", "coordinator"];

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// "YYYY-MM-DD" + "HH:MM" on this device -> an ISO moment.
const at = (date, time) => new Date(`${date}T${time || "18:00"}:00`).toISOString();

export function useCaseTasks(caseId, refresh) {
  return useAsync(() => api.tasks({ caseId }), [caseId, refresh]);
}

export default function CaseTasks({ item, tasks, onChanged, compact = false }) {
  const { t, fmt } = useI18n();
  const { user } = useAuth();
  const team = TEAM_ROLES.includes(item.permissions?.role);
  const [adding, setAdding] = useState(false);
  const [checklist, setChecklist] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [busy, setBusy] = useState(null);

  async function tick(task) {
    setBusy(task.id);
    try {
      await api.updateTask(task.id, { done: !task.doneAt });
      onChanged();
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setBusy(null);
    }
  }

  async function remove(task) {
    if (!confirm(t("caseTasks.confirmRemove", { title: task.title }))) return;
    try {
      await api.deleteTask(task.id);
      onChanged();
    } catch (err) {
      saveFailed(err, t);
    }
  }

  return (
    <Card
      title={t("caseTasks.title")}
      subtitle={compact ? undefined : t("caseTasks.subtitle")}
      action={
        team &&
        !compact && (
          <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
            <Button size="small" variant="plain" icon="clipboard" onClick={() => setChecklist(true)}>
              {t("caseTasks.fromList")}
            </Button>
            <Button size="small" icon="plus" onClick={() => setAdding(true)}>
              {t("caseTasks.add")}
            </Button>
          </span>
        )
      }
    >
      <AsyncBoundary state={tasks}>
        {(rows) => {
          const open = rows.filter((x) => !x.doneAt);
          const done = rows.filter((x) => x.doneAt);
          const shown = compact ? open.slice(0, 4) : open;
          const row = (task) => {
            const mayTick = team || task.assignee?.id === user.id || task.createdBy?.id === user.id;
            const mayRemove = (user.role === "BOSS" || user.role === "DEVELOPER" || task.createdBy?.id === user.id) && !compact;
            const late = !task.doneAt && new Date(task.dueAt).getTime() < Date.now();
            return (
              <li key={task.id} className={`${styles.row} ${task.doneAt ? styles.done : ""}`}>
                <button
                  type="button"
                  className={`${styles.tick} ${task.doneAt ? styles.tickOn : ""}`}
                  onClick={() => tick(task)}
                  disabled={!mayTick || busy === task.id}
                  aria-label={task.doneAt ? t("caseTasks.undo") : t("caseTasks.markDone")}
                  title={task.doneAt ? t("caseTasks.undo") : t("caseTasks.markDone")}
                >
                  <Icon name="check" size={15} strokeWidth={3} />
                </button>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{task.title}</span>
                  <span className={styles.rowSub}>
                    {[
                      task.assignee?.name,
                      task.doneAt ? t("caseTasks.doneOn", { when: fmt.dateTime(new Date(task.doneAt).getTime()) }) : null,
                      !task.doneAt ? (
                        <span key="due" className={late ? styles.overdue : undefined}>
                          {late ? t("caseTasks.late", { when: fmt.dateTime(new Date(task.dueAt).getTime()) }) : t("caseTasks.due", { when: fmt.dateTime(new Date(task.dueAt).getTime()) })}
                        </span>
                      ) : null,
                      task.createdBy && task.createdBy.id !== task.assignee?.id ? t("caseTasks.givenBy", { name: task.createdBy.name }) : null,
                    ]
                      .filter(Boolean)
                      .reduce((acc, part, i) => (i ? [...acc, " · ", part] : [part]), [])}
                  </span>
                  {task.notes && !compact && <span className={styles.rowText}>{task.notes}</span>}
                </span>
                {mayRemove && (
                  <button type="button" className={clientStyles.iconButton} onClick={() => remove(task)} aria-label={t("caseTasks.remove")}>
                    <Icon name="trash" size={15} />
                  </button>
                )}
              </li>
            );
          };
          return (
            <>
              {open.length === 0 ? <p className={styles.empty}>{done.length ? t("caseTasks.allDone") : t("caseTasks.none")}</p> : <ul className={styles.rows}>{shown.map(row)}</ul>}
              {compact && open.length > shown.length && <p className={styles.empty}>{t("caseTasks.more", { count: open.length - shown.length })}</p>}
              {!compact && done.length > 0 && (
                <>
                  <Button size="small" variant="plain" icon={showDone ? "chevronDown" : "chevronRight"} onClick={() => setShowDone((v) => !v)}>
                    {t("caseTasks.doneCount", { count: done.length })}
                  </Button>
                  {showDone && <ul className={styles.rows}>{done.map(row)}</ul>}
                </>
              )}
            </>
          );
        }}
      </AsyncBoundary>
      {adding && <TaskSheet item={item} onClose={() => setAdding(false)} onSaved={() => (setAdding(false), onChanged())} />}
      {checklist && <ChecklistSheet item={item} onClose={() => setChecklist(false)} onSaved={() => (setChecklist(false), onChanged())} />}
    </Card>
  );
}

function PeopleField({ item, value, onChange }) {
  const { t } = useI18n();
  const people = useAsync(() => api.taskPeople(item.id), [item.id]);
  return (
    <SelectField label={t("caseTasks.who")} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t("caseTasks.pickWho")}</option>
      {(people.data || []).map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </SelectField>
  );
}

function TaskSheet({ item, onClose, onSaved }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  // Themselves to start with — not the developer, who isn't on the team.
  const [assigneeId, setAssigneeId] = useState(user.role === "DEVELOPER" ? "" : String(user.id));
  const [date, setDate] = useState(tomorrow());
  const [time, setTime] = useState("18:00");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!title.trim()) return setError(t("caseTasks.titleRequired"));
    if (!assigneeId) return setError(t("caseTasks.pickWho"));
    setBusy(true);
    setError("");
    try {
      await api.createTask({ caseId: item.id, title: title.trim(), assigneeId: Number(assigneeId), dueAt: at(date, time), notes: notes.trim() || null });
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(false);
    }
  }

  return (
    <Sheet title={t("caseTasks.add")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <TextField label={t("caseTasks.what")} placeholder={t("caseTasks.whatPlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <PeopleField item={item} value={assigneeId} onChange={setAssigneeId} />
        <div className={clientStyles.twoCol}>
          <TextField label={t("caseTasks.byDate")} type="date" value={date} min={todayIso()} onChange={(e) => setDate(e.target.value)} />
          <TextField label={t("caseTasks.byTime")} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <TextField label={t("caseTasks.notes")} value={notes} onChange={(e) => setNotes(e.target.value)} />
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" busy={busy} onClick={save}>
            {t("caseTasks.give")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

// A ready-made list (Sozlamalar → Ish andozalari) put on the case at once.
function ChecklistSheet({ item, onClose, onSaved }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const lists = useAsync(() => api.checklists(), []);
  const [listId, setListId] = useState("");
  const [assigneeId, setAssigneeId] = useState(user.role === "DEVELOPER" ? "" : String(user.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const chosen = (lists.data?.lists || []).find((l) => l.id === listId);

  async function save() {
    if (!listId) return setError(t("caseTasks.pickList"));
    if (!assigneeId) return setError(t("caseTasks.pickWho"));
    setBusy(true);
    setError("");
    try {
      await api.applyChecklist(listId, item.id, Number(assigneeId));
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(false);
    }
  }

  return (
    <Sheet title={t("caseTasks.fromList")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <SelectField label={t("caseTasks.list")} value={listId} onChange={(e) => setListId(e.target.value)}>
          <option value="">{t("caseTasks.pickList")}</option>
          {(lists.data?.lists || []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </SelectField>
        {chosen && (
          <ul className={styles.rows}>
            {chosen.items.map((it, i) => (
              <li key={i} className={styles.row}>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{it.title}</span>
                  <span className={styles.rowSub}>{it.days ? t("caseTasks.inDays", { days: it.days }) : t("caseTasks.today")}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <PeopleField item={item} value={assigneeId} onChange={setAssigneeId} />
        <p className={pageStyles.note}>{t("caseTasks.listHint")}</p>
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" busy={busy} onClick={save}>
            {t("caseTasks.putOn")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
