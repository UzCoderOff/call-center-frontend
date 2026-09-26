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
      </div>
    </div>
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
                  subtitle={[p.reportTemplate?.name || t("settings.noReportForm"), p.calendarAccess !== "none" && `${t("settings.calendarAccess")}: ${t(`settings.access.${p.calendarAccess}`)}`].filter(Boolean).join(" · ")}
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
  const [calendarAccess, setCalendarAccess] = useState(position?.calendarAccess ?? "none");
  const [templateId, setTemplateId] = useState(position?.reportTemplate?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const payload = { name, collectCalls, calendarAccess, reportTemplateId: templateId || null };
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
        <SelectField label={t("settings.reportForm")} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          <option value="">{t("settings.noReportForm")}</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}
            </option>
          ))}
        </SelectField>
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
