import { useState } from "react";
import pageStyles from "../../pages/Pages.module.css";
import styles from "./CallCenterRules.module.css";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Sheet from "../ui/Sheet";
import Icon from "../ui/Icon";
import { SelectField, Switch, TextField } from "../ui/Field";
import { List, ListRow, ListSectionHeader } from "../ui/List";
import { AsyncBoundary } from "../ui/Misc";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { saveFailed } from "../../lib/saveFailed";
import { useI18n } from "../../i18n";

// Settings → Claude (developer; backend services/ai/claude.js): the key from
// the Anthropic Console organization the Max plan's monthly API credit goes
// to (pasted here, kept encrypted, never shown again), which AI answers in
// the Ledger AI chat, the model, what Claude does (each off until switched
// on), the reports' script, a monthly cap, and what it cost this month.

const FEATURES = ["weeklyReport", "lostAnalysis", "suggestions", "fileReader", "summaryDraft", "tgReview", "practice"];
const JOBS = ["weeklyReport", "lostAnalysis", "suggestions"];
const usd = (n) => `$${(n || 0).toFixed(2)}`;

export function ClaudeSection() {
  const { t } = useI18n();
  const state = useAsync(() => api.aiSettings(), []);
  const [editing, setEditing] = useState(false);
  const [check, setCheck] = useState(null);
  const [running, setRunning] = useState(null);
  const [ran, setRan] = useState({});

  async function toggle(feature, on) {
    try {
      state.setData(await api.saveAiSettings({ claudeFeatures: { [feature]: on } }));
    } catch (err) {
      saveFailed(err, t);
    }
  }

  async function test() {
    setCheck({ busy: true });
    try {
      setCheck(await api.testClaude());
    } catch (err) {
      setCheck({ ok: false, error: err.code || "?" });
    }
  }

  async function run(job) {
    setRunning(job);
    try {
      const r = await api.runAiJob(job);
      setRan((x) => ({ ...x, [job]: r.created != null ? t("claude.ranSuggestions", { count: r.created }) : t("claude.ranReport") }));
    } catch (err) {
      setRan((x) => ({ ...x, [job]: t(`ai.errors.${err.code === "claude_cap" ? "claude_cap" : err.code === "claude_off" ? "claude_off" : "failed"}`) }));
    } finally {
      setRunning(null);
    }
  }

  return (
    <section>
      <ListSectionHeader>{t("claude.title")}</ListSectionHeader>
      <AsyncBoundary state={state}>
        {(data) => (
          <>
            <List inset={64}>
              <ListRow
                onClick={() => setEditing(true)}
                chevron
                leading={
                  <span className={styles.tile} style={{ background: "#d97757", color: "#fff" }}>
                    <Icon name="sparkles" size={18} />
                  </span>
                }
                title={data.hasClaudeKey ? t("claude.keySet", { last4: data.claudeKeyLast4 }) : t("claude.noKey")}
                subtitle={[data.claudeModel, t(`claude.provider.${data.provider || "openai"}`), t("claude.capLine", { used: usd(data.claudeUsage?.usd), cap: data.claudeMonthlyCapUsd ? usd(data.claudeMonthlyCapUsd) : "∞" })].join(" · ")}
                trailing={data.hasClaudeKey ? <Badge tone="good">{t("ai.ready")}</Badge> : null}
              />
              {data.hasClaudeKey && (
                <ListRow
                  leading={
                    <span className={styles.tile}>
                      <Icon name={check && !check.busy ? (check.ok ? "checkCircle" : "alertCircle") : "key"} size={18} />
                    </span>
                  }
                  title={check && !check.busy ? (check.ok ? (check.modelAvailable ? t("claude.testOk") : t("claude.testNoModel")) : t("claude.testFailed", { reason: check.message || check.error })) : t("ai.test")}
                  subtitle={check?.ok ? t("ai.models", { list: check.models.slice(0, 8).join(", ") || "—" }) : t("claude.testHint")}
                  trailing={
                    <Button size="small" variant="plain" busy={check?.busy} onClick={test}>
                      {t("ai.testButton")}
                    </Button>
                  }
                />
              )}
            </List>

            {data.hasClaudeKey && (
              <div className={pageStyles.formStack} style={{ marginTop: 12 }}>
                {FEATURES.map((f) => (
                  <Switch key={f} label={t(`claude.features.${f}`)} hint={t(`claude.featureHints.${f}`)} checked={Boolean(data.claudeFeatures?.[f])} onChange={(on) => toggle(f, on)} />
                ))}
                <div className={pageStyles.actionsRow} style={{ marginTop: 4 }}>
                  {JOBS.map((job) => (
                    <Button key={job} size="small" icon="sparkles" busy={running === job} disabled={Boolean(running)} onClick={() => run(job)}>
                      {t(`claude.runNow.${job}`)}
                    </Button>
                  ))}
                </div>
                {JOBS.filter((j) => ran[j]).map((j) => (
                  <p key={j} className={pageStyles.note}>
                    {t(`claude.runNow.${j}`)}: {ran[j]}
                  </p>
                ))}
                {Object.keys(data.claudeUsage?.byFeature || {}).length > 0 && (
                  <p className={pageStyles.note}>
                    {t("claude.usageMonth", { month: data.claudeUsage.month })}{" "}
                    {Object.entries(data.claudeUsage.byFeature)
                      .map(([f, x]) => `${t(`claude.usageNames.${f}`)}: ${usd(x.usd)} (${x.calls})`)
                      .join(" · ")}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </AsyncBoundary>
      <p className={styles.footnote}>{t("claude.hint")}</p>
      {editing && state.data && (
        <ClaudeSheet
          settings={state.data}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            setEditing(false);
            setCheck(null);
            state.setData(next);
          }}
        />
      )}
    </section>
  );
}

const MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];

function ClaudeSheet({ settings, onClose, onSaved }) {
  const { t } = useI18n();
  const [key, setKey] = useState("");
  const [provider, setProvider] = useState(settings.provider || "openai");
  const [model, setModel] = useState(settings.claudeModel || "claude-opus-5-5");
  const [script, setScript] = useState(settings.reportScript || "latin");
  const [cap, setCap] = useState(String(settings.claudeMonthlyCapUsd ?? 80));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(payload) {
    setBusy(true);
    setError("");
    try {
      onSaved(await api.saveAiSettings(payload));
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || err.message || "?" }));
      setBusy(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    const k = key.trim();
    if (k && !k.startsWith("sk-ant-")) return setError(t("claude.keyFormat"));
    if (provider === "claude" && !settings.hasClaudeKey && !k) return setError(t("claude.needKey"));
    save({ provider, claudeModel: model.trim(), reportScript: script, claudeMonthlyCapUsd: Number(cap) || 0, ...(k ? { claudeKey: k } : {}) });
  }

  return (
    <Sheet title={t("claude.title")} onClose={onClose}>
      <form className={pageStyles.formStack} onSubmit={submit} autoComplete="off">
        <TextField
          label={settings.hasClaudeKey ? t("ai.newKey") : t("claude.key")}
          hint={settings.hasClaudeKey ? t("ai.keyKeep", { last4: settings.claudeKeyLast4 }) : t("claude.keyHint")}
          type="password"
          autoComplete="new-password"
          spellCheck={false}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-ant-…"
        />
        <SelectField label={t("claude.chatProvider")} hint={t("claude.chatProviderHint")} value={provider} onChange={(e) => setProvider(e.target.value)}>
          <option value="openai">{t("claude.provider.openai")}</option>
          <option value="claude">{t("claude.provider.claude")}</option>
        </SelectField>
        <TextField label={t("claude.model")} hint={t("claude.modelHint")} list="claude-models" value={model} onChange={(e) => setModel(e.target.value)} spellCheck={false} />
        <datalist id="claude-models">
          {MODELS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <SelectField label={t("claude.script")} value={script} onChange={(e) => setScript(e.target.value)}>
          <option value="latin">{t("claude.scripts.latin")}</option>
          <option value="cyrillic">{t("claude.scripts.cyrillic")}</option>
        </SelectField>
        <TextField label={t("claude.cap")} hint={t("claude.capHint")} type="number" min={0} max={10000} step="0.01" value={cap} onChange={(e) => setCap(e.target.value)} />
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          {settings.hasClaudeKey && (
            <Button variant="plain" disabled={busy} onClick={() => window.confirm(t("claude.removeKeyConfirm")) && save({ claudeKey: "", provider: "openai" })}>
              {t("ai.removeKey")}
            </Button>
          )}
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" type="submit" busy={busy}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
