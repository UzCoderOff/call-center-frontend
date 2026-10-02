import { useRef, useState } from "react";
import styles from "./ClientWork.module.css";
import clientStyles from "./Clients.module.css";
import fieldStyles from "../ui/Field.module.css";
import pageStyles from "../../pages/Pages.module.css";
import Card from "../ui/Card";
import Sheet from "../ui/Sheet";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Icon from "../ui/Icon";
import { SelectField, Switch, TextAreaField, TextField } from "../ui/Field";
import { personName } from "./parts";
import { api } from "../../lib/api";
import { telHref } from "../../lib/format";
import { saveFailed } from "../../lib/saveFailed";
import { useI18n } from "../../i18n";

// The work around a client beyond their cases — what happens next (and by
// when), the people connected to them, the files kept on them — and why a
// consultation didn't continue. The server checks every action again
// (backend: routes/clientWork.js).

export const FOLLOW_UP_KINDS = ["call", "decision", "meeting", "documents", "payment", "other"];
export const OUTCOMES = ["reached", "no_answer", "decided_yes", "decided_no", "rescheduled", "other"];
export const RELATIONS = ["father", "mother", "spouse", "child", "sibling", "relative", "representative", "friend", "colleague", "other"];
export const LOST_REASONS = ["price", "thinking", "trust", "other_lawyer", "unreachable", "no_need", "not_our_field", "other"];
export const FILE_KINDS = ["contract", "power_of_attorney", "court_decision", "application", "id_copy", "receipt", "evidence", "other"];
const KIND_ICON = { call: "phone", decision: "clock", meeting: "users", documents: "file", payment: "cash", other: "bell" };
// How long to wait for a decision: one tap.
const WAITS = [1, 2, 3, 7, 14];

const pad = (n) => String(n).padStart(2, "0");
const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
function daysFromNow(days, time = "10:00") {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}
const combine = (date, time) => {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, m] = (time || "10:00").split(":").map(Number);
  return new Date(y, mo - 1, d, h, m, 0, 0);
};

