import { useState } from "react";
import { Link } from "react-router-dom";
import styles from "./Finance.module.css";
import pageStyles from "../../pages/Pages.module.css";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { Banner, StatTile } from "../ui/Misc";
import FinanceChart from "./FinanceChart";
import { Line, MeterRow, ShareBar, Table, percent, useMonthLabel } from "./parts";
import { useAuth } from "../../hooks/useAuth";
import { useI18n } from "../../i18n";

// Moliya → Umumiy. The answer first: how much money came in this month,
// against last month and the months before, and where it came from. Then the
// three things the head of the firm acts on (debts, new contracts,
// consultations) — each opens its tab — and a warning only when something
// needs doing. Who brought the money and the month day by day; everything
// else (the full breakdown, payment methods, lawyers, sources) is folded
// away below, one tap to open.
export default function FinanceOverview({ data }) {
  const firm = data.scope === "firm";
  return (
    <div className={pageStyles.stack}>
      <Hero data={data} />
      <KeyFigures data={data} />
      <Attention data={data} />
      <div className={styles.columns}>
        <ByDay data={data} />
        <People data={data} />
      </div>
      <Fold title="finance.sourcesTitle" subtitle="finance.fold.breakdownSub">
        <Breakdown data={data} />
      </Fold>
      <Fold title="finance.byMonthTitle" subtitle="finance.byMonthSubtitle">
        <ByMonth data={data} />
      </Fold>
      <Fold title="finance.methodsTitle" subtitle="finance.methodsSubtitle">
        <Methods data={data} />
      </Fold>
      <Fold title="finance.lawyersTitle" subtitle="finance.lawyersSubtitle">
        <Lawyers data={data} />
      </Fold>
      {data.sources.channels && (
        <Fold title="finance.ch.title" subtitle="finance.ch.subtitle">
          <Channels data={data} />
        </Fold>
      )}
      <HowCounted firm={firm} />
    </div>
  );
}

// A card that opens on tap: its title and one line, the content below.
function Fold({ title, subtitle, children }) {
  const { t } = useI18n();
  return (
    <Card className={styles.foldCard}>
      <details className={styles.fold}>
        <summary className={styles.foldSummary}>
          <span className={styles.foldText}>
            <span className={styles.foldTitle}>{t(title)}</span>
            {subtitle && <span className={styles.foldSub}>{t(subtitle)}</span>}
          </span>
          <Icon name="chevronDown" size={18} className={styles.foldIcon} />
        </summary>
        <div className={styles.foldBody}>{children}</div>
      </details>
    </Card>
  );
}

// "Sentabr 2026: 178 600 000 soʻm — ▲ 133% against August", the last six
// months as small columns, and the split by source.
function Hero({ data }) {
  const { t, fmt } = useI18n();
  const monthLabel = useMonthLabel();
  const s = data.summary;
  const c = data.sources.clients;
  const firm = data.scope === "firm";
  const prev = s.prev.income;
  const delta = prev > 0 ? Math.round(((s.income - prev) / prev) * 100) : null;
  const max = Math.max(1, ...data.trend.map((m) => m.income));
  const otherIncome = c.kinds.other.amount + s.reportIncome;
  return (
    <section className={styles.hero}>
      <div className={styles.heroMain}>
        <span className={styles.heroLabel}>{t("finance.hero.title", { month: monthLabel(data.month) })}</span>
        <span className={styles.heroValue}>{fmt.money(s.income)}</span>
        <span className={`${styles.heroDelta} ${delta == null ? "" : delta >= 0 ? styles.up : styles.down}`}>
          {delta == null ? (
            t("finance.hero.noPrev")
          ) : (
            <>
              <Icon name={delta >= 0 ? "arrowUp" : "arrowDown"} size={15} strokeWidth={2.2} />
              {t("finance.hero.vsPrev", { delta: `${Math.abs(delta)}%`, amount: fmt.money(prev) })}
            </>
          )}
        </span>
        {firm && s.expenses > 0 && <span className={styles.heroNet}>{t("finance.hero.net", { expenses: fmt.money(s.expenses), net: fmt.money(s.net) })}</span>}
      </div>
      <div className={styles.spark} role="img" aria-label={data.trend.map((m) => `${monthLabel(m.month)}: ${fmt.money(m.income)}`).join(", ")}>
        {data.trend.map((m) => (
          <span key={m.month} className={styles.sparkCol} title={`${monthLabel(m.month)}: ${fmt.money(m.income)}`}>
            <span className={styles.sparkTrack}>
              <span className={`${styles.sparkBar} ${m.month === data.month ? styles.sparkNow : ""}`} style={{ height: `${Math.max(m.income > 0 ? 4 : 0, (m.income / max) * 100)}%` }} />
            </span>
            <span className={styles.sparkLabel}>{monthLabel(m.month, true)}</span>
          </span>
        ))}
      </div>
      <div className={styles.heroShare}>
        <ShareBar
          total={s.income}
          parts={[
            { key: "contract", cls: "s2", label: t("finance.series.contract"), amount: c.kinds.contract.amount },
            { key: "consultation", cls: "s1", label: t("finance.series.consultation"), amount: c.kinds.consultation.amount },
            { key: "otherIncome", cls: "s3", label: t("finance.series.otherIncome"), amount: otherIncome },
          ]}
        />
      </div>
    </section>
  );
}

