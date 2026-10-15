import { useState } from "react";
import styles from "./Cases.module.css";
import clientStyles from "../clients/Clients.module.css";
import pageStyles from "../../pages/Pages.module.css";
import Sheet from "../ui/Sheet";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { SelectField, Switch, TextAreaField, TextField } from "../ui/Field";
import { ChoiceChips } from "../clients/ClientWork";
import { ENTRY_ICON, ENTRY_TYPES } from "../clients/Timeline";
import { useAuth } from "../../hooks/useAuth";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { todayIso } from "../../lib/format";
import { isLawyer, isManager } from "../../lib/access";
import { useI18n } from "../../i18n";

// Writing what happened in a case (services/caseEntries.js on the server):
// first what kind of thing, then only that kind's few fields — a hearing's
// result and the next one, a decision's result and the deadline it starts,
// who was at a meeting. The next hearing and the deadline also become the
// case's dates (and so the lawyers' calendars and reminders).
//
// And "How did it go?" for a hearing (or questioning…) that has taken place:
// the outcome, the next date, in one go — the team hears it in the client's
// chat.

export const HEARING_RESULTS = ["postponed", "heard", "decided", "not_held", "other"];
export const DECISION_RESULTS = ["won", "partly", "lost", "other"];
// Need a case.
const CASE_TYPES = ["hearing", "filed", "decision"];

const toMinutes = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const addDays = (date, n) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// Chips with their question above them.
function LabeledChips({ label, ...rest }) {
  return (
    <div className={pageStyles.formStack} style={{ gap: 6 }}>
      <span className={pageStyles.note}>{label}</span>
      <ChoiceChips label={label} {...rest} />
    </div>
  );
}

function ErrorLine({ text }) {
  return text ? <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{text}</p> : null;
}

// The case's files (and the client's own), to point an entry at one.
function FileField({ client, item, value, onChange }) {
  const { t } = useI18n();
  const files = (client.files || []).filter((f) => !item || f.caseId == null || f.caseId === item.id);
  if (files.length === 0) return null;
  return (
    <SelectField label={t("entries.file")} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t("entries.noFile")}</option>
      {files.map((f) => (
        <option key={f.id} value={f.id}>
          {f.title || f.name}
        </option>
      ))}
    </SelectField>
  );
}

// The next date: day, time, where.
function NextDate({ title, value, onChange, hint }) {
  const { t } = useI18n();
  return (
    <div className={styles.section}>
      <p className={styles.sectionTitle}>{title}</p>
      <div className={clientStyles.twoCol}>
        <TextField label={t("caseWork.date")} type="date" value={value.date} min={todayIso()} onChange={(e) => onChange({ ...value, date: e.target.value })} />
        <TextField label={t("caseWork.time")} type="time" value={value.time} onChange={(e) => onChange({ ...value, time: e.target.value })} />
      </div>
      <TextField label={t("caseWork.place")} value={value.place} onChange={(e) => onChange({ ...value, place: e.target.value })} />
      {hint && <p className={pageStyles.note}>{hint}</p>}
    </div>
  );
}

const nextPayload = (n) => (n.date ? { date: n.date, time: n.time ? toMinutes(n.time) : null, place: n.place || null } : undefined);

