import { useState } from "react";
import pageStyles from "../../pages/Pages.module.css";
import styles from "./CallCenterRules.module.css";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Sheet from "../ui/Sheet";
import Icon from "../ui/Icon";
import { MoneyField, SelectField, Switch, TextField } from "../ui/Field";
import { List, ListRow, ListSectionHeader } from "../ui/List";
import { AsyncBoundary } from "../ui/Misc";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";

// Settings → the call center: who counts as it (their calls are Home's
// numbers, the funnel, the strikes), and the late call-back rule. The
// developer changes them, the boss sees them (backend: routes/rules.js).

const pad = (n) => String(n).padStart(2, "0");
const toTime = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
const fromTime = (s) => {
  const [h, m] = (s || "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

// Their jobs (the main one first) and whether the call center is one of them.
const jobsOfPerson = (p) => (p.jobs?.length ? p.jobs : [p.job || "other"]);
const inCallCenter = (p) => jobsOfPerson(p).includes("call_center");

export function CallCenterSection({ canEdit }) {
  const { t } = useI18n();
  const state = useAsync(() => api.callCenterRules(), []);
  const [open, setOpen] = useState(false);

  return (
    <section>
      <ListSectionHeader>{t("rules.callCenter.title")}</ListSectionHeader>
      <AsyncBoundary state={state}>
        {(data) => {
          const members = data.people.filter(inCallCenter);
          return (
            <List inset={64}>
              <ListRow
                onClick={() => setOpen(true)}
                chevron
                leading={<span className={styles.tile}><Icon name="phone" size={18} /></span>}
                title={t("rules.callCenter.count", { count: members.length })}
                subtitle={members.length ? members.map((p) => p.name).join(", ") : t("rules.callCenter.nobody")}
              />
            </List>
          );
        }}
      </AsyncBoundary>
      <p className={styles.footnote}>{t("rules.callCenter.hint")}</p>
      {open && state.data && (
        <CallCenterSheet
          data={state.data}
          canEdit={canEdit && state.data.canEdit}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            state.reload();
          }}
        />
      )}
    </section>
  );
}

