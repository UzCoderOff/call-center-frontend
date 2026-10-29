import { useState } from "react";
import styles from "./Cases.module.css";
import pageStyles from "../../pages/Pages.module.css";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import { SelectField } from "../ui/Field";
import { Banner } from "../ui/Misc";
import { STATUSES, StatusBadge } from "../clients/parts";
import { DateList, Details, KeyDateSheet, MoneyFigures, OUTCOME_KINDS, PaymentList, StageList, StageSheet, AssignSheet, SummaryList } from "../clients/CaseWork";
import ScheduleSheet, { ScheduleBlock } from "../clients/ScheduleSheet";
import { CaseSheet, ContractAmountSheet, PaymentSheet } from "../clients/ClientSheets";
import { FilesCard, LostSheet } from "../clients/ClientWork";
import { EntrySheet, OutcomeSheet } from "./EntrySheets";
import CaseTasks, { useCaseTasks } from "./CaseTasks";
import { CourtFindBanner, SudLine } from "./CourtParts";
import { colorFor } from "../chat/ChatParts";
import { api } from "../../lib/api";
import { todayIso } from "../../lib/format";
import { saveFailed } from "../../lib/saveFailed";
import { useI18n } from "../../i18n";

// A case as a whole piece of work, open on its client's page (2026-10-15 —
// "it should be right there", nothing hidden behind tabs or another page):
//   - the case: its kind, number, court, who's on it (its lawyers and the
//     coordinator), the next date, days in work, what's owed, open tasks,
//     the road it has taken, and hearings waiting for "how did it go?"
//   - side by side, everything at once: what it's about and its status, key
//     dates (with outcomes), the client's whole history — and the tasks,
//     money, documents, stages. The team talks in the client's chat (the
//     "Chat" button above), not here
// On a phone the same sections stack, the long history last.
// `aside`: the client's own cards (next steps on top, details below);
// `timeline(openEntry)`: the client's history, with a button that opens the
// typed-entry form for this case.

const clock = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const initials = (name) =>
  String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

// A hearing (or questioning…) that has taken place and has no outcome yet.
export function waitsForOutcome(d, today, nowMinutes) {
  if (!OUTCOME_KINDS.includes(d.kind) || d.outcome) return false;
  if (d.date < today) return true;
  return d.date === today && nowMinutes >= (d.time == null ? 17 * 60 : d.time + 30);
}

