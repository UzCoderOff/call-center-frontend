import { useState } from "react";
import styles from "./CaseWork.module.css";
import clientStyles from "./Clients.module.css";
import pageStyles from "../../pages/Pages.module.css";
import fieldStyles from "../ui/Field.module.css";
import Sheet from "../ui/Sheet";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Icon from "../ui/Icon";
import { SelectField, TextAreaField, TextField } from "../ui/Field";
import { LEGAL_STAGES, PayBadge, personName } from "./parts";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { todayIso } from "../../lib/format";
import { useI18n } from "../../i18n";

// The pieces of a case's page (pages/CasePage.jsx), the way a firm works it:
//   - who's on it: the operator who brought it, the coordinator who looks
//     after it since the contract, the lawyer (managers assign them)
//   - its milestones: came in, consultation, contract, closed — with dates
//   - where it has been, with dates (stage history — past dates can be
//     entered for a case brought in from before Ledger), and the dates that
//     matter (hearings, deadlines) with what happened
//   - its money (for whoever sees it): contract, paid, what's left, schedule,
//     payments (each can be corrected)
//   - what it's about in detail, and its consultations' summaries
// What each person may do comes from the server (`item.permissions`).

// The kinds of key date, grouped as the select shows them: the court; the
// investigation's steps (the boss's list, 2026-10-14); the rest.
export const DATE_GROUPS = [
  { key: "court", kinds: ["hearing"] },
  { key: "investigation", kinds: ["investigative_action", "interrogation", "confrontation", "suspect_questioning", "accused_questioning", "charge_announced", "case_review"] },
  { key: "other", kinds: ["summons", "deadline", "meeting", "other"] },
];
export const DATE_KINDS = DATE_GROUPS.flatMap((g) => g.kinds);
export const DATE_ICON = {
  hearing: "briefcase",
  investigative_action: "search",
  interrogation: "message",
  confrontation: "users",
  suspect_questioning: "user",
  accused_questioning: "user",
  charge_announced: "alertCircle",
  case_review: "file",
  summons: "bell",
  deadline: "clock",
  meeting: "users",
  other: "calendar",
  stage: "arrowRight",
};

const clock = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toMinutes = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// What the matter is about, in the client's words and the firm's — long
// text folded after a few lines.
export function Details({ item, canEdit, onEdit }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!item.details) {
    return canEdit ? (
      <button type="button" className={styles.detailsAsk} onClick={onEdit}>
        <Icon name="plus" size={14} /> {t("cases.addDetails")}
      </button>
    ) : null;
  }
  const long = item.details.length > 280 || item.details.split("\n").length > 4;
  return (
    <div className={styles.details}>
      <span className={styles.detailsLabel}>{t("cases.details")}</span>
      <p className={`${styles.detailsText} ${long && !open ? styles.detailsFolded : ""}`}>{item.details}</p>
      {long && (
        <button type="button" className={styles.outcomeAsk} onClick={() => setOpen((v) => !v)}>
          {open ? t("common.showLess") : t("common.showMore")}
        </button>
      )}
    </div>
  );
}

// Contract, paid, left — three big numbers, then the bar.
export function MoneyFigures({ item }) {
  const { t, fmt } = useI18n();
  const { contractAmount, paid = 0, remaining = 0, state } = item;
  if (!contractAmount && !paid) return <p className={styles.empty}>{t("payments.noContractAmount")}</p>;
  const pct = contractAmount ? Math.min(100, Math.round((paid / contractAmount) * 100)) : 100;
  return (
    <div className={styles.figures}>
      <div className={styles.figureRow}>
        <div className={styles.figure}>
          <span className={styles.figureLabel}>{t("cases.contractTotal")}</span>
          <strong className={styles.figureValue}>{contractAmount ? fmt.money(contractAmount) : "—"}</strong>
        </div>
        <div className={styles.figure}>
          <span className={styles.figureLabel}>{t("cases.paidLabel")}</span>
          <strong className={`${styles.figureValue} ${styles.figureGood}`}>{fmt.money(paid)}</strong>
        </div>
        <div className={styles.figure}>
          <span className={styles.figureLabel}>{t("cases.remainingLabel")}</span>
          <strong className={`${styles.figureValue} ${remaining > 0 ? styles.figureDue : styles.figureGood}`}>{contractAmount ? fmt.money(remaining) : "—"}</strong>
        </div>
      </div>
      {contractAmount ? (
        <div className={styles.figureBar}>
          <div className={clientStyles.track} aria-hidden="true">
            <div className={`${clientStyles.fill} ${state === "paid" ? clientStyles.fillDone : ""}`} style={{ width: `${pct}%` }} />
          </div>
          <span className={styles.figurePct}>
            {t("payments.paidPct", { pct })} <PayBadge state={state} />
          </span>
        </div>
      ) : null}
    </div>
  );
}

