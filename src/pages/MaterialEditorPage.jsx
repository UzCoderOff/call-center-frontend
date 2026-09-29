import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import pageStyles from "./Pages.module.css";
import styles from "../components/materials/Materials.module.css";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Segmented from "../components/ui/Segmented";
import { Chips, Switch, TextAreaField, TextField } from "../components/ui/Field";
import { AsyncBoundary, PageHeader } from "../components/ui/Misc";
import RichText from "../components/materials/RichText";
import { FileBlock, formatSize } from "../components/materials/parts";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

// Writing a material (boss and developer): what it is, who it's for,
// whether it's required reading, and its content — text written here, a
// link, and files (PDF, Word, audio of a good call, pictures, short videos).
export default function MaterialEditorPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const state = useAsync(
    () =>
      Promise.all([
        api.materialOptions(),
        id ? api.material(id) : Promise.resolve(null),
        api.telegramMe().catch(() => null),
      ]).then(([options, material, telegram]) => ({ options, material, telegram })),
    [id]
  );
  return (
    <div>
      <PageHeader
        back={{ to: id ? `/materials/${id}` : "/materials", label: id ? t("common.cancel") : t("materials.title") }}
        title={id ? t("materials.editTitle") : t("materials.newTitle")}
      />
      <AsyncBoundary state={state}>{(data) => <Editor key={id || "new"} {...data} />}</AsyncBoundary>
    </div>
  );
}

function errorText(err, t) {
  const known = {
    file_type_not_allowed: "materials.errFileType",
    file_too_large: "materials.errFileTooLarge",
    too_many_files: "materials.errTooManyFiles",
    "invalid linkUrl": "materials.errLink",
    "title is required": "materials.errTitle",
    network_error: "materials.errNetwork",
  };
  return t(known[err?.code] || "materials.saveFailed");
}

