import { useState } from "react";
import pageStyles from "../../pages/Pages.module.css";
import styles from "./CallCenterRules.module.css";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Sheet from "../ui/Sheet";
import Icon from "../ui/Icon";
import { Switch, TextField } from "../ui/Field";
import { List, ListRow, ListSectionHeader } from "../ui/List";
import { AsyncBoundary } from "../ui/Misc";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";

// Settings → Ledger AI (developer; backend routes/ai.js): the OpenAI key —
// pasted here, never sent in a chat, kept encrypted, never shown again (only
// its last 4 characters) — the model, how many questions a person may ask a
// day, and what it has used this month.
export function AiSection() {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.aiSettings(), []);
  const [editing, setEditing] = useState(false);
  const [check, setCheck] = useState(null); // { busy } | result of /ai/test

  async function test() {
    setCheck({ busy: true });
    try {
      setCheck(await api.testAi());
    } catch (err) {
      setCheck({ ok: false, error: err.code || "?" });
    }
  }

  const checkText = (c) => {
    if (c.ok) return c.modelAvailable ? t("ai.testOk") : t("ai.testNoModel");
    if (c.error === "no_key") return t("ai.noKey");
    if (c.error === "bad_key") return t("ai.badKey");
    return t("ai.testFailed", { reason: c.message || c.error });
  };

  return (
    <section>
      <ListSectionHeader>{t("ai.title")}</ListSectionHeader>
      <AsyncBoundary state={state}>
        {(data) => (
          <List inset={64}>
            <ListRow
              onClick={() => setEditing(true)}
              chevron
              leading={
                <span className={styles.tile} style={{ background: "linear-gradient(135deg, #7c5cff, #4ab4e0)", color: "#fff" }}>
                  <Icon name="sparkles" size={18} />
                </span>
              }
              title={!data.hasKey ? t("ai.noKey") : data.enabled ? t("ai.on") : t("ai.off")}
              subtitle={[data.model, data.hasKey ? t("ai.keyEnds", { last4: data.keyLast4 }) : null, t("ai.perDay", { count: data.dailyLimit })].filter(Boolean).join(" · ")}
              trailing={data.hasKey && data.enabled ? <Badge tone="good">{t("ai.ready")}</Badge> : null}
            />
            <ListRow
              leading={
                <span className={styles.tile}>
                  <Icon name="barChart" size={18} />
                </span>
              }
              title={t("ai.usage")}
              subtitle={t("ai.usageLine", {
                questions: fmt.number(data.usage.questions),
                input: fmt.number(data.usage.input),
                output: fmt.number(data.usage.output),
              })}
            />
            {data.hasKey && (
              <ListRow
                leading={
                  <span className={styles.tile}>
                    <Icon name={check && !check.busy ? (check.ok ? "checkCircle" : "alertCircle") : "key"} size={18} />
                  </span>
                }
                title={check && !check.busy ? checkText(check) : t("ai.test")}
                subtitle={check?.ok ? t("ai.models", { list: check.models.slice(0, 12).join(", ") || "—" }) : t("ai.testHint")}
                trailing={
                  <Button size="small" variant="plain" busy={check?.busy} onClick={test}>
                    {t("ai.testButton")}
                  </Button>
                }
              />
            )}
          </List>
        )}
      </AsyncBoundary>
      <p className={styles.footnote}>{t("ai.hint")}</p>
      {editing && state.data && (
        <AiSettingsSheet
          settings={state.data}
          models={check?.ok ? check.models : []}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setCheck(null);
            state.reload();
          }}
        />
      )}
    </section>
  );
}

const SUGGESTED = ["gpt-5-mini", "gpt-5", "gpt-4.1-mini", "gpt-4.1"];

function AiSettingsSheet({ settings, models, onClose, onSaved }) {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(Boolean(settings.enabled));
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(settings.model || "gpt-5-mini");
  const [dailyLimit, setDailyLimit] = useState(String(settings.dailyLimit || 60));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(payload) {
    setBusy(true);
    setError("");
    try {
      await api.saveAiSettings(payload);
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || err.message || "?" }));
      setBusy(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    const key = apiKey.trim();
    if (key && !key.startsWith("sk-")) return setError(t("ai.keyFormat"));
    save({ enabled, model: model.trim(), dailyLimit: Number(dailyLimit), ...(key ? { apiKey: key } : {}) });
  }

  function removeKey() {
    if (window.confirm(t("ai.removeKeyConfirm"))) save({ apiKey: "" });
  }

  const options = [...new Set([...SUGGESTED, ...models])];
  return (
    <Sheet title={t("ai.title")} onClose={onClose}>
      <form className={pageStyles.formStack} onSubmit={submit} autoComplete="off">
        <Switch label={t("ai.enabled")} hint={t("ai.enabledHint")} checked={enabled} onChange={setEnabled} />
        <TextField
          label={settings.hasKey ? t("ai.newKey") : t("ai.key")}
          hint={settings.hasKey ? t("ai.keyKeep", { last4: settings.keyLast4 }) : t("ai.keyHint")}
          type="password"
          autoComplete="new-password"
          spellCheck={false}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-…"
        />
        <TextField label={t("ai.model")} hint={t("ai.modelHint")} list="ai-models" value={model} onChange={(e) => setModel(e.target.value)} spellCheck={false} />
        <datalist id="ai-models">
          {options.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <TextField label={t("ai.dailyLimit")} hint={t("ai.dailyLimitHint")} type="number" min={1} max={1000} value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} />
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          {settings.hasKey && (
            <Button variant="plain" onClick={removeKey} disabled={busy}>
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