// Choices as big labelled chips (one at a time).
function ChoiceChips({ options, value, onChange, label }) {
  return (
    <div className={fieldStyles.chips} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={`${fieldStyles.chip} ${value === o.value ? fieldStyles.chipOn : ""}`} onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={o.icon} size={14} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ErrorLine({ text }) {
  return text ? <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{text}</p> : null;
}

const contactLabel = (c, t) => `${c.name} — ${t(`clientWork.relations.${c.relation}`)}`;

// ---------------------------------------------------------- next steps
// What has to happen next with this client: each open follow-up with when,
// with whom, why — done / move / cancel right there — and "+ Next step".
export function NextSteps({ client, onChanged }) {
  const { t, fmt } = useI18n();
  const [sheet, setSheet] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [now] = useState(() => Date.now());
  const open = client.followUps.filter((f) => f.status === "open");
  const closed = client.followUps.filter((f) => f.status !== "open");
  const saved = () => {
    setSheet(null);
    onChanged();
  };

  return (
    <Card
      title={t("clientWork.nextTitle")}
      subtitle={open.length ? t("clientWork.nextSubtitle") : t("clientWork.nextNone")}
      action={
        <Button size="small" variant="primary" icon="plus" onClick={() => setSheet({ type: "add" })}>
          {t("clientWork.addNext")}
        </Button>
      }
    >
      {open.length > 0 && (
        <ul className={styles.steps}>
          {open.map((f) => {
            const at = new Date(f.dueAt).getTime();
            const late = at < now;
            const phone = f.contact?.phone || client.phones[0]?.phone;
            return (
              <li key={f.id} className={`${styles.step} ${late ? styles.late : ""}`}>
                <span className={styles.stepIcon}>
                  <Icon name={KIND_ICON[f.kind] || "bell"} size={17} />
                </span>
                <div className={styles.stepMain}>
                  <div className={styles.stepHead}>
                    <strong>{t(`clientWork.kinds.${f.kind}`)}</strong>
                    <Badge tone={late ? "critical" : at - now < 86400000 ? "warning" : "neutral"} icon="clock">
                      {late ? `${t("clientWork.late")} · ` : ""}
                      {fmt.dateTime(at)}
                    </Badge>
                  </div>
                  {f.contact && (
                    <span className={styles.stepWho}>
                      <Icon name="user" size={13} /> {contactLabel(f.contact, t)}
                    </span>
                  )}
                  {f.note && <span className={styles.stepNote}>{f.note}</span>}
                  <span className={styles.stepBy}>
                    {[f.assignee ? t("clientWork.assignee", { name: personName(f.assignee) }) : null, f.case?.matter].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <div className={styles.stepActions}>
                  {telHref(phone) && <Button size="small" icon="phone" href={telHref(phone)} aria-label={t("common.call")} />}
                  <Button size="small" variant="primary" icon="check" onClick={() => setSheet({ type: "close", item: f })}>
                    {t("clientWork.done")}
                  </Button>
                  <Button size="small" variant="plain" icon="edit" onClick={() => setSheet({ type: "edit", item: f })} aria-label={t("clientWork.move")} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {closed.length > 0 && (
        <details className={styles.history} open={showDone} onToggle={(e) => setShowDone(e.currentTarget.open)}>
          <summary>{t("clientWork.history", { count: closed.length })}</summary>
          <ul className={styles.closedList}>
            {closed.map((f) => (
              <li key={f.id}>
                <Icon name={f.status === "done" ? "checkCircle" : "minusCircle"} size={14} />
                <span>
                  {t(`clientWork.kinds.${f.kind}`)}
                  {f.contact ? ` (${f.contact.name})` : ""} · {fmt.dateTime(new Date(f.dueAt).getTime())}
                  {f.outcome ? ` — ${t(`clientWork.outcomes.${f.outcome}`)}` : f.status === "cancelled" ? ` — ${t("clientWork.cancelled")}` : ""}
                  {f.outcomeNote ? `: ${f.outcomeNote}` : ""}
                  <span className={styles.stepBy}> · {personName(f.doneBy)}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {sheet?.type === "add" && <FollowUpSheet client={client} onClose={() => setSheet(null)} onSaved={saved} />}
      {sheet?.type === "edit" && <FollowUpSheet client={client} item={sheet.item} onClose={() => setSheet(null)} onSaved={saved} />}
      {sheet?.type === "close" && <CloseSheet client={client} item={sheet.item} onClose={() => setSheet(null)} onSaved={saved} />}
    </Card>
  );
}

// A new follow-up, or moving / changing one. "Waiting for their decision":
// how many days (one tap), then — who to call: the client, or whoever
// decides (a connected person, e.g. the father).
export function FollowUpSheet({ client, item, defaults, onClose, onSaved }) {
  const { t } = useI18n();
  const editing = Boolean(item);
  const contacts = client.contacts || [];
  const decider = contacts.find((c) => c.decides);
  const start = item ? new Date(item.dueAt) : daysFromNow(defaults?.kind === "decision" ? 3 : 1);
  const [kind, setKind] = useState(item?.kind || defaults?.kind || "call");
  const [date, setDate] = useState(localDate(start));
  const [time, setTime] = useState(localTime(start));
  const [contactId, setContactId] = useState(item ? (item.contact?.id ? String(item.contact.id) : "") : defaults?.kind === "decision" && decider ? String(decider.id) : "");
  const [caseId, setCaseId] = useState(item?.case?.id ? String(item.case.id) : defaults?.caseId ? String(defaults.caseId) : client.cases.length === 1 ? String(client.cases[0].id) : "");
  const [note, setNote] = useState(item?.note || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function chooseKind(k) {
    setKind(k);
    // Waiting for a decision: three days, and whoever decides.
    if (k === "decision" && !editing) {
      setDate(localDate(daysFromNow(3)));
      if (decider && !contactId) setContactId(String(decider.id));
    }
  }

  async function save() {
    if (!date) return setError(t("clientWork.whenRequired"));
    setBusy(true);
    setError("");
    const payload = { kind, dueAt: combine(date, time).toISOString(), note, contactId: contactId ? Number(contactId) : null, ...(editing ? {} : { caseId: caseId ? Number(caseId) : null }) };
    try {
      if (editing) await api.updateFollowUp(item.id, payload);
      else await api.addFollowUp(client.id, payload);
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(false);
    }
  }

  async function cancel() {
    if (!confirm(t("clientWork.confirmCancel"))) return;
    setBusy(true);
    try {
      await api.closeFollowUp(item.id, { status: "cancelled" });
      onSaved();
    } catch (err) {
      saveFailed(err, t);
      setBusy(false);
    }
  }

  return (
    <Sheet title={editing ? t("clientWork.editNext") : t("clientWork.addNext")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <ChoiceChips label={t("clientWork.what")} value={kind} onChange={chooseKind} options={FOLLOW_UP_KINDS.map((k) => ({ value: k, label: t(`clientWork.kinds.${k}`), icon: KIND_ICON[k] }))} />
        {kind === "decision" && (
          <div className={pageStyles.formStack} style={{ gap: 6 }}>
            <span className={pageStyles.note}>{t("clientWork.waitHowLong")}</span>
            <ChoiceChips
              label={t("clientWork.waitHowLong")}
              value={WAITS.find((d) => localDate(daysFromNow(d)) === date) ?? null}
              onChange={(d) => setDate(localDate(daysFromNow(d)))}
              options={WAITS.map((d) => ({ value: d, label: d === 7 ? t("clientWork.week") : d === 14 ? t("clientWork.twoWeeks") : t("clientWork.days", { n: d }) }))}
            />
          </div>
        )}
        <div className={clientStyles.twoCol}>
          <TextField label={kind === "decision" ? t("clientWork.callOn") : t("clientWork.when")} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <TextField label={t("clientWork.time")} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <SelectField label={t("clientWork.withWhom")} hint={contacts.length === 0 ? t("clientWork.addContactHint") : undefined} value={contactId} onChange={(e) => setContactId(e.target.value)}>
          <option value="">{t("clientWork.theClient", { name: client.name })}</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {contactLabel(c, t)}
              {c.decides ? ` ★` : ""}
            </option>
          ))}
        </SelectField>
        {!editing && client.cases.length > 1 && (
          <SelectField label={t("clientWork.aboutCase")} value={caseId} onChange={(e) => setCaseId(e.target.value)}>
            <option value="">{t("clientWork.aboutClient")}</option>
            {client.cases.map((k) => (
              <option key={k.id} value={k.id}>
                {k.matter || t("cases.untitled")}
              </option>
            ))}
          </SelectField>
        )}
        <TextAreaField label={t("clientWork.note")} placeholder={kind === "decision" ? t("clientWork.decisionPlaceholder") : t("clientWork.notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        <p className={pageStyles.note}>{t("clientWork.reminderHint")}</p>
        <ErrorLine text={error} />
        <div className={pageStyles.formActions}>
          {editing && (
            <Button variant="destructive" onClick={cancel} disabled={busy}>
              {t("clientWork.cancelStep")}
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

// Done: what came of it — and the next step at once (no answer: try again
// tomorrow; they said no: close the consultation with why).
// Done: how it went, what they said — and, usually, what next. From Home
// the client comes without its cases (closing the consultation is on the
// client's page).
export function CloseSheet({ client, item, onClose, onSaved }) {
  const { t } = useI18n();
  const [outcome, setOutcome] = useState(item.kind === "call" || item.kind === "decision" ? null : "other");
  const [note, setNote] = useState("");
  const [planNext, setPlanNext] = useState(false);
  const [nextKind, setNextKind] = useState("call");
  const [nextDate, setNextDate] = useState(localDate(daysFromNow(1)));
  const [nextTime, setNextTime] = useState(localTime(new Date(item.dueAt)));
  const cases = client.cases || [];
  const theCase = item.case ? cases.find((k) => k.id === item.case.id) : cases.length === 1 ? cases[0] : null;
  const canDecline = theCase && ["consultation", "call_again"].includes(theCase.status) && theCase.permissions?.canStatus;
  const [decline, setDecline] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function choose(o) {
    setOutcome(o);
    // No answer, or moved: the next try is the point.
    if (o === "no_answer" || o === "rescheduled") {
      setPlanNext(true);
      setNextKind(item.kind === "decision" ? "decision" : "call");
    }
    if (o === "decided_yes") {
      setPlanNext(true);
      setNextKind("documents");
    }
    setDecline(o === "decided_no" && Boolean(canDecline));
  }

  async function save() {
    if ((item.kind === "call" || item.kind === "decision") && !outcome) return setError(t("clientWork.pickOutcome"));
    if (decline && !lostReason) return setError(t("clientWork.pickReason"));
    setBusy(true);
    setError("");
    try {
      await api.closeFollowUp(item.id, {
        status: "done",
        outcome: outcome || null,
        outcomeNote: note,
        ...(planNext ? { next: { kind: nextKind, dueAt: combine(nextDate, nextTime).toISOString() } } : {}),
      });
      if (decline) await api.updateCase(theCase.id, { status: "declined", lostReason, lostNote: note || null });
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(false);
    }
  }

  return (
    <Sheet title={t("clientWork.closeTitle", { what: t(`clientWork.kinds.${item.kind}`) })} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <span className={pageStyles.note}>{t("clientWork.howWasIt")}</span>
        <ChoiceChips label={t("clientWork.howWasIt")} value={outcome} onChange={choose} options={OUTCOMES.map((o) => ({ value: o, label: t(`clientWork.outcomes.${o}`) }))} />
        <TextAreaField label={t("clientWork.whatSaid")} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        {decline && (
          <div className={styles.declineBox}>
            <Switch label={t("clientWork.closeConsultation")} hint={t("clientWork.closeConsultationHint")} checked={decline} onChange={setDecline} />
            <SelectField label={t("clientWork.lostReason")} value={lostReason} onChange={(e) => setLostReason(e.target.value)}>
              <option value="">{t("clientWork.pickReason")}</option>
              {LOST_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`clientWork.lost.${r}`)}
                </option>
              ))}
            </SelectField>
          </div>
        )}
        <Switch label={t("clientWork.planNext")} checked={planNext} onChange={setPlanNext} />
        {planNext && (
          <>
            <ChoiceChips label={t("clientWork.what")} value={nextKind} onChange={setNextKind} options={FOLLOW_UP_KINDS.map((k) => ({ value: k, label: t(`clientWork.kinds.${k}`), icon: KIND_ICON[k] }))} />
            <div className={clientStyles.twoCol}>
              <TextField label={t("clientWork.when")} type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
              <TextField label={t("clientWork.time")} type="time" value={nextTime} onChange={(e) => setNextTime(e.target.value)} />
            </div>
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

// ------------------------------------------------------------ contacts
// The people connected to the client: who, how related, their number, and
// who decides (★). Their calls show up as this client's.
export function ContactsCard({ client, onChanged }) {
  const { t, fmt } = useI18n();
  const [sheet, setSheet] = useState(null);
  const canEdit = client.canEdit !== false;
  return (
    <Card
      title={t("clientWork.contactsTitle")}
      subtitle={t("clientWork.contactsHint")}
      action={
        canEdit && (
          <Button size="small" icon="plus" onClick={() => setSheet({})}>
            {t("clientWork.addContact")}
          </Button>
        )
      }
    >
      {client.contacts.length === 0 ? (
        <p className={pageStyles.note}>{t("clientWork.noContacts")}</p>
      ) : (
        <ul className={styles.contacts}>
          {client.contacts.map((c) => (
            <li key={c.id} className={styles.contact}>
              <div className={styles.contactMain}>
                <span className={styles.contactName}>
                  {c.name}
                  {c.decides && (
                    <Badge tone="accent" icon="checkCircle">
                      {t("clientWork.decides")}
                    </Badge>
                  )}
                </span>
                <span className={styles.contactRel}>{t(`clientWork.relations.${c.relation}`)}</span>
                {c.phone && (
                  <a className={styles.contactPhone} href={telHref(c.phone) || undefined}>
                    {fmt.phone(c.phone)}
                  </a>
                )}
                {c.note && <span className={styles.stepNote}>{c.note}</span>}
              </div>
              {canEdit && (
                <button type="button" className={clientStyles.iconButton} onClick={() => setSheet({ item: c })} aria-label={t("clientWork.editContact")}>
                  <Icon name="edit" size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {sheet && (
        <ContactSheet
          client={client}
          item={sheet.item}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

function ContactSheet({ client, item, onClose, onSaved }) {
  const { t } = useI18n();
  const editing = Boolean(item);
  const [name, setName] = useState(item?.name || "");
  const [relation, setRelation] = useState(item?.relation || "father");
  const [phone, setPhone] = useState(item?.phone || "");
  const [decides, setDecides] = useState(item?.decides ?? false);
  const [note, setNote] = useState(item?.note || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim()) return setError(t("clients.nameRequired"));
    setBusy(true);
    setError("");
    const payload = { name, relation, phone, decides, note };
    try {
      if (editing) await api.updateContact(item.id, payload);
      else await api.addContact(client.id, payload);
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(t("clientWork.confirmRemoveContact", { name: item.name }))) return;
    setBusy(true);
    try {
      await api.deleteContact(item.id);
      onSaved();
    } catch (err) {
      saveFailed(err, t);
      setBusy(false);
    }
  }

  return (
    <Sheet title={editing ? t("clientWork.editContact") : t("clientWork.addContact")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <p className={pageStyles.note}>{t("clientWork.contactSheetHint", { name: client.name })}</p>
        <TextField label={t("clientWork.contactName")} value={name} onChange={(e) => setName(e.target.value)} required />
        <SelectField label={t("clientWork.relation")} value={relation} onChange={(e) => setRelation(e.target.value)}>
          {RELATIONS.map((r) => (
            <option key={r} value={r}>
              {t(`clientWork.relations.${r}`)}
            </option>
          ))}
        </SelectField>
        <TextField label={t("clients.phone")} type="tel" inputMode="tel" placeholder="+998 90 123 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Switch label={t("clientWork.decides")} hint={t("clientWork.decidesHint")} checked={decides} onChange={setDecides} />
        <TextAreaField label={t("clientWork.note")} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        <ErrorLine text={error} />
        <div className={pageStyles.formActions}>
          {editing && (
            <Button variant="destructive" onClick={remove} disabled={busy}>
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

// --------------------------------------------------------------- files
// Files kept on the client — contracts, powers of attorney, court decisions,
// receipts — by kind, newest first; each opens (or downloads).
export function FilesCard({ client, onChanged }) {
  const { t, fmt } = useI18n();
  const [adding, setAdding] = useState(false);
  const canEdit = client.view !== "result";
  const caseName = new Map(client.cases.map((k) => [k.id, k.matter || t("cases.untitled")]));

  async function remove(f) {
    if (!confirm(t("clientWork.confirmRemoveFile", { name: f.title || f.name }))) return;
    try {
      await api.deleteClientFile(f.id);
      onChanged();
    } catch (err) {
      saveFailed(err, t);
    }
  }

  return (
    <Card
      title={t("clientWork.filesTitle")}
      subtitle={t("clientWork.filesHint")}
      action={
        canEdit && (
          <Button size="small" icon="upload" onClick={() => setAdding(true)}>
            {t("clientWork.addFile")}
          </Button>
        )
      }
    >
      {client.files.length === 0 ? (
        <p className={pageStyles.note}>{t("clientWork.noFiles")}</p>
      ) : (
        <ul className={styles.files}>
          {client.files.map((f) => (
            <li key={f.id} className={styles.file}>
              <span className={styles.stepIcon}>
                <Icon name="file" size={16} />
              </span>
              <a className={styles.fileMain} href={api.clientFileUrl(f.id)} target="_blank" rel="noreferrer">
                <span className={styles.fileName}>{f.title || f.name}</span>
                <span className={styles.stepBy}>
                  {[t(`clientWork.fileKinds.${f.kind}`), f.caseId ? caseName.get(f.caseId) : null, fmt.date(new Date(f.createdAt).getTime()), personName(f.uploadedBy), `${Math.max(1, Math.round(f.size / 1024))} KB`].filter(Boolean).join(" · ")}
                </span>
              </a>
              <Button size="small" variant="plain" icon="download" href={api.clientFileUrl(f.id, { download: true })} aria-label={t("clientWork.download")} />
              {(client.canManage || f.uploadedBy?.id === client.me) && (
                <button type="button" className={clientStyles.iconButton} onClick={() => remove(f)} aria-label={t("caseWork.remove")}>
                  <Icon name="trash" size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <UploadSheet
          client={client}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

function UploadSheet({ client, onClose, onSaved }) {
  const { t } = useI18n();
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [kind, setKind] = useState("contract");
  const [title, setTitle] = useState("");
  const [caseId, setCaseId] = useState(client.cases.length === 1 ? String(client.cases[0].id) : "");
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");

  async function upload() {
    if (!file) return setError(t("clientWork.pickFile"));
    setError("");
    setProgress(0);
    try {
      await api.uploadClientFile(client.id, file, { kind, title, caseId: caseId ? Number(caseId) : null }, setProgress);
      onSaved();
    } catch (err) {
      setProgress(null);
      setError(err.code === "file_type_not_allowed" ? t("clientWork.typeNotAllowed") : err.code === "file_too_large" ? t("clientWork.tooLarge") : t("clients.saveFailed", { reason: err.code || "?" }));
    }
  }

  return (
    <Sheet title={t("clientWork.addFile")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <input ref={input} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <Button icon="upload" onClick={() => input.current?.click()}>
          {file ? file.name : t("clientWork.pickFile")}
        </Button>
        <SelectField label={t("clientWork.fileKind")} value={kind} onChange={(e) => setKind(e.target.value)}>
          {FILE_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`clientWork.fileKinds.${k}`)}
            </option>
          ))}
        </SelectField>
        <TextField label={t("clientWork.fileTitle")} placeholder={t("clientWork.fileTitlePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} />
        {client.cases.length > 0 && (
          <SelectField label={t("clientWork.aboutCase")} value={caseId} onChange={(e) => setCaseId(e.target.value)}>
            <option value="">{t("clientWork.aboutClient")}</option>
            {client.cases.map((k) => (
              <option key={k.id} value={k.id}>
                {k.matter || t("cases.untitled")}
              </option>
            ))}
          </SelectField>
        )}
        {progress != null && (
          <div className={clientStyles.track} aria-hidden="true">
            <div className={clientStyles.fill} style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
        <p className={pageStyles.note}>{t("clientWork.fileRules")}</p>
        <ErrorLine text={error} />
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" busy={progress != null} onClick={upload}>
            {t("clientWork.upload")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

// -------------------------------------------------------- lost reason
// Closing a consultation that didn't continue: why. Asked every time — it's
// what shows where clients are lost.
export function LostSheet({ item, onClose, onSaved }) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!reason) return setError(t("clientWork.pickReason"));
    setBusy(true);
    try {
      await api.updateCase(item.id, { status: "declined", lostReason: reason, lostNote: note || null });
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(false);
    }
  }

  return (
    <Sheet title={t("clientWork.lostTitle")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <p className={pageStyles.note}>{t("clientWork.lostHint")}</p>
        <ChoiceChips label={t("clientWork.lostReason")} value={reason} onChange={setReason} options={LOST_REASONS.map((r) => ({ value: r, label: t(`clientWork.lost.${r}`) }))} />
        <TextAreaField label={t("clientWork.lostNote")} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        <ErrorLine text={error} />
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="destructive" busy={busy} onClick={save}>
            {t("clientWork.markLost")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
