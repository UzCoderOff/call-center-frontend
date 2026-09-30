import { useState } from "react";
import styles from "./Performance.module.css";
import pageStyles from "../../pages/Pages.module.css";
import Button from "../ui/Button";
import Sheet from "../ui/Sheet";
import { MoneyField, SelectField, TextField } from "../ui/Field";
import { AsyncBoundary } from "../ui/Misc";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";

// A measure's name and one-line explanation: the built-in ones (client
// work) from the texts; a report measure is a question of their daily form.
export function useMeasureText() {
  const { t } = useI18n();
  return (m) =>
    m.builtin || ["consultations", "contracts", "bookings", "calls_answered", "fees"].includes(m.key)
      ? { label: t(`perf.measure.${m.key}`), hint: t(`perf.measureHint.${m.key}`) }
      : { label: m.label, hint: t("perf.measureHint.report", { form: m.form || "—" }) };
}

export function useMeasureValue() {
  const { fmt } = useI18n();
  return (m, v) => (m.unit === "money" ? fmt.money(v) : fmt.number(v));
}

// "12 / 60" with a bar, where they should be by today, and what it means.
export function MeasureRow({ measure: m, compact = false }) {
  const { t } = useI18n();
  const text = useMeasureText()(m);
  const show = useMeasureValue();
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
      {m.target != null && (
        <span className={styles.measureTrack} aria-hidden="true">
          <span className={`${styles.measureFill} ${m.value >= m.target ? styles.measureDone : ""}`} style={{ width: `${Math.min(100, (m.value / Math.max(1, m.target)) * 100)}%` }} />
          {m.expected != null && m.expected < m.target && <span className={styles.measureTick} style={{ left: `${(m.expected / Math.max(1, m.target)) * 100}%` }} />}
        </span>
      )}
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

// Setting targets for one person: pick what to measure (their work), how
// much per month, from which month. Each entry holds until changed.
export function TargetSheet({ employeeId, month, onClose, onSaved }) {
  const { t, fmt } = useI18n();
  const [refresh, setRefresh] = useState(0);
  const state = useAsync(() => api.employeeTargets(employeeId, month), [employeeId, month, refresh]);
  const text = useMeasureText();
  const [metric, setMetric] = useState("");
  const [amount, setAmount] = useState("");
  const [fromMonth, setFromMonth] = useState(month);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    if (!metric) return setError(t("perf.target.pick"));
    if (amount === "" || Number.isNaN(Number(amount))) return setError(t("perf.target.amountNeeded"));
    setBusy(true);
    setError("");
    try {
      await api.setTarget(employeeId, { metric, amount: Number(amount), fromMonth });
      setMetric("");
      setAmount("");
      setRefresh((n) => n + 1);
      onSaved();
    } catch {
      setError(t("perf.target.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={t("perf.target.title")} onClose={onClose}>
      <AsyncBoundary state={state}>
        {(d) => {
          const byKey = new Map(d.catalog.map((c) => [c.key, c]));
          const nameOf = (key) => (byKey.has(key) ? text(byKey.get(key)).label : key);
          const unitOf = (key) => byKey.get(key)?.unit || "count";
          const groups = [
            { label: t("perf.target.clientGroup"), items: d.catalog.filter((c) => c.builtin) },
            ...[...new Set(d.catalog.filter((c) => !c.builtin).map((c) => c.form))].map((form) => ({ label: t("perf.target.formGroup", { form }), items: d.catalog.filter((c) => c.form === form) })),
          ].filter((g) => g.items.length);
          return (
            <div className={pageStyles.formStack}>
              <p className={pageStyles.note}>{t("perf.target.hint")}</p>
              {d.current.length > 0 && (
                <div className={styles.targetList}>
                  <strong>{t("perf.target.now", { month: d.month })}</strong>
                  {d.current.map((c) => (
                    <div key={c.metric} className={styles.targetRow}>
                      <span>{nameOf(c.metric)}</span>
                      <strong>{unitOf(c.metric) === "money" ? fmt.money(c.amount) : fmt.number(c.amount)}</strong>
                    </div>
                  ))}
                </div>
              )}
              {(d.position.consultations || d.position.contracts) && <p className={pageStyles.note}>{t("perf.target.positionNote", { consultations: d.position.consultations ?? "—", contracts: d.position.contracts ?? "—" })}</p>}
              {d.canSet &&
                (d.catalog.length === 0 ? (
                  <p className={pageStyles.note}>{t("perf.target.nothing")}</p>
                ) : (
                  <form onSubmit={save} className={pageStyles.formStack}>
                    <SelectField label={t("perf.target.what")} value={metric} onChange={(e) => setMetric(e.target.value)}>
                      <option value="">{t("perf.target.pick")}</option>
                      {groups.map((g) => (
                        <optgroup key={g.label} label={g.label}>
                          {g.items.map((c) => (
                            <option key={c.key} value={c.key}>
                              {text(c).label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </SelectField>
                    {metric && unitOf(metric) === "money" ? (
                      <MoneyField label={t("perf.target.perMonth")} value={amount} onChange={setAmount} />
                    ) : (
                      <TextField label={t("perf.target.perMonth")} type="number" min="0" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    )}
                    <TextField label={t("perf.target.fromMonth")} type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} />
                    <p className={pageStyles.note}>{t("perf.target.zeroNote")}</p>
                    {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
                    <div className={pageStyles.formActions}>
                      <Button onClick={onClose}>{t("common.close")}</Button>
                      <Button type="submit" variant="primary" busy={busy}>
                        {t("common.save")}
                      </Button>
                    </div>
                  </form>
                ))}
              {d.entries.length > 0 && (
                <div className={styles.targetList}>
                  <strong>{t("perf.target.history")}</strong>
                  {d.entries.map((en) => (
                    <div key={en.id} className={styles.targetRow}>
                      <span>
                        {nameOf(en.metric)} · {t("perf.cost.since", { month: en.fromMonth })}
                        {en.setBy ? <span className={styles.muted}> · {en.setBy}</span> : null}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <strong>{en.amount === 0 ? t("perf.target.none") : unitOf(en.metric) === "money" ? fmt.money(en.amount) : fmt.number(en.amount)}</strong>
                        {d.canSet && (
                          <Button
                            size="small"
                            variant="plain"
                            icon="trash"
                            aria-label={t("perf.cost.remove")}
                            onClick={() => api.deleteTarget(employeeId, en.id).then(() => (setRefresh((n) => n + 1), onSaved()))}
                          />
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }}
      </AsyncBoundary>
    </Sheet>
  );
}
