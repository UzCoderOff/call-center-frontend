import { useState } from "react";
import { SelectField, Switch } from "../ui/Field";
import styles from "./WorkPattern.module.css";
import fieldStyles from "../ui/Field.module.css";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { useI18n } from "../../i18n";

// Offices, positions and report forms, loaded once for the pickers below.
export function useOrgOptions() {
  const state = useAsync(
    () =>
      Promise.all([api.offices(), api.positions(), api.reportTemplates()]).then(([offices, positions, templates]) => ({
        offices: offices.filter((o) => o.active),
        positions,
        templates: templates.filter((tpl) => tpl.active),
      })),
    []
  );
  return state.data || { offices: [], positions: [], templates: [] };
}

// The daily report, one choice of four:
//   none      — no report
//   form      — they fill in a form
//   auto      — made automatically from their calls, bookings and clients
//   autoForm  — automatic numbers AND a form for the rest of their work
// value: { autoReport, alsoForm, reportTemplateId } (the form is kept when
// switching to "auto" alone, just not asked).
export function reportModeOf(v) {
  if (v.autoReport) return v.alsoForm ? "autoForm" : "auto";
  return v.reportTemplateId ? "form" : "none";
}

const MODE_FIELDS = {
  none: { autoReport: false, alsoForm: false, reportTemplateId: "" },
  form: { autoReport: false, alsoForm: false },
  auto: { autoReport: true, alsoForm: false },
  autoForm: { autoReport: true, alsoForm: true },
};

export function ReportModeFields({ value, onChange, templates }) {
  const { t } = useI18n();
  const mode = reportModeOf(value);
  // "Form" chosen but no form picked yet: stay on "form" while they pick.
  const [picking, setPicking] = useState(null);
  const shown = picking || mode;
  const needsForm = shown === "form" || shown === "autoForm";

  function chooseMode(next) {
    setPicking(next === "form" && !value.reportTemplateId ? "form" : null);
    onChange({ ...value, ...MODE_FIELDS[next] });
  }

  return (
    <>
      <SelectField label={t("reportMode.label")} hint={t(`reportMode.hints.${shown}`)} value={shown} onChange={(e) => chooseMode(e.target.value)}>
        {["none", "form", "auto", "autoForm"].map((m) => (
          <option key={m} value={m}>
            {t(`reportMode.modes.${m}`)}
          </option>
        ))}
      </SelectField>
      {(needsForm || (shown === "auto" && value.reportTemplateId)) && (
        <SelectField
          label={t("settings.reportForm")}
          hint={shown === "auto" ? t("autoReport.formKeptHint") : !value.reportTemplateId ? t("reportMode.pickForm") : undefined}
          value={value.reportTemplateId ?? ""}
          onChange={(e) => {
            if (e.target.value) setPicking(null);
            onChange({ ...value, reportTemplateId: e.target.value });
          }}
        >
          <option value="">{shown === "auto" ? t("reportMode.dropForm") : t("reportMode.chooseForm")}</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}
            </option>
          ))}
        </SelectField>
      )}
    </>
  );
}

// The job settings of one person: office, position, "collect calls",
// the daily report (automatic, a form, or both). Picking a position fills in the rest
// from its preset (it can still be changed for this one person).
// When someone works: the weekdays (pressed = a working day) and whether
// public holidays are days off for them. Office staff usually Mon–Sat with
// holidays off; call-center staff, on their own phone, every day.
export function WorkPatternFields({ workDays, holidaysOff, onChange }) {
  const { t } = useI18n();
  const days = t("time.weekdaysShort");
  const pattern = workDays || "123456";
  function toggle(d) {
    const next = pattern.includes(d) ? pattern.replace(d, "") : [...pattern, d].sort().join("");
    if (next) onChange({ workDays: next, holidaysOff });
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 13, color: "var(--text-2)" }}>{t("work.workDays")}</span>
        <div className={styles.days} role="group" aria-label={t("work.workDays")}>
          {["1", "2", "3", "4", "5", "6", "7"].map((d) => (
            <button key={d} type="button" className={styles.day} aria-pressed={pattern.includes(d)} onClick={() => toggle(d)}>
              {Array.isArray(days) ? days[Number(d) % 7] : d}
            </button>
          ))}
        </div>
      </div>
      <Switch label={t("work.holidaysOff")} hint={t("work.holidaysOffHint")} checked={holidaysOff !== false} onChange={(v) => onChange({ workDays: pattern, holidaysOff: v })} />
    </div>
  );
}

// What a person does — the first thing to set: it decides their home page,
// whether their missed calls go on the call-back list, whether Calls and
// Home count them with the call center, and what Natijalar measures. Someone
// can do more than one; the first one chosen is the main one (their home
// page). None chosen = "other".
export const JOBS = ["call_center", "coordinator", "office", "other"];
const CHOOSABLE = JOBS.filter((j) => j !== "other");

