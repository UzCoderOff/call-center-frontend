import { useState } from "react";
import pageStyles from "./Pages.module.css";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Sheet from "../components/ui/Sheet";
import Icon from "../components/ui/Icon";
import { SelectField, Switch, TextField } from "../components/ui/Field";
import { List, ListRow, ListSectionHeader } from "../components/ui/List";
import { AsyncBoundary, Banner, EmptyState, PageHeader } from "../components/ui/Misc";
import { useAuth } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { useI18n } from "../i18n";
import { TelegramOverview } from "../components/telegram/TelegramCard";
import { CallCenterSection, StrikeRulesSection } from "../components/settings/CallCenterRules";
import { PhoneLineSection } from "../components/settings/PhoneLine";
import { ClientArchiveSection } from "../components/settings/ClientArchive";
import { JobField, ReportModeFields, WorkPatternFields, positionJobs, reportModeOf } from "../components/team/WorkSettingsFields";

// "Avtomatik + Kunlik shakl", "Kunlik shakl", "Avtomatik", "Hisobot yoʻq".
export function reportSummary(x, t) {
  const mode = reportModeOf({ autoReport: x.autoReport, alsoForm: x.alsoForm, reportTemplateId: x.reportTemplate?.id });
  if (mode === "autoForm") return x.reportTemplate ? t("reportMode.summaryBoth", { name: x.reportTemplate.name }) : t("autoReport.name");
  if (mode === "auto") return t("autoReport.name");
  if (mode === "form") return x.reportTemplate.name;
  return t("settings.noReportForm");
}

// How the firm is organised: offices, positions (job presets) and the daily
// report forms. Everything here can change as the firm learns what each
// office actually needs — no code changes.
export default function SettingsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const canEdit = user.role === "DEVELOPER";

  return (
    <div>
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
      {!canEdit && (
        <div className={pageStyles.bannerSpace}>
          <Banner icon="alertCircle">{t("settings.readOnly")}</Banner>
        </div>
      )}
      <div className={pageStyles.stack}>
        <Offices canEdit={canEdit} />
        <Positions canEdit={canEdit} />
        <Templates canEdit={canEdit} />
        <CallCenterSection canEdit={canEdit} />
        <StrikeRulesSection canEdit={canEdit} />
        <PhoneLineSection canEdit={canEdit} />
        <ClientArchiveSection />
        <TelegramOverview />
        <AuditLog />
      </div>
    </div>
  );
}

// ------------------------------------------------------------ change log
// The latest changes that removed or reshaped data — archived, restored or
// merged clients, deleted cases and payments, imports — with who and when.
const AUDIT_ICON = {
  "client.archive": "minusCircle",
  "client.restore": "refresh",
  "client.merge": "link",
  "case.delete": "trash",
  "payment.delete": "trash",
  "clients.import": "upload",
  "clients.bulk": "users",
  "material.archive": "archive",
  "material.restore": "refresh",
  "material.delete": "trash",
  "material.file.delete": "trash",
};

// A bulk change in words: "operator — Nodira", "closed as didn't continue".
function bulkWhat(summary, t) {
  if (summary.kind === "operator") return t("bulk.auditOperator", { name: summary.name || "—" });
  if (summary.kind === "lawyer") return t("bulk.auditLawyer", { name: summary.name || "—" });
  return t("bulk.auditDeclined");
}

function AuditLog() {
  const { t, fmt } = useI18n();
  const state = useAsync(() => api.auditLog(), []);
  return (
    <section>
      <ListSectionHeader>{t("settings.audit")}</ListSectionHeader>
      <AsyncBoundary state={state}>
        {(rows) =>
          rows.length === 0 ? (
            <List>
              <EmptyState icon="clipboard" text={t("settings.auditEmpty")} />
            </List>
          ) : (
            <List inset={64}>
              {rows.slice(0, 30).map((r) => (
                <ListRow
                  key={r.id}
                  to={r.clientId ? `/clients/${r.clientId}` : undefined}
                  leading={<IconTile icon={AUDIT_ICON[r.action] || "clipboard"} />}
                  title={t(`settings.auditActions.${r.action}`, {
                    ...r.summary,
                    name: r.clientName || "—",
                    merged: r.summary.merged || "—",
                    amount: r.summary.amount == null ? "—" : fmt.money(r.summary.amount),
                    what: r.action === "clients.bulk" ? bulkWhat(r.summary, t) : "",
                  })}
                  subtitle={[r.user?.employee?.name || r.user?.username, fmt.dateTime(new Date(r.createdAt).getTime())].filter(Boolean).join(" · ")}
                />
              ))}
            </List>
          )
        }
      </AsyncBoundary>
    </section>
  );
}

