import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import pageStyles from "./Pages.module.css";
import styles from "../components/performance/Performance.module.css";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Sheet from "../components/ui/Sheet";
import { MoneyField, TextField } from "../components/ui/Field";
import { AsyncBoundary, PageHeader, StatTile } from "../components/ui/Misc";
import DailyChart from "../components/charts/DailyChart";
import { BurnUpChart, MonthsChart } from "../components/performance/charts";
import HowCounted from "../components/performance/HowCounted";
import { shiftMonth, useMonthLabel } from "../components/finance/parts";
import { useAuth, isManagerRole } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { useBack } from "../hooks/useBack";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

// One person's month at work: against their targets day by day, their
// bookings and what came of them, their calls, the money they brought in
// and took, what they cost (Moliya), their reports and tasks, and the last
// six months. Staff see their own page (no contract money, no cost).
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

            <Tiles p={p} />

            <div className={styles.columns}>
              <Card title={t("perf.consultationsProgress")} subtitle={t("perf.progressSubtitle")}>
                <Progress p={p} field="consultations" tone="s1" />
              </Card>
              <Card title={t("perf.contractsProgress")} subtitle={t("perf.progressSubtitle")}>
                <Progress p={p} field="contracts" tone="s2" />
              </Card>
            </div>

            <div className={styles.columns}>
              <Bookings p={p} />
              <Money p={p} onChanged={state.reload} />
            </div>

            {p.calls && <Calls p={p} />}

            <div className={styles.columns}>
              <Discipline p={p} />
              <History p={p} monthLabel={monthLabel} />
            </div>

            <Card>
              <details className={styles.how}>
                <summary>{t("perf.daysTitle")}</summary>
                <div className={styles.tableScroll} style={{ marginTop: 12 }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>{t("perf.col.date")}</th>
                        {p.calls && <th>{t("perf.col.answered")}</th>}
                        {p.calls && <th>{t("perf.col.missed")}</th>}
                        <th>{t("perf.col.booked")}</th>
                        <th>{t("perf.col.consultations")}</th>
                        <th>{t("perf.col.contracts")}</th>
                        <th>{t("perf.col.fees")}</th>
                        {p.finance && <th>{t("perf.col.brought")}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {[...p.days].reverse().map((d) => (
                        <tr key={d.date}>
                          <td>{fmt.isoDateLong(d.date)}</td>
                          {p.calls && <td>{d.answered}</td>}
                          {p.calls && <td>{d.missed}</td>}
                          <td>{d.booked}</td>
                          <td>{d.consultations}</td>
                          <td>{d.contracts}</td>
                          <td>{d.fees ? fmt.number(d.fees) : "—"}</td>
                          {p.finance && <td>{d.brought ? fmt.number(d.brought) : "—"}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

// "12 / 60 — by today 14 (2 behind)".
function useTargetLine() {
  const { t } = useI18n();
  return (x) => {
    if (x.target == null) return t("perf.noTarget");
    const diff = x.count - (x.expected ?? 0);
    return t(diff >= 0 ? "perf.aheadLine" : "perf.behindLine", { expected: x.expected, n: Math.abs(diff) });
  };
}

function Tiles({ p }) {
  const { t, fmt } = useI18n();
  const line = useTargetLine();
  const brought = p.money.brought.total + (p.money.reportIncome || 0);
  return (
    <div className={styles.tiles}>
      <StatTile
        label={t("perf.col.consultations")}
        value={p.consultations.target != null ? `${p.consultations.count} / ${p.consultations.target}` : String(p.consultations.count)}
        sub={line(p.consultations)}
        dot="var(--series-consultation)"
      />
      <StatTile
        label={t("perf.col.contracts")}
        value={p.contracts.target != null ? `${p.contracts.count} / ${p.contracts.target}` : String(p.contracts.count)}
        sub={[line(p.contracts), p.finance && p.contracts.amount ? fmt.money(p.contracts.amount) : null].filter(Boolean).join(" · ")}
        dot="var(--series-contract)"
      />
      <StatTile
        label={t("perf.col.conversion")}
        value={p.conversion.rate != null ? `${p.conversion.rate}%` : "—"}
        sub={t("perf.conversionSub", { signed: p.conversion.signed, total: p.conversion.consultations })}
        dot="var(--accent)"
      />
      <StatTile label={t("perf.col.booked")} value={String(p.bookings.made)} sub={t("perf.bookedSub", { added: p.clientsAdded })} dot="var(--accent)" />
      <StatTile
        label={p.finance ? t("perf.col.brought") : t("perf.col.fees")}
        value={fmt.money(brought)}
        sub={p.finance && p.cost?.amount != null ? t("perf.costLine", { cost: fmt.money(p.cost.amount) }) : t("perf.broughtSub")}
        dot="var(--good)"
      />
    </div>
  );
}

function Progress({ p, field, tone }) {
  const { t } = useI18n();
  const x = p[field];
  const dates = [];
  const [y, m] = p.month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (let d = 1; d <= last; d++) dates.push(`${p.month}-${String(d).padStart(2, "0")}`);
  const perDay = new Map(p.days.map((d) => [d.date, d[field]]));
  return <BurnUpChart dates={dates} perDay={perDay} workDates={p.workDates} target={x.target} tone={tone} label={t(`perf.series.${field}`)} />;
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

function Bookings({ p }) {
  const { t, fmt } = useI18n();
  const b = p.bookings;
  const pct = (a, n) => (n ? `${Math.round((a / n) * 100)}%` : "—");
  return (
    <Card title={t("perf.bookingsTitle")} subtitle={t("perf.bookingsSubtitle")}>
      <div className={styles.facts}>
        <Fact label={t("perf.b.total")} value={b.total} note={t("perf.b.online", { n: b.online })} />
        <Fact label={t("perf.b.attended")} value={b.attended} note={pct(b.attended, b.attended + b.noShow)} />
        <Fact label={t("perf.b.noShow")} value={b.noShow} note={b.unmarked ? t("perf.b.unmarked", { n: b.unmarked }) : null} />
        <Fact label={t("perf.b.upcoming")} value={b.upcoming} />
        <Fact label={t("perf.b.cancelled")} value={b.cancelled} />
        <Fact label={t("perf.b.paid")} value={`${b.paid} / ${b.total}`} note={fmt.money(b.paidAmount)} />
      </div>
    </Card>
  );
}

function Money({ p, onChanged }) {
  const { t, fmt } = useI18n();
  const [editing, setEditing] = useState(false);
  const m = p.money;
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
        {p.finance ? (
          <>
            <Fact label={t("perf.m.brought")} value={fmt.number(m.brought.total)} note={t("perf.m.broughtSplit", { consultation: fmt.number(m.brought.consultation), contract: fmt.number(m.brought.contract) })} />
            <Fact label={t("perf.m.reports")} value={fmt.number(m.reportIncome)} note={m.reportExpense ? t("perf.m.expenses", { amount: fmt.number(m.reportExpense) }) : null} />
          </>
        ) : (
          <Fact label={t("perf.m.fees")} value={fmt.number(m.brought.consultation)} />
        )}
        <Fact label={t("perf.m.taken")} value={fmt.number(m.taken.total)} note={t("perf.m.takenSplit", { cash: fmt.number(m.taken.cash), card: fmt.number(m.taken.card), transfer: fmt.number(m.taken.transfer) })} />
        {p.cash && <Fact label={t("perf.m.holding")} value={fmt.number(p.cash.holding)} note={t("perf.m.holdingNote", { handed: fmt.number(p.cash.handed) })} />}
        {p.finance && p.cost && (
          <>
            <Fact
              label={t("perf.cost.label")}
              value={p.cost.amount != null ? fmt.number(p.cost.amount) : "—"}
              note={p.cost.amount != null ? t("perf.cost.since", { month: p.cost.fromMonth }) : t("perf.cost.notSet")}
            />
            {p.cost.amount != null && (
              <>
                <Fact
                  label={t("perf.cost.return")}
                  value={p.cost.ratio != null ? `×${String(p.cost.ratio).replace(".", ",")}` : "—"}
                  note={t(p.cost.net >= 0 ? "perf.cost.netPlus" : "perf.cost.netMinus", { amount: fmt.money(Math.abs(p.cost.net)) })}
                />
                <Fact
                  label={t("perf.cost.perUnit")}
                  value={p.cost.perConsultation != null ? fmt.number(p.cost.perConsultation) : "—"}
                  note={p.cost.perContract != null ? t("perf.cost.perContract", { amount: fmt.number(p.cost.perContract) }) : t("perf.cost.noContracts")}
                />
              </>
            )}
          </>
        )}
      </div>
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
        <Fact
          label={t("perf.d.reports")}
          value={r.due ? `${r.sent} / ${r.due}` : r.mode === "auto" ? t("perf.autoShort") : "—"}
          note={r.mode === "auto" ? t("perf.d.auto") : r.mode === "none" ? t("perf.d.none") : null}
        />
        <Fact label={t("perf.d.tasks")} value={k.total ? `${k.onTime} / ${k.total}` : "—"} note={k.total ? t("perf.d.tasksSplit", { late: k.late, open: k.open, overdue: k.overdue }) : t("perf.d.noTasks")} />
      </div>
      {r.missing.length > 0 && <p className={styles.missing}>{t("perf.d.missing", { days: r.missing.map((d) => fmt.isoDateLong(d)).join(", ") })}</p>}
    </Card>
  );
}

function History({ p, monthLabel }) {
  const { t, fmt } = useI18n();
  return (
    <Card title={t("perf.historyTitle")} subtitle={t("perf.historySubtitle")}>
      <MonthsChart months={p.history} monthLabel={monthLabel} />
      <div className={styles.tableScroll} style={{ marginTop: 12 }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t("perf.col.month")}</th>
              <th>{t("perf.col.consultations")}</th>
              <th>{t("perf.col.contracts")}</th>
              {p.finance ? <th>{t("perf.col.contracted")}</th> : null}
              <th>{p.finance ? t("perf.col.brought") : t("perf.col.fees")}</th>
            </tr>
          </thead>
          <tbody>
            {[...p.history].reverse().map((m) => (
              <tr key={m.month}>
                <td>{monthLabel(m.month)}</td>
                <td>{m.consultations}</td>
                <td>{m.contracts}</td>
                {p.finance ? <td>{fmt.number(m.contracted)}</td> : null}
                <td>{fmt.number(p.finance ? m.brought : m.fees)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
