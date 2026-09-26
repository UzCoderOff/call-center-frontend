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

// The job settings of one person: office, position, "collect calls" and
// report form. Picking a position fills in the other two from its preset
// (they can still be changed for this one person).
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
      <SelectField
        label={t("settings.reportForm")}
        value={value.reportTemplateId ?? ""}
        onChange={(e) => set({ reportTemplateId: e.target.value })}
      >
        <option value="">{t("settings.noReportForm")}</option>
        {options.templates.map((tpl) => (
          <option key={tpl.id} value={tpl.id}>
            {tpl.name}
          </option>
        ))}
      </SelectField>
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
    calendarAccess: value.calendarAccess || "none",
  };
}