function errorMessage(err, t) {
  return err?.code === "name_taken" ? t("settings.nameTaken") : t("settings.saveFailed");
}

// ---------------------------------------------------------------- offices
function Offices({ canEdit }) {
  const { t } = useI18n();
  const state = useAsync(() => api.offices(), []);
  const [editing, setEditing] = useState(null); // null | "new" | office

  return (
    <section>
      <ListSectionHeader
        action={
          canEdit && (
            <Button size="small" variant="plain" icon="plus" onClick={() => setEditing("new")}>
              {t("settings.addOffice")}
            </Button>
          )
        }
      >
        {t("settings.offices")}
      </ListSectionHeader>
      <AsyncBoundary state={state}>
        {(offices) =>
          offices.length === 0 ? (
            <List>
              <EmptyState icon="home" text={t("settings.noOffices")} />
            </List>
          ) : (
            <List inset={64}>
              {offices.map((o) => (
                <ListRow
                  key={o.id}
                  onClick={canEdit ? () => setEditing(o) : undefined}
                  chevron={canEdit}
                  leading={<IconTile icon="home" />}
                  title={o.name}
                  subtitle={[o.address, t("settings.staffCount", { count: o.employeeCount })].filter(Boolean).join(" · ")}
                  trailing={!o.active && <Badge tone="neutral">{t("settings.inactive")}</Badge>}
                />
              ))}
            </List>
          )
        }
      </AsyncBoundary>
      {editing && <OfficeSheet office={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={state.reload} />}
    </section>
  );
}

function IconTile({ icon }) {
  return (
    <span
      style={{
        display: "grid",
        placeItems: "center",
        width: 36,
        height: 36,
        borderRadius: 10,
        background: "var(--accent-soft)",
        color: "var(--accent)",
      }}
    >
      <Icon name={icon} size={18} />
    </span>
  );
}

function OfficeSheet({ office, onClose, onSaved }) {
  const { t } = useI18n();
  const [name, setName] = useState(office?.name || "");
  const [address, setAddress] = useState(office?.address || "");
  const [active, setActive] = useState(office?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (office) await api.updateOffice(office.id, { name, address, active });
      else await api.createOffice({ name, address });
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(t("settings.confirmDelete", { name: office.name }))) return;
    try {
      await api.deleteOffice(office.id);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  return (
    <Sheet title={office ? t("settings.editOffice") : t("settings.newOffice")} onClose={onClose}>
      <form onSubmit={save} className={pageStyles.formStack}>
        <TextField label={t("settings.officeName")} value={name} onChange={(e) => setName(e.target.value)} required />
        <TextField label={t("settings.address")} value={address} onChange={(e) => setAddress(e.target.value)} />
        {office && <Switch label={t("settings.active")} checked={active} onChange={setActive} />}
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          {office && (
            <Button variant="destructive" onClick={remove}>
              {t("settings.delete")}
            </Button>
          )}
          <Button type="submit" variant="primary" busy={busy}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

// -------------------------------------------------------------- positions
function Positions({ canEdit }) {
  const { t } = useI18n();
  const state = useAsync(() => api.positions(), []);
  const templates = useAsync(() => api.reportTemplates(), []);
  const [editing, setEditing] = useState(null);

  return (
    <section>
      <ListSectionHeader
        action={
          canEdit && (
            <Button size="small" variant="plain" icon="plus" onClick={() => setEditing("new")}>
              {t("settings.addPosition")}
            </Button>
          )
        }
      >
        {t("settings.positions")}
      </ListSectionHeader>
      <p className={pageStyles.note} style={{ margin: "-2px 4px 10px" }}>
        {t("settings.positionsHint")}
      </p>
      <AsyncBoundary state={state}>
        {(positions) =>
          positions.length === 0 ? (
            <List>
              <EmptyState icon="users" text={t("settings.noPositions")} />
            </List>
          ) : (
            <List inset={64}>
              {positions.map((p) => (
                <ListRow
                  key={p.id}
                  onClick={canEdit ? () => setEditing(p) : undefined}
                  chevron={canEdit}
                  leading={<IconTile icon="user" />}
                  title={p.name}
                  subtitle={[reportSummary(p, t), p.calendarAccess !== "none" && `${t("settings.calendarAccess")}: ${t(`settings.access.${p.calendarAccess}`)}`].filter(Boolean).join(" · ")}
                  trailing={
                    p.collectCalls && (
                      <Badge tone="accent" icon="phone">
                        {t("settings.collectsCalls")}
                      </Badge>
                    )
                  }
                />
              ))}
            </List>
          )
        }
      </AsyncBoundary>
      {editing && (
        <PositionSheet
          position={editing === "new" ? null : editing}
          templates={(templates.data || []).filter((tpl) => tpl.active)}
          onClose={() => setEditing(null)}
          onSaved={state.reload}
        />
      )}
    </section>
  );
}

function PositionSheet({ position, templates, onClose, onSaved }) {
  const { t } = useI18n();
  const [name, setName] = useState(position?.name || "");
  const [collectCalls, setCollectCalls] = useState(position?.collectCalls ?? false);
  // The daily report preset: none / form / automatic / automatic + form.
  const [report, setReport] = useState({
    autoReport: position?.autoReport ?? false,
    alsoForm: position?.alsoForm ?? false,
    reportTemplateId: position?.reportTemplate?.id ?? "",
  });
  const [calendarAccess, setCalendarAccess] = useState(position?.calendarAccess ?? "none");
  const [jobs, setJobs] = useState(() => positionJobs(position));
  const [pattern, setPattern] = useState({ workDays: position?.workDays ?? "123456", holidaysOff: position?.holidaysOff ?? true });
  const [targetConsultations, setTargetConsultations] = useState(position?.targetConsultations ?? "");
  const [targetContracts, setTargetContracts] = useState(position?.targetContracts ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const target = (v) => (String(v).trim() === "" ? null : Number(v));
    const payload = {
      name,
      collectCalls,
      autoReport: report.autoReport,
      alsoForm: Boolean(report.autoReport && report.alsoForm),
      calendarAccess,
      jobs,
      workDays: pattern.workDays,
      holidaysOff: pattern.holidaysOff,
      reportTemplateId: report.reportTemplateId || null,
      targetConsultations: target(targetConsultations),
      targetContracts: target(targetContracts),
    };
    try {
      if (position) await api.updatePosition(position.id, payload);
      else await api.createPosition(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(t("settings.confirmDelete", { name: position.name }))) return;
    try {
      await api.deletePosition(position.id);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err, t));
    }
  }

  return (
    <Sheet title={position ? t("settings.editPosition") : t("settings.newPosition")} onClose={onClose}>
      <form onSubmit={save} className={pageStyles.formStack}>
        <TextField label={t("settings.positionName")} value={name} onChange={(e) => setName(e.target.value)} required />
        <JobField value={jobs} onChange={setJobs} />
        <SelectField
          label={t("settings.calendarAccess")}
          hint={t("settings.calendarAccessHint")}
          value={calendarAccess}
          onChange={(e) => setCalendarAccess(e.target.value)}
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
          checked={collectCalls}
          onChange={setCollectCalls}
        />
        <ReportModeFields value={report} onChange={setReport} templates={templates} />
        <WorkPatternFields workDays={pattern.workDays} holidaysOff={pattern.holidaysOff} onChange={setPattern} />
        <div className={pageStyles.formStack} style={{ gap: 6 }}>
          <span className={pageStyles.note}>{t("settings.targetsHint")}</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <TextField label={t("settings.targetConsultations")} type="number" min="0" inputMode="numeric" value={targetConsultations} onChange={(e) => setTargetConsultations(e.target.value)} />
            <TextField label={t("settings.targetContracts")} type="number" min="0" inputMode="numeric" value={targetContracts} onChange={(e) => setTargetContracts(e.target.value)} />
          </div>
        </div>
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          {position && (
            <Button variant="destructive" onClick={remove}>
              {t("settings.delete")}
            </Button>
          )}
          <Button type="submit" variant="primary" busy={busy}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

// -------------------------------------------------------------- templates
function Templates({ canEdit }) {
  const { t } = useI18n();
  const state = useAsync(() => api.reportTemplates(), []);

  return (
    <section>
      <ListSectionHeader
        action={
          canEdit && (
            <Button size="small" variant="plain" icon="plus" to="/settings/templates/new">
              {t("settings.addTemplate")}
            </Button>
          )
        }
      >
        {t("settings.templates")}
      </ListSectionHeader>
      <p className={pageStyles.note} style={{ margin: "-2px 4px 10px" }}>
        {t("settings.templatesHint")}
      </p>
      <AsyncBoundary state={state}>
        {(templates) =>
          templates.length === 0 ? (
            <List>
              <EmptyState icon="sliders" text={t("settings.noTemplates")} />
            </List>
          ) : (
            <List inset={64}>
              {templates.map((tpl) => (
                <ListRow
                  key={tpl.id}
                  to={`/settings/templates/${tpl.id}`}
                  leading={<IconTile icon="sliders" />}
                  title={tpl.name}
                  subtitle={`${t("settings.questionsCount", { count: tpl.fields.length })} · ${t("settings.usedBy", { count: tpl.employeeCount })}`}
                  trailing={!tpl.active && <Badge tone="neutral">{t("settings.inactive")}</Badge>}
                />
              ))}
            </List>
          )
        }
      </AsyncBoundary>
    </section>
  );
}
