import { useState } from "react";
import pageStyles from "./Pages.module.css";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Sheet from "../components/ui/Sheet";
import { Switch, TextField } from "../components/ui/Field";
import { List, ListRow, ListSectionHeader } from "../components/ui/List";
import { AsyncBoundary, Avatar, EmptyState, KeyValue, PageHeader } from "../components/ui/Misc";
import CredentialsView from "../components/team/CredentialsView";
import WorkSettingsFields, { useOrgOptions, workPayload } from "../components/team/WorkSettingsFields";
import { SyncBadge, isSyncProblem, syncLine } from "../components/SyncStatus";
import { useAuth } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { useI18n } from "../i18n";

export default function TeamPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const canManage = user.role === "DEVELOPER";
  const state = useAsync(() => api.employees(), []);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader
        title={t("team.title")}
        subtitle={
          state.data
            ? `${t("team.count", { count: state.data.length })}${canManage ? "" : ` · ${t("team.viewOnly")}`}`
            : undefined
        }
        actions={
          <>
            <Button icon="settings" to="/settings">
              {t("nav.settings")}
            </Button>
            {canManage && (
              <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
                {t("team.add")}
              </Button>
            )}
          </>
        }
      />

      <AsyncBoundary state={state}>
        {(employees) => (employees.length === 0 ? <EmptyState icon="users" text={t("team.empty")} /> : <StaffByOffice employees={employees} />)}
      </AsyncBoundary>

      {canManage && <BossAccounts />}

      {creating && <CreateEmployeeSheet onClose={() => setCreating(false)} onCreated={state.reload} />}
    </div>
  );
}

// Staff grouped under their office, offices alphabetically, "no office" last.
function StaffByOffice({ employees }) {
  const { t, fmt } = useI18n();
  const groups = new Map();
  for (const e of employees) {
    const key = e.office?.name || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {ordered.map(([office, people]) => (
        <section key={office || "none"}>
          <ListSectionHeader>{office || t("reports.noOffice")}</ListSectionHeader>
          <List inset={68}>
            {people.map((e) => (
              <ListRow
                key={e.id}
                to={`/team/${e.id}`}
                leading={<Avatar name={e.name} size={40} />}
                title={e.name}
                subtitle={[e.position?.name, e.phoneNumber && fmt.phone(e.phoneNumber), e.collectCalls && syncLine(e.sync, t, fmt)]
                  .filter(Boolean)
                  .join(" · ")}
                trailing={
                  <>
                    {!e.active && <Badge tone="neutral">{t("team.inactive")}</Badge>}
                    {e.active && e.collectCalls && isSyncProblem(e.sync) && <SyncBadge sync={e.sync} />}
                    {e.passwordStatus?.mustChangePassword && (
                      <Badge tone="warning" icon="key">
                        {t("team.tempPassword")}
                      </Badge>
                    )}
                  </>
                }
              />
            ))}
          </List>
        </section>
      ))}
    </div>
  );
}

