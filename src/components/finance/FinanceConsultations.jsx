import styles from "./Finance.module.css";
import pageStyles from "../../pages/Pages.module.css";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Icon from "../ui/Icon";
import { List, ListRow } from "../ui/List";
import { EmptyState, StatTile } from "../ui/Misc";
import { Table, percent } from "./parts";
import { useI18n } from "../../i18n";

// Moliya → Konsultatsiyalar: the month's appointments (a booking is a
// consultation) — how many came, paid, didn't pay, went on to sign a
// contract; per lawyer; and the visits with no fee recorded.
export default function FinanceConsultations({ data }) {
  const { t, fmt } = useI18n();
  const c = data.consultations;
  const steps = [
    { label: t("finance.funnel.booked"), value: c.total },
    { label: t("finance.funnel.attended"), value: c.status.attended },
    { label: t("finance.funnel.paid"), value: c.paid.count },
    { label: t("finance.funnel.signed"), value: c.converted },
  ];
  return (
    <div className={pageStyles.stack}>
      <div className={styles.tiles}>
        <StatTile label={t("finance.c.booked")} value={fmt.number(c.total)} sub={t("finance.c.bookedSub", { office: c.format.office, online: c.format.online })} dot="var(--series-consultation)" />
        <StatTile
          label={t("finance.c.attended")}
          value={fmt.number(c.status.attended)}
          sub={t("finance.c.attendedSub", { noShow: c.status.noShow, unmarked: c.status.unmarked, upcoming: c.status.upcoming })}
          dot="var(--good)"
        />
        <StatTile label={t("finance.c.paid")} value={fmt.money(c.paid.amount)} sub={t("finance.c.paidSub", { count: c.paid.count, total: c.total })} dot="var(--good)" />
        <StatTile
          label={t("finance.c.unpaid")}
          value={fmt.number(c.unpaidHeld.length)}
          sub={c.unpaidHeld.length ? t("finance.c.unpaidSub", { amount: fmt.money(c.missing) }) : t("finance.c.unpaidNone")}
          dot="var(--warning)"
        />
        <StatTile
          label={t("finance.c.converted")}
          value={`${percent(c.converted, c.clients)}%`}
          sub={t("finance.c.convertedSub", { converted: c.converted, clients: c.clients })}
          dot="var(--series-contract)"
        />
      </div>

      <Card title={t("finance.funnel.title")} subtitle={t("finance.funnel.subtitle")}>
        <div className={styles.funnel}>
          {steps.map((s, i) => (
            <div key={s.label} className={styles.funnelStep}>
              {i > 0 && <Icon name="chevronRight" size={18} className={styles.funnelArrow} />}
              <div className={styles.funnelBox}>
                <strong>{fmt.number(s.value)}</strong>
                <span>{s.label}</span>
                {i > 0 && <span className={styles.muted}>{percent(s.value, steps[i - 1].value)}%</span>}
              </div>
            </div>
          ))}
        </div>
        {c.status.cancelled > 0 && <p className={pageStyles.note}>{t("finance.funnel.cancelled", { count: c.status.cancelled })}</p>}
      </Card>

      <Card flush title={t("finance.c.unpaidTitle")} subtitle={t("finance.c.unpaidSubtitle", { fee: fmt.money(c.fee) })}>
        {c.unpaidHeld.length === 0 ? (
          <EmptyState icon="checkCircle" text={t("finance.c.unpaidEmpty")} />
        ) : (
          <List plain inset={16}>
            {c.unpaidHeld.map((a) => (
              <ListRow
                key={a.id}
                to={a.clientId ? `/clients/${a.clientId}` : undefined}
                title={a.clientName}
                subtitle={[
                  `${fmt.isoDateLong(a.date)}, ${fmt.minutes(a.start)}`,
                  a.lawyer,
                  a.format === "online" ? t("calendar.format.online") : null,
                  a.status === "booked" ? t("finance.c.notMarked") : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                trailing={<Badge tone="warning">{t("calendar.feeNotPaid")}</Badge>}
              />
            ))}
          </List>
        )}
      </Card>

      <Card title={t("finance.c.byLawyerTitle")}>
        <Table
          empty={t("finance.c.byLawyerEmpty")}
          head={[t("finance.col.lawyer"), t("finance.col.booked"), t("finance.col.attended"), t("finance.col.noShow"), t("finance.col.online"), t("finance.col.paid"), t("finance.col.cancelled")]}
          rows={c.byLawyer.map((l) => [
            <strong key="n">{l.lawyer}</strong>,
            fmt.number(l.total),
            fmt.number(l.attended),
            fmt.number(l.noShow),
            fmt.number(l.online),
            <span key="p">
              {fmt.number(l.paid)}
              {l.amount > 0 && <span className={styles.cellNote}>{fmt.money(l.amount)}</span>}
            </span>,
            fmt.number(l.cancelled),
          ])}
        />
      </Card>
    </div>
  );
}
