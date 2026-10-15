import { useState } from "react";
import pageStyles from "../../pages/Pages.module.css";
import styles from "./CallCenterRules.module.css";
import Button from "../ui/Button";
import Sheet from "../ui/Sheet";
import Icon from "../ui/Icon";
import { TextField } from "../ui/Field";
import { List, ListRow, ListSectionHeader } from "../ui/List";
import { AsyncBoundary } from "../ui/Misc";
import { LEGAL_STAGES } from "../clients/parts";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { saveFailed } from "../../lib/saveFailed";
import { useI18n } from "../../i18n";

// Settings for the work on cases (2026-10-15):
//   Ish andozalari   ready-made task lists to put on a case at once (the
//                    managers write them; routes/tasks.js)
//   Shikoyat muddati the days from a decision to the deadline it starts, by
//                    stage — the lawyers' own numbers (Ledger assumes none);
//                    the history form suggests the date from them

export function ChecklistsSection() {
  const { t } = useI18n();
  const state = useAsync(() => api.checklists(), []);
  const [editing, setEditing] = useState(null); // index, or "new"

  async function save(lists) {
    await api.saveChecklists(lists);
    setEditing(null);
    state.reload();
  }

  return (
    <section>
      <ListSectionHeader
        action={
          <Button size="small" variant="plain" icon="plus" onClick={() => setEditing("new")}>
            {t("checklists.add")}
          </Button>
        }
      >
        {t("checklists.title")}
      </ListSectionHeader>
      <AsyncBoundary state={state}>
        {(data) => (
          <List inset={64}>
            {(data.lists || []).map((l, i) => (
              <ListRow
                key={l.id}
                onClick={() => setEditing(i)}
                chevron
                leading={
                  <span className={styles.tile}>
                    <Icon name="clipboard" size={18} />
                  </span>
                }
                title={l.name}
                subtitle={l.items.map((it) => it.title).join(" · ")}
              />
            ))}
          </List>
        )}
      </AsyncBoundary>
      <p className={styles.footnote}>{t("checklists.hint")}</p>
      {editing !== null && state.data && (
        <ChecklistSheet
          list={editing === "new" ? null : state.data.lists[editing]}
          onClose={() => setEditing(null)}
          onSave={(list) => save(editing === "new" ? [...state.data.lists, list] : state.data.lists.map((l, i) => (i === editing ? list : l)))}
          onRemove={editing === "new" ? null : () => save(state.data.lists.filter((_, i) => i !== editing))}
        />
      )}
    </section>
  );
}

function ChecklistSheet({ list, onClose, onSave, onRemove }) {
  const { t } = useI18n();
  const [name, setName] = useState(list?.name || "");
  const [items, setItems] = useState(list?.items?.length ? list.items.map((it) => ({ title: it.title, days: String(it.days) })) : [{ title: "", days: "1" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const setItem = (i, patch) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function save() {
    const clean = items.filter((it) => it.title.trim()).map((it) => ({ title: it.title.trim(), days: Math.min(365, Math.max(0, Math.round(Number(it.days) || 0))) }));
    if (!name.trim()) return setError(t("checklists.nameRequired"));
    if (!clean.length) return setError(t("checklists.itemsRequired"));
    setBusy(true);
    try {
      await onSave({ ...(list?.id ? { id: list.id } : {}), name: name.trim(), items: clean });
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(t("checklists.removeConfirm", { name: list.name }))) return;
    setBusy(true);
    try {
      await onRemove();
    } catch (err) {
      saveFailed(err, t);
      setBusy(false);
    }
  }

  return (
    <Sheet title={list ? t("checklists.edit") : t("checklists.add")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <TextField label={t("checklists.name")} placeholder={t("checklists.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
        {items.map((it, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 90px auto", gap: 8, alignItems: "end" }}>
            <TextField label={i === 0 ? t("checklists.task") : undefined} aria-label={t("checklists.task")} value={it.title} onChange={(e) => setItem(i, { title: e.target.value })} />
            <TextField label={i === 0 ? t("checklists.days") : undefined} aria-label={t("checklists.days")} type="number" min="0" inputMode="numeric" value={it.days} onChange={(e) => setItem(i, { days: e.target.value })} />
            <Button variant="plain" icon="trash" aria-label={t("caseWork.remove")} onClick={() => setItems((xs) => (xs.length > 1 ? xs.filter((_, j) => j !== i) : xs))} />
          </div>
        ))}
        <Button size="small" variant="plain" icon="plus" onClick={() => setItems((xs) => [...xs, { title: "", days: "1" }])}>
          {t("checklists.addTask")}
        </Button>
        <p className={pageStyles.note}>{t("checklists.daysHint")}</p>
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          {onRemove && (
            <Button variant="destructive" busy={busy} onClick={remove}>
              {t("caseWork.remove")}
            </Button>
          )}
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" busy={busy} onClick={save}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

const STAGE_KEYS = ["_", ...LEGAL_STAGES];

export function DeadlineDaysSection() {
  const { t } = useI18n();
  const state = useAsync(() => api.deadlineDays(), []);
  const [editing, setEditing] = useState(null); // a stage key

  return (
    <section>
      <ListSectionHeader>{t("deadlineDays.title")}</ListSectionHeader>
      <AsyncBoundary state={state}>
        {(days) => (
          <List inset={64}>
            {STAGE_KEYS.map((k) => (
              <ListRow
                key={k}
                onClick={() => setEditing(k)}
                chevron
                leading={
                  <span className={styles.tile}>
                    <Icon name="clock" size={18} />
                  </span>
                }
                title={k === "_" ? t("entries.anyStage") : t(`cases.stages.${k}`)}
                subtitle={days[k] ? t("deadlineDays.days", { days: days[k] }) : t("deadlineDays.none")}
              />
            ))}
          </List>
        )}
      </AsyncBoundary>
      <p className={styles.footnote}>{t("deadlineDays.hint")}</p>
      {editing && state.data && <DaysSheet stage={editing} value={state.data[editing]} onClose={() => setEditing(null)} onSaved={() => (setEditing(null), state.reload())} />}
    </section>
  );
}

function DaysSheet({ stage, value, onClose, onSaved }) {
  const { t } = useI18n();
  const [days, setDays] = useState(value ? String(value) : "");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await api.saveDeadlineDays(stage === "_" ? null : stage, days ? Number(days) : null);
      onSaved();
    } catch (err) {
      saveFailed(err, t);
      setBusy(false);
    }
  }
  return (
    <Sheet title={stage === "_" ? t("entries.anyStage") : t(`cases.stages.${stage}`)} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <TextField label={t("deadlineDays.label")} type="number" min="1" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
        <p className={pageStyles.note}>{t("deadlineDays.sheetHint")}</p>
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" busy={busy} onClick={save}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
