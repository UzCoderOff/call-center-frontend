import { useEffect, useState } from "react";
import styles from "./Performance.module.css";
import pageStyles from "../../pages/Pages.module.css";
import Button from "../ui/Button";
import Sheet from "../ui/Sheet";
import { TextField } from "../ui/Field";
import { AsyncBoundary } from "../ui/Misc";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";

const BUILTIN = ["consultations", "contracts", "bookings", "calls_answered", "fees", "income", "collected", "cases"];

// A measure's name and one-line explanation: the built-in ones (client
// work, all income) from the texts; a report measure is a question of their
// daily form.
export function useMeasureText() {
  const { t } = useI18n();
  return (m) =>
    m.builtin || BUILTIN.includes(m.key)
      ? { label: t(`perf.measure.${m.key}`), hint: t(`perf.measureHint.${m.key}`) }
      : { label: m.label, hint: t("perf.measureHint.report", { form: m.form || "—" }) };
}

export function useMeasureValue() {
  const { fmt } = useI18n();
  return (m, v) => (m.unit === "money" ? fmt.money(v) : fmt.number(v));
}

// "12 / 60" with a bar, where they should be by today, and what it means.
// All income without Moliya comes as percent only (no soʻm): "64%".
export function MeasureRow({ measure: m, compact = false }) {
  const { t } = useI18n();
  const text = useMeasureText()(m);
  const show = useMeasureValue();
  if (m.hidden) return <HiddenMeasureRow measure={m} text={text} compact={compact} />;
  const behind = m.target != null && m.expected != null ? m.value - m.expected : null;
  return (
    <div className={styles.measure}>
      <div className={styles.measureHead}>
        <span className={styles.measureLabel}>{text.label}</span>
        <span className={styles.measureValue}>
          <strong>{show(m, m.value)}</strong>
          {m.target != null && <span className={styles.muted}> / {show(m, m.target)}</span>}
        </span>
      </div>
      {m.target != null && <Track pct={(m.value / Math.max(1, m.target)) * 100} expectedPct={m.expected != null && m.expected < m.target ? (m.expected / Math.max(1, m.target)) * 100 : null} />}
      <span className={styles.measureNote}>
        {m.target != null
          ? behind >= 0
            ? t("perf.onTrack", { expected: show(m, m.expected) })
            : t("perf.behindBy", { expected: show(m, m.expected), n: show(m, -behind) })
          : compact
            ? t("perf.noTarget")
            : text.hint}
      </span>
      {!compact && m.target != null && <span className={styles.measureNote}>{text.hint}</span>}
    </div>
  );
}

function HiddenMeasureRow({ measure: m, text, compact }) {
  const { t } = useI18n();
  const pct = m.pct ?? 0;
  return (
    <div className={styles.measure}>
      <div className={styles.measureHead}>
        <span className={styles.measureLabel}>{text.label}</span>
        <span className={styles.measureValue}>{m.hasTarget ? <strong>{t("perf.pctDone", { pct })}</strong> : <span className={styles.muted}>—</span>}</span>
      </div>
      {m.hasTarget && <Track pct={pct} expectedPct={m.expectedPct != null && m.expectedPct < 100 ? m.expectedPct : null} />}
      <span className={styles.measureNote}>
        {m.hasTarget ? (pct >= (m.expectedPct ?? 0) ? t("perf.onTrackPct", { expected: m.expectedPct ?? 0 }) : t("perf.behindPct", { expected: m.expectedPct ?? 0 })) : t("perf.noTarget")}
      </span>
      {!compact && <span className={styles.measureNote}>{t("perf.measureHint.incomeHidden")}</span>}
    </div>
  );
}

