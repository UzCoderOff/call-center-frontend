import { useEffect, useState } from "react";
import pageStyles from "../../pages/Pages.module.css";
import tg from "./TgInbox.module.css";
import Button from "../ui/Button";
import { SelectField, TextAreaField } from "../ui/Field";
import { BetaBadge } from "./TgReview";
import Sheet from "../ui/Sheet";
import { List, ListRow, ListSectionHeader } from "../ui/List";
import { AsyncBoundary, Banner } from "../ui/Misc";
import { PeoplePicker } from "../chat/ChatParts";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { saveFailed } from "../../lib/saveFailed";
import { useI18n } from "../../i18n";

// Sozlamalar → "Mijozlar Telegrami": is the firm's Telegram account connected
// (and how to connect it), who answers it, how many chats.
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
        <p className={pageStyles.note} style={{ margin: 0 }}>
          {t("tgReview.repliesLater")}
        </p>
      </div>
    </List>
  );
}
