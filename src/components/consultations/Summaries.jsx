import { useState } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Icon from "../ui/Icon";
import { List, ListRow } from "../ui/List";
import { Switch, SelectField, TextField } from "../ui/Field";
import { AsyncBoundary, EmptyState } from "../ui/Misc";
import pageStyles from "../../pages/Pages.module.css";
import styles from "../clients/Clients.module.css";
import { personName } from "../clients/parts";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { saveFailed } from "../../lib/saveFailed";
import { todayIso } from "../../lib/format";
import { useI18n } from "../../i18n";

// Consultation summaries ("suhbat yakuni") still to write — on the home
// page of whoever holds consultations (team: managers), and the strike
// rule for ones not written in time (backend: services/consultSummary.js).

function MissingRows({ items, team }) {
  const { t, fmt } = useI18n();
  const now = Date.now();
  return (
    <List>
      {items.map((a) => {
        const late = a.deadlineAt && new Date(a.deadlineAt).getTime() < now;
        return (
          <ListRow
            key={a.id}
            to={`/consultations/${a.id}`}
            leading={
              <span className={styles.itemIcon}>
                <Icon name="note" size={16} />
              </span>
            }
            title={a.clientName}
            subtitle={[a.date === todayIso() ? t("caseWork.today") : fmt.isoDay(a.date), fmt.minutes(a.start), team ? a.calendar?.name : null, a.matter].filter(Boolean).join(" · ")}
            trailing={late ? <Badge tone="critical">{t("summary.late")}</Badge> : <Badge tone="warning">{t("summary.toWrite")}</Badge>}
            chevron
          />
        );
      })}
    </List>
  );
}

// Home: "N consultation summaries to write".
export function SummariesDueCard({ team = false }) {
  const { t } = useI18n();
  const state = useAsync(() => api.consultationsMissing(team ? "team" : "mine"), [team]);
  const items = state.data?.items || [];
  if (items.length === 0) return null;
  return (
    <Card
      flush
      title={t(team ? "summary.dueTeamTitle" : "summary.dueCardTitle", { count: items.length })}
      subtitle={t("summary.dueCardHint")}
      action={
        <Button size="small" variant="plain" to={team ? "/consultations?scope=team" : "/consultations"}>
          {t("common.seeAll")}
          <Icon name="chevronRight" size={15} />
        </Button>
      }
    >
      <MissingRows items={items.slice(0, 5)} team={team} />
    </Card>
  );
}

// The whole list (/consultations), and this month's late ones.
export function SummariesList({ team }) {
  const { t } = useI18n();
  const state = useAsync(() => api.consultationsMissing(team ? "team" : "mine"), [team]);
  return (
    <Card flush title={t("summary.listTitle")} subtitle={t("summary.dueCardHint")}>
      <AsyncBoundary state={state}>
        {(data) => (data.items.length === 0 ? <EmptyState icon="checkCircle" text={t("summary.allWritten")} /> : <MissingRows items={data.items} team={team} />)}
      </AsyncBoundary>
    </Card>
  );
}

export function SummaryStrikesCard({ manager }) {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.summaryStrikes(), []);
  const [busy, setBusy] = useState(null);
  const rows = state.data?.strikes || [];
  if (rows.length === 0) return null;

  async function cancel(s) {
    const reason = window.prompt(t("summary.cancelStrikeReason"));
    if (!reason?.trim()) return;
    setBusy(s.id);
    try {
      await api.cancelSummaryStrike(s.id, reason.trim());
      state.reload();
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card flush title={t("summary.strikesTitle", { count: rows.filter((s) => !s.cancelledAt).length })} subtitle={t("summary.strikesHint", { limit: state.data.limit })}>
      <List>
        {rows.map((s) => (
          <ListRow
            key={s.id}
            to={`/consultations/${s.appointment.id}`}
            title={`${s.appointment.clientName} — ${fmt.isoDay(s.appointment.date)}, ${fmt.minutes(s.appointment.start)}`}
            subtitle={[manager ? personName(s.user) : null, s.writtenAt ? t("summary.writtenLate", { when: fmt.dateTime(new Date(s.writtenAt).getTime()) }) : t("summary.notWritten"), s.cancelledAt ? t("summary.strikeCancelled", { reason: s.cancelReason }) : null]
              .filter(Boolean)
              .join(" · ")}
            trailing={s.cancelledAt ? <Badge tone="neutral">{t("summary.cancelledBadge")}</Badge> : <Badge tone="critical">{t("summary.strike")}</Badge>}
            actions={
              manager && !s.cancelledAt ? (
                <Button size="small" variant="plain" busy={busy === s.id} onClick={() => cancel(s)}>
                  {t("summary.cancelStrike")}
                </Button>
              ) : null
            }
          />
        ))}
      </List>
    </Card>
  );
}

// Settings (managers): strikes for summaries not written in time — off,
// or on with "by the end of the day" / "within N hours", and the monthly
// limit after which the managers hear about it.
export function SummaryRuleSection() {
  const { t } = useI18n();
  const state = useAsync(() => api.summaryRule(), []);
  const [busy, setBusy] = useState(false);

  async function save(patch) {
    setBusy(true);
    try {
      state.setData(await api.saveSummaryRule(patch));
    } catch (err) {
      saveFailed(err, t);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={t("summary.ruleTitle")} subtitle={t("summary.ruleHint")}>
      <AsyncBoundary state={state}>
        {(rule) => (
          <div className={pageStyles.formStack}>
            <Switch label={t("summary.ruleOn")} hint={t("summary.ruleOnHint")} checked={rule.enabled} disabled={busy || !rule.canEdit} onChange={(v) => save({ enabled: v })} />
            <SelectField
              label={t("summary.ruleDeadline")}
              value={rule.hours == null ? "" : String(rule.hours)}
              disabled={busy || !rule.canEdit}
              onChange={(e) => save({ hours: e.target.value === "" ? null : Number(e.target.value) })}
            >
              <option value="">{t("summary.ruleEndOfDay")}</option>
              {[1, 2, 3, 6, 12, 24].map((h) => (
                <option key={h} value={h}>
                  {t("summary.ruleHours", { n: h })}
                </option>
              ))}
            </SelectField>
            <TextField
              label={t("summary.ruleLimit")}
              type="number"
              min="0"
              max="100"
              defaultValue={rule.limit}
              disabled={busy || !rule.canEdit}
              onBlur={(e) => Number(e.target.value) !== rule.limit && save({ limit: Number(e.target.value) })}
            />
            <p className={pageStyles.note}>{t("summary.ruleReminderNote")}</p>
          </div>
        )}
      </AsyncBoundary>
    </Card>
  );
}
