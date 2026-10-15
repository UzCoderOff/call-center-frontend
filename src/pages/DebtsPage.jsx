import { useState } from "react";
import { Link } from "react-router-dom";
import styles from "../components/cases/Cases.module.css";
import pageStyles from "./Pages.module.css";
import Card from "../components/ui/Card";
import Sheet from "../components/ui/Sheet";
import Button from "../components/ui/Button";
import Segmented from "../components/ui/Segmented";
import { TextAreaField } from "../components/ui/Field";
import { AsyncBoundary, EmptyState, PageHeader } from "../components/ui/Misc";
import { useAuth } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { telHref } from "../lib/format";
import { canSeeFinance } from "../lib/access";
import { useI18n } from "../i18n";

// Who owes on the cases a coordinator looks after (Moliya: every case) —
// late first, then due soon, later, and debts with no schedule — each with a
// call button and a word about the call, which goes on the case's history
// (server: GET /api/client-cases/debts).

const GROUPS = ["overdue", "soon", "later", "unscheduled"];
const SPANS = [7, 14, 30];

export default function DebtsPage() {
  const { t } = useI18n();
  const [days, setDays] = useState(14);
  const state = useAsync(() => api.debts(days), [days]);
  const [noting, setNoting] = useState(null);
  return (
    <div>
      <PageHeader title={t("debts.title")} subtitle={t("debts.subtitle")} />
      <div style={{ marginBottom: 14 }}>
        <Segmented value={days} onChange={setDays} label={t("debts.soonWithin")} options={SPANS.map((d) => ({ value: d, label: t("debts.days", { days: d }) }))} />
      </div>
      <AsyncBoundary state={state}>
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState icon="checkCircle" text={t("debts.none")} />
          ) : (
            <DebtList data={data} onNote={setNoting} />
          )
        }
      </AsyncBoundary>
      {noting && <NoteSheet item={noting} onClose={() => setNoting(null)} onSaved={() => (setNoting(null), state.reload())} />}
    </div>
  );
}

export function DebtList({ data, onNote, limit = null }) {
  const { t, fmt } = useI18n();
  const { user } = useAuth();
  const everyone = canSeeFinance(user);
  return (
    <div className={pageStyles.stack}>
      {GROUPS.map((g) => {
        const rows = data.items.filter((d) => d.group === g);
        if (!rows.length) return null;
        const shown = limit ? rows.slice(0, limit) : rows;
        return (
          <Card key={g} title={t(`debts.groups.${g}`, { days: data.days })} subtitle={t("debts.count", { count: rows.length, amount: fmt.money(rows.reduce((s, d) => s + (g === "overdue" ? d.overdue : d.remaining), 0)) })}>
            <ul className={styles.rows}>
              {shown.map((d) => {
                const tel = telHref(d.client.phone);
                return (
                  <li key={d.caseId} className={styles.row}>
                    <span className={styles.rowMain}>
                      <Link to={`/clients/${d.client.id}?case=${d.caseId}&section=money`} className={styles.rowTitle}>
                        {d.client.name}
                      </Link>
                      <span className={styles.rowSub}>{[d.matter, everyone && d.coordinator ? t("debts.coordinator", { name: d.coordinator.name }) : null].filter(Boolean).join(" · ")}</span>
                      <span className={styles.rowText}>
                        {g === "overdue" && <strong className={styles.overdue}>{t("debts.late", { amount: fmt.money(d.overdue), date: fmt.isoDateLong(d.overdueSince) })} · </strong>}
                        {d.next && g !== "overdue" ? t("debts.next", { amount: fmt.money(d.next.left), date: fmt.isoDateLong(d.next.dueDate) }) + " · " : ""}
                        {t("debts.left", { amount: fmt.money(d.remaining), total: fmt.money(d.contractAmount) })}
                        {d.lastPaid ? ` · ${t("debts.lastPaid", { date: fmt.isoDateLong(d.lastPaid) })}` : ` · ${t("debts.neverPaid")}`}
                      </span>
                    </span>
                    <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {tel && (
                        <Button size="small" variant="primary" icon="phone" href={tel}>
                          {t("common.call")}
                        </Button>
                      )}
                      {onNote && (
                        <Button size="small" icon="note" onClick={() => onNote(d)}>
                          {t("debts.note")}
                        </Button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            {limit && rows.length > shown.length && (
              <Button size="small" variant="plain" to="/debts">
                {t("debts.more", { count: rows.length - shown.length })}
              </Button>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// What the client said about paying — on the case's history.
function NoteSheet({ item, onClose, onSaved }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (!text.trim()) return setError(t("entries.textRequired"));
    setBusy(true);
    try {
      await api.addEntry(item.client.id, { type: "call", caseId: item.caseId, text: text.trim(), with: item.client.name });
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(false);
    }
  }
  return (
    <Sheet title={t("debts.noteTitle", { name: item.client.name })} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <TextAreaField label={t("debts.noteLabel")} placeholder={t("debts.notePlaceholder")} value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus />
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" busy={busy} onClick={save}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