function Editor({ options, material, telegram }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const editing = Boolean(material);
  const [form, setForm] = useState(() => ({
    title: material?.title || "",
    category: material?.category || "",
    body: material?.body || "",
    linkUrl: material?.linkUrl || "",
    required: material?.required ?? false,
    published: material?.published ?? true,
    forEveryone: material?.forEveryone ?? false,
    positionIds: material?.audience?.positionIds || [],
    roles: material?.audience?.roles || [],
    userIds: material?.audience?.userIds || [],
  }));
  const [askAgain, setAskAgain] = useState(false);
  const [notify, setNotify] = useState(!editing);
  const [files, setFiles] = useState(material?.files || []);
  const [queued, setQueued] = useState([]); // new material: files picked before the first save
  const [uploads, setUploads] = useState([]); // { key, name, progress, error }
  const [mode, setMode] = useState("write");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const fileInput = useRef(null);
  const bodyRef = useRef(null);

  // Chips show names; the form keeps ids.
  const positionLabel = (p) => `${p.name} · ${p.count}`;
  const lawyersLabel = t("materials.lawyersGroup", { count: options.lawyerCount });
  const groupOptions = [...options.positions.map(positionLabel), ...(options.lawyerCount > 0 ? [lawyersLabel] : [])];
  const groupValue = [
    ...options.positions.filter((p) => form.positionIds.includes(p.id)).map(positionLabel),
    ...(form.roles.includes("LAWYER") ? [lawyersLabel] : []),
  ];
  function setGroups(labels) {
    set({
      positionIds: options.positions.filter((p) => labels.includes(positionLabel(p))).map((p) => p.id),
      roles: labels.includes(lawyersLabel) ? ["LAWYER"] : [],
    });
  }
  const personLabel = (p) => (p.position ? `${p.name} (${p.position})` : p.name);
  const people = options.people;

  // "N people will see it" — so an empty audience is noticed before saving.
  const audienceCount = useMemo(() => {
    const positionNames = options.positions.filter((p) => form.positionIds.includes(p.id)).map((p) => p.name);
    return people.filter(
      (p) =>
        form.userIds.includes(p.id) ||
        (p.role !== "BOSS" &&
          (form.forEveryone || positionNames.includes(p.position) || (p.role === "LAWYER" && form.roles.includes("LAWYER"))))
    ).length;
  }, [form, people, options.positions]);

  // Toolbar: put a formatting mark at the start of the current line, or
  // make the selected words bold.
  function format(prefix) {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end, value } = el;
    let next;
    let cursor;
    if (prefix === "**") {
      const picked = value.slice(start, end) || t("materials.boldSample");
      next = `${value.slice(0, start)}**${picked}**${value.slice(end)}`;
      cursor = start + picked.length + 4;
    } else {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      next = `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`;
      cursor = start + prefix.length;
    }
    set({ body: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  function tooBig(file) {
    return file.size > options.maxFileBytes;
  }

  async function uploadAll(materialId, list) {
    let failed = false;
    for (const file of list) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      const update = (patch) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, ...patch } : x)));
      setUploads((u) => [...u, { key, name: file.name, progress: 0, error: "" }]);
      if (tooBig(file)) {
        update({ error: t("materials.errFileTooLarge") });
        failed = true;
        continue;
      }
      try {
        const saved = await api.uploadMaterialFile(materialId, file, (progress) => update({ progress }));
        setFiles((f) => [...f, saved]);
        setUploads((u) => u.filter((x) => x.key !== key));
      } catch (err) {
        update({ error: errorText(err, t) });
        failed = true;
      }
    }
    return !failed;
  }

  function pickFiles(e) {
    const list = [...(e.target.files || [])];
    e.target.value = "";
    if (list.length === 0) return;
    if (editing) uploadAll(material.id, list);
    else setQueued((q) => [...q, ...list]);
  }

  async function removeFile(file) {
    if (!window.confirm(t("materials.removeFileConfirm", { name: file.name }))) return;
    try {
      await api.deleteMaterialFile(file.id);
      setFiles((f) => f.filter((x) => x.id !== file.id));
    } catch (err) {
      setError(errorText(err, t));
    }
  }

  async function save(e) {
    e.preventDefault();
    if (!form.title.trim()) return setError(t("materials.errTitle"));
    setBusy(true);
    setError("");
    const payload = {
      title: form.title,
      category: form.category,
      body: form.body,
      linkUrl: form.linkUrl.trim(),
      required: form.required,
      published: form.published,
      forEveryone: form.forEveryone,
      audience: { positionIds: form.positionIds, roles: form.roles, userIds: form.userIds },
      notify: form.published && notify,
      ...(editing ? { askAgain } : {}),
    };
    try {
      const saved = editing ? await api.updateMaterial(material.id, payload) : await api.createMaterial(payload);
      const ok = queued.length === 0 || (await uploadAll(saved.id, queued));
      setQueued([]);
      if (ok) navigate(`/materials/${saved.id}`, { replace: true });
      else if (!editing) navigate(`/materials/${saved.id}/edit`, { replace: true });
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className={pageStyles.stack}>
      <Card>
        <div className={pageStyles.formStack}>
          <TextField label={t("materials.fTitle")} value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder={t("materials.fTitlePh")} maxLength={160} required />
          <TextField
            label={t("materials.fCategory")}
            hint={t("materials.fCategoryHint")}
            value={form.category}
            onChange={(e) => set({ category: e.target.value })}
            list="material-categories"
            maxLength={60}
          />
          <datalist id="material-categories">
            {options.categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </Card>

      <Card title={t("materials.whoTitle")} subtitle={t("materials.whoCount", { count: audienceCount })}>
        <div className={pageStyles.formStack}>
          <Switch label={t("materials.forEveryone")} hint={t("materials.forEveryoneHint")} checked={form.forEveryone} onChange={(v) => set({ forEveryone: v })} />
          {!form.forEveryone && (
            <>
              <span className={styles.groupLabel}>{t("materials.groups")}</span>
              <Chips multiple options={groupOptions} value={groupValue} onChange={setGroups} />
            </>
          )}
          <span className={styles.groupLabel}>{form.forEveryone ? t("materials.alsoPeople") : t("materials.people")}</span>
          <Chips
            multiple
            options={people.map(personLabel)}
            value={people.filter((p) => form.userIds.includes(p.id)).map(personLabel)}
            onChange={(labels) => set({ userIds: people.filter((p) => labels.includes(personLabel(p))).map((p) => p.id) })}
          />
          {audienceCount === 0 && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{t("materials.nobody")}</p>}
          <Switch label={t("materials.fRequired")} hint={t("materials.fRequiredHint")} checked={form.required} onChange={(v) => set({ required: v })} />
        </div>
      </Card>

      <Card title={t("materials.contentTitle")} subtitle={t("materials.contentSubtitle")}>
        <div className={pageStyles.formStack}>
          <Segmented
            value={mode}
            onChange={setMode}
            label={t("materials.contentTitle")}
            options={[
              { value: "write", label: t("materials.write") },
              { value: "preview", label: t("materials.preview") },
            ]}
          />
          {mode === "write" ? (
            <>
              <div className={styles.toolbar}>
                <Button size="small" onClick={() => format("# ")}>{t("materials.tHeading")}</Button>
                <Button size="small" onClick={() => format("- ")}>{t("materials.tList")}</Button>
                <Button size="small" onClick={() => format("> ")}>{t("materials.tSay")}</Button>
                <Button size="small" onClick={() => format("! ")}>{t("materials.tImportant")}</Button>
                <Button size="small" onClick={() => format("**")}>{t("materials.tBold")}</Button>
              </div>
              <TextAreaField
                className={styles.bodyField}
                label={t("materials.fBody")}
                value={form.body}
                onChange={(e) => set({ body: e.target.value })}
                placeholder={t("materials.fBodyPh")}
                ref={bodyRef}
              />
              <p className={styles.help}>
                <code># </code> {t("materials.helpHeading")} · <code>- </code> {t("materials.helpList")} · <code>&gt; </code> {t("materials.helpSay")} ·{" "}
                <code>! </code> {t("materials.helpImportant")} · <code>**…**</code> {t("materials.helpBold")}
              </p>
            </>
          ) : (
            <div className={styles.preview}>{form.body.trim() ? <RichText text={form.body} /> : <p className={pageStyles.note}>{t("materials.previewEmpty")}</p>}</div>
          )}
          <TextField
            label={t("materials.fLink")}
            hint={t("materials.fLinkHint")}
            value={form.linkUrl}
            onChange={(e) => set({ linkUrl: e.target.value })}
            type="url"
            inputMode="url"
            placeholder="https://"
          />
        </div>
      </Card>

      <Card title={t("materials.filesTitle")} subtitle={t("materials.filesHint", { max: formatSize(options.maxFileBytes) })}>
        <div className={pageStyles.formStack}>
          {files.length > 0 && <FileBlock files={files} onDelete={removeFile} />}
          {queued.map((f, i) => (
            <div key={`${f.name}-${i}`} className={styles.upload}>
              <span>
                {f.name} · {formatSize(f.size)} {tooBig(f) && <span className={pageStyles.messageError}>— {t("materials.errFileTooLarge")}</span>}
              </span>
              <span className={pageStyles.note}>{t("materials.queued")}</span>
            </div>
          ))}
          {uploads.map((u) => (
            <div key={u.key} className={styles.upload}>
              <span>{u.name}</span>
              {u.error ? (
                <span className={`${pageStyles.message} ${pageStyles.messageError}`}>{u.error}</span>
              ) : (
                <div className={styles.uploadBar} aria-label={t("materials.uploading")}>
                  <span style={{ width: `${Math.round(u.progress * 100)}%` }} />
                </div>
              )}
            </div>
          ))}
          <input ref={fileInput} type="file" multiple accept={options.fileTypes.join(",")} className={styles.hiddenInput} onChange={pickFiles} />
          <div>
            <Button icon="upload" onClick={() => fileInput.current?.click()}>
              {t("materials.addFiles")}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className={pageStyles.formStack}>
          <Switch label={t("materials.fPublished")} hint={t("materials.fPublishedHint")} checked={form.published} onChange={(v) => set({ published: v })} />
          {editing && material.published && (
            <Switch label={t("materials.askAgain")} hint={t("materials.askAgainHint")} checked={askAgain} onChange={setAskAgain} />
          )}
          {form.published && telegram?.bot?.configured && (
            <Switch label={t("materials.notify")} hint={t("materials.notifyHint")} checked={notify} onChange={setNotify} />
          )}
          {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
          <div className={pageStyles.formActions}>
            <Button type="submit" variant="primary" size="large" busy={busy} disabled={uploads.some((u) => !u.error)}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      </Card>
    </form>
  );
}