// The three things to act on — each opens its own tab.
function KeyFigures({ data }) {
  const { t, fmt } = useI18n();
  const s = data.summary;
  const c = data.consultations;
  const plan = data.owed.plan;
  const tab = (name) => `/finance?tab=${name}${data.month !== data.current ? `&month=${data.month}` : ""}`;
  return (
    <div className={styles.keyTiles}>
      <StatTile
        to={tab("debts")}
        label={t("finance.kf.owed")}
        value={fmt.money(s.owed)}
        sub={[t("finance.kf.owedSub", { count: s.owedClients }), plan.overdue > 0 ? t("finance.kf.overdueSub", { amount: fmt.money(plan.overdue) }) : null].filter(Boolean).join(" · ")}
        dot="var(--warning)"
      />
      <StatTile to={tab("contracts")} label={t("finance.kf.contracts")} value={fmt.money(s.contracted)} sub={t("finance.kf.contractsSub", { count: s.contractCount })} dot="var(--series-contract)" />
      <StatTile
        to={tab("consultations")}
        label={t("finance.kf.consultations")}
        value={`${fmt.number(c.status.attended)} / ${fmt.number(c.total)}`}
        sub={t("finance.kf.consultationsSub", { paid: fmt.money(c.paid.amount) })}
        dot="var(--series-consultation)"
      />
    </div>
  );
}

// Only when something needs doing: late payments, consultations with no fee
// recorded, report money not marked for Moliya yet.
function Attention({ data }) {
  const { t, fmt } = useI18n();
  const { user } = useAuth();
  const plan = data.owed.plan;
  const c = data.consultations;
  const r = data.sources.reports;
  const tab = (name) => `/finance?tab=${name}${data.month !== data.current ? `&month=${data.month}` : ""}`;
  const items = [];
  if (plan.overdue > 0) {
    items.push(
      <Banner
        key="overdue"
        tone="warning"
        icon="clock"
        action={
          <Button size="small" to={tab("debts")}>
            {t("finance.att.open")}
          </Button>
        }
      >
        <strong>{t("finance.att.overdue", { amount: fmt.money(plan.overdue) })}</strong>
        <div className={pageStyles.bannerDetail}>{t("finance.att.overdueSub", { count: plan.overdueCases })}</div>
      </Banner>
    );
  }
  if (c.unpaidHeld.length > 0) {
    items.push(
      <Banner
        key="unpaid"
        tone="warning"
        icon="cash"
        action={
          <Button size="small" to={tab("consultations")}>
            {t("finance.att.open")}
          </Button>
        }
      >
        <strong>{t("finance.att.unpaid", { count: c.unpaidHeld.length })}</strong>
        {c.missing > 0 && <div className={pageStyles.bannerDetail}>{t("finance.att.unpaidSub", { amount: fmt.money(c.missing) })}</div>}
      </Banner>
    );
  }
  if (r && r.unclassified.length > 0) {
    items.push(
      <Banner key="unmarked" tone="warning" icon="alertCircle">
        <strong>{t("finance.unclassifiedTitle")}</strong>
        <ul className={styles.plainList}>
          {r.unclassified.map((u, k) => (
            <li key={k}>
              {t("finance.unclassifiedLine", {
                label: u.column ? `${u.label} → ${u.column}` : u.label,
                form: u.form || "—",
                amount: fmt.money(u.amount),
                count: u.count,
              })}
            </li>
          ))}
        </ul>
        <div className={pageStyles.bannerDetail}>
          {user.role === "DEVELOPER" ? (
            <>
              {t("finance.unclassifiedHowDev")} <Link to="/settings">{t("finance.unclassifiedOpen")}</Link>
            </>
          ) : (
            t("finance.unclassifiedHow")
          )}
        </div>
      </Banner>
    );
  }
  if (items.length === 0) return null;
  return <div className={styles.attention}>{items}</div>;
}

