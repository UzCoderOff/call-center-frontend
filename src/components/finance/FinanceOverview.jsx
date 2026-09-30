import { Link } from "react-router-dom";
import styles from "./Finance.module.css";
import pageStyles from "../../pages/Pages.module.css";
import Card from "../ui/Card";
import { Banner, StatTile } from "../ui/Misc";
import FinanceChart from "./FinanceChart";
import { Line, MeterRow, ShareBar, Table, percent, useMonthLabel, useVsPrev } from "./parts";
import { useAuth } from "../../hooks/useAuth";
import { useI18n } from "../../i18n";

// Moliya → Umumiy: the month in numbers, where the money came from, how it
// moved over the months and days, how it was paid and who brought it in,
// per lawyer — and how each figure is counted.
export default function FinanceOverview({ data }) {
  const firm = data.scope === "firm";
  return (
    <div className={pageStyles.stack}>
      <Tiles data={data} />
      <Sources data={data} />
      <div className={styles.columns}>
        <ByMonth data={data} />
        <ByDay data={data} />
      </div>
      <div className={styles.columns}>
        <Methods data={data} />
        <People data={data} />
      </div>
      <Lawyers data={data} />
      {data.sources.channels && <Channels data={data} />}
      <HowCounted firm={firm} />
    </div>
  );
}

function Tiles({ data }) {
  const { t, fmt } = useI18n();
  const vs = useVsPrev();
  const s = data.summary;
  const firm = data.scope === "firm";
  return (
    <div className={styles.tiles}>
      <StatTile label={t("finance.income")} value={fmt.money(s.income)} sub={vs(s.income, s.prev.income)} dot="var(--good)" />
      {firm && <StatTile label={t("finance.expenses")} value={fmt.money(s.expenses)} sub={s.expenses ? vs(s.expenses, s.prev.expenses) : t("finance.expensesNone")} dot="var(--critical)" />}
      {firm && <StatTile label={t("finance.net")} value={fmt.money(s.net)} sub={vs(s.net, s.prev.net)} dot="var(--accent)" />}
      <StatTile label={t("finance.contracted")} value={fmt.money(s.contracted)} sub={t("finance.contractsCount", { count: s.contractCount })} dot="var(--series-contract)" />
      <StatTile label={t("finance.owed")} value={fmt.money(s.owed)} sub={t("finance.owedClients", { count: s.owedClients })} dot="var(--warning)" />
    </div>
  );
}

function Sources({ data }) {
  const { t, fmt } = useI18n();
  const { user } = useAuth();
  const c = data.sources.clients;
  const r = data.sources.reports;
  const s = data.summary;
  const otherIncome = c.kinds.other.amount + s.reportIncome;
  const itemLabel = (i) => [i.column ? `${i.label} → ${i.column}` : i.label, i.service].filter(Boolean).join(" · ");
  const itemNote = (i) => [t("finance.times", { count: i.count }), i.people.join(", ")].filter(Boolean).join(" · ");

  return (
    <Card title={t("finance.sourcesTitle")} subtitle={t("finance.sourcesSubtitle")}>
      <ShareBar
        total={s.income}
        parts={[
          { key: "consultation", cls: "s1", label: t("finance.series.consultation"), amount: c.kinds.consultation.amount },
          { key: "contract", cls: "s2", label: t("finance.series.contract"), amount: c.kinds.contract.amount },
          { key: "otherIncome", cls: "s3", label: t("finance.series.otherIncome"), amount: otherIncome },
        ]}
      />

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

      {r && r.unclassified.length > 0 && (
        <div className={pageStyles.bannerSpace} style={{ marginTop: 14 }}>
          <Banner tone="warning" icon="alertCircle">
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
        </div>
      )}
    </Card>
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
  return (
    <Card title={t("finance.byMonthTitle")} subtitle={t("finance.byMonthSubtitle")}>
      <FinanceChart rows={rows} label={t("finance.month")} showExpenses={data.scope === "firm"} />
    </Card>
  );
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
  return (
    <Card title={t("finance.methodsTitle")} subtitle={t("finance.methodsSubtitle")}>
      {list.length === 0 ? (
        <p className={styles.emptyNote}>{t("finance.noPayments")}</p>
      ) : (
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
      )}
    </Card>
  );
}

function People({ data }) {
  const { t, fmt } = useI18n();
  const list = data.sources.people;
  const max = Math.max(0, ...list.map((p) => p.total));
  return (
    <Card title={t("finance.peopleTitle")} subtitle={t("finance.peopleSubtitle")}>
      {list.length === 0 ? (
        <p className={styles.emptyNote}>{t("finance.noPayments")}</p>
      ) : (
        <div className={styles.meters}>
          {list.map((p) => (
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
        </div>
      )}
    </Card>
  );
}

function Lawyers({ data }) {
  const { t, fmt } = useI18n();
  return (
    <Card title={t("finance.lawyersTitle")} subtitle={t("finance.lawyersSubtitle")}>
      <Table
        empty={t("finance.lawyersEmpty")}
        head={[t("finance.col.lawyer"), t("finance.col.consultations"), t("finance.col.contracts"), t("finance.col.received"), t("finance.col.owed")]}
        rows={data.lawyers.map((l) => [
          <strong key="n">{l.lawyer || t("finance.noLawyer")}</strong>,
          t("finance.cell.consultations", { attended: l.attended, total: l.consultations }),
          l.contracts ? t("finance.cell.contracts", { count: l.contracts, amount: fmt.money(l.contracted) }) : "—",
          <span key="r">
            {fmt.money(l.received)}
            {l.received > 0 && (
              <span className={styles.cellNote}>{t("finance.cell.receivedSplit", { consultation: fmt.number(l.consultationFees), contract: fmt.number(l.contractPayments) })}</span>
            )}
          </span>,
          l.owed ? fmt.money(l.owed) : "—",
        ])}
      />
    </Card>
  );
}

// Where clients come from (the source on the client's card): new clients,
// consultations, contracts and money this month, per source.
function Channels({ data }) {
  const { t, fmt } = useI18n();
  const rows = data.sources.channels;
  const max = Math.max(0, ...rows.map((r) => r.received));
  const label = (s) => (s === "none" ? t("finance.ch.none") : t(`clients.sources.${s}`));
  return (
    <Card title={t("finance.ch.title")} subtitle={t("finance.ch.subtitle")}>
      {rows.length === 0 ? (
        <p className={styles.emptyNote}>{t("finance.ch.empty")}</p>
      ) : (
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
      )}
    </Card>
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
