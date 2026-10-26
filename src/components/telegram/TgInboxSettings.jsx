import { useEffect, useState } from "react";
import pageStyles from "../../pages/Pages.module.css";
import tg from "./TgInbox.module.css";
import Button from "../ui/Button";
import { SelectField, TextAreaField, TextField } from "../ui/Field";
import { BetaBadge } from "./TgReview";
import Sheet from "../ui/Sheet";
import { List, ListRow, ListSectionHeader } from "../ui/List";
import { AsyncBoundary, Banner } from "../ui/Misc";
import { PeoplePicker } from "../chat/ChatParts";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { saveFailed } from "../../lib/saveFailed";
import { useI18n } from "../../i18n";

// Sozlamalar → "Mijozlar xabarlari": is the firm's Telegram account connected
// (and how to connect it), who answers it, how many chats; the AI review, and
// the AI that answers new people (managers).
export function TgInboxSection({ canEdit }) {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.tgStatus(), []);
  const [picking, setPicking] = useState(false);

  // Only the firm's account counts; when the firm changes its Telegram account,
  // a manager frees the place for the new one.
  async function resetConnection(done) {
    if (!confirm(t("tg.confirmOtherAccount"))) return;
    try {
      await api.tgSettings({ resetConnection: true });
      done();
    } catch (err) {
      saveFailed(err, t);
    }
  }

  return (
    <section>
      <ListSectionHeader>{t("tg.settingsTitle")}</ListSectionHeader>
      <AsyncBoundary state={state}>
        {({ bot, connection, operators, counts, review }) => (
          <div className={pageStyles.stack}>
            {!bot.configured ? (
              <Banner icon="alertCircle">{t("telegram.notConfigured")}</Banner>
            ) : connection?.enabled ? (
              <>
                <Banner icon="send">
                  {t("tg.connected", { name: [connection.ownerName, connection.ownerUsername && `@${connection.ownerUsername}`].filter(Boolean).join(" ") || "—", date: fmt.date(new Date(connection.at).getTime()) })}
                </Banner>
                {canEdit && (
                  <div>
                    <Button size="small" variant="plain" onClick={() => resetConnection(state.reload)}>
                      {t("tg.otherAccount")}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <Banner tone="warning" icon="alertTriangle">
                {connection ? t("tg.disconnected") : t("tg.notConnected")}
              </Banner>
            )}
            {bot.configured && !connection?.enabled && (
              <List>
                <div style={{ padding: "14px 16px" }}>
                  <ol className={tg.steps}>
                    <li>{t("tg.step1", { bot: bot.username ? `@${bot.username}` : t("tg.theBot") })}</li>
                    <li>{t("tg.step2", { bot: bot.username ? `@${bot.username}` : t("tg.theBot") })}</li>
                    <li>{t("tg.step3")}</li>
                    <li>{t("tg.step4")}</li>
                  </ol>
                </div>
              </List>
            )}
            <List inset={16}>
              <ListRow
                title={t("tg.whoAnswers")}
                subtitle={operators.length ? operators.map((o) => o.name).join(", ") : t("tg.nobodyAnswers")}
                trailing={
                  canEdit && (
                    <Button size="small" onClick={() => setPicking(true)}>
                      {t("tg.change")}
                    </Button>
                  )
                }
              />
              <ListRow title={t("tg.counts")} subtitle={t("tg.countsLine", counts)} />
            </List>
            <ReviewSettings review={review} canEdit={canEdit} onSaved={state.reload} />
            {canEdit && <AiReplySettings canEdit={canEdit} />}
            {picking && (
              <OperatorsSheet
                selected={operators.map((o) => o.id)}
                onClose={() => setPicking(false)}
                onSaved={() => {
                  setPicking(false);
                  state.reload();
                }}
              />
            )}
          </div>
        )}
      </AsyncBoundary>
    </section>
  );
}

function OperatorsSheet({ selected: initial, onClose, onSaved }) {
  const { t } = useI18n();
  const people = useAsync(() => api.chatPeople(), []);
  const [selected, setSelected] = useState(initial);
  const [busy, setBusy] = useState(false);
  const toggle = (id) => setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  async function save() {
    setBusy(true);
    try {
      await api.tgSettings({ operatorIds: selected });
      onSaved();
    } catch (err) {
      saveFailed(err, t);
      setBusy(false);
    }
  }

  return (
    <Sheet title={t("tg.whoAnswers")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <p className={pageStyles.note}>{t("tg.whoAnswersHint")}</p>
        <AsyncBoundary state={people}>{(list) => <PeoplePicker people={list} selected={selected} onToggle={toggle} />}</AsyncBoundary>
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

// The AI review (beta): on or off (Sozlamalar → Claude), which model, and the
// firm's rules for operators it judges by. Replying to clients: not yet.
function ReviewSettings({ review, canEdit, onSaved }) {
  const { t } = useI18n();
  const [rules, setRules] = useState(review.rules);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => setRules(review.rules), [review.rules]);
  const changed = rules.trim() !== review.rules.trim();

  async function save(payload) {
    setBusy(true);
    setSaved(false);
    try {
      await api.tgSettings(payload);
      setSaved(true);
      onSaved();
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setBusy(false);
    }
  }

  return (
    <List>
      <div style={{ padding: "14px 16px", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <strong>{t("tgReview.settingsTitle")}</strong>
          <BetaBadge />
          <span className={pageStyles.note} style={{ margin: 0 }}>
            {review.on ? t("tgReview.isOn") : t("tgReview.isOff")}
          </span>
        </div>
        <p className={pageStyles.note} style={{ margin: 0 }}>
          {t("tgReview.settingsHint")}
        </p>
        {review.models.length > 1 ? (
          <SelectField label={t("tgReview.model")} value={review.model} disabled={!canEdit || busy} onChange={(e) => save({ reviewModel: e.target.value })}>
            {review.models.map((m) => (
              <option key={m} value={m}>
                {t(`tgReview.models.${m}`)}
              </option>
            ))}
          </SelectField>
        ) : (
          <p className={pageStyles.note} style={{ margin: 0 }}>
            {t("tgReview.model")}: {t(`tgReview.models.${review.model}`)}
          </p>
        )}
        <TextAreaField label={t("tgReview.rules")} hint={t("tgReview.rulesHint")} value={rules} onChange={(e) => setRules(e.target.value)} rows={9} disabled={!canEdit} />
        {canEdit && (
          <div className={pageStyles.formActions} style={{ justifyContent: "flex-start" }}>
            <Button variant="primary" busy={busy} disabled={!changed} onClick={() => save({ rules })}>
              {t("common.save")}
            </Button>
            {review.customRules && (
              <Button busy={busy} onClick={() => save({ rules: "" })}>
                {t("tgReview.defaultRules")}
              </Button>
            )}
            {saved && !changed && <span className={pageStyles.note}>{t("tgReview.saved")}</span>}
          </div>
        )}
      </div>
    </List>
  );
}

// The AI that answers new people (beta, the server's services/aiReply): when it
// answers on Telegram and on Instagram, how long it waits for an operator,
// working hours, the model, its own monthly limit (the rest stays for Ledger
// AI), whose calendar its free times come from, and the firm's facts and
// rules it writes by. Managers only.
const hhmm = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const toMinutes = (value) => {
  const [h, m] = String(value || "").split(":").map(Number);
  return Number.isFinite(h) ? h * 60 + (m || 0) : null;
};

export function AiReplySettings({ canEdit }) {
  const state = useAsync(() => api.tgAi(), []);
  return <AsyncBoundary state={state}>{(s) => <AiReplyForm s={s} canEdit={canEdit} onSaved={state.setData} />}</AsyncBoundary>;
}

function formOf(s) {
  return {
    telegram: s.telegram,
    instagram: s.instagram,
    slowMinutes: String(s.slowMinutes),
    hoursFrom: hhmm(s.hoursFrom),
    hoursTo: hhmm(s.hoursTo),
    capUsd: String(s.capUsd),
    model: s.model,
    calendarId: s.calendarId ? String(s.calendarId) : "",
    facts: s.facts || s.defaultFacts,
    rules: s.rules || s.defaultRules,
  };
}

function AiReplyForm({ s, canEdit, onSaved }) {
  const { t, fmt } = useI18n();
  const [form, setForm] = useState(() => formOf(s));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => setForm(formOf(s)), [s]);
  const set = (key) => (e) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };
  const disabled = !canEdit || busy;
  const minutes = Number(form.slowMinutes) || s.slowMinutes;
  const ig = s.instagramStatus;

  async function save() {
    setBusy(true);
    try {
      const same = (a, b) => a.replace(/\r\n/g, "\n").trim() === b.trim();
      const next = await api.tgAiSave({
        telegram: form.telegram,
        instagram: form.instagram,
        slowMinutes: Number(form.slowMinutes) || s.slowMinutes,
        hoursFrom: toMinutes(form.hoursFrom) ?? s.hoursFrom,
        hoursTo: toMinutes(form.hoursTo) ?? s.hoursTo,
        capUsd: Number(form.capUsd) >= 0 ? Number(form.capUsd) : s.capUsd,
        model: form.model,
        calendarId: form.calendarId ? Number(form.calendarId) : null,
        // The firm's own text unchanged: kept empty, so it follows the defaults.
        facts: same(form.facts, s.defaultFacts) ? "" : form.facts,
        rules: same(form.rules, s.defaultRules) ? "" : form.rules,
      });
      onSaved(next);
      setSaved(true);
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setBusy(false);
    }
  }

  const modeOptions = s.modes.map((m) => (
    <option key={m} value={m}>
      {t(`tgAi.modes.${m}`, { minutes })}
    </option>
  ));
  const sinceLine = (p) => (s[p] !== "off" && s.since?.[p] ? <p className={pageStyles.note} style={{ margin: 0 }}>{t("tgAi.since", { date: fmt.dateTime(new Date(s.since[p]).getTime()) })}</p> : null);

  return (
    <List>
      <div style={{ padding: "14px 16px", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <strong>{t("tgAi.settingsTitle")}</strong>
          <BetaBadge />
        </div>
        <p className={pageStyles.note} style={{ margin: 0 }}>
          {t("tgAi.settingsHint")}
        </p>

        <SelectField label="Telegram" value={form.telegram} disabled={disabled} onChange={set("telegram")}>
          {modeOptions}
        </SelectField>
        {!s.telegramCanReply && !["off", "draft"].includes(form.telegram) && (
          <Banner tone="warning" icon="alertTriangle">
            {t("tgAi.telegramNoReply")}
          </Banner>
        )}
        {sinceLine("telegram")}
        <p className={pageStyles.note} style={{ margin: 0 }}>
          {t("tgAi.telegramTip")}
        </p>

        <SelectField label="Instagram" value={form.instagram} disabled={disabled} onChange={set("instagram")}>
          {modeOptions}
        </SelectField>
        <p className={pageStyles.note} style={{ margin: 0 }}>
          {!ig.configured
            ? t("tgAi.igNotConfigured")
            : ig.lastError && (!ig.lastOkAt || new Date(ig.lastErrorAt) > new Date(ig.lastOkAt))
              ? t("tgAi.igError", { error: ig.lastError })
              : ig.lastOkAt
                ? t("tgAi.igOk", { name: ig.username || "—", time: fmt.dateTime(new Date(ig.lastOkAt).getTime()) })
                : t("tgAi.igWaiting")}
        </p>
        {sinceLine("instagram")}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <TextField label={t("tgAi.slowMinutes")} type="number" min={1} max={120} value={form.slowMinutes} disabled={disabled} onChange={set("slowMinutes")} />
          <TextField label={t("tgAi.hoursFrom")} type="time" value={form.hoursFrom} disabled={disabled} onChange={set("hoursFrom")} />
          <TextField label={t("tgAi.hoursTo")} type="time" value={form.hoursTo} disabled={disabled} onChange={set("hoursTo")} />
        </div>

        <SelectField label={t("tgAi.model")} value={form.model} disabled={disabled} onChange={set("model")}>
          {s.models.map((m) => (
            <option key={m} value={m}>
              {t(`tgAi.models.${m}`)}
            </option>
          ))}
        </SelectField>
        <TextField label={t("tgAi.cap")} hint={t("tgAi.capHint")} type="number" min={0} max={500} value={form.capUsd} disabled={disabled} onChange={set("capUsd")} />
        <p className={pageStyles.note} style={{ margin: 0 }}>
          {t("tgAi.usage", { usd: (s.usage?.usd || 0).toFixed((s.usage?.usd || 0) < 1 ? 3 : 2), replies: s.usage?.replies || 0, drafts: s.usage?.drafts || 0, blocked: s.usage?.blocked || 0 })}
        </p>

        <SelectField label={t("tgAi.calendar")} value={form.calendarId} disabled={disabled} onChange={set("calendarId")}>
          <option value="">{t("tgAi.calendarAuto")}</option>
          {s.calendars.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </SelectField>

        <TextAreaField label={t("tgAi.facts")} value={form.facts} rows={7} disabled={disabled} onChange={set("facts")} />
        <TextAreaField label={t("tgAi.rules")} value={form.rules} rows={10} disabled={disabled} onChange={set("rules")} />

        {canEdit && (
          <div className={pageStyles.formActions} style={{ justifyContent: "flex-start" }}>
            <Button variant="primary" busy={busy} onClick={save}>
              {t("common.save")}
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                setSaved(false);
                setForm((f) => ({ ...f, facts: s.defaultFacts, rules: s.defaultRules }));
              }}
            >
              {t("tgAi.defaultText")}
            </Button>
            {saved && <span className={pageStyles.note}>{t("tgAi.saved")}</span>}
          </div>
        )}
      </div>
    </List>
  );
}