// Every source, line by line: clients (consultation fees, contract payments —
// new and earlier contracts — other) and the daily reports' income, then
// expenses and what's left.
function Breakdown({ data }) {
  const { t } = useI18n();
  const c = data.sources.clients;
  const r = data.sources.reports;
  const s = data.summary;
  const itemLabel = (i) => [i.column ? `${i.label} → ${i.column}` : i.label, i.service].filter(Boolean).join(" · ");
  const itemNote = (i) => [t("finance.times", { count: i.count }), i.people.join(", ")].filter(Boolean).join(" · ");
  return (
    <div className={styles.lines}>
      <Line label={t("finance.fromClients")} note={t("finance.paymentsCount", { count: c.count })} amount={c.total} />
      <Line level={1} label={t("finance.consultationFees")} note={t("finance.paymentsCount", { count: c.kinds.consultation.count })} amount={c.kinds.consultation.amount} />
      <Line level={1} label={t("finance.contractPayments")} note={t("finance.paymentsCount", { count: c.kinds.contract.count })} amount={c.kinds.contract.amount} />
      {c.kinds.contract.count > 0 && (
        <>
          <Line level={2} label={t("finance.newContractsPaid")} note={t("finance.paymentsCount", { count: c.contractSplit.newContracts.count })} amount={c.contractSplit.newContracts.amount} />
          <Line level={2} label={t("finance.earlierContractsPaid")} note={t("finance.paymentsCount", { count: c.contractSplit.earlier.count })} amount={c.contractSplit.earlier.amount} />
        </>
      )}
      {c.kinds.other.count > 0 && <Line level={1} label={t("finance.otherPayments")} note={t("finance.paymentsCount", { count: c.kinds.other.count })} amount={c.kinds.other.amount} />}
      {r && (
        <>
          <Line label={t("finance.fromReports")} note={r.income.count ? t("finance.entriesCount", { count: r.income.count }) : t("finance.fromReportsNone")} amount={r.income.total} />
          {r.income.items.map((i, k) => (
            <Line key={k} level={1} label={itemLabel(i)} note={itemNote(i)} amount={i.amount} />
          ))}
        </>
      )}
      <Line total label={t("finance.income")} amount={s.income} />
      {r && (
        <>
          <Line label={t("finance.expensesFromReports")} note={r.expense.count ? t("finance.entriesCount", { count: r.expense.count }) : t("finance.expensesNone")} amount={r.expense.total} negative />
          {r.expense.items.map((i, k) => (
            <Line key={k} level={1} label={itemLabel(i)} note={itemNote(i)} amount={i.amount} negative />
          ))}
          <Line total label={t("finance.net")} amount={s.net} />
        </>
      )}
    </div>
  );
}

const chartRow = (key, axis, title, x) => ({
  key,
  axis,
  title,
  consultation: x.consultation,
  contract: x.contract,
  otherIncome: x.other + x.reportIncome,
  expenses: x.expenses,
});

function ByMonth({ data }) {
  const { t } = useI18n();
  const monthLabel = useMonthLabel();
  const rows = data.trend.map((m) => chartRow(m.month, monthLabel(m.month, true), monthLabel(m.month), m));
  return <FinanceChart rows={rows} label={t("finance.month")} showExpenses={data.scope === "firm"} />;
}

// Every day of the month (up to today in the current month), so quiet days
// show as gaps rather than disappearing.
function ByDay({ data }) {
  const { t, fmt } = useI18n();
  const [y, m] = data.month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const until = data.month === data.current ? Number(data.today.slice(8, 10)) : last;
  const byDate = new Map(data.sources.days.map((d) => [d.date, d]));
  const rows = [];
  for (let d = 1; d <= until; d++) {
    const date = `${data.month}-${String(d).padStart(2, "0")}`;
    const x = byDate.get(date) || { consultation: 0, contract: 0, other: 0, reportIncome: 0, expenses: 0 };
    rows.push(chartRow(date, String(d), fmt.isoDateLong(date), x));
  }
  return (
    <Card title={t("finance.byDayTitle")} subtitle={t("finance.byDaySubtitle")}>
      <FinanceChart rows={rows} label={t("finance.day")} showExpenses={data.scope === "firm"} />
    </Card>
  );
}

function Methods({ data }) {
  const { t } = useI18n();
  const list = data.sources.methods;
  const total = data.sources.clients.total;
  const max = Math.max(0, ...list.map((m) => m.amount));
  if (list.length === 0) return <p className={styles.emptyNote}>{t("finance.noPayments")}</p>;
  return (
    <div className={styles.meters}>
      {list.map((m) => (
        <MeterRow
          key={m.method}
          label={m.method === "none" ? t("finance.methodNone") : t(`payments.methods.${m.method}`)}
          amount={m.amount}
          max={max}
          sub={`${percent(m.amount, total)}% · ${t("finance.paymentsCount", { count: m.count })}`}
        />
      ))}
    </div>
  );
}