export default function CaseWorkspace({ client, item, reload, asideTop = null, asideBottom = null, timeline }) {
  const { t, fmt } = useI18n();
  const [sheet, setSheet] = useState(null);
  const [taskRefresh, setTaskRefresh] = useState(0);
  const tasks = useCaseTasks(item.id, taskRefresh);
  const close = () => setSheet(null);
  const saved = () => {
    setSheet(null);
    reload();
    setTaskRefresh((n) => n + 1);
  };
  const p = item.permissions || {};
  const today = todayIso();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const signed = item.status === "contract" || item.status === "done";
  // Still ahead: a later day, or today and not yet started.
  const upcoming = (item.dates || [])
    .filter((d) => d.date > today || (d.date === today && (d.time == null || d.time >= nowMinutes)))
    .sort((a, b) => (a.date === b.date ? (a.time ?? -1) - (b.time ?? -1) : a.date < b.date ? -1 : 1));
  const waiting = p.canDates ? (item.dates || []).filter((d) => waitsForOutcome(d, today, nowMinutes)) : [];
  const openTasks = (tasks.data || []).filter((x) => !x.doneAt);
  const lateTasks = openTasks.filter((x) => new Date(x.dueAt).getTime() < Date.now());
  const since = item.contractDate || item.startDate;
  const writes = p.role !== "result";
  // Lawyers don't record payments (the server refuses their corrections).
  const records = writes && client.level !== "lawyer";
  const hasMoney = p.money || (item.payments || []).length > 0;

  return (
    <section className={styles.workspace} aria-label={item.matter || t("cases.untitled")}>
      <header className={styles.head}>
        <div className={styles.headMain}>
          <span className={styles.badges}>
            <StatusBadge status={item.status} />
            {item.legalStage && <Badge tone="accent">{t(`cases.stages.${item.legalStage}`)}</Badge>}
          </span>
          <h2 className={styles.title}>{item.matter || t("cases.untitled")}</h2>
          <p className={styles.meta}>{[item.number && `№ ${item.number}`, item.court, since ? t("casePage.since", { date: fmt.isoDateLong(since) }) : null].filter(Boolean).join(" · ") || t("caseWork.noNumber")}</p>
          {/* Signed cases are followed on sud.uz (services/courts/sync.js). */}
          {item.status === "contract" && p.canDates && <SudLine item={item} onChecked={reload} />}
          <Team item={item} canAssign={p.canAssign} onAssign={() => setSheet({ type: "assign" })} />
        </div>
        <div className={styles.headActions}>
          {writes && (
            <Button variant="primary" icon="plus" onClick={() => setSheet({ type: "entry" })}>
              {t("entries.add")}
            </Button>
          )}
          {p.canEdit && (
            <Button icon="sliders" onClick={() => setSheet({ type: "case" })}>
              {t("cases.edit")}
            </Button>
          )}
        </div>
      </header>

      <div className={styles.figures}>
        <Figure
          label={t("casePage.nextDate")}
          value={upcoming[0] ? `${fmt.isoDay(upcoming[0].date)}${upcoming[0].time != null ? `, ${clock(upcoming[0].time)}` : ""}` : "—"}
          sub={upcoming[0] ? upcoming[0].title || t(`caseWork.kinds.${upcoming[0].kind}`) : t("casePage.noDates")}
        />
        <Figure label={t("casePage.inWork")} value={since ? t("casePage.days", { count: Math.max(0, daysBetween(since, today)) }) : "—"} sub={signed ? t("casePage.sinceContract") : t("casePage.sinceStart")} />
        {p.money && item.contractAmount > 0 ? (
          <Figure
            label={t("casePage.left")}
            value={fmt.money(item.remaining ?? 0)}
            tone={item.remaining > 0 ? "warn" : "good"}
            sub={t("casePage.paidOf", { paid: fmt.money(item.paid ?? 0), total: fmt.money(item.contractAmount) })}
          />
        ) : (
          <Figure label={t("casePage.stage")} value={item.legalStage ? t(`cases.stages.${item.legalStage}`) : t(`cases.statuses.${item.status}`)} />
        )}
        <Figure
          label={t("casePage.tasks")}
          value={tasks.data ? String(openTasks.length) : "…"}
          tone={lateTasks.length ? "critical" : undefined}
          sub={lateTasks.length ? t("casePage.lateTasks", { count: lateTasks.length }) : t("casePage.openTasks")}
        />
      </div>

      <Road item={item} today={today} />

      {(item.courtFinds || []).map((f) => (
        <CourtFindBanner key={f.id} find={f} onAnswered={reload} />
      ))}

      {waiting.map((d) => (
        <div key={d.id} className={styles.ask}>
          <Banner
            tone="warning"
            icon="briefcase"
            action={
              <Button size="small" variant="primary" onClick={() => setSheet({ type: "outcome", row: d })}>
                {t("entries.writeOutcome")}
              </Button>
            }
          >
            <strong>{t("entries.outcomeAsk", { what: d.title || t(`caseWork.kinds.${d.kind}`) })}</strong>
            <div className={pageStyles.bannerDetail}>{[fmt.isoDateLong(d.date), d.time != null ? clock(d.time) : null, d.place].filter(Boolean).join(" · ")}</div>
          </Banner>
        </div>
      ))}

      <div className={styles.grid}>
        <div className={styles.column}>
          <About item={item} onSheet={setSheet} onChanged={reload} />
          <Card
            id="section-dates"
            title={t("caseWork.datesTitle")}
            subtitle={t("caseWork.datesSubtitle")}
            action={
              p.canDates && (
                <Button size="small" icon="plus" onClick={() => setSheet({ type: "date" })}>
                  {t("caseWork.addDate")}
                </Button>
              )
            }
          >
            <DateList item={item} canEdit={p.canDates} onEdit={(row) => setSheet({ type: "date", row })} onOutcome={(row) => setSheet({ type: "outcome", row })} />
          </Card>
          {item.consultations?.length > 0 && (
            <Card title={t("summary.caseTitle")} subtitle={t("summary.caseSubtitle")}>
              <SummaryList rows={item.consultations} />
            </Card>
          )}
          <div className={styles.late} id="section-history">
            {timeline && timeline(writes ? () => setSheet({ type: "entry" }) : null)}
          </div>
        </div>
        <div className={styles.column}>
          {asideTop}
          <div id="section-tasks">
            <CaseTasks item={item} tasks={tasks} onChanged={() => (setTaskRefresh((n) => n + 1), reload())} />
          </div>
          {hasMoney && (
            <Card
              id="section-money"
              title={t("caseWork.moneyTitle")}
            >
              {/* The buttons under the title, wrapping — on a phone they don't fit beside it. */}
              {(records || (p.money && client.finance)) && (
                <div className={pageStyles.actionsRow} style={{ marginTop: 0, marginBottom: 12 }}>
                  {p.money && client.finance && (
                    <Button size="small" variant="plain" icon="edit" onClick={() => setSheet({ type: "contract" })}>
                      {item.contractAmount ? t("clientMoney.changeContract") : t("clientMoney.setContract")}
                    </Button>
                  )}
                  {p.canSchedule && signed && item.contractAmount > 0 && (
                    <Button size="small" variant="plain" icon="calendar" onClick={() => setSheet({ type: "schedule" })}>
                      {item.schedule?.items?.length ? t("schedule.edit") : t("schedule.set")}
                    </Button>
                  )}
                  {records && (
                    <Button size="small" icon="cash" onClick={() => setSheet({ type: "payment" })}>
                      {t("payments.add")}
                    </Button>
                  )}
                </div>
              )}
              {p.money && <MoneyFigures item={item} />}
              {p.money && <ScheduleBlock schedule={item.schedule} />}
              <PaymentList item={item} client={client} canPay={p.canPay} onEdit={records ? (payment) => setSheet({ type: "payment", payment }) : null} onRemove={(pay) => removePayment(pay, t, reload)} />
            </Card>
          )}
          <div id="section-documents">
            <FilesCard client={client} caseId={item.id} onChanged={reload} />
          </div>
          {(signed || item.stages?.length > 0) && (
            <Card
              id="section-stages"
              title={t("caseWork.stagesTitle")}
              subtitle={t("caseWork.stagesSubtitle")}
              action={
                p.canHistory && (
                  <Button size="small" icon="plus" onClick={() => setSheet({ type: "stage" })}>
                    {t("caseWork.addStage")}
                  </Button>
                )
              }
            >
              <StageList item={item} canEdit={p.canHistory} onEdit={(row) => setSheet({ type: "stage", row })} />
            </Card>
          )}
          <div className={styles.last}>{asideBottom}</div>
        </div>
      </div>

      {sheet?.type === "entry" && <EntrySheet client={client} item={item} initialType={sheet.initialType} onClose={close} onSaved={saved} />}
      {sheet?.type === "outcome" && <OutcomeSheet client={client} item={item} row={sheet.row} onClose={close} onSaved={saved} />}
      {sheet?.type === "case" && <CaseSheet clientId={client.id} item={item} canManage={client.canManage} finance={Boolean(p.money && client.finance)} onClose={close} onSaved={saved} />}
      {sheet?.type === "stage" && <StageSheet item={item} row={sheet.row} onClose={close} onSaved={saved} />}
      {sheet?.type === "date" && <KeyDateSheet item={item} row={sheet.row} onClose={close} onSaved={saved} />}
      {sheet?.type === "assign" && <AssignSheet item={item} onClose={close} onSaved={saved} />}
      {sheet?.type === "lost" && <LostSheet item={item} onClose={close} onSaved={saved} />}
      {sheet?.type === "schedule" && <ScheduleSheet item={item} onClose={close} onSaved={saved} />}
      {sheet?.type === "payment" && (
        <PaymentSheet clientId={client.id} cases={[item]} caseId={item.id} payment={sheet.payment || null} suggested={sheet.suggested || null} finance={Boolean(p.canPay)} onClose={close} onSaved={saved} />
      )}
      {sheet?.type === "contract" && (
        <ContractAmountSheet cases={[item]} caseId={item.id} onClose={close} onSaved={saved} onSavedPay={(cid, left) => (reload(), setSheet({ type: "payment", suggested: left }))} />
      )}
    </section>
  );
}

