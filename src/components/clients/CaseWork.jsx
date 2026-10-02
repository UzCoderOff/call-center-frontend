import { useState } from "react";
import styles from "./CaseWork.module.css";
import clientStyles from "./Clients.module.css";
import pageStyles from "../../pages/Pages.module.css";
import Sheet from "../ui/Sheet";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Icon from "../ui/Icon";
import { SelectField, TextAreaField, TextField } from "../ui/Field";
import { LEGAL_STAGES, MoneyBlock, STATUSES, StatusBadge, personName } from "./parts";
import { ScheduleBlock } from "./ScheduleSheet";
import { LostSheet } from "./ClientWork";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { todayIso } from "../../lib/format";
import { saveFailed } from "../../lib/saveFailed";
import { useI18n } from "../../i18n";

// One case on the client's page, the way a firm works it:
//   - who's on it: the operator who brought it, the coordinator who looks
//     after it since the contract, the lawyer (managers assign them)
//   - its milestones: came in, consultation, contract, closed — with dates
//   - where it has been, with dates (stage history — past dates can be
//     entered for a case brought in from before Ledger), and the dates that
//     matter (hearings, deadlines) with what happened
//   - its money (for whoever sees it): contract, paid, schedule, payments
// What each person may do comes from the server (`item.permissions`).

export const DATE_KINDS = ["hearing", "summons", "deadline", "meeting", "other"];
const DATE_ICON = { hearing: "briefcase", summons: "bell", deadline: "clock", meeting: "users", other: "calendar" };