// Every payment on the case, newest first: when, how, who took it — each
// can be corrected (pencil: managers any time, whoever recorded it on that
// day) or, by a manager, removed.
const SHOWN_PAYMENTS = 6;
export function PaymentList({ item, client, canPay, onEdit, onRemove }) {
  const { t, fmt } = useI18n();
  const [all, setAll] = useState(false);
  const rows = item.payments || [];
  if (rows.length === 0) return <p className={styles.empty}>{t("payments.none")}</p>;
  const shown = all ? rows : rows.slice(0, SHOWN_PAYMENTS);
  const fees = rows.filter((pay) => pay.kind === "consultation").reduce((sum, pay) => sum + pay.amount, 0);
  const recordedToday = (pay) => new Date(pay.createdAt).toDateString() === new Date().toDateString();
  const mayEdit = (pay) =>
    Boolean(onEdit) &&
    ((client.canManage && (client.finance || pay.kind === "consultation")) || (pay.recordedBy?.id === client.me && recordedToday(pay) && (pay.kind === "consultation" || canPay)));
  return (
    <div className={clientStyles.payments}>
      <p className={styles.pastLabel}>{t("payments.list", { count: rows.length })}</p>
      {shown.map((pay) => (
        <div key={pay.id} className={clientStyles.payment}>
          <Icon name="cash" size={16} />
          <span className={clientStyles.paymentMain}>
            {fmt.isoDateLong(pay.date)}
            {pay.kind !== "contract" ? ` · ${t(`payments.kinds.${pay.kind}`)}` : ""}
            {pay.method ? ` · ${t(`payments.methods.${pay.method}`)}` : ""}
            {pay.recordedBy ? ` · ${personName(pay.recordedBy)}` : ""}
            {pay.cashHolder ? ` · ${t("cashWith.took", { name: personName(pay.cashHolder) })}` : ""}
            {pay.note ? ` · ${pay.note}` : ""}
            {pay.editedAt ? ` · ${t("payments.edited")}` : ""}
          </span>
          <span className={clientStyles.paymentAmount}>{fmt.money(pay.amount)}</span>
          {mayEdit(pay) && (
            <button type="button" className={clientStyles.iconButton} onClick={() => onEdit(pay)} aria-label={t("payments.edit")} title={t("payments.edit")}>
              <Icon name="edit" size={15} />
            </button>
          )}
          {client.canManage && (client.finance || pay.kind === "consultation") && (
            <button type="button" className={clientStyles.iconButton} onClick={() => onRemove(pay)} aria-label={t("payments.delete")} title={t("payments.delete")}>
              <Icon name="trash" size={15} />
            </button>
          )}
        </div>
      ))}
      {rows.length > SHOWN_PAYMENTS && (
        <Button size="small" variant="plain" onClick={() => setAll((v) => !v)}>
          {all ? t("common.showLess") : t("clients.showAll", { count: rows.length })}
        </Button>
      )}
      {fees > 0 && <p className={styles.hint}>{t("payments.feesApart", { amount: fmt.money(fees) })}</p>}
    </div>
  );
}

