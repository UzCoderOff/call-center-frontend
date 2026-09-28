import { useEffect, useState } from "react";
import styles from "./Clients.module.css";
import pageStyles from "../../pages/Pages.module.css";
import Sheet from "../ui/Sheet";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { SelectField, TextAreaField, TextField } from "../ui/Field";
import { LEGAL_STAGES, SOURCES, STATUSES } from "./parts";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { todayIso } from "../../lib/format";
import { useI18n } from "../../i18n";

const digits = (v) => String(v ?? "").replace(/\D/g, "");
const grouped = (v) => digits(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

// Sums in so'm, shown with spaces as they're typed ("15 000 000").
function MoneyField({ label, value, onChange, ...rest }) {
  return <TextField label={label} value={grouped(value)} onChange={(e) => onChange(digits(e.target.value))} inputMode="numeric" {...rest} />;
}

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
export function ClientSheet({ client, prefill, onClose, onSaved }) {
  const { t } = useI18n();
  const editing = Boolean(client);
  const [name, setName] = useState(client?.name || prefill?.name || "");
  const [phones, setPhones] = useState(client ? client.phones.map((p) => p.phone) : [prefill?.phone || ""]);
  const [city, setCity] = useState(client?.city || "");
  const [source, setSource] = useState(client?.source || (prefill?.phone ? "call" : ""));
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
      ...(editing ? {} : { case: { matter, lawyer: lawyer.lawyer, lawyerId: lawyer.lawyerId, status } }),
    };
    try {
      const saved = editing ? await api.updateClient(client.id, payload) : await api.createClient(payload);
      onSaved(saved);
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
                {STATUSES.map((s) => (
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

        {duplicate && (
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
            {t("clients.save")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

// -------------------------------------------------------------- case
export function CaseSheet({ clientId, item, canManage, onClose, onSaved }) {
  const { t } = useI18n();
  const editing = Boolean(item);
  const [matter, setMatter] = useState(item?.matter || "");
  const [number, setNumber] = useState(item?.number || "");
  const [lawyer, setLawyer] = useState({ lawyerId: item?.lawyerId ?? null, lawyer: item?.lawyer || "" });
  const [status, setStatus] = useState(item?.status || "consultation");
  const [legalStage, setLegalStage] = useState(item?.legalStage || "");
  const [startDate, setStartDate] = useState(item?.startDate || todayIso());
  const [amount, setAmount] = useState(item?.contractAmount ? String(item.contractAmount) : "");
  const [operatorId, setOperatorId] = useState(item?.operator?.id ? String(item.operator.id) : "");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const employees = useAsync(() => (canManage ? api.employees() : Promise.resolve([])), [canManage]);
  const hasContract = status === "contract" || status === "done";

  async function save() {
    setBusy("save");
    setError("");
    const payload = {
      matter,
      number,
      lawyer: lawyer.lawyer,
      lawyerId: lawyer.lawyerId,
      status,
      legalStage: hasContract ? legalStage || null : null,
      startDate,
      contractAmount: amount ? Number(amount) : null,
      ...(canManage ? { operatorId: operatorId ? Number(operatorId) : null } : {}),
    };
    try {
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
        <TextField label={t("cases.matter")} placeholder={t("cases.matterPlaceholder")} value={matter} onChange={(e) => setMatter(e.target.value)} />
        <div className={styles.twoCol}>
          <SelectField label={t("cases.status")} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`cases.statuses.${s}`)}
              </option>
            ))}
          </SelectField>
          {hasContract ? (
            <SelectField label={t("cases.legalStage")} value={legalStage} onChange={(e) => setLegalStage(e.target.value)}>
              <option value="">{t("cases.noStage")}</option>
              {LEGAL_STAGES.map((s) => (
                <option key={s} value={s}>
                  {t(`cases.stages.${s}`)}
                </option>
              ))}
            </SelectField>
          ) : (
            <TextField label={t("cases.startDate")} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          )}
        </div>
        <LawyerField value={lawyer} onChange={setLawyer} />
        <TextField label={t("cases.number")} value={number} onChange={(e) => setNumber(e.target.value)} />
        <MoneyField label={t("cases.contractAmount")} value={amount} onChange={setAmount} />
        {canManage && (
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
export function PaymentSheet({ clientId, cases, caseId, onClose, onSaved }) {
  const { t } = useI18n();
  const target = cases.find((c) => c.id === caseId);
  const [amount, setAmount] = useState(target?.remaining > 0 ? String(target.remaining) : "");
  const [date, setDate] = useState(todayIso());
  const [method, setMethod] = useState("card");
  const [kind, setKind] = useState(target?.status === "consultation" ? "consultation" : "contract");
  const [forCase, setForCase] = useState(caseId ? String(caseId) : cases[0] ? String(cases[0].id) : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!Number(amount)) return setError(t("payments.amountRequired"));
    setBusy(true);
    setError("");
    try {
      await api.addPayment(clientId, { amount: Number(amount), date, method, kind, note, caseId: forCase ? Number(forCase) : null });
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={t("payments.add")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <MoneyField label={t("payments.amount")} value={amount} onChange={setAmount} />
        <div className={styles.twoCol}>
          <TextField label={t("payments.date")} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <SelectField label={t("payments.method")} value={method} onChange={(e) => setMethod(e.target.value)}>
            {["cash", "card", "transfer"].map((m) => (
              <option key={m} value={m}>
                {t(`payments.methods.${m}`)}
              </option>
            ))}
          </SelectField>
        </div>
        <div className={styles.twoCol}>
          <SelectField label={t("payments.kind")} value={kind} onChange={(e) => setKind(e.target.value)}>
            {["consultation", "contract", "other"].map((k) => (
              <option key={k} value={k}>
                {t(`payments.kinds.${k}`)}
              </option>
            ))}
          </SelectField>
          {cases.length > 1 && (
            <SelectField label={t("payments.forCase")} value={forCase} onChange={(e) => setForCase(e.target.value)}>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.matter || t(`cases.statuses.${c.status}`)}
                </option>
              ))}
            </SelectField>
          )}
        </div>
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
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
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
export function BulkSheet({ kind, count, operators, lawyers, onApply, onClose }) {
  const { t } = useI18n();
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const options = kind === "operator" ? operators : kind === "lawyer" ? lawyers : [];

  async function apply() {
    if (kind !== "declined" && !choice) return setError(t("bulk.pickFirst"));
    setBusy(true);
    setError("");
    try {
      await onApply(kind === "operator" ? { operatorId: Number(choice) } : kind === "lawyer" ? { lawyerId: Number(choice) } : { status: "declined" });
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
          <SelectField label={t(kind === "operator" ? "cases.operator" : "cases.lawyer")} value={choice} onChange={(e) => setChoice(e.target.value)}>
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