function CreateEmployeeSheet({ onClose, onCreated }) {
  const { t } = useI18n();
  const options = useOrgOptions();
  const [form, setForm] = useState({ name: "", phoneNumber: "", username: "" });
  const [work, setWork] = useState({ officeId: "", positionId: "", reportTemplateId: "", collectCalls: false, calendarAccess: "none" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.createEmployee({
        name: form.name.trim(),
        phoneNumber: form.phoneNumber.trim() || null,
        username: form.username.trim(),
        ...workPayload(work),
      });
      setCreated(res);
      onCreated();
    } catch (err) {
      setError(err.code === "username_taken" ? t("team.usernameTaken") : t("team.createFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <Sheet
        title={t("team.createdTitle", { name: created.employee.name })}
        onClose={onClose}
        footer={
          <Button variant="primary" onClick={onClose}>
            {t("common.done")}
          </Button>
        }
      >
        <CredentialsView
          note={t("team.createdNote")}
          items={[
            { label: t("team.username"), value: created.credentials.username },
            { label: t("team.tempPasswordLabel"), value: created.credentials.temporaryPassword },
          ]}
        />
      </Sheet>
    );
  }

  return (
    <Sheet title={t("team.newTitle")} onClose={onClose}>
      <form onSubmit={submit} className={pageStyles.formStack}>
        <TextField label={t("team.fullName")} value={form.name} onChange={set("name")} required autoComplete="off" />
        <TextField
          label={t("team.username")}
          value={form.username}
          onChange={set("username")}
          required
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
        />
        <TextField
          label={t("team.phoneOptional")}
          value={form.phoneNumber}
          onChange={set("phoneNumber")}
          type="tel"
          inputMode="tel"
          placeholder="+998 90 123 45 67"
        />
        <WorkSettingsFields value={work} onChange={setWork} options={options} />
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" variant="primary" busy={busy}>
            {busy ? t("team.creating") : t("team.create")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

function BossAccounts() {
  const { t } = useI18n();
  const state = useAsync(() => api.bossAccounts(), []);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const selected = state.data?.find((b) => b.id === selectedId);

  return (
    <section style={{ marginTop: 36 }}>
      <ListSectionHeader
        action={
          <Button variant="plain" size="small" icon="plus" onClick={() => setCreating(true)}>
            {t("team.bossAdd")}
          </Button>
        }
      >
        {t("team.bossTitle")}
      </ListSectionHeader>

      <AsyncBoundary state={state}>
        {(bosses) =>
          bosses.length === 0 ? (
            <List>
              <EmptyState icon="user" text={t("team.bossEmpty")} />
            </List>
          ) : (
            <List inset={68}>
              {bosses.map((b) => (
                <ListRow
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  leading={<Avatar name={b.username} size={40} />}
                  title={b.username}
                  subtitle={b.calendar ? `${t("roles.BOSS")} · ${b.calendar.name}` : t("roles.BOSS")}
                  chevron
                  trailing={
                    <>
                      {b.calendar && (
                        <Badge tone="accent" icon="calendar">
                          {t("nav.calendar")}
                        </Badge>
                      )}
                      {!b.active && <Badge tone="neutral">{t("team.inactive")}</Badge>}
                      {b.passwordStatus.mustChangePassword && (
                        <Badge tone="warning" icon="key">
                          {t("team.tempPassword")}
                        </Badge>
                      )}
                    </>
                  }
                />
              ))}
            </List>
          )
        }
      </AsyncBoundary>

      {creating && <CreateBossSheet onClose={() => setCreating(false)} onCreated={state.reload} />}
      {selected && (
        <BossSheet
          account={selected}
          onClose={() => setSelectedId(null)}
          onUpdated={(updated) => state.setData((list) => list.map((b) => (b.id === updated.id ? updated : b)))}
          onRemoved={() => {
            setSelectedId(null);
            state.setData((list) => list.filter((b) => b.id !== selected.id));
          }}
        />
      )}
    </section>
  );
}

function CreateBossSheet({ onClose, onCreated }) {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [hasCalendar, setHasCalendar] = useState(true);
  const [calendarName, setCalendarName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.createBossAccount({
        username: username.trim(),
        hasCalendar,
        calendarName: calendarName.trim() || undefined,
      });
      setCredentials(res.credentials);
      onCreated();
    } catch (err) {
      setError(err.code === "username_taken" ? t("team.usernameTaken") : t("team.createFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (credentials) {
    return (
      <Sheet
        title={t("team.bossCreatedTitle")}
        onClose={onClose}
        footer={
          <Button variant="primary" onClick={onClose}>
            {t("common.done")}
          </Button>
        }
      >
        <CredentialsView
          note={t("team.bossCreatedNote")}
          items={[
            { label: t("team.username"), value: credentials.username },
            { label: t("team.tempPasswordLabel"), value: credentials.temporaryPassword },
          ]}
        />
      </Sheet>
    );
  }

  return (
    <Sheet title={t("team.bossNewTitle")} onClose={onClose}>
      <form onSubmit={submit} className={pageStyles.formStack}>
        <p className={pageStyles.note}>{t("team.bossNote")}</p>
        <TextField
          label={t("team.username")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
        />
        <Switch label={t("team.hasCalendar")} hint={t("team.hasCalendarHint")} checked={hasCalendar} onChange={setHasCalendar} />
        {hasCalendar && (
          <TextField
            label={t("team.calendarName")}
            placeholder={t("team.calendarNamePlaceholder")}
            value={calendarName}
            onChange={(e) => setCalendarName(e.target.value)}
          />
        )}
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" variant="primary" busy={busy}>
            {busy ? t("team.creating") : t("team.create")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

function BossSheet({ account, onClose, onUpdated, onRemoved }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [tempPassword, setTempPassword] = useState(null);

  async function run(kind, action) {
    setBusy(kind);
    setError("");
    try {
      await action();
    } catch {
      setError(t("team.actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet title={account.username} onClose={onClose}>
      <div>
        <KeyValue label={t("employee.status")}>{account.active ? t("team.active") : t("team.inactive")}</KeyValue>
        <KeyValue label={t("employee.password")}>
          {account.passwordStatus.mustChangePassword ? t("team.tempPassword") : t("team.passwordSet")}
        </KeyValue>
      </div>

      <Switch
        label={t("team.hasCalendar")}
        hint={account.calendar ? account.calendar.name : t("team.hasCalendarHint")}
        checked={Boolean(account.calendar)}
        disabled={busy === "calendar"}
        onChange={(on) => run("calendar", async () => onUpdated(await api.updateBossAccount(account.id, { hasCalendar: on })))}
      />

      {tempPassword && (
        <CredentialsView
          note={t("team.newTempPassword")}
          items={[{ label: t("team.tempPasswordLabel"), value: tempPassword }]}
        />
      )}

      <div className={pageStyles.formStack}>
        <Button
          block
          icon="key"
          busy={busy === "reset"}
          onClick={() => {
            if (!confirm(t("team.confirmReset", { name: account.username }))) return;
            run("reset", async () => {
              const res = await api.resetBossPassword(account.id);
              onUpdated(res.user);
              setTempPassword(res.credentials.temporaryPassword);
            });
          }}
        >
          {t("team.resetPassword")}
        </Button>
        <Button
          block
          busy={busy === "active"}
          onClick={() =>
            run("active", async () => onUpdated(await api.updateBossAccount(account.id, { active: !account.active })))
          }
        >
          {account.active ? t("team.deactivate") : t("team.reactivate")}
        </Button>
        <Button
          block
          variant="destructive"
          busy={busy === "remove"}
          onClick={() => {
            if (!confirm(t("team.confirmRemoveBoss", { name: account.username }))) return;
            run("remove", async () => {
              await api.deleteBossAccount(account.id);
              onRemoved();
            });
          }}
        >
          {t("team.remove")}
        </Button>
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
      </div>
    </Sheet>
  );
}
