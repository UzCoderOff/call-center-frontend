import { useState } from "react";
import pageStyles from "./Pages.module.css";
import Button from "../components/ui/Button";
import Segmented from "../components/ui/Segmented";
import { List } from "../components/ui/List";
import { AsyncBoundary, EmptyState, PageHeader } from "../components/ui/Misc";
import { TaskDetailSheet, TaskRow, TaskSheet } from "../components/tasks/TaskParts";
import { useAuth, isManagerRole } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

// Vazifalar. Everyone: the tasks given to them. The boss (and the
// developer): also the ones they gave, and everyone's — and "give a task".
export default function TasksPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const manager = isManagerRole(user.role);
  const [view, setView] = useState(manager ? "given" : "mine");
  const [status, setStatus] = useState("open");
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(null);
  const state = useAsync(() => api.tasks({ view, status }), [view, status]);

  // A task changed: keep it where it belongs (done ones leave the open list).
  function changed(updated) {
    state.setData((rows) => rows.map((r) => (r.id === updated.id ? updated : r)).filter((r) => (status === "done" ? r.doneAt : !r.doneAt)));
  }

  return (
    <div>
      <PageHeader
        title={t("tasks.title")}
        subtitle={manager ? t("tasks.subtitleManager") : t("tasks.subtitle")}
        actions={
          manager && (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              {t("tasks.give")}
            </Button>
          )
        }
      />
      <div className={pageStyles.stack}>
        {manager && (
          <Segmented
            full
            value={view}
            onChange={setView}
            label={t("tasks.title")}
            options={[
              { value: "given", label: t("tasks.viewGiven") },
              { value: "all", label: t("tasks.viewAll") },
              { value: "mine", label: t("tasks.viewMine") },
            ]}
          />
        )}
        <Segmented
          value={status}
          onChange={setStatus}
          label={t("tasks.status")}
          options={[
            { value: "open", label: t("tasks.open") },
            { value: "done", label: t("tasks.done") },
          ]}
        />
        <AsyncBoundary state={state}>
          {(rows) =>
            rows.length === 0 ? (
              <List>
                <EmptyState
                  icon="checkCircle"
                  title={status === "open" ? (view === "mine" ? t("tasks.emptyMine") : t("tasks.emptyGiven")) : t("tasks.emptyDone")}
                  text={manager && status === "open" && view !== "mine" ? t("tasks.emptyHint") : undefined}
                />
              </List>
            ) : (
              <List inset={16}>
                {rows.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    showAssignee={view !== "mine"}
                    canTick={task.assignee?.id === user.id || manager}
                    onOpen={setOpen}
                    onChanged={changed}
                  />
                ))}
              </List>
            )
          }
        </AsyncBoundary>
      </div>

      {creating && (
        <TaskSheet
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            if (view === "mine") setView("given");
            else state.reload();
          }}
        />
      )}
      {open && (
        <TaskDetailSheet
          task={open}
          onClose={() => setOpen(null)}
          onChanged={(updated) => {
            changed(updated);
            setOpen(null);
          }}
          onEdit={() => {
            setEditing(open);
            setOpen(null);
          }}
          onDeleted={(task) => {
            state.setData((rows) => rows.filter((r) => r.id !== task.id));
            setOpen(null);
          }}
        />
      )}
      {editing && (
        <TaskSheet
          task={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            state.setData((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
