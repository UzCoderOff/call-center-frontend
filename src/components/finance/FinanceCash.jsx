import { useState } from "react";
import styles from "./Finance.module.css";
import pageStyles from "../../pages/Pages.module.css";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Sheet from "../ui/Sheet";
import { MoneyField, TextField } from "../ui/Field";
import { List, ListRow } from "../ui/List";
import { AsyncBoundary, EmptyState, StatTile } from "../ui/Misc";
import { Table } from "./parts";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";

// Moliya → Kassa: cash in people's hands. Whoever records a cash payment took
// the money; "Qabul qildim" records them handing it over. What they hold =
// cash taken − handed over (counted from the day this started).
export default function FinanceCash() {
  const { t, fmt } = useI18n();
  const [refresh, setRefresh] = useState(0);
  const state = useAsync(() => api.cash(), [refresh]);
  const [receiving, setReceiving] = useState(null); // a person row
  const reload = () => setRefresh((n) => n + 1);

  return (
    <AsyncBoundary state={state}>
      {(d) => {
        const holding = d.people.reduce((s, p) => s + Math.max(0, p.holding), 0);
        const taken = d.people.reduce((s, p) => s + p.taken, 0);
        return (
          <div className={pageStyles.stack}>
            <div className={styles.tiles}>
              <StatTile label={t("finance.cash.holding")} value={fmt.money(holding)} sub={t("finance.cash.holdingSub", { n: d.people.filter((p) => p.holding > 0).length })} dot="var(--warning)" />
              <StatTile label={t("finance.cash.taken")} value={fmt.money(taken)} sub={t("finance.cash.since", { date: fmt.isoDateLong(d.from) })} dot="var(--good)" />
            </div>

            <Card title={t("finance.cash.peopleTitle")} subtitle={t("finance.cash.peopleSubtitle")}>
              <Table
                empty={t("finance.cash.empty")}
                head={[t("finance.cash.person"), t("finance.cash.taken"), t("finance.cash.handed"), t("finance.cash.holding"), ""]}
                rows={d.people.map((p) => [
                  <strong key="n">{p.user.name}</strong>,
                  <span key="t">
                    {fmt.money(p.taken)}
                    <span className={styles.cellNote}>{t("finance.paymentsCount", { count: p.payments })}</span>
                  </span>,
                  <span key="h">
                    {fmt.money(p.handed)}
                    {p.lastHandover && <span className={styles.cellNote}>{t("finance.cash.last", { date: fmt.isoDateLong(p.lastHandover) })}</span>}
                  </span>,
                  <strong key="b" className={p.holding > 0 ? styles.owedAmount : undefined}>
                    {fmt.money(p.holding)}
                  </strong>,
                  p.holding > 0 ? (
                    <Button key="r" size="small" variant="primary" onClick={() => setReceiving(p)}>
                      {t("finance.cash.receive")}
                    </Button>
                  ) : (
                    ""
                  ),
                ])}
              />
            </Card>

            <Card flush title={t("finance.cash.historyTitle")}>
              {d.handovers.length === 0 ? (
                <EmptyState icon="cash" text={t("finance.cash.historyEmpty")} />
              ) : (
                <List plain inset={16}>
                  {d.handovers.map((h) => (
                    <ListRow
                      key={h.id}
                      title={`${h.user.name} → ${h.receivedBy || "—"}`}
                      subtitle={[fmt.isoDateLong(h.date), h.note].filter(Boolean).join(" · ")}
                      trailing={
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <strong>{fmt.money(h.amount)}</strong>
                          <Button
                            size="small"
                            variant="plain"
                            icon="trash"
                            aria-label={t("finance.cash.remove")}
                            onClick={() => confirm(t("finance.cash.removeConfirm")) && api.deleteHandover(h.id).then(reload)}
                          />
                        </span>
                      }
                    />
                  ))}
                </List>
              )}
            </Card>

            {receiving && (
              <HandoverSheet
                person={receiving}
                today={d.today}
                onClose={() => setReceiving(null)}
                onSaved={() => {
                  setReceiving(null);
                  reload();
                }}
              />
            )}
          </div>
        );
      }}
    </AsyncBoundary>
  );
}

function HandoverSheet({ person, today, onClose, onSaved }) {
  const { t, fmt } = useI18n();
  const [amount, setAmount] = useState(String(Math.max(0, person.holding)));
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e) {
    e.preventDefault();
    if (!Number(amount)) return setError(t("payments.amountRequired"));
    setBusy(true);
    try {
      await api.addHandover({ userId: person.user.id, amount: Number(amount), date, note: note.trim() || null });
      onSaved();
    } catch {
      setError(t("finance.cash.failed"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet title={t("finance.cash.receiveFrom", { name: person.user.name })} onClose={onClose}>
      <form onSubmit={save} className={pageStyles.formStack}>
        <p className={pageStyles.note}>{t("finance.cash.holdingNow", { amount: fmt.money(person.holding) })}</p>
        <MoneyField label={t("finance.cash.amount")} value={amount} onChange={setAmount} />
        <TextField label={t("finance.cash.date")} type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
        <TextField label={t("finance.cash.note")} value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" variant="primary" busy={busy}>
            {t("finance.cash.save")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
