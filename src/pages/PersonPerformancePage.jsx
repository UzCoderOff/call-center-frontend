import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import pageStyles from "./Pages.module.css";
import styles from "../components/performance/Performance.module.css";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Sheet from "../components/ui/Sheet";
import Segmented from "../components/ui/Segmented";
import { MoneyField, TextField } from "../components/ui/Field";
import { AsyncBoundary, PageHeader } from "../components/ui/Misc";
import DailyChart from "../components/charts/DailyChart";
import { BurnUpChart, MeasureMonthsChart } from "../components/performance/charts";
import { MeasureRow, TargetSheet, useMeasureText, useMeasureValue } from "../components/performance/Measures";
import HowCounted from "../components/performance/HowCounted";
import { StrikesCard } from "../components/performance/Strikes";
import { shiftMonth, useMonthLabel } from "../components/finance/parts";
import { useAuth, isManagerRole } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { useBack } from "../hooks/useBack";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

// One person's month, measured by the work they do: their targets (set
// here — "Reja qoʻyish"), then client work (calls, consultations, contracts)
// and/or office work (the numbers in their daily report form), money, days
// worked, reports and tasks, and the last six months of any measure. Staff
// see their own page (no contract money, no cost).
export default function PersonPerformancePage() {
  const { id } = useParams();
  const { t, fmt } = useI18n();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const month = params.get("month");
  const state = useAsync(() => api.employeePerformance(id, month || undefined), [id, month]);
  const monthLabel = useMonthLabel();
  const goBack = useBack("/performance");
  const manager = isManagerRole(user.role);

  return (
    <AsyncBoundary state={state}>
      {(p) => (
        <div>
          <PageHeader
            back={manager ? { label: t("perf.title"), onClick: goBack } : undefined}
            title={p.employee.name}
            subtitle={[p.employee.position, p.employee.office].filter(Boolean).join(" · ")}
            actions={manager ? <Button to={`/team/${p.employee.id}`} icon="user">{t("perf.profile")}</Button> : undefined}
          />
          <div className={pageStyles.stack}>
            <div className={styles.topBar}>
              <div className={styles.monthBar}>
                <Button icon="chevronLeft" onClick={() => setParams({ month: shiftMonth(p.month, -1) }, { replace: true })} aria-label={t("finance.prevMonth")} />
                <span className={styles.monthLabel}>{monthLabel(p.month)}</span>
                <Button
                  icon="chevronRight"
                  disabled={p.month >= p.current}
                  onClick={() => {
                    const next = shiftMonth(p.month, 1);
                    setParams(next === p.current ? {} : { month: next }, { replace: true });
                  }}
                  aria-label={t("finance.nextMonth")}
                />
              </div>
              <span className={styles.pace}>{t("perf.paceNotePerson", { soFar: p.workDays.soFar, total: p.workDays.total })}</span>
            </div>
            {p.workDays.away.length > 0 && <AwayNote away={p.workDays.away} />}

            <Plan p={p} manager={manager} onChanged={state.reload} />
            {p.coordinator && <CoordinatorWork p={p} />}
            {(p.work.client || p.work.clientActivity) && <ClientWork p={p} />}
            {p.work.office && p.office.length > 0 && <OfficeWork p={p} />}
            {p.calls && <Calls p={p} />}
            {p.strikes && <StrikesCard employeeId={p.employee.id} month={p.month} summary={p.strikes} manager={manager} onChanged={state.reload} />}
            <div className={styles.columns}>
              <Money p={p} onChanged={state.reload} />
              <Discipline p={p} />
            </div>
            <History p={p} monthLabel={monthLabel} />

            <Card>
              <details className={styles.how}>
                <summary>{t("perf.daysTitle")}</summary>
                <div className={styles.tableScroll} style={{ marginTop: 12 }}>
                  <DaysTable p={p} fmt={fmt} />
                </div>
              </details>
            </Card>

            <HowCounted finance={p.finance} />
          </div>
        </div>
      )}
    </AsyncBoundary>
  );
}

// Their days away this month (holidays off for them, days off, sick…).
function AwayNote({ away }) {
  const { t, fmt } = useI18n();
  const label = (a) => (a.kind === "holiday" ? a.name || t("daysOff.holiday") : t(`daysOff.kinds.${a.kind}`));
  return <p className={styles.pace}>{t("perf.awayNote", { days: away.map((a) => `${fmt.isoDateLong(a.date)} (${label(a)})`).join(", ") })}</p>;
}

