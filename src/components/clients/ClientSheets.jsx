import { useEffect, useState } from "react";
import styles from "./Clients.module.css";
import pageStyles from "../../pages/Pages.module.css";
import Sheet from "../ui/Sheet";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { MoneyField, SelectField, TextAreaField, TextField } from "../ui/Field";
import { SOURCES, STATUSES } from "./parts";
import { LOST_REASONS } from "./ClientWork";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { todayIso } from "../../lib/format";
import Segmented from "../ui/Segmented";
import CashWith, { cashWithDefault, cashWithOf } from "../finance/CashWith";
import { useAuth } from "../../hooks/useAuth";
import { canBookAppointments, isManager } from "../../lib/access";
import { useI18n } from "../../i18n";


// Who handles the case: one of the lawyer accounts (the case then shows up
// for that lawyer), a name already used on other cases, or someone else by
// name. value: { lawyerId, lawyer }.
function LawyerField({ value, onChange }) {
  const { t } = useI18n();
  const state = useAsync(() => api.clientLawyers(), []);
  const accounts = state.data?.accounts || [];
  const names = state.data?.names || [];
  const [typing, setTyping] = useState(false);
  const current = value.lawyerId ? `id:${value.lawyerId}` : !value.lawyer ? "" : names.includes(value.lawyer) && !typing ? `name:${value.lawyer}` : "other";

  function choose(v) {
    setTyping(v === "other");
    if (v.startsWith("id:")) {
      const account = accounts.find((a) => String(a.id) === v.slice(3));
      onChange({ lawyerId: account.id, lawyer: account.name });
    } else if (v.startsWith("name:")) onChange({ lawyerId: null, lawyer: v.slice(5) });
    else if (v === "other") onChange({ lawyerId: null, lawyer: value.lawyerId ? "" : value.lawyer });
    else onChange({ lawyerId: null, lawyer: "" });
  }

  return (
    <>
      <SelectField label={t("cases.lawyer")} hint={t("lawyer.pickHint")} value={typing ? "other" : current} onChange={(e) => choose(e.target.value)}>
        <option value="">{t("lawyer.none")}</option>
        {accounts.length > 0 && (
          <optgroup label={t("lawyer.accounts")}>
            {accounts.map((a) => (
              <option key={a.id} value={`id:${a.id}`}>
                {a.name}
              </option>
            ))}
          </optgroup>
        )}
        {names.length > 0 && (
          <optgroup label={t("lawyer.otherNames")}>
            {names.map((n) => (
              <option key={n} value={`name:${n}`}>
                {n}
              </option>
            ))}
          </optgroup>
        )}
        <option value="other">{t("lawyer.someoneElse")}</option>
      </SelectField>
      {(typing || current === "other") && (
        <TextField label={t("lawyer.nameLabel")} value={value.lawyer || ""} onChange={(e) => onChange({ lawyerId: null, lawyer: e.target.value })} autoComplete="off" />
      )}
    </>
  );
}

function ErrorLine({ text }) {
  return text ? <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{text}</p> : null;
}

// ------------------------------------------------------------ client
// New client (with their first case) or editing one. A phone number that
// already belongs to someone stops the save and offers that client instead.
// Booking a client into the calendar: the form opens with them filled in.
export const bookUrlFor = (id, name, phone) => `/calendar?${new URLSearchParams({ clientId: id, name, ...(phone ? { phone } : {}) })}`;