// Everyone active, one switch each; narrow by position, office or report
// form and switch the whole group at once. Saved together.
function CallCenterSheet({ data, canEdit, onClose, onSaved }) {
  const { t } = useI18n();
  const [by, setBy] = useState("");
  const [pick, setPick] = useState("");
  const [chosen, setChosen] = useState(() => new Set(data.people.filter(inCallCenter).map((p) => p.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const groups = { position: data.positions, office: data.offices, template: data.templates };
  const field = { position: "positionId", office: "officeId", template: "reportTemplateId" };
  const shown = by && pick ? data.people.filter((p) => String(p[field[by]] ?? "") === pick) : data.people;
  const was = new Set(data.people.filter(inCallCenter).map((p) => p.id));
  const add = [...chosen].filter((id) => !was.has(id));
  const remove = [...was].filter((id) => !chosen.has(id));
  // Coordinators keep that job too: they'll have both.
  const moving = data.people.filter((p) => add.includes(p.id) && jobsOfPerson(p).includes("coordinator"));

  function toggle(id, on) {
    const next = new Set(chosen);
    if (on) next.add(id);
    else next.delete(id);
    setChosen(next);
  }
  function setAll(on) {
    const next = new Set(chosen);
    for (const p of shown) {
      if (on) next.add(p.id);
      else next.delete(p.id);
    }
    setChosen(next);
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      await api.saveCallCenter({ add, remove });
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(false);
    }
  }

  return (
    <Sheet title={t("rules.callCenter.title")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <p className={pageStyles.note}>{t("rules.callCenter.sheetHint")}</p>
        <div className={styles.twoCol}>
          <SelectField
            label={t("rules.callCenter.by")}
            value={by}
            onChange={(e) => {
              setBy(e.target.value);
              setPick("");
            }}
          >
            <option value="">{t("rules.callCenter.byAll")}</option>
            <option value="position">{t("rules.callCenter.byPosition")}</option>
            <option value="office">{t("rules.callCenter.byOffice")}</option>
            <option value="template">{t("rules.callCenter.byTemplate")}</option>
          </SelectField>
          {by && (
            <SelectField label={t(`rules.callCenter.${by === "template" ? "byTemplate" : by === "office" ? "byOffice" : "byPosition"}`)} value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">—</option>
              {groups[by].map((g) => (
                <option key={g.id} value={String(g.id)}>
                  {g.name}
                </option>
              ))}
            </SelectField>
          )}
        </div>
        {canEdit && by && pick && shown.length > 0 && (
          <div className={styles.groupActions}>
            <Button size="small" onClick={() => setAll(true)}>
              {t("rules.callCenter.allIn", { count: shown.length })}
            </Button>
            <Button size="small" variant="plain" onClick={() => setAll(false)}>
              {t("rules.callCenter.allOut", { count: shown.length })}
            </Button>
          </div>
        )}
        <ul className={styles.people}>
          {shown.map((p) => (
            <li key={p.id}>
              <Switch
                label={p.name}
                hint={[p.position?.name, p.office?.name, jobsOfPerson(p).filter((j) => j !== "call_center").map((j) => t(`work.jobs.${j}`)).join(" + ") || null, p.collectCalls || p.pbxCalling ? null : t("rules.callCenter.notMonitored")].filter(Boolean).join(" · ")}
                checked={chosen.has(p.id)}
                onChange={(on) => toggle(p.id, on)}
                disabled={!canEdit}
              />
            </li>
          ))}
          {shown.length === 0 && <li className={pageStyles.note}>{t("rules.callCenter.nobodyHere")}</li>}
        </ul>
        {moving.length > 0 && <p className={pageStyles.message}>{t("rules.callCenter.coordWarning", { names: moving.map((p) => p.name).join(", ") })}</p>}
        {(add.length > 0 || remove.length > 0) && <p className={pageStyles.note}>{t("rules.callCenter.changes", { add: add.length, remove: remove.length })}</p>}
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{canEdit ? t("common.cancel") : t("common.close")}</Button>
          {canEdit && (
            <Button variant="primary" busy={busy} disabled={add.length + remove.length === 0} onClick={save}>
              {t("common.save")}
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------ late call-backs
export function StrikeRulesSection({ canEdit }) {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.strikeRules(), []);
  const [open, setOpen] = useState(false);

  return (
    <section>
      <ListSectionHeader>{t("rules.strikes.title")}</ListSectionHeader>
      <AsyncBoundary state={state}>
        {(r) => (
          <List inset={64}>
            <ListRow
              onClick={() => setOpen(true)}
              chevron
              leading={<span className={styles.tile}><Icon name="alertTriangle" size={18} /></span>}
              title={r.enabled ? t("rules.strikes.on", { minutes: r.minutes, limit: r.limit }) : t("rules.strikes.off")}
              subtitle={
                r.enabled
                  ? [
                      t("rules.strikes.hours", { from: toTime(r.from), to: toTime(r.to) }),
                      r.fine > 0 ? t("rules.strikes.fineLine", { fine: fmt.money(r.fine) }) : t("rules.strikes.noFine"),
                      r.since ? t("rules.strikes.since", { date: fmt.dateTime(new Date(r.since).getTime()) }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : t("rules.strikes.offHint")
              }
              trailing={<Badge tone={r.enabled ? "good" : "neutral"}>{r.enabled ? t("rules.strikes.badgeOn") : t("rules.strikes.badgeOff")}</Badge>}
            />
          </List>
        )}
      </AsyncBoundary>
      {open && state.data && (
        <StrikeSheet
          rules={state.data}
          canEdit={canEdit && state.data.canEdit}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            state.reload();
          }}
        />
      )}
    </section>
  );
}

function StrikeSheet({ rules, canEdit, onClose, onSaved }) {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(rules.enabled);
  const [minutes, setMinutes] = useState(String(rules.minutes));
  const [from, setFrom] = useState(toTime(rules.from));
  const [to, setTo] = useState(toTime(rules.to === 1440 ? 1439 : rules.to));
  const [limit, setLimit] = useState(String(rules.limit));
  const [fine, setFine] = useState(rules.fine ? String(rules.fine) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const f = fromTime(from);
    const e = fromTime(to);
    const m = Number(minutes);
    const l = Number(limit);
    if (!Number.isInteger(m) || m < 1 || m > 240) return setError(t("rules.strikes.badMinutes"));
    if (f == null || e == null || f >= e) return setError(t("rules.strikes.badHours"));
    if (!Number.isInteger(l) || l < 0 || l > 100) return setError(t("rules.strikes.badLimit"));
    setBusy(true);
    setError("");
    try {
      await api.saveStrikeRules({ enabled, minutes: m, from: f, to: e, limit: l, fine: Number(fine) || 0 });
      onSaved();
    } catch (err) {
      setError(t("clients.saveFailed", { reason: err.code || "?" }));
      setBusy(false);
    }
  }

  return (
    <Sheet title={t("rules.strikes.title")} onClose={onClose}>
      <div className={pageStyles.formStack}>
        <Switch label={t("rules.strikes.enabled")} hint={t("rules.strikes.enabledHint")} checked={enabled} onChange={setEnabled} disabled={!canEdit} />
        <TextField label={t("rules.strikes.minutes")} hint={t("rules.strikes.minutesHint")} type="number" inputMode="numeric" min={1} max={240} value={minutes} onChange={(e) => setMinutes(e.target.value)} disabled={!canEdit} />
        <div className={styles.twoCol}>
          <TextField label={t("rules.strikes.from")} type="time" value={from} onChange={(e) => setFrom(e.target.value)} disabled={!canEdit} />
          <TextField label={t("rules.strikes.to")} type="time" value={to} onChange={(e) => setTo(e.target.value)} disabled={!canEdit} />
        </div>
        <TextField label={t("rules.strikes.limit")} hint={t("rules.strikes.limitHint")} type="number" inputMode="numeric" min={0} max={100} value={limit} onChange={(e) => setLimit(e.target.value)} disabled={!canEdit} />
        <MoneyField label={t("rules.strikes.fine")} hint={t("rules.strikes.fineHint")} value={fine} onChange={setFine} disabled={!canEdit} />
        <details className={styles.how}>
          <summary>{t("rules.strikes.howTitle")}</summary>
          <ul>
            {["hours", "daysOff", "callback", "repeat", "staff", "late", "since", "cancel", "alert"].map((k) => (
              <li key={k}>{t(`rules.strikes.how.${k}`)}</li>
            ))}
          </ul>
        </details>
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{canEdit ? t("common.cancel") : t("common.close")}</Button>
          {canEdit && (
            <Button variant="primary" busy={busy} onClick={save}>
              {t("common.save")}
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