// Someone's jobs, the main one first: `jobs` from the server, or the single
// `job` (older data).
export const jobsOf = (x) => (Array.isArray(x?.jobs) && x.jobs.length ? x.jobs : [x?.job || "other"]);
// A position's preset jobs (Position.job + Position.extraJobs, as stored).
export const positionJobs = (p) => [p?.job || "other", ...String(p?.extraJobs || "").split(",").filter(Boolean)];

// value: their jobs, the main one first. onChange gets the new list.
export function JobField({ value, onChange }) {
  const { t } = useI18n();
  const chosen = (Array.isArray(value) ? value : [value]).filter((j) => CHOOSABLE.includes(j));
  const toggle = (job) => {
    const next = chosen.includes(job) ? chosen.filter((j) => j !== job) : [...chosen, job];
    onChange(next.length ? next : ["other"]);
  };
  return (
    <div className={fieldStyles.field}>
      <span className={fieldStyles.label}>{t("work.job")}</span>
      <div className={styles.days} role="group" aria-label={t("work.job")}>
        {CHOOSABLE.map((j) => (
          <button key={j} type="button" className={`${styles.day} ${styles.job}`} aria-pressed={chosen.includes(j)} onClick={() => toggle(j)}>
            {t(`work.jobs.${j}`)}
            {chosen.length > 1 && chosen[0] === j ? ` · ${t("work.mainJob")}` : ""}
          </button>
        ))}
      </div>
      <span className={fieldStyles.hint}>
        {/* One job: what it means. Several: their single-job notes would contradict each other. */}
        {chosen.length > 1 ? t("work.jobsHint") : `${t(`work.jobHints.${chosen[0] || "other"}`)} ${t("work.jobsHint")}`}
      </span>
    </div>
  );
}

export default function WorkSettingsFields({ value, onChange, options }) {
  const { t } = useI18n();
  const set = (patch) => onChange({ ...value, ...patch });

  function choosePosition(id) {
    const position = options.positions.find((p) => String(p.id) === String(id));
    set(
      position
        ? {
            positionId: position.id,
            collectCalls: position.collectCalls,
            autoReport: position.autoReport,
            alsoForm: position.alsoForm,
            calendarAccess: position.calendarAccess,
            reportTemplateId: position.reportTemplate?.id ?? "",
            workDays: position.workDays,
            holidaysOff: position.holidaysOff,
            jobs: position.job ? positionJobs(position) : jobsOf(value),
          }
        : { positionId: "" }
    );
  }

  return (
    <>
      <JobField value={jobsOf(value)} onChange={(jobs) => set({ jobs })} />
      <SelectField label={t("work.office")} value={value.officeId ?? ""} onChange={(e) => set({ officeId: e.target.value })}>
        <option value="">{t("work.noOffice")}</option>
        {options.offices.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </SelectField>
      <SelectField label={t("work.position")} value={value.positionId ?? ""} onChange={(e) => choosePosition(e.target.value)}>
        <option value="">{t("work.noPosition")}</option>
        {options.positions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </SelectField>
      <ReportModeFields value={value} onChange={onChange} templates={options.templates} />
      <SelectField
        label={t("settings.calendarAccess")}
        hint={t("settings.calendarAccessHint")}
        value={value.calendarAccess || "none"}
        onChange={(e) => set({ calendarAccess: e.target.value })}
      >
        {["none", "view", "book"].map((a) => (
          <option key={a} value={a}>
            {t(`settings.access.${a}`)}
          </option>
        ))}
      </SelectField>
      <Switch
        label={t("settings.collectCalls")}
        hint={t("settings.collectCallsHint")}
        checked={Boolean(value.collectCalls)}
        onChange={(v) => set({ collectCalls: v })}
      />
      <Switch label={t("work.pbxCalling")} hint={t("work.pbxCallingHint")} checked={Boolean(value.pbxCalling)} onChange={(v) => set({ pbxCalling: v })} />
      {value.pbxCalling && (
        <Switch label={t("work.canCallOut")} hint={t("work.canCallOutHint")} checked={value.canCallOut !== false} onChange={(v) => set({ canCallOut: v })} />
      )}
      <WorkPatternFields workDays={value.workDays} holidaysOff={value.holidaysOff} onChange={set} />
    </>
  );
}

// Form value -> API payload ("" means "none").
export function workPayload(value) {
  const id = (v) => (v === "" || v == null ? null : Number(v));
  return {
    officeId: id(value.officeId),
    positionId: id(value.positionId),
    reportTemplateId: id(value.reportTemplateId),
    collectCalls: Boolean(value.collectCalls),
    // Ledger's phone line: a phone ID, and whether they may call outside.
    pbxCalling: Boolean(value.pbxCalling),
    ...(value.pbxCalling ? { canCallOut: value.canCallOut !== false } : {}),
    autoReport: Boolean(value.autoReport),
    alsoForm: Boolean(value.autoReport && value.alsoForm),
    calendarAccess: value.calendarAccess || "none",
    jobs: jobsOf(value),
    workDays: value.workDays || "123456",
    holidaysOff: value.holidaysOff !== false,
  };
}