// Targets and results: everything they're measured on, targets first, with
// what each number means. Managers set the targets here.
function Plan({ p, manager, onChanged }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const targeted = p.metrics.filter((m) => m.target != null);
  return (
    <Card
      title={t("perf.planTitle")}
      subtitle={targeted.length ? t("perf.planSubtitle") : t("perf.planNone")}
      action={
        manager ? (
          <Button size="small" variant="primary" icon="plus" onClick={() => setEditing(true)}>
            {t("perf.target.set")}
          </Button>
        ) : undefined
      }
    >
      {p.metrics.length === 0 ? (
        <p className={styles.emptyNote}>{t("perf.nothingToMeasure")}</p>
      ) : (
        <div className={styles.measures}>
          {p.metrics.map((m) => (
            <MeasureRow key={m.key} measure={m} />
          ))}
        </div>
      )}
      {editing && (
        <TargetSheet
          employeeId={p.employee.id}
          name={p.employee.name}
          month={p.month}
          onClose={() => setEditing(false)}
          onSaved={onChanged}
        />
      )}
    </Card>
  );
}

function Fact({ label, value, note }) {
  return (
    <div className={styles.fact}>
      <span className={styles.factLabel}>{label}</span>
      <span className={styles.factValue}>{value}</span>
      {note && <span className={styles.factNote}>{note}</span>}
    </div>
  );
}

function monthDates(month) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

// Client work, in plain words: booked, came, signed.
function ClientWork({ p }) {
  const { t } = useI18n();
  const b = p.bookings;
  const c = p.conversion;
  const dates = monthDates(p.month);
  return (
    <Card title={t("perf.clientTitle")} subtitle={t("perf.clientSubtitle")}>
      <div className={styles.facts}>
        <Fact label={t("perf.cw.booked")} value={b.made} note={t("perf.cw.bookedNote", { added: p.clientsAdded })} />
        <Fact label={t("perf.cw.came")} value={`${b.attended} / ${b.total}`} note={t("perf.cw.cameNote", { noShow: b.noShow, unmarked: b.unmarked, upcoming: b.upcoming })} />
        <Fact label={t("perf.measure.consultations")} value={p.consultations.count} note={t("perf.measureHint.consultations")} />
        <Fact label={t("perf.measure.contracts")} value={p.contracts.count} note={t("perf.measureHint.contracts")} />
        <Fact
          label={t("perf.cw.signedShare")}
          value={c.rate != null ? `${c.rate}%` : "—"}
          note={t("perf.cw.signedShareNote", { signed: c.signed, total: c.consultations })}
        />
      </div>
      <div className={styles.columns} style={{ marginTop: 18 }}>
        <BurnUpChart dates={dates} perDay={new Map(p.days.map((d) => [d.date, d.consultations]))} workDates={p.workDates} target={p.consultations.target} tone="s1" label={t("perf.measure.consultations")} />
        <BurnUpChart dates={dates} perDay={new Map(p.days.map((d) => [d.date, d.contracts]))} workDates={p.workDates} target={p.contracts.target} tone="s2" label={t("perf.measure.contracts")} />
      </div>
    </Card>
  );
}

// Coordinator work: the cases handed to them since the contract — how many
// they look after, the money collected on them this month, what's overdue
// today.
function CoordinatorWork({ p }) {
  const { t, fmt } = useI18n();
  const c = p.coordinator;
  return (
    <Card title={t("perf.coordTitle")} subtitle={t("perf.coordSubtitle")}>
      <div className={styles.facts}>
        <Fact label={t("perf.measure.cases")} value={fmt.number(c.cases)} note={c.finished ? t("perf.coord.finished", { n: c.finished }) : null} />
        {c.collected != null && <Fact label={t("perf.measure.collected")} value={fmt.number(c.collected)} note={t("perf.coord.payments", { n: c.payments })} />}
        {c.overdue != null && <Fact label={t("perf.coord.overdue")} value={fmt.number(c.overdue)} note={t("perf.coord.overdueCases", { n: c.overdueCases })} />}
      </div>
    </Card>
  );
}

