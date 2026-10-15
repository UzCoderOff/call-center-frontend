import { useState } from "react";
import styles from "./Finance.module.css";
import pageStyles from "../../pages/Pages.module.css";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Sheet from "../ui/Sheet";
import { MoneyField, SelectField, TextField } from "../ui/Field";
import { List, ListRow } from "../ui/List";
import { AsyncBoundary, EmptyState, StatTile } from "../ui/Misc";
import { Table } from "./parts";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";
import { Link } from "react-router-dom";

// Moliya → Kassa: cash in people's hands. A cash payment is with whoever took
// the money (picked when it's recorded; else whoever recorded it) — "Kimda?"
// shows a person's cash payments and moves a wrong one to whoever really
// took it. "Qabul qildim" records them handing it over. What they hold =
// cash with them − handed over (counted from the day this started).
export default function FinanceCash() {
  const { t, fmt } = useI18n();
  const [refresh, setRefresh] = useState(0);
  const state = useAsync(() => api.cash(), [refresh]);
  const [receiving, setReceiving] = useState(null); // a person row
  const [looking, setLooking] = useState(null); // a person row: their cash payments
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
                  <span key="r" style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
                    {p.payments > 0 && (
                      <Button size="small" onClick={() => setLooking(p)}>
                        {t("finance.cash.whose")}
                      </Button>
                    )}
                    {p.holding > 0 && (
                      <Button size="small" variant="primary" onClick={() => setReceiving(p)}>
                        {t("finance.cash.receive")}
                      </Button>
                    )}
                  </span>,
                ])}
              />
            </Card>

            {d.kassa?.length > 0 && (
              <Card flush title={t("finance.cash.kassaTitle")} subtitle={t("finance.cash.kassaHint")}>
                <List plain inset={16}>
                  {d.kassa.map((p) => (
                    <ListRow
                      key={p.user.id}
                      title={p.user.name}
                      subtitle={t("finance.paymentsCount", { count: p.payments })}
                      trailing={
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <strong>{fmt.money(p.taken)}</strong>
                          <Button size="small" onClick={() => setLooking(p)}>
                            {t("finance.cash.whose")}
                          </Button>
                        </span>
                      }
                    />
                  ))}
                </List>
              </Card>
            )}

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

            {looking && <CashPaymentsSheet person={looking} onClose={() => setLooking(null)} onChanged={reload} />}
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

// One person's cash payments: each one, and who has the money — moved to
// whoever really took it (the client paid the boss or the lawyer in the
// office, not the operator who recorded it).
function CashPaymentsSheet({ person, onClose, onChanged }) {
  const { t, fmt } = useI18n();
  const [refresh, setRefresh] = useState(0);
  const state = useAsync(() => api.cashPayments(person.user.id), [refresh]);
  const people = useAsync(() => api.cashHolders(true), []);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  async function move(payment, to) {
    setBusy(payment.id);
    setError("");
    try {
      await api.moveCashPayment(payment.id, Number(to));
      setRefresh((n) => n + 1);
      onChanged();
    } catch {
      setError(t("finance.cash.failed"));
    } finally {
      setBusy(null);
    }
  }
  return (
    <Sheet title={t("finance.cash.whoseTitle", { name: person.user.name })} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <p className={pageStyles.note}>{t("finance.cash.whoseHint")}</p>
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <AsyncBoundary state={state}>
          {(d) =>
            d.payments.length === 0 ? (
              <EmptyState icon="cash" text={t("finance.cash.whoseEmpty")} />
            ) : (
              <div>
                {d.payments.map((p) => {
                  const options = people.data?.people || [];
                  const known = options.some((o) => o.id === p.holder.id);
                  return (
                    <div key={p.id} className={styles.cashPayment}>
                      <div className={styles.cashPaymentTop}>
                        <Link to={`/clients/${p.client.id}`}>{p.client.name}</Link>
                        <strong>{fmt.money(p.amount)}</strong>
                      </div>
                      <span className={pageStyles.note}>
                        {[fmt.isoDateLong(p.date), t(`payments.kinds.${p.kind}`), p.recordedBy ? t("finance.recordedBy", { name: p.recordedBy.name }) : null, p.note]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <SelectField label={t("finance.cash.with")} value={String(p.holder.id)} disabled={busy === p.id || !people.data} onChange={(e) => move(p, e.target.value)}>
                        {!known && <option value={p.holder.id}>{p.holder.name}</option>}
                        {options.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                            {o.role === "BOSS" ? ` (${t("cashWith.boss")})` : o.role === "LAWYER" ? ` (${t("cashWith.lawyer")})` : ""}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                  );
                })}
              </div>
            )
          }
        </AsyncBoundary>
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.close")}</Button>
        </div>
      </div>
    </Sheet>
  );
}
