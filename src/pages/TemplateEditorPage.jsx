import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styles from "./TemplateEditorPage.module.css";
import pageStyles from "./Pages.module.css";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Sheet from "../components/ui/Sheet";
import Icon from "../components/ui/Icon";
import { SelectField, Switch, TextAreaField, TextField } from "../components/ui/Field";
import { EmptyState, LoadingState, ErrorState, PageHeader } from "../components/ui/Misc";
import ReportForm from "../components/reports/ReportForm";
import { useAuth } from "../hooks/useAuth";
import { useBack } from "../hooks/useBack";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

const TYPES = ["text", "textarea", "number", "money", "yesno", "select", "checklist"];
const WITH_OPTIONS = ["select", "checklist"];

function newId() {
  return `q_${Math.random().toString(36).slice(2, 10)}`;
}

// The report-form builder: a list of questions (add, edit, reorder, remove)
// next to a live preview of exactly what the employee will fill in.
export default function TemplateEditorPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const goBack = useBack("/settings");
  const canEdit = user.role === "DEVELOPER";

  const [loaded, setLoaded] = useState(isNew ? { name: "", fields: [], active: true } : null);
  const [loadError, setLoadError] = useState(null);
  const [name, setName] = useState("");
  const [fields, setFields] = useState([]);
  const [editing, setEditing] = useState(null); // null | "new" | index
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ kind: "", text: "" });

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    api
      .reportTemplate(id)
      .then((tpl) => {
        if (cancelled) return;
        setLoaded(tpl);
        setName(tpl.name);
        setFields(tpl.fields);
      })
      .catch((err) => !cancelled && setLoadError(err));
    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  if (loadError) return <ErrorState error={loadError} />;
  if (!loaded) return <LoadingState />;

  function move(index, delta) {
    setFields((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setStatus({ kind: "", text: "" });
    try {
      if (isNew) {
        const created = await api.createReportTemplate({ name, fields });
        navigate(`/settings/templates/${created.id}`, { replace: true });
      } else {
        const updated = await api.updateReportTemplate(loaded.id, { name, fields });
        setLoaded(updated);
        setFields(updated.fields);
        setStatus({ kind: "ok", text: t("templateEditor.saved") });
      }
    } catch (err) {
      setStatus({ kind: "error", text: t("templateEditor.saveFailed", { reason: err.code || "?" }) });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    setBusy(true);
    try {
      setLoaded(await api.updateReportTemplate(loaded.id, { active: !loaded.active }));
    } catch (err) {
      setStatus({ kind: "error", text: t("templateEditor.saveFailed", { reason: err.code || "?" }) });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(t("settings.confirmDelete", { name: loaded.name }))) return;
    try {
      await api.deleteReportTemplate(loaded.id);
      navigate("/settings", { replace: true });
    } catch (err) {
      setStatus({
        kind: "error",
        text: err.code === "has_reports" ? t("templateEditor.hasReports") : t("templateEditor.saveFailed", { reason: err.code || "?" }),
      });
    }
  }

  return (
    <div>
      <PageHeader
        back={{ label: t("templateEditor.back"), onClick: goBack }}
        title={isNew ? t("templateEditor.newTitle") : name || t("templateEditor.editTitle")}
        actions={!isNew && !loaded.active && <Badge tone="neutral">{t("settings.inactive")}</Badge>}
      />

      <div className={pageStyles.split}>
        <div className={pageStyles.stack}>
          <Card>
            <TextField
              label={t("templateEditor.name")}
              placeholder={t("templateEditor.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit}
            />
          </Card>

          <Card
            flush
            title={t("templateEditor.questions")}
            action={
              canEdit && (
                <Button size="small" variant="plain" icon="plus" onClick={() => setEditing("new")}>
                  {t("templateEditor.addQuestion")}
                </Button>
              )
            }
          >
            {fields.length === 0 ? (
              <EmptyState icon="sliders" text={t("templateEditor.noQuestions")} />
            ) : (
              <ol className={styles.questions}>
                {fields.map((f, i) => (
                  <li key={f.id} className={styles.question}>
                    <span className={styles.number}>{i + 1}</span>
                    <div className={styles.questionMain}>
                      <div className={styles.questionLabel}>{f.label}</div>
                      <div className={styles.questionMeta}>
                        {t(`fieldTypes.${f.type}`)}
                        {f.required && ` · ${t("reports.requiredMark")}`}
                        {f.options && ` · ${f.options.join(", ")}`}
                      </div>
                    </div>
                    {canEdit && (
                      <div className={styles.questionActions}>
                        <IconButton icon="chevronDown" label={t("templateEditor.moveDown")} disabled={i === fields.length - 1} onClick={() => move(i, 1)} flip={false} />
                        <IconButton icon="chevronDown" label={t("templateEditor.moveUp")} disabled={i === 0} onClick={() => move(i, -1)} flip />
                        <IconButton icon="sliders" label={t("templateEditor.edit")} onClick={() => setEditing(i)} />
                        <IconButton icon="x" label={t("templateEditor.remove")} onClick={() => setFields((list) => list.filter((_, j) => j !== i))} />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {canEdit && (
            <>
              {!isNew && <p className={pageStyles.note}>{t("templateEditor.editNote")}</p>}
              {status.text && (
                <p className={`${pageStyles.message} ${status.kind === "ok" ? pageStyles.messageSuccess : pageStyles.messageError}`}>
                  {status.text}
                </p>
              )}
              <div className={styles.saveRow}>
                <Button variant="primary" size="large" busy={busy} disabled={!name.trim() || fields.length === 0} onClick={save}>
                  {t("templateEditor.save")}
                </Button>
                {!isNew && (
                  <>
                    <Button onClick={toggleActive} disabled={busy}>
                      {loaded.active ? t("templateEditor.deactivate") : t("templateEditor.activate")}
                    </Button>
                    <Button variant="destructive" onClick={remove} disabled={busy}>
                      {t("templateEditor.deleteForm")}
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className={styles.previewColumn}>
          <Card title={t("templateEditor.preview")} subtitle={t("templateEditor.previewHint")}>
            {fields.length === 0 ? <p className={pageStyles.note}>—</p> : <ReportForm key={fields.map((f) => f.id + f.type).join()} fields={fields} preview />}
          </Card>
        </div>
      </div>

      {editing !== null && (
        <QuestionSheet
          field={editing === "new" ? null : fields[editing]}
          onClose={() => setEditing(null)}
          onSave={(field) => {
            setFields((list) => (editing === "new" ? [...list, field] : list.map((f, j) => (j === editing ? field : f))));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function IconButton({ icon, label, onClick, disabled, flip }) {
  return (
    <button type="button" className={styles.iconButton} onClick={onClick} disabled={disabled} aria-label={label} title={label}>
      <Icon name={icon} size={16} className={flip ? styles.flip : undefined} />
    </button>
  );
}

function QuestionSheet({ field, onClose, onSave }) {
  const { t } = useI18n();
  const [label, setLabel] = useState(field?.label || "");
  const [type, setType] = useState(field?.type || "text");
  const [required, setRequired] = useState(field?.required ?? false);
  const [options, setOptions] = useState((field?.options || []).join("\n"));
  const [hint, setHint] = useState(field?.hint || "");
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    const cleanOptions = [...new Set(options.split("\n").map((o) => o.trim()).filter(Boolean))];
    if (!label.trim()) return setError(t("templateEditor.needLabel"));
    if (WITH_OPTIONS.includes(type) && cleanOptions.length === 0) return setError(t("templateEditor.needOptions"));
    onSave({
      id: field?.id || newId(),
      label: label.trim(),
      type,
      required,
      ...(WITH_OPTIONS.includes(type) ? { options: cleanOptions } : {}),
      ...(hint.trim() ? { hint: hint.trim() } : {}),
    });
  }

  return (
    <Sheet title={field ? t("templateEditor.questionEdit") : t("templateEditor.questionNew")} onClose={onClose}>
      <form onSubmit={submit} className={pageStyles.formStack}>
        <TextField label={t("templateEditor.questionText")} value={label} onChange={(e) => setLabel(e.target.value)} required />
        <SelectField label={t("templateEditor.type")} value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {t(`fieldTypes.${ty}`)}
            </option>
          ))}
        </SelectField>
        {WITH_OPTIONS.includes(type) && (
          <TextAreaField
            label={t("templateEditor.options")}
            hint={t("templateEditor.optionsHint")}
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            rows={4}
          />
        )}
        <TextField
          label={t("templateEditor.hint")}
          placeholder={t("templateEditor.hintPlaceholder")}
          value={hint}
          onChange={(e) => setHint(e.target.value)}
        />
        <Switch label={t("templateEditor.required")} checked={required} onChange={setRequired} />
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" variant="primary">
            {t("common.done")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
