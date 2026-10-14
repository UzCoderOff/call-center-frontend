import { useEffect, useState } from "react";
import Card from "../ui/Card";
import Sheet from "../ui/Sheet";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Icon from "../ui/Icon";
import { List, ListRow } from "../ui/List";
import { SelectField, TextAreaField } from "../ui/Field";
import { Banner } from "../ui/Misc";
import pageStyles from "../../pages/Pages.module.css";
import styles from "./Ai.module.css";
import { personName } from "../clients/parts";
import { api } from "../../lib/api";
import { saveFailed } from "../../lib/saveFailed";
import { readPref, writePref } from "../../lib/prefs";
import { useI18n } from "../../i18n";

// Ledger AI on Claude in the portal (backend: services/ai/*): which features
// are on, a client file read by Claude, the suggestions about clients, and
// the consultation summary drafted from rough notes. Each only shows when
// the developer switched it on (Sozlamalar → Sunʼiy intellekt).

// ------------------------------------------------------------ which are on
let featuresCache = null;
let featuresAt = 0;
export function useAiFeatures() {
  const [features, setFeatures] = useState(featuresCache || {});
  useEffect(() => {
    if (featuresCache && Date.now() - featuresAt < 5 * 60 * 1000) return;
    let live = true;
    api
      .aiFeatures()
      .then((f) => {
        featuresCache = f;
        featuresAt = Date.now();
        if (live) setFeatures(f);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return features;
}

const READABLE = /\.(pdf|docx|txt|jpe?g|png|webp|gif)$/i;
export const aiCanRead = (file) => READABLE.test(file?.name || "");

const errorText = (code, t) => t(`ai.errors.${["ai_off", "claude_off", "claude_cap", "daily_limit", "unsupported", "too_large", "file_missing", "declined", "unreadable", "notes_required", "no_draft"].includes(code) ? code : "failed"}`);

const clock = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// ------------------------------------------------------------ a file read by Claude
// What's in it — and each part offered to the case: the details text, the
// dates (one tap each), the stage. Nothing goes on the case by itself.
export function FileReadingSheet({ file, client, onClose, onChanged }) {
  const { t, fmt } = useI18n();
  const [reading, setReading] = useState(file.aiAnalysis || null);
  const [busy, setBusy] = useState(!file.aiAnalysis);
  const [error, setError] = useState("");
  const [added, setAdded] = useState({});
  const workable = client.cases.filter((k) => k.permissions && k.permissions.role !== "result");
  const [caseId, setCaseId] = useState(String(file.caseId ?? (workable.length === 1 ? workable[0].id : "")));
  const kase = workable.find((k) => String(k.id) === caseId) || null;
  const p = kase?.permissions || {};

  async function read(again = false) {
    setBusy(true);
    setError("");
    try {
      setReading(await api.analyzeFile(file.id, again));
    } catch (err) {
      setError(errorText(err.code, t));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!file.aiAnalysis) read(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id]);

  async function apply(key, action) {
    setAdded((a) => ({ ...a, [key]: "busy" }));
    try {
      await action();
      setAdded((a) => ({ ...a, [key]: "done" }));
    } catch (err) {
      setAdded((a) => ({ ...a, [key]: null }));
      saveFailed(err, t);
    }
  }

  const close = () => {
    if (Object.values(added).includes("done")) onChanged();
    onClose();
  };

  return (
    <Sheet title={t("ai.fileTitle", { name: file.title || file.name })} onClose={close}>
      <div className={pageStyles.formStack}>
        {busy && (
          <Banner icon="sparkles">
            <strong>{t("ai.reading")}</strong>
            <div className={pageStyles.bannerDetail}>{t("ai.readingHint")}</div>
          </Banner>
        )}
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        {reading && !busy && (
          <>
            <div>
              <Badge tone="accent" icon="sparkles">
                {reading.documentType || t("ai.document")}
              </Badge>
            </div>
            <p className={styles.text}>{reading.summary}</p>

            {workable.length > 1 && !file.caseId && (
              <SelectField label={t("ai.toCase")} value={caseId} onChange={(e) => setCaseId(e.target.value)}>
                <option value="">{t("ai.pickCase")}</option>
                {workable.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.matter || t("cases.untitled")}
                  </option>
                ))}
              </SelectField>
            )}

            {reading.details && (
              <section className={styles.part}>
                <h4 className={styles.partTitle}>{t("cases.details")}</h4>
                <p className={styles.text}>{reading.details}</p>
                {kase && p.canEdit && (
                  <ApplyButton state={added.details} label={kase.details ? t("ai.appendDetails") : t("ai.writeDetails")}
                    onClick={() => apply("details", () => api.updateCase(kase.id, { details: kase.details ? `${kase.details}\n\n${reading.details}` : reading.details }))} />
                )}
              </section>
            )}

            {reading.keyDates?.length > 0 && (
              <section className={styles.part}>
                <h4 className={styles.partTitle}>{t("ai.datesFound")}</h4>
                <ul className={styles.items}>
                  {reading.keyDates.map((d, i) => (
                    <li key={i} className={styles.item}>
                      <span>
                        <strong>{d.title || t(`caseWork.kinds.${d.kind}`)}</strong>
                        <span className={styles.muted}> — {[fmt.isoDateLong(d.date), d.time, t(`caseWork.kinds.${d.kind}`), d.place].filter(Boolean).join(" · ")}</span>
                      </span>
                      {kase && p.canDates && (
                        <ApplyButton state={added[`d${i}`]} label={t("ai.addDate")}
                          onClick={() => apply(`d${i}`, () => api.addKeyDate(kase.id, { kind: d.kind, date: d.date, time: clock(d.time), title: d.title || null, place: d.place || null }))} />
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {reading.stage && (
              <section className={styles.part}>
                <h4 className={styles.partTitle}>{t("ai.stageFound")}</h4>
                <div className={styles.item}>
                  <span>
                    {t(`cases.stages.${reading.stage.stage}`)} <span className={styles.muted}>— {fmt.isoDateLong(reading.stage.date)}</span>
                  </span>
                  {kase && p.canHistory && (
                    <ApplyButton state={added.stage} label={t("ai.addStage")} onClick={() => apply("stage", () => api.addStage(kase.id, { stage: reading.stage.stage, date: reading.stage.date }))} />
                  )}
                </div>
              </section>
            )}

            {reading.parties?.length > 0 && (
              <section className={styles.part}>
                <h4 className={styles.partTitle}>{t("ai.parties")}</h4>
                <ul className={styles.items}>
                  {reading.parties.map((x, i) => (
                    <li key={i}>
                      {x.name} <span className={styles.muted}>— {x.role}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {reading.risks?.length > 0 && <Bullets title={t("ai.risks")} rows={reading.risks} />}
            {reading.nextSteps?.length > 0 && <Bullets title={t("ai.nextSteps")} rows={reading.nextSteps} />}

            {!kase && <p className={pageStyles.note}>{t("ai.noCaseHint")}</p>}
            <p className={pageStyles.note}>{t("ai.checkIt")}</p>
          </>
        )}
        <div className={pageStyles.formActions}>
          {reading && !busy && (
            <Button variant="plain" icon="refresh" onClick={() => read(true)}>
              {t("ai.readAgain")}
            </Button>
          )}
          <Button variant="primary" onClick={close}>
            {t("ai.close")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function Bullets({ title, rows }) {
  return (
    <section className={styles.part}>
      <h4 className={styles.partTitle}>{title}</h4>
      <ul className={styles.bullets}>
        {rows.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </section>
  );
}

function ApplyButton({ state, label, onClick }) {
  const { t } = useI18n();
  if (state === "done") {
    return (
      <Badge tone="good" icon="check">
        {t("ai.added")}
      </Badge>
    );
  }
  return (
    <Button size="small" icon="plus" busy={state === "busy"} onClick={onClick}>
      {label}
    </Button>
  );
}

// ------------------------------------------------------------ suggestions
// What Ledger AI suggests doing about clients — mine (team: managers,
// everyone's). Done or not needed: one tap.
const PRIORITY_TONE = { 1: "critical", 2: "warning", 3: "neutral" };

export function AiSuggestionsCard({ team = false }) {
  const { t } = useI18n();
  const features = useAiFeatures();
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  // Folded away with one tap (its title); remembered on this device.
  const [open, setOpen] = useState(() => readPref("aiSuggestionsOpen", "1") !== "0");
  function toggle() {
    writePref("aiSuggestionsOpen", open ? "0" : "1");
    setOpen(!open);
  }

  const load = () =>
    api
      .aiSuggestions(team ? "team" : "mine")
      .then(setRows)
      .catch(() => setRows([]));
  useEffect(() => {
    if (features.suggestions) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features.suggestions, team]);

  async function mark(row, payload) {
    setRows((all) => all.filter((r) => r.id !== row.id));
    try {
      await api.updateAiSuggestion(row.id, payload);
    } catch (err) {
      saveFailed(err, t);
      load();
    }
  }

  async function runNow() {
    setBusy(true);
    try {
      await api.runAiSuggestions();
      await load();
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setBusy(false);
    }
  }

  if (!features.suggestions || rows === null) return null;
  if (rows.length === 0 && !team) return null;
  // Folded: how many of each priority, on one line.
  const byPriority = [1, 2, 3].map((p) => [p, rows.filter((r) => r.priority === p).length]).filter(([, n]) => n > 0);
  return (
    <Card
      flush
      title={
        <button type="button" className={styles.foldTitle} onClick={toggle} aria-expanded={open}>
          <Icon name={open ? "chevronDown" : "chevronRight"} size={18} />
          {t(team ? "ai.suggestionsTeam" : "ai.suggestionsMine", { count: rows.length })}
        </button>
      }
      subtitle={open ? t("ai.suggestionsHint") : byPriority.map(([p, n]) => `${t(`ai.priority.${p}`)}: ${n}`).join(" · ") || undefined}
      action={
        team &&
        open && (
          <Button size="small" variant="plain" icon="refresh" busy={busy} onClick={runNow}>
            {t("ai.refreshSuggestions")}
          </Button>
        )
      }
    >
      {!open ? null : rows.length === 0 ? (
        <p className={pageStyles.note} style={{ padding: "0 16px 16px" }}>
          {t("ai.noSuggestions")}
        </p>
      ) : (
        <List>
          {rows.slice(0, 12).map((r) => (
            <ListRow
              key={r.id}
              to={r.client ? `/clients/${r.client.id}` : undefined}
              leading={<Badge tone={PRIORITY_TONE[r.priority] || "neutral"}>{t(`ai.priority.${r.priority}`)}</Badge>}
              title={r.text}
              subtitle={[r.why, team && r.forUser ? t("ai.forPerson", { name: personName(r.forUser) }) : null].filter(Boolean).join(" · ")}
              actions={
                <span className={styles.rowActions}>
                  <button type="button" className={styles.iconButton} onClick={() => mark(r, { done: true })} aria-label={t("ai.markDone")} title={t("ai.markDone")}>
                    <Icon name="check" size={16} />
                  </button>
                  <button type="button" className={styles.iconButton} onClick={() => mark(r, { dismissed: true })} aria-label={t("ai.dismiss")} title={t("ai.dismiss")}>
                    <Icon name="x" size={16} />
                  </button>
                </span>
              }
            />
          ))}
        </List>
      )}
    </Card>
  );
}

// ------------------------------------------------------------ summary draft
// A few rough lines -> the summary's fields, for the specialist to check.
export function SummaryDraftBox({ appointmentId, onDraft }) {
  const { t } = useI18n();
  const features = useAiFeatures();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!features.summaryDraft) return null;

  async function draft() {
    if (notes.trim().length < 5) return setError(t("ai.errors.notes_required"));
    setBusy(true);
    setError("");
    try {
      onDraft(await api.summaryDraft(appointmentId, notes.trim()));
    } catch (err) {
      setError(errorText(err.code, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.draftBox}>
      <TextAreaField label={t("ai.draftLabel")} placeholder={t("ai.draftPh")} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      <div className={styles.draftRow}>
        <Button icon="sparkles" busy={busy} onClick={draft}>
          {t("ai.draftButton")}
        </Button>
        <span className={styles.muted}>{t("ai.draftHint")}</span>
      </div>
      {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
    </div>
  );
}