async function removePayment(pay, t, reload) {
  if (!confirm(t("payments.confirmDelete"))) return;
  try {
    await api.deletePayment(pay.id);
    reload();
  } catch (err) {
    saveFailed(err, t);
  }
}

function Figure({ label, value, sub, tone }) {
  return (
    <div className={styles.figure}>
      <span className={styles.figureLabel}>{label}</span>
      <span className={`${styles.figureValue} ${tone ? styles[tone] : ""}`}>{value}</span>
      {sub && <span className={styles.figureSub}>{sub}</span>}
    </div>
  );
}

// Who's on it, with their initials: the lawyers (main first) and the
// coordinator. Managers assign them from here.
function Team({ item, canAssign, onAssign }) {
  const { t } = useI18n();
  const signed = item.status === "contract" || item.status === "done";
  const people = [
    item.lawyer ? { role: (item.extraLawyers || []).length ? t("casePage.mainLawyer") : t("cases.lawyer"), name: item.lawyer } : signed ? { role: t("cases.lawyer"), name: null } : null,
    ...(item.extraLawyers || []).map((l) => ({ role: t("casePage.alsoLawyer"), name: l.name })),
    item.coordinator?.name ? { role: t("cases.coordinator"), name: item.coordinator.name } : signed ? { role: t("cases.coordinator"), name: null } : null,
  ].filter(Boolean);
  return (
    <div className={styles.team}>
      {people.map((x, i) => (
        <span key={i} className={styles.member}>
          <span className={styles.initials} style={{ background: x.name ? colorFor(x.name) : "var(--fill-strong)" }} aria-hidden="true">
            {x.name ? initials(x.name) : "?"}
          </span>
          <span>
            <span className={styles.memberRole}>{x.role}</span>
            <span className={`${styles.memberName} ${x.name ? "" : styles.memberMissing}`}>{x.name || t("caseWork.notAssigned")}</span>
          </span>
        </span>
      ))}
      {canAssign && (
        <Button size="small" variant="plain" icon="users" onClick={onAssign}>
          {t("caseWork.assign")}
        </Button>
      )}
    </div>
  );
}