// Who brought the money in: the first few, the rest one tap away.
const PEOPLE_SHOWN = 5;

function People({ data }) {
  const { t, fmt } = useI18n();
  const [all, setAll] = useState(false);
  const list = data.sources.people;
  const shown = all ? list : list.slice(0, PEOPLE_SHOWN);
  const max = Math.max(0, ...list.map((p) => p.total));
  return (
    <Card title={t("finance.peopleTitle")} subtitle={t("finance.peopleSubtitle")}>
      {list.length === 0 ? (
        <p className={styles.emptyNote}>{t("finance.noPayments")}</p>
      ) : (
        <div className={styles.meters}>
          {shown.map((p) => (
            <MeterRow
              key={p.name || "-"}
              label={p.name || t("finance.unknownPerson")}
              amount={p.total}
              max={max}
              sub={[
                p.clientCount ? t("finance.personClients", { amount: fmt.money(p.clientPayments), count: p.clientCount }) : null,
                p.reportIncome ? t("finance.personReports", { amount: fmt.money(p.reportIncome) }) : null,
                p.reportExpense ? t("finance.personExpenses", { amount: fmt.money(p.reportExpense) }) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          ))}
          {list.length > PEOPLE_SHOWN && (
            <Button size="small" variant="plain" onClick={() => setAll((v) => !v)}>
              {all ? t("finance.people.less") : t("finance.people.more", { count: list.length })}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function Lawyers({ data }) {
  const { t, fmt } = useI18n();
  return (
    <Table
      empty={t("finance.lawyersEmpty")}
      head={[t("finance.col.lawyer"), t("finance.col.consultations"), t("finance.col.contracts"), t("finance.col.received"), t("finance.col.owed")]}
      rows={data.lawyers.map((l) => [
        <strong key="n">{l.lawyer || t("finance.noLawyer")}</strong>,
        t("finance.cell.consultations", { attended: l.attended, total: l.consultations }),
        l.contracts ? t("finance.cell.contracts", { count: l.contracts, amount: fmt.money(l.contracted) }) : "—",
        <span key="r">
          {fmt.money(l.received)}
          {l.received > 0 && <span className={styles.cellNote}>{t("finance.cell.receivedSplit", { consultation: fmt.number(l.consultationFees), contract: fmt.number(l.contractPayments) })}</span>}
        </span>,
        l.owed ? fmt.money(l.owed) : "—",
      ])}
    />
  );
}

// Where clients come from (the source on the client's card): new clients,
// consultations, contracts and money this month, per source.
function Channels({ data }) {
  const { t, fmt } = useI18n();
  const rows = data.sources.channels;
  const max = Math.max(0, ...rows.map((r) => r.received));
  const label = (s) => (s === "none" ? t("finance.ch.none") : t(`clients.sources.${s}`));
  if (rows.length === 0) return <p className={styles.emptyNote}>{t("finance.ch.empty")}</p>;
  return (
    <>
      <div className={styles.meters} style={{ marginBottom: 16 }}>
        {rows
          .filter((r) => r.received > 0)
          .map((r) => (
            <MeterRow key={r.source} label={label(r.source)} amount={r.received} max={max} sub={t("finance.ch.receivedShare", { percent: percent(r.received, data.sources.clients.total) })} />
          ))}
      </div>
      <Table
        head={[t("finance.ch.source"), t("finance.ch.newClients"), t("finance.ch.consultations"), t("finance.ch.contracts"), t("finance.ch.received")]}
        rows={rows.map((r) => [
          <strong key="s">{label(r.source)}</strong>,
          fmt.number(r.newClients),
          fmt.number(r.consultations),
          <span key="c">
            {fmt.number(r.contracts)}
            {r.contracted > 0 && <span className={styles.cellNote}>{fmt.money(r.contracted)}</span>}
          </span>,
          fmt.money(r.received),
        ])}
      />
    </>
  );
}

function HowCounted({ firm }) {
  const { t } = useI18n();
  const points = ["cash", "income", ...(firm ? ["reports", "expenses"] : []), "contracted", "owed", "schedule", "consultations", "people", ...(firm ? ["channels", "kassa"] : [])];
  return (
    <Card>
      <details className={styles.how}>
        <summary>{t("finance.how.title")}</summary>
        <ul>
          {points.map((p) => (
            <li key={p}>{t(`finance.how.${p}`)}</li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