const clock = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toMinutes = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export default function CasePanel({ item, client, onChanged, onEdit, onPay, onSchedule, onRemovePayment }) {
  const { t, fmt } = useI18n();
  const p = item.permissions || {};
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const signed = item.status === "contract" || item.status === "done";
  const close = () => setSheet(null);
  const saved = () => {
    setSheet(null);
    onChanged();
  };

  async function setStatus(status) {
    // Didn't continue: asked why first.
    if (status === "declined") return setSheet({ type: "lost" });
    setBusy(true);
    try {
      await api.updateCase(item.id, { status });
      onChanged();
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setBusy(false);
    }
  }

  // The statuses this person can move the case to.
  const statuses = p.role === "operator" ? ["consultation", "call_again", "contract", "declined"] : STATUSES;

  return (
    <section className={styles.panel} aria-busy={busy}>
      <header className={styles.head}>
        <div className={styles.headMain}>
          <span className={styles.badges}>
            <StatusBadge status={item.status} />
            {item.legalStage && <Badge tone="neutral">{t(`cases.stages.${item.legalStage}`)}</Badge>}
          </span>
          <h3 className={styles.title}>{item.matter || t("cases.untitled")}</h3>
          <p className={styles.meta}>{[item.number && `№ ${item.number}`, item.court].filter(Boolean).join(" · ") || t("caseWork.noNumber")}</p>
        </div>
        {p.canEdit && (
          <Button size="small" variant="plain" icon="sliders" onClick={onEdit}>
            {t("cases.edit")}
          </Button>
        )}
      </header>

      <People item={item} canAssign={p.canAssign} onAssign={() => setSheet({ type: "assign" })} />
      <Milestones item={item} />

      {p.canStatus && (
        <div className={styles.statusRow}>
          <SelectField label={t("cases.status")} value={item.status} onChange={(e) => setStatus(e.target.value)}>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {t(`cases.statuses.${s}`)}
              </option>
            ))}
          </SelectField>
          {p.role === "operator" && <p className={styles.hint}>{t("caseWork.operatorContractHint")}</p>}
          {item.status === "declined" && item.lostReason && (
            <p className={styles.hint}>
              {t("clientWork.lostWhy", { reason: t(`clientWork.lost.${item.lostReason}`) })}
              {item.lostNote ? ` — ${item.lostNote}` : ""}
            </p>
          )}
        </div>
      )}

      {(signed || item.stages?.length > 0) && (
        <Block
          title={t("caseWork.stagesTitle")}
          subtitle={t("caseWork.stagesSubtitle")}
          action={p.canHistory && <Button size="small" icon="plus" onClick={() => setSheet({ type: "stage" })}>{t("caseWork.addStage")}</Button>}
        >
          <StageList item={item} canEdit={p.canHistory} onEdit={(row) => setSheet({ type: "stage", row })} />
        </Block>
      )}

      {(signed || item.dates?.length > 0) && (
        <Block
          title={t("caseWork.datesTitle")}
          subtitle={t("caseWork.datesSubtitle")}
          action={p.canDates && <Button size="small" icon="plus" onClick={() => setSheet({ type: "date" })}>{t("caseWork.addDate")}</Button>}
        >
          <DateList item={item} canEdit={p.canDates} onEdit={(row) => setSheet({ type: "date", row })} />
        </Block>
      )}

      {(p.money || item.payments?.length > 0) && (
        <Block
          title={t("caseWork.moneyTitle")}
          action={
            <span className={styles.actions}>
              {p.canSchedule && signed && item.contractAmount > 0 && (
                <Button size="small" variant="plain" icon="calendar" onClick={onSchedule}>
                  {item.schedule?.items?.length ? t("schedule.edit") : t("schedule.set")}
                </Button>
              )}
              {onPay && (
                <Button size="small" icon="cash" onClick={onPay}>
                  {t("payments.add")}
                </Button>
              )}
            </span>
          }
        >
          {p.money && <MoneyBlock item={item} />}
          {p.money && <ScheduleBlock schedule={item.schedule} />}
          {item.payments?.length > 0 && (
            <div className={clientStyles.payments}>
              {item.payments.slice(0, 8).map((pay) => (
                <div key={pay.id} className={clientStyles.payment}>
                  <Icon name="cash" size={16} />
                  <span className={clientStyles.paymentMain}>
                    {fmt.isoDateLong(pay.date)}
                    {pay.kind === "consultation" ? ` · ${t("payments.kinds.consultation")}` : ""}
                    {pay.method ? ` · ${t(`payments.methods.${pay.method}`)}` : ""}
                    {pay.recordedBy ? ` · ${personName(pay.recordedBy)}` : ""}
                    {pay.note ? ` · ${pay.note}` : ""}
                  </span>
                  <span className={clientStyles.paymentAmount}>{fmt.money(pay.amount)}</span>
                  {client.canManage && (client.finance || pay.kind === "consultation") && (
                    <button type="button" className={clientStyles.iconButton} onClick={() => onRemovePayment(pay)} aria-label={t("payments.delete")}>
                      <Icon name="trash" size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Block>
      )}

      {sheet?.type === "stage" && <StageSheet item={item} row={sheet.row} onClose={close} onSaved={saved} />}
      {sheet?.type === "date" && <KeyDateSheet item={item} row={sheet.row} onClose={close} onSaved={saved} />}
      {sheet?.type === "assign" && <AssignSheet item={item} onClose={close} onSaved={saved} />}
      {sheet?.type === "lost" && <LostSheet item={item} onClose={close} onSaved={saved} />}
    </section>
  );
}

function Block({ title, subtitle, action, children }) {
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

// Operator · Koordinator · Advokat — who to ask about this case.
function People({ item, canAssign, onAssign }) {
  const { t } = useI18n();
  const signed = item.status === "contract" || item.status === "done";
  const people = [
    { key: "operator", name: item.operator?.name },
    { key: "coordinator", name: item.coordinator?.name, needed: signed },
    { key: "lawyer", name: item.lawyer, needed: signed },
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
function Milestones({ item }) {
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

// Where the case has been, newest first, each with its date and where.
function StageList({ item, canEdit, onEdit }) {
  const { t, fmt } = useI18n();
  const rows = [...(item.stages || [])].sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));
  if (rows.length === 0) return <p className={styles.empty}>{t("caseWork.noStages")}</p>;
  return (
    <ol className={styles.history}>
      {rows.map((r, i) => (
        <li key={r.id} className={`${styles.historyItem} ${i === 0 ? styles.current : ""}`}>
          <span className={styles.historyDot} aria-hidden="true" />
          <div className={styles.historyMain}>
            <div className={styles.historyHead}>
              <strong>{t(`cases.stages.${r.stage}`)}</strong>
              {i === 0 && <Badge tone="accent">{t("caseWork.now")}</Badge>}
            </div>
            <span className={styles.historyMeta}>
              {[t("caseWork.since", { date: fmt.isoDateLong(r.date) }), r.court].filter(Boolean).join(" · ")}
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
function DateList({ item, canEdit, onEdit }) {
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
                <button type="button" className={styles.outcomeAsk} onClick={() => onEdit(r)}>
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

// Adding a stage the case reached (today, or a date in the past), or
// correcting / removing one.
function StageSheet({ item, row, onClose, onSaved }) {
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
    if (date > todayIso()) return setError(t("caseWork.noFutureStage"));
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
        <TextField label={t("caseWork.stageDate")} type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />
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
function KeyDateSheet({ item, row, onClose, onSaved }) {
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
          {DATE_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`caseWork.kinds.${k}`)}
            </option>
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
// (lawyer). Each change is on the timeline; the person hears in Telegram.
function AssignSheet({ item, onClose, onSaved }) {
  const { t } = useI18n();
  const people = useAsync(() => api.clientCoordinators(), []);
  const lawyers = useAsync(() => api.clientLawyers(), []);
  const [coordinatorId, setCoordinatorId] = useState(item.coordinator?.id ? String(item.coordinator.id) : "");
  const [lawyerId, setLawyerId] = useState(item.lawyerId ? String(item.lawyerId) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    const payload = {};
    if (String(item.coordinator?.id ?? "") !== coordinatorId) payload.coordinatorId = coordinatorId ? Number(coordinatorId) : null;
    if (String(item.lawyerId ?? "") !== lawyerId) payload.lawyerId = lawyerId ? Number(lawyerId) : null;
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
