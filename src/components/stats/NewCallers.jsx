import { useState } from "react";
import styles from "./NewCallers.module.css";
import fieldStyles from "../ui/Field.module.css";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { saveFailed } from "../../lib/saveFailed";
import { useI18n } from "../../i18n";

// New callers the call center talked to who didn't book a consultation —
// one tap for why (services/callOutcomes.js): the price, only a question,
// another firm… Only new numbers (not clients, not callers from before),
// once per number, however many times they called. A booking takes a number
// off by itself. `employeeId`: one person's (managers); otherwise the
// person's own, or — managers — the whole call center's.
const SHOWN = 6;

export default function NewCallersCard({ employeeId, showEmployee = false }) {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.newCallers({ employeeId }), [employeeId]);
  // Just answered here: phoneKey -> { outcome, note } (shown as done, can be changed).
  const [answered, setAnswered] = useState({});
  const [writing, setWriting] = useState(null); // phoneKey whose "other" is being written
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(null);
  const [all, setAll] = useState(false);
  const data = state.data;
  if (!data?.asked) return null;
  const left = data.items.filter((r) => !answered[r.phoneKey]).length;
  const rows = all ? data.items : data.items.slice(0, SHOWN);

  async function save(phoneKey, outcome, text) {
    setBusy(phoneKey);
    try {
      await api.setCallOutcome(phoneKey, { outcome, note: text || null });
      setAnswered((a) => ({ ...a, [phoneKey]: { outcome, note: text || null } }));
      setWriting(null);
      setNote("");
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setBusy(null);
    }
  }

  async function undo(phoneKey) {
    setBusy(phoneKey);
    try {
      await api.setCallOutcome(phoneKey, { outcome: null });
      setAnswered(({ [phoneKey]: _, ...rest }) => rest);
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card flush title={t("newCallers.title")} subtitle={showEmployee ? t("newCallers.subtitleTeam") : t("newCallers.subtitle")} action={left > 0 && <span className={styles.count}>{left}</span>}>
      {data.items.length === 0 ? (
        <div className={styles.allDone}>
          <Icon name="checkCircle" size={18} />
          {t("newCallers.allDone")}
        </div>
      ) : (
        <ul className={styles.rows}>
          {rows.map((r) => {
            const done = answered[r.phoneKey];
            return (
              <li key={r.phoneKey} className={styles.row}>
                <div className={styles.head}>
                  <a className={styles.phone} href={`tel:${r.phone || r.phoneKey}`}>
                    <Icon name="phone" size={15} />
                    {fmt.phone(r.phone || r.phoneKey)}
                  </a>
                  <span className={styles.meta}>
                    {[showEmployee ? r.employee?.name : null, fmt.dateTime(r.lastAt), r.calls > 1 ? t("newCallers.calls", { n: r.calls }) : null].filter(Boolean).join(" · ")}
                  </span>
                </div>
                {done ? (
                  <div className={styles.done}>
                    <Icon name="check" size={15} />
                    <span>{done.outcome === "other" && done.note ? done.note : t(`newCallers.outcomes.${done.outcome}`)}</span>
                    <button type="button" className={styles.change} onClick={() => undo(r.phoneKey)} disabled={busy === r.phoneKey}>
                      {t("newCallers.change")}
                    </button>
                  </div>
                ) : writing === r.phoneKey ? (
                  <form
                    className={styles.other}
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (note.trim()) save(r.phoneKey, "other", note.trim());
                    }}
                  >
                    <input className={fieldStyles.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("newCallers.otherPh")} maxLength={300} autoFocus />
                    <Button type="submit" size="small" variant="primary" busy={busy === r.phoneKey} disabled={!note.trim()}>
                      {t("common.save")}
                    </Button>
                    <Button size="small" onClick={() => (setWriting(null), setNote(""))}>
                      {t("common.cancel")}
                    </Button>
                  </form>
                ) : (
                  <div className={fieldStyles.chips}>
                    {data.outcomes.map((o) => (
                      <button
                        key={o}
                        type="button"
                        className={fieldStyles.chip}
                        disabled={busy === r.phoneKey}
                        onClick={() => (o === "other" ? (setWriting(r.phoneKey), setNote("")) : save(r.phoneKey, o))}
                      >
                        {t(`newCallers.outcomes.${o}`)}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!all && data.items.length > SHOWN && (
        <button type="button" className={styles.more} onClick={() => setAll(true)}>
          {t("common.seeAll")} ({data.count})
          <Icon name="chevronDown" size={15} />
        </button>
      )}
      <p className={styles.note}>{t("newCallers.note")}</p>
    </Card>
  );
}
