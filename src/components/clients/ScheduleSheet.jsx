import { useState } from "react";
import pageStyles from "../../pages/Pages.module.css";
import styles from "./Schedule.module.css";
import Sheet from "../ui/Sheet";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import { MoneyField, TextField } from "../ui/Field";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";

// A contract's payment schedule — what's due when (Moliya only). Fill it
// quickly (a first payment and N monthly ones on a chosen day, the rest split
// evenly) or row by row. Payments towards the contract cover the rows in date
// order; the client page and Moliya show each row as paid / overdue / ahead.

const today = () => new Date().toISOString().slice(0, 10);

// The same day each month (the 31st becomes the month's last day).
function monthly(startDate, count, day) {
  const [y, m] = startDate.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const last = new Date(Date.UTC(y, m - 1 + i + 1, 0)).getUTCDate();
    const d = new Date(Date.UTC(y, m - 1 + i, Math.min(day, last)));
    return d.toISOString().slice(0, 10);
  });
}

export default function ScheduleSheet({ item, onClose, onSaved }) {
  const { t, fmt } = useI18n();
  const [rows, setRows] = useState(() =>
    (item.schedule?.items || []).map((i) => ({ key: i.id, dueDate: i.dueDate, amount: String(i.amount) }))
  );
  // Quick fill
  const [first, setFirst] = useState("");
  const [firstDate, setFirstDate] = useState(today());
  const [count, setCount] = useState("6");
  const [startMonth, setStartMonth] = useState(() => {
    const d = new Date();
    return new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 1)).toISOString().slice(0, 7);
  });
  const [day, setDay] = useState("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const contract = item.contractAmount || 0;
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const diff = contract - total;

  function fill() {
    const n = Number(count);
    const firstAmount = Number(first) || 0;
    if (!n || n < 1 || n > 60) return setError(t("schedule.badCount"));
    const rest = Math.max(0, contract - firstAmount);
    // Even parts rounded to 1 000; the last one takes the remainder.
    const part = Math.floor(rest / n / 1000) * 1000;
    const dates = monthly(`${startMonth}-01`, n, Number(day) || 1);
    const next = [];
    if (firstAmount) next.push({ key: `f${Date.now()}`, dueDate: firstDate, amount: String(firstAmount) });
    dates.forEach((date, i) => next.push({ key: `m${i}${Date.now()}`, dueDate: date, amount: String(i === n - 1 ? rest - part * (n - 1) : part) }));
    setRows(next);
    setError("");
  }

  const setRow = (key, patch) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function save(items) {
    setBusy(true);
    setError("");
    try {
      await api.setInstallments(item.id, items);
      onSaved();
    } catch (err) {
      setError(t("schedule.failed", { reason: err.message || "?" }));
    } finally {
      setBusy(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    const items = rows.filter((r) => r.dueDate || r.amount).map((r) => ({ dueDate: r.dueDate, amount: Number(r.amount) }));
    if (items.some((i) => !i.dueDate || !i.amount)) return setError(t("schedule.incomplete"));
    save(items.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)));
  }

  return (
    <Sheet title={t("schedule.title")} onClose={onClose}>
      <form onSubmit={submit} className={pageStyles.formStack}>
        <p className={pageStyles.note}>{t("schedule.hint", { amount: fmt.money(contract) })}</p>

        <details className={styles.quick} open={rows.length === 0}>
          <summary>{t("schedule.quick")}</summary>
          <div className={styles.quickGrid}>
            <MoneyField label={t("schedule.first")} value={first} onChange={setFirst} />
            <TextField label={t("schedule.firstDate")} type="date" value={firstDate} onChange={(e) => setFirstDate(e.target.value)} />
            <TextField label={t("schedule.count")} type="number" min="1" max="60" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
            <TextField label={t("schedule.startMonth")} type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />
            <TextField label={t("schedule.day")} type="number" min="1" max="31" inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} />
          </div>
          <Button size="small" onClick={fill}>
            {t("schedule.fill")}
          </Button>
        </details>

        {rows.length > 0 && (
          <div className={styles.rows}>
            {rows.map((r, i) => (
              <div key={r.key} className={styles.row}>
                <span className={styles.n}>{i + 1}</span>
                <TextField label={t("schedule.date")} type="date" value={r.dueDate} onChange={(e) => setRow(r.key, { dueDate: e.target.value })} />
                <MoneyField label={t("schedule.amount")} value={r.amount} onChange={(v) => setRow(r.key, { amount: v })} />
                <Button size="small" variant="plain" icon="x" aria-label={t("schedule.removeRow")} onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))} />
              </div>
            ))}
          </div>
        )}
        <div>
          <Button size="small" icon="plus" onClick={() => setRows((list) => [...list, { key: `n${Date.now()}`, dueDate: "", amount: "" }])}>
            {t("schedule.addRow")}
          </Button>
        </div>

        <p className={styles.total}>
          {t("schedule.totalLine", { total: fmt.money(total), contract: fmt.money(contract) })}{" "}
          {diff === 0 ? (
            <Badge tone="good" icon="check">
              {t("schedule.matches")}
            </Badge>
          ) : (
            <Badge tone="warning">{diff > 0 ? t("schedule.short", { amount: fmt.money(diff) }) : t("schedule.over", { amount: fmt.money(-diff) })}</Badge>
          )}
        </p>

        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          {item.schedule?.items?.length > 0 && (
            <Button variant="destructive" onClick={() => confirm(t("schedule.clearConfirm")) && save([])}>
              {t("schedule.clear")}
            </Button>
          )}
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" variant="primary" busy={busy}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

// On the case card: each installment with where it stands.
const TONE = { paid: "good", overdue: "critical", due: "warning", upcoming: "neutral" };
export function ScheduleBlock({ schedule }) {
  const { t, fmt } = useI18n();
  if (!schedule?.items?.length) return null;
  return (
    <div className={styles.block}>
      <div className={styles.blockHead}>
        <strong>{t("schedule.title")}</strong>
        {schedule.overdue > 0 ? (
          <Badge tone="critical" icon="alertCircle">
            {t("schedule.overdueBadge", { amount: fmt.money(schedule.overdue) })}
          </Badge>
        ) : schedule.next ? (
          <span className={styles.nextLine}>{t("schedule.nextLine", { date: fmt.isoDateLong(schedule.next.dueDate), amount: fmt.money(schedule.next.left) })}</span>
        ) : null}
      </div>
      {schedule.items.map((i) => (
        <div key={i.id} className={styles.item}>
          <span>{fmt.isoDateLong(i.dueDate)}</span>
          <span className={styles.itemAmount}>
            {fmt.money(i.amount)}
            {i.paid > 0 && i.left > 0 ? <span className={styles.itemNote}>{t("schedule.partLeft", { amount: fmt.money(i.left) })}</span> : null}
          </span>
          <Badge tone={TONE[i.status]}>{t(`schedule.status.${i.status}`)}</Badge>
        </div>
      ))}
      {schedule.ahead > 0 && <p className={styles.nextLine}>{t("schedule.ahead", { amount: fmt.money(schedule.ahead) })}</p>}
    </div>
  );
}