// Office work: the numbers in their daily report form over the month — how
// much, per working day, by service (tables) — and one of them day by day.
function OfficeWork({ p }) {
  const { t, fmt } = useI18n();
  const text = useMeasureText();
  const show = useMeasureValue();
  const [picked, setPicked] = useState(p.office[0]?.key);
  const chosen = p.office.find((m) => m.key === picked) || p.office[0];
  const dates = monthDates(p.month);
  return (
    <Card title={t("perf.officeTitle")} subtitle={t("perf.officeSubtitle")}>
      <div className={styles.measures}>
        {p.office.map((m) => (
          <div key={m.key} className={styles.measure}>
            <div className={styles.measureHead}>
              <span className={styles.measureLabel}>{text(m).label}</span>
              <strong className={styles.measureValue}>{show(m, m.value)}</strong>
            </div>
            <span className={styles.measureNote}>
              {[m.perWorkDay != null ? t("perf.ow.perDay", { n: m.unit === "money" ? fmt.money(Math.round(m.perWorkDay)) : fmt.number(m.perWorkDay) }) : null, m.target != null ? t("perf.ow.target", { target: show(m, m.target) }) : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {m.groups.length > 0 && (
              <div className={styles.targetList} style={{ marginTop: 4 }}>
                {m.groups.map((g) => (
                  <div key={g.name} className={styles.targetRow}>
                    <span className={styles.muted}>{g.name}</span>
                    <span>{show(m, g.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {chosen && (
        <div style={{ marginTop: 18 }}>
          {p.office.length > 1 && (
            <div style={{ marginBottom: 10 }}>
              <Segmented wrap size="small" value={chosen.key} onChange={setPicked} label={t("perf.officeTitle")} options={p.office.map((m) => ({ value: m.key, label: text(m).label }))} />
            </div>
          )}
          <BurnUpChart
            dates={dates}
            perDay={new Map(p.days.map((d) => [d.date, d.measures?.[chosen.key] || 0]))}
            workDates={p.workDates}
            target={chosen.target}
            tone="s1"
            label={text(chosen).label}
          />
        </div>
      )}
    </Card>
  );
}

function Money({ p, onChanged }) {
  const { t, fmt } = useI18n();
  const [editing, setEditing] = useState(false);
  const m = p.money;
  const income = p.metrics.find((x) => x.key === "income");
  return (
    <Card
      title={p.finance ? t("perf.moneyTitle") : t("perf.feesTitle")}
      subtitle={p.finance ? t("perf.moneySubtitle") : t("perf.feesSubtitle")}
      action={
        p.canSetCost ? (
          <Button size="small" variant="plain" icon="edit" onClick={() => setEditing(true)}>
            {t("perf.cost.set")}
          </Button>
        ) : undefined
      }
    >
      <div className={styles.facts}>
        {p.finance && m.income != null && <Fact label={t("perf.m.income")} value={fmt.number(m.income)} note={t("perf.m.incomeSplit", { clients: fmt.number(m.brought.total), reports: fmt.number(m.reportIncome || 0) })} />}
        {(p.work.client || p.work.clientActivity) &&
          (p.finance ? (
            <Fact label={t("perf.m.brought")} value={fmt.number(m.brought.total)} note={t("perf.m.broughtSplit", { consultation: fmt.number(m.brought.consultation), contract: fmt.number(m.brought.contract) })} />
          ) : (
            <Fact label={t("perf.m.fees")} value={fmt.number(m.brought.consultation)} />
          ))}
        {p.finance && m.reportIncome > 0 && <Fact label={t("perf.m.reports")} value={fmt.number(m.reportIncome)} note={m.reportExpense ? t("perf.m.expenses", { amount: fmt.number(m.reportExpense) }) : null} />}
        <Fact label={t("perf.m.taken")} value={fmt.number(m.taken.total)} note={t("perf.m.takenSplit", { cash: fmt.number(m.taken.cash), card: fmt.number(m.taken.card), transfer: fmt.number(m.taken.transfer) })} />
        {p.cash && <Fact label={t("perf.m.holding")} value={fmt.number(p.cash.holding)} note={t("perf.m.holdingNote", { handed: fmt.number(p.cash.handed) })} />}
        {p.finance && p.cost && (
          <>
            <Fact label={t("perf.cost.label")} value={p.cost.amount != null ? fmt.number(p.cost.amount) : "—"} note={p.cost.amount != null ? t("perf.cost.since", { month: p.cost.fromMonth }) : t("perf.cost.notSet")} />
            {p.cost.amount != null && (
              <Fact
                label={t("perf.cost.return")}
                value={p.cost.ratio != null ? `×${String(p.cost.ratio).replace(".", ",")}` : "—"}
                note={t(p.cost.net >= 0 ? "perf.cost.netPlus" : "perf.cost.netMinus", { amount: fmt.money(Math.abs(p.cost.net)) })}
              />
            )}
          </>
        )}
      </div>
      {p.finance && m.unmarked > 0 && <p className={styles.missing}>{t("perf.m.unmarked", { amount: fmt.money(m.unmarked) })}</p>}
      {p.finance && income?.target != null && (
        <div style={{ marginTop: 18 }}>
          <BurnUpChart dates={monthDates(p.month)} perDay={new Map(p.days.map((d) => [d.date, d.income || 0]))} workDates={p.workDates} target={income.target} tone="s3" label={t("perf.measure.income")} money />
        </div>
      )}
      {editing && (
        <CostSheet
          employeeId={p.employee.id}
          month={p.month}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

// What the person costs per month, from a month on (kept until changed).
function CostSheet({ employeeId, month, onClose, onSaved }) {
  const { t, fmt } = useI18n();
  const list = useAsync(() => api.employeeCosts(employeeId), [employeeId]);
  const [fromMonth, setFromMonth] = useState(month);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    if (!/^\d{4}-\d{2}$/.test(fromMonth)) return setError(t("perf.cost.badMonth"));
    if (amount === "" || Number.isNaN(Number(amount))) return setError(t("payments.amountRequired"));
    setBusy(true);
    setError("");
    try {
      await api.setEmployeeCost(employeeId, { fromMonth, amount: Number(amount), note: note.trim() || null });
      onSaved();
    } catch {
      setError(t("perf.cost.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(costId) {
    await api.deleteEmployeeCost(employeeId, costId);
    list.reload();
    onSaved();
  }

  return (
    <Sheet title={t("perf.cost.title")} onClose={onClose}>
      <form onSubmit={save} className={pageStyles.formStack}>
        <p className={pageStyles.note}>{t("perf.cost.hint")}</p>
        <TextField label={t("perf.cost.fromMonth")} type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} required />
        <MoneyField label={t("perf.cost.amount")} value={amount} onChange={setAmount} />
        <TextField label={t("perf.cost.note")} placeholder={t("perf.cost.notePh")} value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" variant="primary" busy={busy}>
            {t("common.save")}
          </Button>
        </div>
      </form>
      <AsyncBoundary state={list}>
        {(rows) =>
          rows.length > 0 && (
            <div className={styles.costList}>
              <strong>{t("perf.cost.history")}</strong>
              {rows.map((r) => (
                <div key={r.id} className={styles.costRow}>
                  <span>
                    {t("perf.cost.since", { month: r.fromMonth })}: <strong>{fmt.money(r.amount)}</strong>
                    {r.note ? ` · ${r.note}` : ""}
                  </span>
                  <Button size="small" variant="plain" icon="trash" onClick={() => remove(r.id)} aria-label={t("perf.cost.remove")} />
                </div>
              ))}
            </div>
          )
        }
      </AsyncBoundary>
    </Sheet>
  );
}

function Calls({ p }) {
  const { t, fmt } = useI18n();
  const c = p.calls;
  const data = p.days.map((d) => ({ date: d.date, total: d.answered + d.missed, missed: d.missed }));
  return (
    <Card title={t("perf.callsTitle")} subtitle={t("perf.callsSubtitle")}>
      <div className={styles.facts} style={{ marginBottom: 16 }}>
        <Fact label={t("perf.c.total")} value={c.total} note={t("perf.c.inOut", { incoming: c.incoming, outgoing: c.outgoing })} />
        <Fact label={t("perf.c.answered")} value={c.answered} note={c.answerRate != null ? `${c.answerRate}%` : null} />
        <Fact label={t("perf.c.missed")} value={c.missed} note={t("perf.c.reached", { n: c.reached, pct: c.reachedRate ?? 0 })} />
        <Fact label={t("perf.c.waiting")} value={c.needsCallback} />
        <Fact label={t("perf.c.median")} value={c.medianCallbackSec != null ? fmt.duration(c.medianCallbackSec) : "—"} />
        <Fact label={t("perf.c.talk")} value={fmt.duration(c.talkSeconds)} />
      </div>
      {data.length > 0 && <DailyChart data={data} dayLink={(date) => `/calls?employeeId=${p.employee.id}&date=${date}`} />}
    </Card>
  );
}

function Discipline({ p }) {
  const { t, fmt } = useI18n();
  const r = p.reports;
  const k = p.tasks;
  return (
    <Card title={t("perf.disciplineTitle")}>
      <div className={styles.facts}>
        <Fact label={t("perf.d.days")} value={`${p.workDays.soFar} / ${p.workDays.total}`} note={t("perf.d.daysNote")} />
        <Fact
          label={t("perf.d.reports")}
          value={r.due ? `${r.sent} / ${r.due}` : r.mode === "auto" ? t("perf.autoShort") : "—"}
          note={r.mode === "auto" ? t("perf.d.auto") : r.mode === "none" ? t("perf.d.none") : t("perf.d.reportsNote")}
        />
        <Fact label={t("perf.d.tasks")} value={k.total ? `${k.onTime} / ${k.total}` : "—"} note={k.total ? t("perf.d.tasksSplit", { late: k.late, open: k.open, overdue: k.overdue }) : t("perf.d.noTasks")} />
      </div>
      {r.missing.length > 0 && <p className={styles.missing}>{t("perf.d.missing", { days: r.missing.map((d) => fmt.isoDateLong(d)).join(", ") })}</p>}
    </Card>
  );
}

// Six months of one measure at a time — whichever they're measured on.
function History({ p, monthLabel }) {
  const { t } = useI18n();
  const text = useMeasureText();
  const show = useMeasureValue();
  const inHistory = (m) => !m.builtin || ["consultations", "contracts", "fees"].includes(m.key) || (m.key === "income" && p.finance);
  const options = p.metrics.filter(inHistory);
  const [picked, setPicked] = useState(options[0]?.key);
  const chosen = options.find((m) => m.key === picked) || options[0];
  if (!chosen) return null;
  const valueOf = (h) => (chosen.builtin ? h[chosen.key] || 0 : h.measures?.[chosen.key] || 0);
  return (
    <Card title={t("perf.historyTitle")} subtitle={t("perf.historyPick")}>
      {options.length > 1 && (
        <div style={{ marginBottom: 12 }}>
          <Segmented wrap size="small" value={chosen.key} onChange={setPicked} label={t("perf.historyTitle")} options={options.map((m) => ({ value: m.key, label: text(m).label }))} />
        </div>
      )}
      <MeasureMonthsChart rows={p.history.map((h) => ({ month: h.month, value: valueOf(h) }))} monthLabel={monthLabel} show={(v) => show(chosen, v)} label={text(chosen).label} />
    </Card>
  );
}

function DaysTable({ p, fmt }) {
  const { t } = useI18n();
  const text = useMeasureText();
  const office = p.office || [];
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>{t("perf.col.date")}</th>
          {p.calls && <th>{t("perf.col.answered")}</th>}
          {p.calls && <th>{t("perf.col.missed")}</th>}
          {(p.work.client || p.work.clientActivity) && <th>{t("perf.col.booked")}</th>}
          {(p.work.client || p.work.clientActivity) && <th>{t("perf.col.consultations")}</th>}
          {(p.work.client || p.work.clientActivity) && <th>{t("perf.col.contracts")}</th>}
          {office.map((m) => (
            <th key={m.key}>{text(m).label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...p.days].reverse().map((d) => (
          <tr key={d.date}>
            <td>{fmt.isoDateLong(d.date)}</td>
            {p.calls && <td>{d.answered}</td>}
            {p.calls && <td>{d.missed}</td>}
            {(p.work.client || p.work.clientActivity) && <td>{d.booked}</td>}
            {(p.work.client || p.work.clientActivity) && <td>{d.consultations}</td>}
            {(p.work.client || p.work.clientActivity) && <td>{d.contracts}</td>}
            {office.map((m) => (
              <td key={m.key}>{d.measures?.[m.key] ? fmt.number(d.measures[m.key]) : "—"}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