// A new client, or the details of one. Adding one asks two things
// (2026-10-17): is it a new client — the first time they came to the firm,
// counted as a new client — or one the firm already had, only now written
// in (not counted); and whether to book them a consultation now. onSaved
// gets (client, { bookUrl }) — bookUrl only when they said yes.
export function ClientSheet({ client, prefill, onClose, onSaved }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const editing = Boolean(client);
  const mayBook = !editing && canBookAppointments(user);
  // A manager can correct it later.
  const askNew = !editing || isManager(user);
  const [isNew, setIsNew] = useState(editing ? client.isNew !== false : null);
  const [book, setBook] = useState(null);
  const [name, setName] = useState(client?.name || prefill?.name || "");
  const [phones, setPhones] = useState(client ? client.phones.map((p) => p.phone) : [prefill?.phone || ""]);
  const [city, setCity] = useState(client?.city || "");
  const [source, setSource] = useState(client?.source || prefill?.source || (prefill?.phone ? "call" : ""));
  const [email, setEmail] = useState(client?.email || "");
  const [notes, setNotes] = useState(client?.notes || "");
  const [matter, setMatter] = useState("");
  const [lawyer, setLawyer] = useState({ lawyerId: null, lawyer: "" });
  const [status, setStatus] = useState("consultation");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState(null);

  const setPhone = (i, v) => setPhones((list) => list.map((p, j) => (j === i ? v : p)));

  async function save(force = false) {
    if (!name.trim()) return setError(t("clients.nameRequired"));
    if (askNew && isNew === null) return setError(t("clients.isNewNeeded"));
    if (!editing && !source) return setError(t("clients.sourceNeeded"));
    if (mayBook && book === null) return setError(t("clients.bookNeeded"));
    setBusy(true);
    setError("");
    const payload = {
      name,
      phones: phones.map((p) => p.trim()).filter(Boolean),
      city,
      source: source || null,
      email,
      notes,
      force,
      ...(askNew && (!editing || isNew !== (client.isNew !== false)) ? { isNew } : {}),
      ...(editing ? {} : { case: { matter, lawyer: lawyer.lawyer, lawyerId: lawyer.lawyerId, status } }),
    };
    try {
      const saved = editing ? await api.updateClient(client.id, payload) : await api.createClient(payload);
      onSaved(saved, { bookUrl: mayBook && book ? bookUrlFor(saved.id, saved.name, payload.phones[0]) : null });
    } catch (err) {
      if (err.code === "phone_exists") setDuplicate(err.body.client);
      else setError(t("clients.saveFailed", { reason: err.code || "?" }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={editing ? t("clients.editTitle") : t("clients.add")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        {askNew && (
          <div>
            <span className={pageStyles.note}>{t("clients.isNewQuestion")}</span>
            <Segmented
              full
              value={isNew}
              onChange={setIsNew}
              label={t("clients.isNewQuestion")}
              options={[
                { value: true, label: t("clients.isNewYes") },
                { value: false, label: t("clients.isNewNo") },
              ]}
            />
            <span className={pageStyles.note}>{isNew === false ? t("clients.isNewNoHint") : isNew ? t("clients.isNewYesHint") : t("clients.isNewHint")}</span>
          </div>
        )}
        <TextField label={t("clients.name")} placeholder={t("clients.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} required />
        {phones.map((p, i) => (
          <div key={i} className={styles.phoneEditRow}>
            <TextField
              label={i === 0 ? t("clients.phone") : t("clients.phoneMore")}
              value={p}
              onChange={(e) => setPhone(i, e.target.value)}
              type="tel"
              inputMode="tel"
              placeholder="+998 90 123 45 67"
            />
            {phones.length > 1 && (
              <button type="button" className={styles.iconButton} onClick={() => setPhones((l) => l.filter((_, j) => j !== i))} aria-label={t("clients.removePhone")}>
                <Icon name="trash" size={16} />
              </button>
            )}
          </div>
        ))}
        {phones.length < 5 && (
          <button type="button" className={styles.addLine} onClick={() => setPhones((l) => [...l, ""])}>
            <Icon name="plus" size={15} />
            {t("clients.addPhone")}
          </button>
        )}
        <div className={styles.twoCol}>
          <TextField label={t("clients.city")} value={city} onChange={(e) => setCity(e.target.value)} />
          <SelectField label={t("clients.source")} value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">—</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {t(`clients.sources.${s}`)}
              </option>
            ))}
          </SelectField>
        </div>

        {!editing && (
          <>
            <TextField label={t("cases.matter")} placeholder={t("cases.matterPlaceholder")} value={matter} onChange={(e) => setMatter(e.target.value)} />
            <div className={styles.twoCol}>
              <SelectField label={t("cases.status")} value={status} onChange={(e) => setStatus(e.target.value)}>
                {/* Whoever adds the client is its first case's operator: staff set what an operator may (the server checks the same). */}
                {(isManager(user) ? STATUSES : OPERATOR_STATUSES).map((s) => (
                  <option key={s} value={s}>
                    {t(`cases.statuses.${s}`)}
                  </option>
                ))}
              </SelectField>
              <LawyerField value={lawyer} onChange={setLawyer} />
            </div>
          </>
        )}

        {editing && <TextField label={t("clients.email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        <TextAreaField label={t("clients.notes")} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

        {mayBook && (
          <div>
            <span className={pageStyles.note}>{t("clients.askBookTitle")}</span>
            <Segmented
              full
              value={book}
              onChange={setBook}
              label={t("clients.askBookTitle")}
              options={[
                { value: true, label: t("clients.askBookYes") },
                { value: false, label: t("clients.askBookNo") },
              ]}
            />
          </div>
        )}

        {duplicate?.restricted && (
          <div className={styles.duplicate}>
            <span style={{ flex: "1 1 200px" }}>
              {duplicate.operator ? t("clients.phoneExistsOtherOf", { operator: duplicate.operator }) : t("clients.phoneExistsOther")}
            </span>
          </div>
        )}
        {duplicate && !duplicate.restricted && (
          <div className={styles.duplicate}>
            <span style={{ flex: "1 1 200px" }}>{t("clients.phoneExists", { name: duplicate.name })}</span>
            <Button size="small" to={`/clients/${duplicate.id}`} onClick={onClose}>
              {t("clients.openExisting")}
            </Button>
            <Button size="small" variant="plain" onClick={() => save(true)}>
              {t("clients.addAnyway")}
            </Button>
          </div>
        )}
        <ErrorLine text={error} />
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" busy={busy} onClick={() => save(false)}>
            {mayBook && book ? t("clients.saveAndBook") : t("clients.save")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

// -------------------------------------------------------------- case
// A new case, or the details of one. Each person sees the fields that are
// theirs to change (the server checks the same — item.permissions.role):
//   managers     everything: what, number, court, status, its dates, the
//                contract amount (Moliya), operator, lawyer
//   lawyer       what, number, court, status, when it closed
//   coordinator  number, court
//   operator     the consultation: what, status up to the contract, when it
//                started, number, lawyer
// Only what changed is sent. The stage history and key dates are on the
// case itself (CaseWork.jsx), not here.
const OPERATOR_STATUSES = ["consultation", "call_again", "contract", "declined"];
const CASE_FIELDS = {
  manager: ["matter", "details", "number", "court", "status", "startDate", "consultationDate", "contractDate", "closedDate", "lawyer", "operatorId", "lostReason", "lostNote"],
  lawyer: ["matter", "details", "number", "court", "status", "closedDate", "lostReason", "lostNote"],
  coordinator: ["number", "court", "details"],
  operator: ["matter", "details", "number", "status", "startDate", "lawyer", "lostReason", "lostNote"],
};

export function CaseSheet({ clientId, item, canManage, finance = false, onClose, onSaved }) {
  const { t } = useI18n();
  const editing = Boolean(item);
  const role = editing ? item.permissions?.role || (canManage ? "manager" : "operator") : canManage ? "manager" : "operator";
  const may = (field) => (CASE_FIELDS[role] || []).includes(field);
  const [matter, setMatter] = useState(item?.matter || "");
  const [details, setDetails] = useState(item?.details || "");
  const [number, setNumber] = useState(item?.number || "");
  const [court, setCourt] = useState(item?.court || "");
  const [lawyer, setLawyer] = useState({ lawyerId: item?.lawyerId ?? null, lawyer: item?.lawyer || "" });
  const [status, setStatus] = useState(item?.status || "consultation");
  const [startDate, setStartDate] = useState(item?.startDate || todayIso());
  const [consultationDate, setConsultationDate] = useState(item?.consultationDate || "");
  const [contractDate, setContractDate] = useState(item?.contractDate || "");
  const [closedDate, setClosedDate] = useState(item?.closedDate || "");
  const [amount, setAmount] = useState(item?.contractAmount ? String(item.contractAmount) : "");
  const [operatorId, setOperatorId] = useState(item?.operator?.id ? String(item.operator.id) : "");
  const [lostReason, setLostReason] = useState(item?.lostReason || "");
  const [lostNote, setLostNote] = useState(item?.lostNote || "");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const employees = useAsync(() => (canManage ? api.employees() : Promise.resolve([])), [canManage]);
  const statuses = role === "operator" ? OPERATOR_STATUSES : STATUSES;
  const closed = status === "done" || status === "declined";

  async function save() {
    // Didn't continue: why (it's what shows where clients are lost).
    if (status === "declined" && may("lostReason") && !lostReason) return setError(t("clientWork.pickReason"));
    setBusy("save");
    setError("");
    const values = {
      lostReason: status === "declined" ? lostReason || null : undefined,
      lostNote: status === "declined" ? lostNote || null : undefined,
      matter,
      details,
      number,
      court,
      status,
      startDate: startDate || null,
      consultationDate: consultationDate || null,
      contractDate: contractDate || null,
      closedDate: closedDate || null,
      operatorId: operatorId ? Number(operatorId) : null,
    };
    const before = {
      matter: item?.matter || "",
      details: item?.details || "",
      number: item?.number || "",
      court: item?.court || "",
      status: item?.status || "consultation",
      startDate: item?.startDate || null,
      consultationDate: item?.consultationDate || null,
      contractDate: item?.contractDate || null,
      closedDate: item?.closedDate || null,
      operatorId: item?.operator?.id ?? null,
      lostReason: item?.lostReason ?? null,
      lostNote: item?.lostNote ?? null,
    };
    const payload = {};
    for (const [key, value] of Object.entries(values)) {
      if (!may(key) || value === undefined) continue;
      if (!editing || value !== before[key]) payload[key] = value;
    }
    if (may("lawyer") && (!editing || lawyer.lawyerId !== (item?.lawyerId ?? null) || lawyer.lawyer !== (item?.lawyer || ""))) {
      payload.lawyer = lawyer.lawyer;
      payload.lawyerId = lawyer.lawyerId;
    }
    // Only people who see money set the contract amount (the server ignores
    // it from anyone else, so it can't be wiped by accident).
    if (finance && (!editing || String(item?.contractAmount ?? "") !== amount)) payload.contractAmount = amount ? Number(amount) : null;
    if (!editing && !payload.startDate) payload.startDate = todayIso();
    try {
      if (editing && Object.keys(payload).length === 0) return onSaved(item);
      onSaved(editing ? await api.updateCase(item.id, payload) : await api.addCase(clientId, payload));
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm(t("cases.confirmDelete"))) return;
    setBusy("delete");
    try {
      await api.deleteCase(item.id);
      onSaved(null);
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(null);
    }
  }

  return (
    <Sheet title={editing ? t("cases.edit") : t("cases.new")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        {may("matter") && <TextField label={t("cases.matter")} placeholder={t("cases.matterPlaceholder")} value={matter} onChange={(e) => setMatter(e.target.value)} />}
        {may("details") && (
          <TextAreaField label={t("cases.details")} placeholder={t("cases.detailsPlaceholder")} value={details} onChange={(e) => setDetails(e.target.value)} rows={4} maxLength={6000} />
        )}
        <div className={styles.twoCol}>
          {may("number") && <TextField label={t("cases.number")} value={number} onChange={(e) => setNumber(e.target.value)} />}
          {may("status") && (
            <SelectField label={t("cases.status")} value={status} onChange={(e) => setStatus(e.target.value)}>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {t(`cases.statuses.${s}`)}
                </option>
              ))}
            </SelectField>
          )}
        </div>
        {status === "declined" && may("lostReason") && (
          <>
            <SelectField label={t("clientWork.lostReason")} value={lostReason} onChange={(e) => setLostReason(e.target.value)}>
              <option value="">{t("clientWork.pickReason")}</option>
              {LOST_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`clientWork.lost.${r}`)}
                </option>
              ))}
            </SelectField>
            <TextField label={t("clientWork.lostNote")} value={lostNote} onChange={(e) => setLostNote(e.target.value)} />
          </>
        )}
        {may("court") && <TextField label={t("caseWork.court")} placeholder={t("caseWork.courtPlaceholder")} value={court} onChange={(e) => setCourt(e.target.value)} />}
        {may("lawyer") && <LawyerField value={lawyer} onChange={setLawyer} />}
        {(may("startDate") || may("consultationDate") || may("contractDate") || may("closedDate")) && (
          <div className={styles.twoCol}>
            {may("startDate") && <TextField label={t("caseWork.milestones.start")} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />}
            {may("consultationDate") && editing && <TextField label={t("caseWork.milestones.consultation")} type="date" value={consultationDate} onChange={(e) => setConsultationDate(e.target.value)} />}
            {may("contractDate") && editing && <TextField label={t("caseWork.milestones.contract")} type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} />}
            {may("closedDate") && editing && closed && <TextField label={t("caseWork.milestones.closed")} type="date" value={closedDate} onChange={(e) => setClosedDate(e.target.value)} />}
          </div>
        )}
        {finance && <MoneyField label={t("cases.contractAmount")} value={amount} onChange={setAmount} />}
        {may("operatorId") && canManage && (
          <SelectField label={t("cases.operator")} value={operatorId} onChange={(e) => setOperatorId(e.target.value)}>
            <option value="">{t("cases.noOperator")}</option>
            {(employees.data || [])
              .filter((e) => e.active)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </SelectField>
        )}
        {editing && role === "manager" && <p className={pageStyles.note}>{t("caseWork.editHint")}</p>}
        <ErrorLine text={error} />
        <div className={pageStyles.formActions}>
          {editing && canManage && (
            <Button variant="destructive" busy={busy === "delete"} onClick={remove}>
              {t("cases.delete")}
            </Button>
          )}
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" busy={busy === "save"} onClick={save}>
            {t("clients.save")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

// ----------------------------------------------------------- payment
// The firm's consultation fee — filled in for a consultation payment (it can
// be changed).
const CONSULTATION_FEE = 450000;

// `finance`: sees contract money. Without it, only the consultation fee can
// be recorded (the server enforces the same).
// A new payment, or correcting one (`payment`): the amount, the day, how,
// what for — and, for cash, who took the money (Kassa counts it with them).
// The server checks who may (the audit log keeps the before and after of a
// correction).
export function PaymentSheet({ clientId, cases, caseId, payment = null, finance = false, suggested = null, onClose, onSaved }) {
  const { t, fmt } = useI18n();
  const { user } = useAuth();
  const editing = Boolean(payment);
  const target = cases.find((c) => c.id === (payment?.caseId ?? caseId));
  // `suggested`: what's left on a contract amount just set (the case here
  // is from before it).
  const firstKind = payment?.kind || (suggested ? "contract" : !finance || target?.status === "consultation" || target?.status === "call_again" ? "consultation" : "contract");
  const [amount, setAmount] = useState(
    payment ? String(payment.amount) : suggested ? String(suggested) : firstKind === "consultation" ? String(CONSULTATION_FEE) : target?.remaining > 0 ? String(target.remaining) : ""
  );
  const [date, setDate] = useState(payment?.date || todayIso());
  const [method, setMethod] = useState(payment ? payment.method || "" : "card");
  const [cashWith, setCashWith] = useState(payment ? cashWithOf(payment) : cashWithDefault(user));
  const [kind, setKind] = useState(firstKind);
  const [forCase, setForCase] = useState(payment ? (payment.caseId != null ? String(payment.caseId) : "") : caseId ? String(caseId) : cases[0] ? String(cases[0].id) : "");
  const [note, setNote] = useState(payment?.note || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const chosenCase = cases.find((c) => String(c.id) === forCase);
  // Correcting someone else's payment: "me" is them.
  const recorder = payment?.recordedBy && payment.recordedBy.id !== user.id ? { id: payment.recordedBy.id, name: payment.recordedBy.employee?.name || payment.recordedBy.name || payment.recordedBy.username } : null;

  // Picking what it's for fills in the usual amount (until they type one).
  function pickKind(next) {
    setKind(next);
    if (editing) return;
    if (next === "consultation") setAmount(String(CONSULTATION_FEE));
    else if (chosenCase?.remaining > 0) setAmount(String(chosenCase.remaining));
  }

  async function save() {
    if (!Number(amount)) return setError(t("payments.amountRequired"));
    if (!method && !editing) return setError(t("payments.methodRequired"));
    if (method === "cash" && cashWith == null) return setError(t("cashWith.required"));
    setBusy(true);
    setError("");
    const cash = method === "cash" ? cashWith : undefined;
    try {
      if (editing) {
        const changes = {};
        if (Number(amount) !== payment.amount) changes.amount = Number(amount);
        if (date !== payment.date) changes.date = date;
        if ((method || null) !== (payment.method || null)) changes.method = method || null;
        if (kind !== payment.kind) changes.kind = kind;
        if (note !== (payment.note || "")) changes.note = note;
        if ((forCase ? Number(forCase) : null) !== (payment.caseId ?? null)) changes.caseId = forCase ? Number(forCase) : null;
        if (cash !== undefined && cash !== cashWithOf(payment)) changes.cashWith = cash;
        if (Object.keys(changes).length) await api.updatePayment(payment.id, changes);
      } else {
        await api.addPayment(clientId, { amount: Number(amount), date, method, kind, note, caseId: forCase ? Number(forCase) : null, cashWith: cash });
      }
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={editing ? t("payments.edit") : finance ? t("payments.add") : t("payments.addConsultation")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        {cases.length > 1 && (
          <SelectField label={t("payments.forCase")} value={forCase} onChange={(e) => setForCase(e.target.value)}>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.matter || t(`cases.statuses.${c.status}`)}
              </option>
            ))}
          </SelectField>
        )}
        {finance && (
          <div className={pageStyles.formStack} style={{ gap: 6 }}>
            <span className={pageStyles.note}>{t("payments.kind")}</span>
            <Segmented full value={kind} onChange={pickKind} label={t("payments.kind")} options={["contract", "consultation", "other"].map((k) => ({ value: k, label: t(`payments.kinds.${k}`) }))} />
          </div>
        )}
        <MoneyField label={t("payments.amount")} value={amount} onChange={setAmount} />
        {!editing && !suggested && kind === "contract" && chosenCase?.contractAmount > 0 && (
          <p className={pageStyles.note} style={{ marginTop: -6 }}>
            {t("payments.leftOnCase", { amount: fmt.money(chosenCase.remaining ?? 0), total: fmt.money(chosenCase.contractAmount) })}
          </p>
        )}
        <div className={pageStyles.formStack} style={{ gap: 6 }}>
          <span className={pageStyles.note}>{t("payments.method")}</span>
          <Segmented full value={method} onChange={setMethod} label={t("payments.method")} options={["cash", "card", "transfer"].map((m) => ({ value: m, label: t(`payments.methods.${m}`) }))} />
        </div>
        {method === "cash" && <CashWith value={cashWith} onChange={setCashWith} recorder={recorder} />}
        <TextField label={t("payments.date")} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <TextField label={t("payments.note")} value={note} onChange={(e) => setNote(e.target.value)} />
        <ErrorLine text={error} />
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" busy={busy} onClick={save}>
            {t("clients.save")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------ contract amount
// What the client pays altogether for a case — set straight from the
// client's money card (it's also in "Ishni tahrirlash"). "Save and add a
// payment": the usual moment — the contract is signed and the first money
// comes in.
export function ContractAmountSheet({ cases, caseId, onClose, onSaved, onSavedPay }) {
  const { t, fmt } = useI18n();
  const [forCase, setForCase] = useState(String(caseId ?? cases[0]?.id ?? ""));
  const chosen = cases.find((c) => String(c.id) === forCase);
  const [amount, setAmount] = useState(chosen?.contractAmount ? String(chosen.contractAmount) : "");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  function pickCase(id) {
    setForCase(id);
    const c = cases.find((x) => String(x.id) === id);
    setAmount(c?.contractAmount ? String(c.contractAmount) : "");
  }

  async function save(andPay) {
    if (!Number(amount)) return setError(t("payments.amountRequired"));
    setBusy(andPay ? "pay" : "save");
    setError("");
    try {
      if (Number(amount) !== (chosen?.contractAmount || 0)) await api.updateCase(Number(forCase), { contractAmount: Number(amount) });
      if (andPay) onSavedPay(Number(forCase), Math.max(0, Number(amount) - (chosen?.paid || 0)) || null);
      else onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet title={t("clientMoney.contractTitle")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        {cases.length > 1 && (
          <SelectField label={t("payments.forCase")} value={forCase} onChange={(e) => pickCase(e.target.value)}>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.matter || t(`cases.statuses.${c.status}`)}
              </option>
            ))}
          </SelectField>
        )}
        <MoneyField label={t("clientMoney.contractAmount")} value={amount} onChange={setAmount} />
        {chosen?.paid > 0 && <p className={pageStyles.note}>{t("clientMoney.paidSoFar", { amount: fmt.money(chosen.paid) })}</p>}
        <p className={pageStyles.note}>{t("clientMoney.contractHint")}</p>
        <ErrorLine text={error} />
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button busy={busy === "save"} onClick={() => save(false)}>
            {t("clients.save")}
          </Button>
          <Button variant="primary" icon="plus" busy={busy === "pay"} onClick={() => save(true)}>
            {t("clientMoney.saveAndPay")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------- find a client
// "Whose money is it?" — find the client by name or phone (Moliya → "Toʻlov
// qoʻshish"); picking one opens their page with the payment form.
export function PickClientSheet({ title, onClose, onPick }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);

  const searching = query.trim().length >= 2;
  useEffect(() => {
    if (query.trim().length < 2) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .clients({ q: query })
        .then((data) => !cancelled && setResults(data.clients.slice(0, 10)))
        .catch(() => !cancelled && setResults([]));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <Sheet title={title} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <TextField label={t("pickClient.who")} placeholder={t("links.searchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" autoFocus />
        {searching && results && results.length === 0 && <p className={pageStyles.note}>{t("pickClient.none")}</p>}
        {searching && results && results.length > 0 && (
          <div className={styles.results}>
            {results.map((r) => (
              <button key={r.id} type="button" className={styles.result} onClick={() => onPick(r)}>
                <strong>{r.name}</strong>
                <span className={styles.linkSub}>{[r.phone, r.latestCase?.matter].filter(Boolean).join(" · ") || "—"}</span>
              </button>
            ))}
          </div>
        )}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
        </div>
      </div>
    </Sheet>
  );
}

// -------------------------------------------------------- connection
const LINK_CHOICES = [
  { value: "family", kind: "family" },
  { value: "referredBy", kind: "referral", direction: "to" },
  { value: "referred", kind: "referral", direction: "from" },
  { value: "same_case", kind: "same_case" },
  { value: "work", kind: "work" },
  { value: "other", kind: "other" },
];

// Connect this client to someone: pick how, then find them in the
// database (by name or phone) or add them.
export function LinkSheet({ client, onClose, onSaved }) {
  const { t } = useI18n();
  const [choice, setChoice] = useState("family");
  const [label, setLabel] = useState("");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isNew || query.trim().length < 2) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .clients({ q: query })
        .then((data) => !cancelled && setResults(data.clients.filter((c) => c.id !== client.id).slice(0, 8)))
        .catch(() => {});
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, isNew, client.id]);

  async function save() {
    const c = LINK_CHOICES.find((x) => x.value === choice);
    if (!isNew && !picked) return setError(t("links.pickSomeone"));
    if (isNew && !newName.trim()) return setError(t("clients.nameRequired"));
    setBusy(true);
    setError("");
    try {
      await api.addLink(client.id, {
        kind: c.kind,
        direction: c.direction,
        label,
        ...(isNew ? { newClient: { name: newName, phone: newPhone } } : { otherId: picked.id }),
      });
      onSaved();
    } catch (err) {
      // The number is another operator's client: say whose, not "failed".
      const other = err.code === "phone_exists" ? err.body?.client : null;
      if (other?.restricted) setError(other.operator ? t("clients.phoneExistsOtherOf", { operator: other.operator }) : t("clients.phoneExistsOther"));
      else setError(t("clients.saveFailed", { reason: err.code || "?" }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={t("links.add")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <div className={styles.choices} role="radiogroup" aria-label={t("links.how")}>
          {LINK_CHOICES.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={choice === c.value}
              className={`${styles.choice} ${choice === c.value ? styles.choiceOn : ""}`}
              onClick={() => setChoice(c.value)}
            >
              <span className={styles.choiceTitle}>{t(`links.kinds.${c.value}`)}</span>
              <span className={styles.choiceHint}>{t(`links.hints.${c.value}`)}</span>
            </button>
          ))}
        </div>
        <TextField label={t("links.label")} placeholder={t("links.labelPlaceholder")} value={label} onChange={(e) => setLabel(e.target.value)} />

        {isNew ? (
          <>
            <div className={styles.twoCol}>
              <TextField label={t("clients.name")} value={newName} onChange={(e) => setNewName(e.target.value)} />
              <TextField label={t("clients.phone")} type="tel" inputMode="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            </div>
            <button type="button" className={styles.addLine} onClick={() => setIsNew(false)}>
              <Icon name="search" size={15} />
              {t("links.searchInstead")}
            </button>
          </>
        ) : (
          <>
            <TextField label={t("links.who")} placeholder={t("links.searchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
            {results.length > 0 && (
              <div className={styles.results}>
                {results.map((r) => (
                  <button key={r.id} type="button" className={`${styles.result} ${picked?.id === r.id ? styles.resultOn : ""}`} aria-pressed={picked?.id === r.id} onClick={() => setPicked(r)}>
                    <strong>{r.name}</strong>
                    <span className={styles.linkSub}>{r.phone || "—"}</span>
                  </button>
                ))}
              </div>
            )}
            <button type="button" className={styles.addLine} onClick={() => setIsNew(true)}>
              <Icon name="plus" size={15} />
              {t("links.newPerson")}
            </button>
          </>
        )}
        <ErrorLine text={error} />
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" busy={busy} onClick={save}>
            {t("clients.save")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------- merge
// The same person entered twice: pick the other record; everything of it
// moves to this client and the duplicate is removed (managers).
export function MergeSheet({ client, onClose, onSaved }) {
  const { t, fmt } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (query.trim().length < 2) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .clients({ q: query })
        .then((data) => !cancelled && setResults(data.clients.filter((c) => c.id !== client.id).slice(0, 8)))
        .catch(() => {});
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, client.id]);

  async function merge() {
    if (!picked) return setError(t("links.pickSomeone"));
    if (!confirm(t("clients.mergeConfirm", { other: picked.name, name: client.name }))) return;
    setBusy(true);
    setError("");
    try {
      await api.mergeClient(client.id, picked.id);
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={t("clients.mergeTitle")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <p className={pageStyles.note}>{t("clients.mergeHint", { name: client.name })}</p>
        <TextField label={t("links.who")} placeholder={t("links.searchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
        {results.length > 0 && (
          <div className={styles.results}>
            {results.map((r) => (
              <button key={r.id} type="button" className={`${styles.result} ${picked?.id === r.id ? styles.resultOn : ""}`} aria-pressed={picked?.id === r.id} onClick={() => setPicked(r)}>
                <strong>{r.name}</strong>
                <span className={styles.linkSub}>{r.phone ? fmt.phone(r.phone) : "—"}</span>
              </button>
            ))}
          </div>
        )}
        <ErrorLine text={error} />
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" busy={busy} disabled={!picked} onClick={merge}>
            {t("clients.mergeButton")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

// --------------------------------------------------------------- bulk
// Many clients at once: who their operator or lawyer is, or "didn't
// continue" for their consultations. kind: "operator" | "lawyer" | "declined".
export function BulkSheet({ kind, count, operators, lawyers, coordinators = [], onApply, onClose }) {
  const { t } = useI18n();
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const options = kind === "operator" ? operators : kind === "lawyer" ? lawyers : kind === "coordinator" ? coordinators : [];
  const field = { operator: "operatorId", lawyer: "lawyerId", coordinator: "coordinatorId" }[kind];

  async function apply() {
    if (kind !== "declined" && !choice) return setError(t("bulk.pickFirst"));
    setBusy(true);
    setError("");
    try {
      await onApply(field ? { [field]: Number(choice) } : { status: "declined" });
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(false);
    }
  }

  return (
    <Sheet title={t(`bulk.${kind}Title`, { count })} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <p className={pageStyles.note}>{t(`bulk.${kind}Hint`, { count })}</p>
        {kind !== "declined" && (
          <SelectField label={t(`cases.${kind}`)} value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">{t("bulk.choose")}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </SelectField>
        )}
        <ErrorLine text={error} />
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant={kind === "declined" ? "destructive" : "primary"} busy={busy} onClick={apply}>
            {t("bulk.apply", { count })}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

// --------------------------------------------------------- next call
const pad = (n) => String(n).padStart(2, "0");

export function NextCallSheet({ client, onClose, onSaved }) {
  const { t } = useI18n();
  const when = client.nextCallAt ? new Date(client.nextCallAt) : null;
  // Default: tomorrow.
  const [date, setDate] = useState(() => {
    const d = when || new Date(Date.now() + 86400000);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [time, setTime] = useState(when ? `${pad(when.getHours())}:${pad(when.getMinutes())}` : "10:00");
  const [note, setNote] = useState(client.nextCallNote || "");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  async function save(clear = false) {
    setBusy(clear ? "clear" : "save");
    setError("");
    try {
      await api.updateClient(client.id, clear ? { nextCallAt: null, nextCallNote: null } : { nextCallAt: new Date(`${date}T${time}:00`).toISOString(), nextCallNote: note });
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet title={t("clients.nextCall")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <div className={styles.twoCol}>
          <TextField label={t("clients.nextCallDate")} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <TextField label={t("clients.nextCallTime")} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <TextField label={t("clients.nextCallNote")} value={note} onChange={(e) => setNote(e.target.value)} />
        <ErrorLine text={error} />
        <div className={pageStyles.formActions}>
          {when && (
            <Button variant="destructive" busy={busy === "clear"} onClick={() => save(true)}>
              {t("clients.removeCall")}
            </Button>
          )}
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" busy={busy === "save"} onClick={() => save(false)}>
            {t("clients.save")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

