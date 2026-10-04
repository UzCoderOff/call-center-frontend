import { useState } from "react";
import pageStyles from "./Pages.module.css";
import Button from "../components/ui/Button";
import Segmented from "../components/ui/Segmented";
import { List } from "../components/ui/List";
import { AsyncBoundary, EmptyState, PageHeader } from "../components/ui/Misc";
import { ReminderDetailSheet, ReminderRow, ReminderSheet } from "../components/reminders/ReminderParts";
import { useAuth, isManagerRole } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

// Eslatmalar. Everyone: their own reminders (and the ones set for them).
// The boss and the developer: also the ones they set for others.
export default function RemindersPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const manager = isManagerRole(user.role);
  const [view, setView] = useState("mine");
  const [status, setStatus] = useState("open");
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(null);
  const state = useAsync(() => api.reminders({ view, status }), [view, status]);

  // A reminder changed: keep it where it belongs (done ones leave the open list).
  function changed(updated) {
    state.setData((rows) => rows.map((r) => (r.id === updated.id ? updated : r)).filter((r) => (status === "done" ? r.doneAt : !r.doneAt)));
  }

  return (
    <div>
      <PageHeader
        title={t("reminders.title")}
        subtitle={manager ? t("reminders.subtitleManager") : t("reminders.subtitle")}
        actions={
          <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
            {t("reminders.new")}
          </Button>
        }
      />
      <div className={pageStyles.stack}>
        {manager && (
          <Segmented
            full
            value={view}
            onChange={setView}
            label={t("reminders.title")}
            options={[
              { value: "mine", label: t("reminders.viewMine") },
              { value: "given", label: t("reminders.viewGiven") },
            ]}
          />
        )}
        <Segmented
          value={status}
          onChange={setStatus}
          label={t("reminders.status")}
          options={[
            { value: "open", label: t("reminders.open") },
            { value: "done", label: t("reminders.done") },
          ]}
        />
        <AsyncBoundary state={state}>
          {(rows) =>
            rows.length === 0 ? (
              <List>
                <EmptyState
                  icon="alarm"
                  title={status === "open" ? (view === "mine" ? t("reminders.emptyMine") : t("reminders.emptyGiven")) : t("reminders.emptyDone")}
                  text={status === "open" ? t("reminders.emptyHint") : undefined}
                />
              </List>
            ) : (
              <List inset={16}>
                {rows.map((r) => (
                  <ReminderRow key={r.id} reminder={r} showFor={view === "given"} canTick={view === "mine" || manager} onOpen={setOpen} onChanged={changed} />
                ))}
              </List>
            )
          }
        </AsyncBoundary>
      </div>

      {creating && (
        <ReminderSheet
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            state.reload();
          }}
        />
      )}
      {open && (
        <ReminderDetailSheet
          reminder={open}
          onClose={() => setOpen(null)}
          onChanged={(updated) => {
            changed(updated);
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
          onSaved={() => {
            setEditing(null);
            state.reload();
          }}
        />
      )}
    </div>
  );
}
