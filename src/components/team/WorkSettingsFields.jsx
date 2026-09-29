import { useState } from "react";
import { SelectField, Switch } from "../ui/Field";
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
          }
        : { positionId: "" }
    );
  }

  return (
    <>
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
    autoReport: Boolean(value.autoReport),
    alsoForm: Boolean(value.autoReport && value.alsoForm),
    calendarAccess: value.calendarAccess || "none",
  };
}