// From the first call to the end: where it has been (green), where it is
// (blue), what's planned (dashed).
function Road({ item, today }) {
  const { t, fmt } = useI18n();
  const [open, setOpen] = useState(false);
  const stages = [...(item.stages || [])].sort((a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1));
  const reached = stages.filter((s) => s.date <= today);
  const current = reached.at(-1)?.id;
  const steps = [
    { key: "start", name: t("caseWork.milestones.start"), date: item.startDate, state: item.startDate ? "done" : "todo" },
    { key: "consultation", name: t("caseWork.milestones.consultation"), date: item.consultationDate, state: item.consultationDate ? "done" : "todo" },
    { key: "contract", name: t("caseWork.milestones.contract"), date: item.contractDate, state: item.contractDate ? (stages.length || item.closedDate ? "done" : "now") : "todo" },
    ...stages.map((s) => ({ key: `s${s.id}`, name: t(`cases.stages.${s.stage}`), date: s.date, state: s.date > today ? "planned" : s.id === current && !item.closedDate ? "now" : "done" })),
    ...(stages.length === 0 && item.legalStage ? [{ key: "stage", name: t(`cases.stages.${item.legalStage}`), date: null, state: "now" }] : []),
    { key: "end", name: item.status === "declined" ? t("caseWork.milestones.declined") : t("caseWork.milestones.closed"), date: item.closedDate, state: item.closedDate ? "done" : "todo" },
  ];
  const cls = { done: styles.stepDone, now: styles.stepNow, planned: styles.stepPlanned, todo: "" };
  // Where it is: the step it's on (else the last one done), and what's next.
  const at = Math.max(steps.findIndex((s) => s.state === "now"), steps.findLastIndex((s) => s.state === "done"), 0);
  const next = steps.slice(at + 1).find((s) => s.state !== "done");
  const when = (s) => (s.date ? fmt.isoDay(s.date) : s.state === "planned" ? t("caseWork.planned") : "");
  return (
    <div className={`${styles.roadWrap} ${open ? styles.roadOpen : ""}`}>
      {/* On a phone: one line — the step it's on, how far along, what's next. */}
      <div className={styles.roadShort}>
        <div className={styles.roadShortHead}>
          <span className={styles.roadShortCount}>{t("casePage.stepOf", { n: at + 1, total: steps.length })}</span>
          <button type="button" className={styles.roadMore} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? t("casePage.hideSteps") : t("casePage.allSteps")}
          </button>
        </div>
        <strong className={styles.roadShortName}>
          {steps[at].name}
          {when(steps[at]) && <span className={styles.roadShortDate}> · {when(steps[at])}</span>}
        </strong>
        <span className={styles.roadShortBar}>
          <span style={{ width: `${Math.round(((at + 1) / steps.length) * 100)}%` }} />
        </span>
        {next && <span className={styles.roadShortNext}>{t("casePage.nextStep", { name: [next.name, when(next)].filter(Boolean).join(" · ") })}</span>}
      </div>
      <ol className={styles.road} aria-label={t("casePage.road")}>
        {steps.map((s) => (
          <li key={s.key} className={`${styles.step} ${cls[s.state]}`} aria-current={s.state === "now" ? "step" : undefined}>
            <span className={styles.stepBar} />
            <span className={styles.stepName}>{s.name}</span>
            <span className={styles.stepDate}>{when(s) || " "}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// What it's about, and where it stands (its status).
function About({ item, onSheet, onChanged }) {
  const { t } = useI18n();
  const p = item.permissions || {};
  const [busy, setBusy] = useState(false);
  const statuses = p.role === "operator" ? ["consultation", "call_again", "contract", "declined"] : STATUSES;
  async function setStatus(status) {
    if (status === "declined") return onSheet({ type: "lost" });
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
  return (
    <Card id="section-about" title={t("casePage.about")}>
      <Details item={item} canEdit={p.canEdit} onEdit={() => onSheet({ type: "case" })} />
      {p.canStatus && (
        <div style={{ marginTop: 12 }} aria-busy={busy}>
          <SelectField label={t("cases.status")} value={item.status} onChange={(e) => setStatus(e.target.value)}>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {t(`cases.statuses.${s}`)}
              </option>
            ))}
          </SelectField>
        </div>
      )}
    </Card>
  );
}


// Several cases for one client: pick which one is open below.
export function CaseSwitcher({ cases, value, onChange }) {
  const { t, fmt } = useI18n();
  return (
    <div className={styles.switcher} role="tablist" aria-label={t("cases.title")}>
      {cases.map((c) => (
        <button
          key={c.id}
          type="button"
          role="tab"
          aria-selected={c.id === value}
          className={`${styles.switch} ${c.id === value ? styles.switchOn : ""}`}
          onClick={() => onChange(c.id)}
        >
          <span className={styles.switchName}>{c.matter || t("cases.untitled")}</span>
          <span className={styles.switchSub}>
            {[t(`cases.statuses.${c.status}`), c.number && `№ ${c.number}`, c.contractDate && fmt.isoDay(c.contractDate)].filter(Boolean).join(" · ")}
          </span>
        </button>
      ))}
    </div>
  );
}