export function EntrySheet({ client, item = null, initialType = null, onClose, onSaved }) {
  const { t, fmt } = useI18n();
  const { user } = useAuth();
  const types = item ? ENTRY_TYPES : ENTRY_TYPES.filter((x) => !CASE_TYPES.includes(x));
  const [type, setType] = useState(initialType && types.includes(initialType) ? initialType : null);
  const [on, setOn] = useState(todayIso());
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [place, setPlace] = useState(item?.court || "");
  const [what, setWhat] = useState("");
  const [withWho, setWithWho] = useState("");
  const [fileId, setFileId] = useState("");
  const [next, setNext] = useState({ date: "", time: "", place: item?.court || "" });
  // A decision's deadline: the firm's days for the stage (saved by the
  // lawyers), the date they make — both can be changed.
  const daysState = useAsync(() => (item ? api.deadlineDays() : Promise.resolve({})), [item?.id]);
  const stage = item?.legalStage || "_";
  const savedDays = daysState.data?.[stage];
  const [deadlineOn, setDeadlineOn] = useState(true);
  const [days, setDays] = useState(null); // null: the saved number
  const shownDays = days ?? (savedDays != null ? String(savedDays) : "");
  const [deadlineDate, setDeadlineDate] = useState(null); // null: from the days
  const computed = Number(shownDays) > 0 ? addDays(on, Number(shownDays)) : "";
  const shownDeadline = deadlineDate ?? computed;
  const [deadlineTitle, setDeadlineTitle] = useState(null);
  const shownTitle = deadlineTitle ?? t(`entries.deadlineTitles.${["first_instance", "appeal", "cassation"].includes(stage) ? stage : "other"}`);
  const [remember, setRemember] = useState(false);
  const canDates = Boolean(item?.permissions?.canDates);
  const mayRemember = isLawyer(user) || isManager(user);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!type) return setError(t("entries.pickType"));
    // A hearing's or a decision's result can be the whole entry.
    if (!text.trim() && !((type === "hearing" || type === "decision") && result)) return setError(t("entries.textRequired"));
    if (type === "decision" && canDates && deadlineOn && shownDeadline && !shownTitle.trim()) return setError(t("entries.deadlineTitleRequired"));
    setBusy(true);
    setError("");
    try {
      const payload = {
        type,
        text: text.trim(),
        on,
        ...(item ? { caseId: item.id } : {}),
        ...(result ? { result } : {}),
        ...((type === "hearing" || type === "filed") && place.trim() ? { place: place.trim() } : {}),
        ...(type === "filed" && what.trim() ? { what: what.trim() } : {}),
        ...((type === "meeting" || type === "call") && withWho.trim() ? { with: withWho.trim() } : {}),
        ...(fileId ? { fileId: Number(fileId) } : {}),
        ...(type === "hearing" && canDates && nextPayload(next) ? { next: nextPayload(next) } : {}),
        ...(type === "decision" && canDates && deadlineOn && shownDeadline ? { deadline: { date: shownDeadline, title: shownTitle.trim() } } : {}),
      };
      await api.addEntry(client.id, payload);
      if (type === "decision" && remember && Number(shownDays) > 0) await api.saveDeadlineDays(stage === "_" ? null : stage, Number(shownDays)).catch(() => {});
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(false);
    }
  }

  const textLabel = type ? t(`entries.textLabels.${type}`) : t("entries.textLabels.other");
  return (
    <Sheet title={t("entries.addTitle")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <div className={styles.types} role="radiogroup" aria-label={t("entries.whatHappened")}>
          {types.map((x) => (
            <button key={x} type="button" role="radio" aria-checked={type === x} className={`${styles.type} ${type === x ? styles.typeOn : ""}`} onClick={() => (setType(x), setResult(null))}>
              <Icon name={ENTRY_ICON[x]} size={20} />
              {t(`entries.types.${x}`)}
            </button>
          ))}
        </div>
        {type && (
          <>
            {type === "hearing" && <LabeledChips label={t("entries.howItWent")} options={HEARING_RESULTS.map((r) => ({ value: r, label: t(`entries.results.hearing.${r}`) }))} value={result} onChange={setResult} />}
            {type === "decision" && <LabeledChips label={t("entries.inWhoseFavour")} options={DECISION_RESULTS.map((r) => ({ value: r, label: t(`entries.results.decision.${r}`) }))} value={result} onChange={setResult} />}
            {type === "filed" && <TextField label={t("entries.what")} placeholder={t("entries.whatPlaceholder")} value={what} onChange={(e) => setWhat(e.target.value)} />}
            {(type === "meeting" || type === "call") && <TextField label={t("entries.withWho")} placeholder={t("entries.withWhoPlaceholder")} value={withWho} onChange={(e) => setWithWho(e.target.value)} />}
            <TextAreaField label={textLabel} value={text} onChange={(e) => setText(e.target.value)} rows={3} />
            <div className={clientStyles.twoCol}>
              <TextField label={t("entries.on")} type="date" value={on} max={todayIso()} onChange={(e) => setOn(e.target.value)} />
              {(type === "hearing" || type === "filed") && <TextField label={t("entries.where")} value={place} onChange={(e) => setPlace(e.target.value)} />}
            </div>
            <FileField client={client} item={item} value={fileId} onChange={setFileId} />
            {type === "hearing" && canDates && <NextDate title={t("entries.nextHearing")} value={next} onChange={setNext} hint={t("entries.nextHint")} />}
            {type === "decision" && canDates && (
              <div className={styles.section}>
                <Switch label={t("entries.deadlineOn")} hint={t("entries.deadlineHint")} checked={deadlineOn} onChange={setDeadlineOn} />
                {deadlineOn && (
                  <>
                    <TextField label={t("entries.deadlineName")} value={shownTitle} onChange={(e) => setDeadlineTitle(e.target.value)} />
                    <div className={clientStyles.twoCol}>
                      <TextField
                        label={t("entries.days")}
                        type="number"
                        inputMode="numeric"
                        min="1"
                        value={shownDays}
                        onChange={(e) => (setDays(e.target.value), setDeadlineDate(null))}
                      />
                      <TextField label={t("entries.deadlineDate")} type="date" value={shownDeadline} onChange={(e) => setDeadlineDate(e.target.value)} />
                    </div>
                    <p className={pageStyles.note}>
                      {savedDays != null
                        ? t("entries.daysSaved", { days: savedDays, stage: stage === "_" ? t("entries.anyStage") : t(`cases.stages.${stage}`) })
                        : t("entries.daysNotSaved")}
                      {shownDeadline ? ` ${t("entries.deadlineIs", { date: fmt.isoDateLong(shownDeadline) })}` : ""}
                    </p>
                    {mayRemember && Number(shownDays) > 0 && Number(shownDays) !== savedDays && (
                      <Switch label={t("entries.remember", { days: shownDays })} checked={remember} onChange={setRemember} />
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
        <ErrorLine text={error} />
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

// "How did it go?" — a hearing (or questioning…) that has taken place.
export function OutcomeSheet({ client, item, row, onClose, onSaved }) {
  const { t, fmt } = useI18n();
  const [result, setResult] = useState(null);
  const [text, setText] = useState("");
  const [fileId, setFileId] = useState("");
  const [next, setNext] = useState({ date: "", time: row.time != null ? `${String(Math.floor(row.time / 60)).padStart(2, "0")}:${String(row.time % 60).padStart(2, "0")}` : "", place: row.place || item.court || "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!text.trim() && !result) return setError(t("entries.textRequired"));
    setBusy(true);
    setError("");
    try {
      await api.writeOutcome(row.id, {
        text: text.trim(),
        ...(result ? { result } : {}),
        ...(fileId ? { fileId: Number(fileId) } : {}),
        ...(nextPayload(next) ? { next: nextPayload(next) } : {}),
      });
      onSaved();
    } catch (err) {
      setError(err.code === "outcome_exists" ? t("entries.alreadyWritten") : t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(false);
    }
  }

  return (
    <Sheet title={t("entries.outcomeTitle")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <p className={pageStyles.note}>
          <strong>{row.title || t(`caseWork.kinds.${row.kind}`)}</strong> · {fmt.isoDateLong(row.date)}
          {row.place ? ` · ${row.place}` : ""}
        </p>
        <LabeledChips label={t("entries.howItWent")} options={HEARING_RESULTS.map((r) => ({ value: r, label: t(`entries.results.hearing.${r}`) }))} value={result} onChange={setResult} />
        <TextAreaField label={t("entries.textLabels.hearing")} value={text} onChange={(e) => setText(e.target.value)} rows={3} />
        <FileField client={client} item={item} value={fileId} onChange={setFileId} />
        <NextDate title={t("entries.nextOf", { kind: t(`caseWork.kinds.${row.kind}`) })} value={next} onChange={setNext} hint={t("entries.outcomeHint")} />
        <ErrorLine text={error} />
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