// The summaries of the consultations on this case: who held it, potential
// or not, what happens next, and what was said.
export function SummaryList({ rows }) {
  const { t, fmt } = useI18n();
  return (
    <ul className={styles.dates}>
      {rows.map((c) => {
        const s = c.summary || {};
        return (
          <li key={c.id} className={styles.summaryItem}>
            <div className={styles.historyHead}>
              <Badge tone={s.prospect === "potential" ? "good" : "neutral"} icon={s.prospect === "potential" ? "checkCircle" : "minusCircle"}>
                {t(`summary.prospects.${s.prospect || "potential"}`)}
              </Badge>
              {s.next && <Badge tone="accent">{t(`summary.next.${s.next.kind}`)}{s.next.dueAt ? ` · ${fmt.dateTime(new Date(s.next.dueAt).getTime())}` : ""}</Badge>}
              {s.lostReason && <Badge tone="neutral">{t(`clientWork.lost.${s.lostReason}`)}</Badge>}
            </div>
            {s.topic && (
              <span className={styles.historyNote}>
                <strong>{t("summary.topic")}:</strong> {s.topic}
              </span>
            )}
            {s.advice && (
              <span className={styles.historyNote}>
                <strong>{t("summary.advice")}:</strong> {s.advice}
              </span>
            )}
            <span className={styles.historyNote}>
              <strong>{t("summary.conclusion")}:</strong> {s.conclusion}
            </span>
            <span className={styles.historyBy}>
              {[t("summary.heldBy", { name: c.calendar?.name || personName(c.summaryBy) }), `${fmt.isoDateLong(c.date)}`, t("summary.writtenAt", { when: fmt.dateTime(new Date(c.summaryAt).getTime()) })].join(" · ")}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function Block({ title, subtitle, action, children }) {
  return (
    <div className={styles.block}>
      <div className={styles.blockHead}>
        <div>
          <h4 className={styles.blockTitle}>{title}</h4>
          {subtitle && <p className={styles.blockSub}>{subtitle}</p>}
        </div>
        {action || null}
      </div>
      {children}
    </div>
  );
}

// Operator · Koordinator · Advokat(lar) — who to ask about this case. More
// than one lawyer: the main one first.
export function People({ item, canAssign, onAssign }) {
  const { t } = useI18n();
  const signed = item.status === "contract" || item.status === "done";
  const extra = (item.extraLawyers || []).map((l) => l.name);
  const people = [
    { key: "operator", name: item.operator?.name },
    { key: "coordinator", name: item.coordinator?.name, needed: signed },
    extra.length
      ? { key: "lawyers", name: [item.lawyer ? t("caseWork.mainLawyer", { name: item.lawyer }) : null, ...extra].filter(Boolean).join(", "), needed: signed }
      : { key: "lawyer", name: item.lawyer, needed: signed },
  ];
  return (
    <div className={styles.people}>
      {people.map((x) => (
        <div key={x.key} className={styles.person}>
          <span className={styles.personRole}>{t(`cases.${x.key}`)}</span>
          <span className={`${styles.personName} ${!x.name && x.needed ? styles.missing : ""}`}>{x.name || (x.needed ? t("caseWork.notAssigned") : "—")}</span>
        </div>
      ))}
      {canAssign && (
        <Button size="small" variant="plain" icon="users" onClick={onAssign}>
          {t("caseWork.assign")}
        </Button>
      )}
    </div>
  );
}

// Came in → consultation → contract → closed, each with its date.
export function Milestones({ item }) {
  const { t, fmt } = useI18n();
  const steps = [
    { key: "start", date: item.startDate },
    { key: "consultation", date: item.consultationDate },
    { key: "contract", date: item.contractDate },
    { key: item.status === "declined" ? "declined" : "closed", date: item.closedDate },
  ];
  return (
    <ol className={styles.milestones}>
      {steps.map((s) => (
        <li key={s.key} className={`${styles.milestone} ${s.date ? styles.reached : ""}`}>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.milestoneName}>{t(`caseWork.milestones.${s.key}`)}</span>
          <span className={styles.milestoneDate}>{s.date ? fmt.isoDateLong(s.date) : "—"}</span>
        </li>
      ))}
    </ol>
  );
}

// Where the case has been, newest first, each with its date and where —
// planned ones (a date still ahead) on top, marked so; the latest reached
// one is "now".
export function StageList({ item, canEdit, onEdit }) {
  const { t, fmt } = useI18n();
  const today = todayIso();
  const rows = [...(item.stages || [])].sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));
  if (rows.length === 0) return <p className={styles.empty}>{t("caseWork.noStages")}</p>;
  const currentId = rows.find((r) => r.date <= today)?.id;
  return (
    <ol className={styles.history}>
      {rows.map((r) => (
        <li key={r.id} className={`${styles.historyItem} ${r.id === currentId ? styles.current : ""} ${r.date > today ? styles.planned : ""}`}>
          <span className={styles.historyDot} aria-hidden="true" />
          <div className={styles.historyMain}>
            <div className={styles.historyHead}>
              <strong>{t(`cases.stages.${r.stage}`)}</strong>
              {r.id === currentId && <Badge tone="accent">{t("caseWork.now")}</Badge>}
              {r.date > today && <Badge tone="warning" icon="clock">{t("caseWork.planned")}</Badge>}
            </div>
            <span className={styles.historyMeta}>
              {[r.date > today ? t("caseWork.plannedFor", { date: fmt.isoDateLong(r.date) }) : t("caseWork.since", { date: fmt.isoDateLong(r.date) }), r.court].filter(Boolean).join(" · ")}
            </span>
            {r.note && <span className={styles.historyNote}>{r.note}</span>}
            <span className={styles.historyBy}>{[personName(r.createdBy), fmt.dateTime(new Date(r.createdAt).getTime())].filter(Boolean).join(" · ")}</span>
          </div>
          {canEdit && (
            <button type="button" className={clientStyles.iconButton} onClick={() => onEdit(r)} aria-label={t("caseWork.editStage")}>
              <Icon name="edit" size={15} />
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}

// Hearings, summons, deadlines: coming up first, then what's past (with
// what happened, or a reminder to write it).
// Dates that take place and have an outcome (services/outcomes.js).
export const OUTCOME_KINDS = ["hearing", "investigative_action", "interrogation", "confrontation", "suspect_questioning", "accused_questioning", "charge_announced", "case_review", "summons"];

export function DateList({ item, canEdit, onEdit, onOutcome }) {
  const { t, fmt } = useI18n();
  const today = todayIso();
  const rows = item.dates || [];
  if (rows.length === 0) return <p className={styles.empty}>{t("caseWork.noDates")}</p>;
  const upcoming = rows.filter((r) => r.date >= today);
  const past = rows.filter((r) => r.date < today).reverse();
  const row = (r) => {
    const isPast = r.date < today;
    return (
      <li key={r.id} className={`${styles.dateItem} ${isPast ? styles.past : ""}`}>
        <span className={styles.dateIcon}>
          <Icon name={DATE_ICON[r.kind] || "calendar"} size={16} />
        </span>
        <div className={styles.historyMain}>
          <div className={styles.historyHead}>
            <strong>{r.title || t(`caseWork.kinds.${r.kind}`)}</strong>
            {r.date === today && <Badge tone="warning">{t("caseWork.today")}</Badge>}
          </div>
          <span className={styles.historyMeta}>
            {[fmt.isoDay(r.date), r.time != null ? clock(r.time) : null, r.title ? t(`caseWork.kinds.${r.kind}`) : null, r.place].filter(Boolean).join(" · ")}
          </span>
          {r.note && <span className={styles.historyNote}>{r.note}</span>}
          {isPast &&
            (r.outcome ? (
              <span className={styles.outcome}>
                <Icon name="check" size={14} /> {r.outcome}
              </span>
            ) : (
              canEdit && (
                <button type="button" className={styles.outcomeAsk} onClick={() => (onOutcome && OUTCOME_KINDS.includes(r.kind) ? onOutcome(r) : onEdit(r))}>
                  {t("caseWork.writeOutcome")}
                </button>
              )
            ))}
        </div>
        {canEdit && (
          <button type="button" className={clientStyles.iconButton} onClick={() => onEdit(r)} aria-label={t("caseWork.editDate")}>
            <Icon name="edit" size={15} />
          </button>
        )}
      </li>
    );
  };
  return (
    <>
      {upcoming.length > 0 && <ul className={styles.dates}>{upcoming.map(row)}</ul>}
      {past.length > 0 && (
        <>
          <p className={styles.pastLabel}>{t("caseWork.pastDates")}</p>
          <ul className={styles.dates}>{past.map(row)}</ul>
        </>
      )}
    </>
  );
}

function ErrorLine({ text }) {
  return text ? <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{text}</p> : null;
}

// Adding a stage the case reached (today, or a date in the past) or will
// reach (a date ahead: planned — it becomes the case's stage on that day),
// or correcting / removing one.
export function StageSheet({ item, row, onClose, onSaved }) {
  const { t } = useI18n();
  const editing = Boolean(row);
  const latest = item.legalStage ? LEGAL_STAGES.indexOf(item.legalStage) : -1;
  const [stage, setStage] = useState(row?.stage || LEGAL_STAGES[Math.min(LEGAL_STAGES.length - 1, latest + 1)]);
  const [date, setDate] = useState(row?.date || todayIso());
  const [court, setCourt] = useState(row?.court || (editing ? "" : item.court || ""));
  const [note, setNote] = useState(row?.note || "");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  async function save() {
    if (!date) return setError(t("caseWork.dateRequired"));
    setBusy("save");
    setError("");
    try {
      const payload = { stage, date, court, note };
      if (editing) await api.updateStage(row.id, payload);
      else await api.addStage(item.id, payload);
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm(t("caseWork.confirmRemoveStage"))) return;
    setBusy("remove");
    try {
      await api.deleteStage(row.id);
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(null);
    }
  }

  return (
    <Sheet title={editing ? t("caseWork.editStage") : t("caseWork.addStage")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        {!editing && <p className={pageStyles.note}>{t("caseWork.stageHint")}</p>}
        <SelectField label={t("cases.legalStage")} value={stage} onChange={(e) => setStage(e.target.value)}>
          {LEGAL_STAGES.map((s) => (
            <option key={s} value={s}>
              {t(`cases.stages.${s}`)}
            </option>
          ))}
        </SelectField>
        <TextField label={t("caseWork.stageDate")} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        {date > todayIso() && <p className={styles.hint}>{t("caseWork.plannedHint")}</p>}
        <TextField label={t("caseWork.court")} placeholder={t("caseWork.courtPlaceholder")} value={court} onChange={(e) => setCourt(e.target.value)} />
        <TextAreaField label={t("caseWork.stageNote")} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        <ErrorLine text={error} />
        <div className={pageStyles.formActions}>
          {editing && (
            <Button variant="destructive" busy={busy === "remove"} onClick={remove}>
              {t("caseWork.remove")}
            </Button>
          )}
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" busy={busy === "save"} onClick={save}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

// A hearing, summons, deadline or meeting — and, once it's past, what
// happened.
export function KeyDateSheet({ item, row, onClose, onSaved }) {
  const { t } = useI18n();
  const editing = Boolean(row);
  const [kind, setKind] = useState(row?.kind || "hearing");
  const [date, setDate] = useState(row?.date || todayIso());
  const [time, setTime] = useState(row?.time != null ? clock(row.time) : "");
  const [title, setTitle] = useState(row?.title || "");
  const [place, setPlace] = useState(row?.place || item.court || "");
  const [note, setNote] = useState(row?.note || "");
  const [outcome, setOutcome] = useState(row?.outcome || "");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const past = date < todayIso();

  async function save() {
    if (!date) return setError(t("caseWork.dateRequired"));
    setBusy("save");
    setError("");
    try {
      const payload = { kind, date, time: time ? toMinutes(time) : null, title, place, note, ...(editing || past ? { outcome } : {}) };
      if (editing) await api.updateKeyDate(row.id, payload);
      else await api.addKeyDate(item.id, payload);
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm(t("caseWork.confirmRemoveDate"))) return;
    setBusy("remove");
    try {
      await api.deleteKeyDate(row.id);
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(null);
    }
  }

  return (
    <Sheet title={editing ? t("caseWork.editDate") : t("caseWork.addDate")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <SelectField label={t("caseWork.kind")} value={kind} onChange={(e) => setKind(e.target.value)}>
          {DATE_GROUPS.map((g) => (
            <optgroup key={g.key} label={t(`caseWork.kindGroups.${g.key}`)}>
              {g.kinds.map((k) => (
                <option key={k} value={k}>
                  {t(`caseWork.kinds.${k}`)}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectField>
        <div className={clientStyles.twoCol}>
          <TextField label={t("caseWork.date")} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <TextField label={t("caseWork.time")} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <TextField label={t("caseWork.titleLabel")} placeholder={t("caseWork.titlePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextField label={t("caseWork.place")} value={place} onChange={(e) => setPlace(e.target.value)} />
        <TextAreaField label={t("caseWork.dateNote")} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        {(editing || past) && <TextAreaField label={t("caseWork.outcome")} placeholder={t("caseWork.outcomePlaceholder")} value={outcome} onChange={(e) => setOutcome(e.target.value)} rows={2} />}
        <ErrorLine text={error} />
        <div className={pageStyles.formActions}>
          {editing && (
            <Button variant="destructive" busy={busy === "remove"} onClick={remove}>
              {t("caseWork.remove")}
            </Button>
          )}
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" busy={busy === "save"} onClick={save}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

// Managers: who looks after the case (coordinator) and who handles it
// (the main lawyer, and any more lawyers on it). Each change is on the
// timeline; the person hears in Telegram.
export function AssignSheet({ item, onClose, onSaved }) {
  const { t } = useI18n();
  const people = useAsync(() => api.clientCoordinators(), []);
  const lawyers = useAsync(() => api.clientLawyers(), []);
  const [coordinatorId, setCoordinatorId] = useState(item.coordinator?.id ? String(item.coordinator.id) : "");
  const [lawyerId, setLawyerId] = useState(item.lawyerId ? String(item.lawyerId) : "");
  const before = (item.extraLawyers || []).map((l) => l.id);
  const [extra, setExtra] = useState(before);
  const toggleExtra = (id) => setExtra((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    const payload = {};
    if (String(item.coordinator?.id ?? "") !== coordinatorId) payload.coordinatorId = coordinatorId ? Number(coordinatorId) : null;
    if (String(item.lawyerId ?? "") !== lawyerId) payload.lawyerId = lawyerId ? Number(lawyerId) : null;
    // The main lawyer isn't one of "the others" too.
    const others = extra.filter((id) => String(id) !== lawyerId);
    if (others.length !== before.length || others.some((id) => !before.includes(id))) payload.extraLawyerIds = others;
    try {
      if (Object.keys(payload).length) await api.updateCase(item.id, payload);
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(false);
    }
  }

  return (
    <Sheet title={t("caseWork.assignTitle")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <p className={pageStyles.note}>{t("caseWork.assignHint")}</p>
        <SelectField label={t("cases.coordinator")} value={coordinatorId} onChange={(e) => setCoordinatorId(e.target.value)}>
          <option value="">{t("caseWork.nobody")}</option>
          {(people.data?.coordinators || []).length > 0 && (
            <optgroup label={t("caseWork.coordinators")}>
              {people.data.coordinators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
          {(people.data?.others || []).length > 0 && (
            <optgroup label={t("caseWork.otherStaff")}>
              {people.data.others.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
        </SelectField>
        <SelectField label={t("cases.lawyer")} value={lawyerId} onChange={(e) => setLawyerId(e.target.value)}>
          <option value="">{t("caseWork.nobody")}</option>
          {(lawyers.data?.accounts || []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </SelectField>
        {(lawyers.data?.accounts || []).length > 1 && (
          <div>
            <p className={fieldStyles.label}>{t("caseWork.moreLawyers")}</p>
            <div className={fieldStyles.chips} role="group" aria-label={t("caseWork.moreLawyers")}>
              {lawyers.data.accounts
                .filter((l) => String(l.id) !== lawyerId)
                .map((l) => {
                  const on = extra.includes(l.id);
                  return (
                    <button key={l.id} type="button" role="checkbox" aria-checked={on} className={`${fieldStyles.chip} ${on ? fieldStyles.chipOn : ""}`} onClick={() => toggleExtra(l.id)}>
                      {on && <Icon name="check" size={14} strokeWidth={2.4} />}
                      {l.name}
                    </button>
                  );
                })}
            </div>
            <p className={pageStyles.note}>{t("caseWork.moreLawyersHint")}</p>
          </div>
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