function Track({ pct, expectedPct }) {
  return (
    <span className={styles.measureTrack} aria-hidden="true">
      <span className={`${styles.measureFill} ${pct >= 100 ? styles.measureDone : ""}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      {expectedPct != null && <span className={styles.measureTick} style={{ left: `${expectedPct}%` }} />}
    </span>
  );
}

const digitsOnly = (v) => String(v ?? "").replace(/\D/g, "");
const grouped = (v) => digitsOnly(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

// Setting someone's plan: everything they can be measured on in one list —
// type how much per month next to each, leave empty for none, save once.
// From the chosen month until changed. The person gets a Telegram message.
export function TargetSheet({ employeeId, name, month, onClose, onSaved }) {
  const { t, fmt } = useI18n();
  const [fromMonth, setFromMonth] = useState(month);
  const [refresh, setRefresh] = useState(0);
  const state = useAsync(() => api.employeeTargets(employeeId, /^\d{4}-\d{2}$/.test(fromMonth) ? fromMonth : month), [employeeId, fromMonth, refresh]);
  const text = useMeasureText();
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // The month's targets as the starting values.
  const d = state.data;
  useEffect(() => {
    if (!d) return;
    setValues(Object.fromEntries(d.current.filter((c) => !c.hidden).map((c) => [c.metric, String(c.amount)])));
  }, [d]);

  async function save(e) {
    e.preventDefault();
    if (!/^\d{4}-\d{2}$/.test(fromMonth)) return setError(t("perf.cost.badMonth"));
    const before = new Map(d.current.filter((c) => !c.hidden).map((c) => [c.metric, c.amount]));
    const changes = d.catalog
      .map((c) => {
        const typed = digitsOnly(values[c.key]);
        const had = before.get(c.key);
        if (typed === "") return had ? { metric: c.key, amount: 0 } : null; // cleared: no target from now
        const amount = Number(typed);
        return amount === had ? null : { metric: c.key, amount };
      })
      .filter(Boolean);
    if (changes.length === 0) return onClose();
    setBusy(true);
    setError("");
    try {
      await api.setTargets(employeeId, { fromMonth, targets: changes });
      setSaved(true);
      setRefresh((n) => n + 1);
      onSaved();
    } catch {
      setError(t("perf.target.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={name ? t("perf.target.titleFor", { name }) : t("perf.target.title")} onClose={onClose}>
      <form onSubmit={save} className={pageStyles.formStack}>
        <TextField label={t("perf.target.fromMonth")} type="month" value={fromMonth} onChange={(e) => (setFromMonth(e.target.value), setSaved(false))} />
        <p className={pageStyles.note}>{t("perf.target.hintList")}</p>
        <AsyncBoundary state={state}>
          {(data) => {
            if (!data.canSet) return null;
            if (data.catalog.length === 0) return <p className={pageStyles.note}>{t("perf.target.nothing")}</p>;
            const groups = [
              { key: "money", label: t("perf.target.moneyGroup"), items: data.catalog.filter((c) => c.key === "income") },
              { key: "coordinator", label: t("perf.target.coordinatorGroup"), items: data.catalog.filter((c) => c.key === "collected" || c.key === "cases") },
              { key: "client", label: t("perf.target.clientGroup"), items: data.catalog.filter((c) => c.builtin && !["income", "collected", "cases"].includes(c.key)) },
              ...[...new Set(data.catalog.filter((c) => !c.builtin).map((c) => c.form))].map((form) => ({ key: `form:${form}`, label: t("perf.target.formGroup", { form }), items: data.catalog.filter((c) => !c.builtin && c.form === form) })),
            ].filter((g) => g.items.length);
            const hiddenIncome = data.current.some((c) => c.hidden);
            return (
              <div className={styles.planGroups}>
                {groups.map((g) => (
                  <fieldset key={g.key} className={styles.planGroup}>
                    <legend className={styles.planGroupTitle}>{g.label}</legend>
                    {g.items.map((c) => {
                      const money = c.unit === "money";
                      const label = text(c);
                      return (
                        <label key={c.key} className={styles.planRow}>
                          <span className={styles.planText}>
                            <span className={styles.planLabel}>{label.label}</span>
                            <span className={styles.planHint}>{c.key === "income" ? t("perf.target.incomeHint") : label.hint}</span>
                          </span>
                          <span className={styles.planInput}>
                            <input
                              className={styles.planField}
                              inputMode="numeric"
                              placeholder={t("perf.target.noneShort")}
                              value={money ? grouped(values[c.key]) : digitsOnly(values[c.key])}
                              onChange={(e) => (setValues((v) => ({ ...v, [c.key]: digitsOnly(e.target.value) })), setSaved(false))}
                              aria-label={label.label}
                            />
                            <span className={styles.planUnit}>{money ? t("reports.soum") : t("perf.target.perMonthShort")}</span>
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                ))}
                {hiddenIncome && <p className={pageStyles.note}>{t("perf.target.incomeHiddenNote")}</p>}
                {(data.position.consultations || data.position.contracts) && <p className={pageStyles.note}>{t("perf.target.positionNote", { consultations: data.position.consultations ?? "—", contracts: data.position.contracts ?? "—" })}</p>}
              </div>
            );
          }}
        </AsyncBoundary>
        <p className={pageStyles.note}>{t("perf.target.tellsThem")}</p>
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        {saved && !error && <p className={`${pageStyles.message} ${pageStyles.messageSuccess}`}>{t("perf.target.saved")}</p>}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.close")}</Button>
          <Button type="submit" variant="primary" busy={busy} disabled={!d?.canSet}>
            {t("common.save")}
          </Button>
        </div>
      </form>
      {d && d.entries.length > 0 && (
        <details className={styles.planHistory}>
          <summary>{t("perf.target.history")}</summary>
          <div className={styles.targetList}>
            {d.entries.map((en) => {
              const c = d.catalog.find((x) => x.key === en.metric);
              const label = c ? text(c).label : BUILTIN.includes(en.metric) ? t(`perf.measure.${en.metric}`) : en.metric;
              const money = c ? c.unit === "money" : ["fees", "income", "collected"].includes(en.metric);
              return (
                <div key={en.id} className={styles.targetRow}>
                  <span>
                    {label} · {t("perf.cost.since", { month: en.fromMonth })}
                    {en.setBy ? <span className={styles.muted}> · {en.setBy}</span> : null}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <strong>{en.hidden ? "•••" : en.amount === 0 ? t("perf.target.none") : money ? fmt.money(en.amount) : fmt.number(en.amount)}</strong>
                    {d.canSet && !en.hidden && (
                      <Button size="small" variant="plain" icon="trash" aria-label={t("perf.cost.remove")} onClick={() => api.deleteTarget(employeeId, en.id).then(() => (setRefresh((n) => n + 1), onSaved()))} />
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </Sheet>
  );
}
