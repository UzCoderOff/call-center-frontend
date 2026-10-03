import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styles from "./EmployeeDetailPage.module.css";
import pageStyles from "./Pages.module.css";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Icon from "../components/ui/Icon";
import Sheet from "../components/ui/Sheet";
import { TextField } from "../components/ui/Field";
import { AsyncBoundary, Avatar, CopyButton, KeyValue, PageHeader } from "../components/ui/Misc";
import CredentialsView from "../components/team/CredentialsView";
import WorkSettingsFields, { jobsOf, useOrgOptions, workPayload } from "../components/team/WorkSettingsFields";
import { takesCalls } from "../lib/access";
import StatsOverview from "../components/stats/StatsOverview";
import RangePicker from "../components/stats/RangePicker";
import { RecordingBadge, SyncBadge } from "../components/SyncStatus";
import { ReportHistory } from "./ReportsPage";
import { AutoReportHistory } from "../components/reports/AutoReport";
import { useAuth } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";
import { useBack } from "../hooks/useBack";
import { api } from "../lib/api";
import { rangeWithPrevious } from "../lib/format";
import { useI18n } from "../i18n";
import { reportSummary } from "./SettingsPage";

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const { t, fmt } = useI18n();
  const goBack = useBack("/team");
  const employee = useAsync(() => api.employee(id), [id]);

  if (employee.error?.status === 404) {
    return <PageHeader back={{ label: t("employee.back"), onClick: goBack }} title={t("employee.notFound")} />;
  }

  return (
    <AsyncBoundary state={employee}>
      {(e) => (
        <div>
          <PageHeader
            back={{ label: t("employee.back"), onClick: goBack }}
            title={
              <span className={styles.titleRow}>
                <Avatar name={e.name} size={48} />
                <span>{e.name}</span>
              </span>
            }
            subtitle={[e.position?.name, e.office?.name, e.phoneNumber && fmt.phone(e.phoneNumber), e.username && `@${e.username}`]
              .filter(Boolean)
              .join(" · ")}
            actions={
              <div className={styles.headerBadges}>
                <Badge tone={e.active ? "good" : "neutral"} icon={e.active ? "checkCircle" : "minusCircle"}>
                  {e.active ? t("team.active") : t("team.inactive")}
                </Badge>
                {e.collectCalls && <SyncBadge sync={e.sync} />}
              </div>
            }
          />

          <div className={pageStyles.stack}>
            {takesCalls(e) && <CallsSection employee={e} />}
            {!takesCalls(e) && (
              <div className={styles.linkRow}>
                <Button to={`/performance/${e.id}`} icon="barChart">
                  {t("perf.open")}
                </Button>
              </div>
            )}

            <div className={styles.cards}>
              <WorkCard employee={e} onChange={employee.setData} />
              {e.collectCalls && <SyncCard employee={e} />}
              <DevicesCard employee={e} onChange={employee.setData} />
              <AccountCard employee={e} onChange={employee.setData} />
            </div>

            {e.autoReport && <AutoReportHistory employeeId={e.id} title={t("work.reports")} />}
            {/* The forms they fill in; on automatic alone, only old ones if any. */}
            {e.reportTemplate && <EmployeeReports employeeId={e.id} onlyIfAny={e.autoReport && !e.alsoForm} />}
          </div>
        </div>
      )}
    </AsyncBoundary>
  );
}

function CallsSection({ employee }) {
  const { t } = useI18n();
  const [range, setRange] = useState("month");
  const stats = useAsync(() => api.dashboard({ ...rangeWithPrevious(range), employeeId: employee.id }), [employee.id, range]);
  return (
    <>
      <div className={pageStyles.rangePicker}>
        <RangePicker value={range} onChange={setRange} />
      </div>
      <AsyncBoundary state={stats}>
        {(data) => <StatsOverview data={data} range={range} callsLink={`employeeId=${employee.id}`} money />}
      </AsyncBoundary>
      <div className={styles.linkRow}>
        <Button to={`/calls?employeeId=${employee.id}`} icon="phone">
          {t("employee.viewCalls")}
        </Button>
        <Button to={`/performance/${employee.id}`} icon="barChart">
          {t("perf.open")}
        </Button>
      </div>
    </>
  );
}

// Reports filled in by hand. For someone now on automatic reports: their
// old ones, only if there are any.
function EmployeeReports({ employeeId, onlyIfAny = false }) {
  const { t } = useI18n();
  const state = useAsync(() => api.reports({ employeeId, pageSize: 10 }), [employeeId]);
  return (
    <AsyncBoundary state={state}>
      {(data) =>
        (!onlyIfAny || data.reports.length > 0) && (
          <ReportHistory reports={data.reports} title={onlyIfAny ? t("autoReport.formHistory") : t("work.reports")} />
        )
      }
    </AsyncBoundary>
  );
}

// Office, position, "collect calls" and report form — what this person's
// job looks like in the system.
function WorkCard({ employee, onChange }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const canEdit = user.role === "DEVELOPER";

  return (
    <Card
      title={t("work.title")}
      action={
        canEdit && (
          <Button size="small" variant="plain" onClick={() => setEditing(true)}>
            {t("work.edit")}
          </Button>
        )
      }
    >
      <KeyValue label={t("work.office")}>{employee.office?.name || t("work.none")}</KeyValue>
      <KeyValue label={t("work.position")}>{employee.position?.name || t("work.none")}</KeyValue>
      <KeyValue label={t("settings.reportForm")}>
        {employee.autoReport && !employee.alsoForm && employee.reportTemplate
          ? [t("autoReport.name"), t("autoReport.formKept", { name: employee.reportTemplate.name })].join(" · ")
          : reportSummary(employee, t)}
      </KeyValue>
      <KeyValue label={t("settings.calendarAccess")}>{t(`settings.access.${employee.calendarAccess || "none"}`)}</KeyValue>
      <KeyValue label={t("settings.collectCalls")}>
        {employee.collectCalls ? (
          <Badge tone="accent" icon="phone">
            {t("common.yes")}
          </Badge>
        ) : (
          t("common.no")
        )}
      </KeyValue>
      <KeyValue label={t("work.pbxCalling")}>
        {employee.pbxCalling && employee.phoneLine ? (
          <Badge tone="accent" icon="phone">
            {t("work.phoneId", { ext: employee.phoneLine.ext })}
          </Badge>
        ) : (
          t("common.no")
        )}
      </KeyValue>
      <KeyValue label={t("work.workDays")}>{workPatternLine(employee, t)}</KeyValue>
      <KeyValue label={t("work.job")}>{jobsOf(employee).map((j) => t(`work.jobs.${j}`)).join(" + ")}</KeyValue>
      {editing && <EditWorkSheet employee={employee} onClose={() => setEditing(false)} onSaved={onChange} />}
    </Card>
  );
}

// "Du Se Ch Pa Ju Sh · bayramlarda dam oladi"
function workPatternLine(employee, t) {
  const days = t("time.weekdaysShort");
  const pattern = employee.workDays || "123456";
  const list = pattern === "1234567" ? t("work.everyDay") : pattern.split("").map((d) => (Array.isArray(days) ? days[Number(d) % 7] : d)).join(" ");
  return `${list} · ${employee.holidaysOff === false ? t("work.worksHolidays") : t("work.holidaysOffShort")}`;
}

function EditWorkSheet({ employee, onClose, onSaved }) {
  const { t } = useI18n();
  const options = useOrgOptions();
  const [name, setName] = useState(employee.name);
  const [phone, setPhone] = useState(employee.phoneNumber || "");
  const [work, setWork] = useState({
    officeId: employee.office?.id ?? "",
    positionId: employee.position?.id ?? "",
    reportTemplateId: employee.reportTemplate?.id ?? "",
    collectCalls: employee.collectCalls,
    pbxCalling: employee.pbxCalling,
    canCallOut: employee.phoneLine?.canCallOut ?? true,
    autoReport: employee.autoReport,
    alsoForm: employee.alsoForm,
    calendarAccess: employee.calendarAccess,
    jobs: jobsOf(employee),
    workDays: employee.workDays,
    holidaysOff: employee.holidaysOff,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const updated = await api.updateEmployee(employee.id, { name, phoneNumber: phone || null, ...workPayload(work) });
      onSaved((prev) => ({ ...prev, ...updated }));
      onClose();
    } catch {
      setError(t("settings.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={t("work.title")} onClose={onClose}>
      <form onSubmit={save} className={pageStyles.formStack}>
        <TextField label={t("team.fullName")} value={name} onChange={(e) => setName(e.target.value)} required />
        <TextField label={t("team.phoneOptional")} value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" />
        <WorkSettingsFields value={work} onChange={setWork} options={options} />
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        <div className={pageStyles.formActions}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" variant="primary" busy={busy}>
            {t("work.save")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

function SyncCard({ employee }) {
  const { t, fmt } = useI18n();
  const sync = employee.sync;
  return (
    <Card title={t("sync.title")} action={<SyncBadge sync={sync} />}>
      <KeyValue label={t("sync.lastSuccess")}>{sync?.lastSyncAt ? fmt.dateTime(new Date(sync.lastSyncAt).getTime()) : "—"}</KeyValue>
      {sync?.recordings && (
        <KeyValue label={t("recordings.label")}>
          <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <RecordingBadge recordings={sync.recordings} />
            <span className={pageStyles.note} style={{ margin: 0 }}>
              {[
                sync.recordings.calls7d ? t("recordings.detail", { calls: sync.recordings.calls7d, recorded: sync.recordings.recorded7d }) : null,
                sync.recordings.lastRecordingAt ? t("recordings.lastAt", { when: fmt.relative(sync.recordings.lastRecordingAt) }) : t("recordings.never"),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
        </KeyValue>
      )}
      {sync?.lastError && (
        <KeyValue label={t("sync.lastError")}>
          <span className={styles.errorText}>
            {sync.lastError.code} · {fmt.relative(sync.lastError.at)}
          </span>
        </KeyValue>
      )}
      {sync?.missingEntries7d > 0 && (
        <p className={styles.warn}>
          <Icon name="alertTriangle" size={16} />
          {t("sync.missingEntries", { count: sync.missingEntries7d })}
        </p>
      )}

      {employee.recentSyncs && (
        <>
          <h3 className={styles.subhead}>{t("sync.recent")}</h3>
          {employee.recentSyncs.length === 0 ? (
            <p className={pageStyles.note}>{t("sync.none")}</p>
          ) : (
            <ul className={styles.syncList}>
              {employee.recentSyncs.map((s) => (
                <li key={s.id} className={styles.syncItem}>
                  <Icon
                    name={s.ok ? "checkCircle" : "alertCircle"}
                    size={16}
                    className={s.ok ? styles.okIcon : styles.failIcon}
                    title={s.ok ? t("sync.success") : t("sync.failed")}
                  />
                  <span className={styles.syncWhen}>{fmt.dateTime(new Date(s.createdAt).getTime())}</span>
                  <span className={styles.syncDetail}>
                    {s.ok
                      ? t("sync.batch", { calls: s.callCount ?? 0, recordings: s.recordingCount ?? 0 })
                      : `HTTP ${s.httpStatus} · ${s.errorCode || "?"}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

// Phones signed in to the app with this account — and the legacy device ID
// for the old manually-configured agent, for DEVELOPER accounts.
function DevicesCard({ employee, onChange }) {
  const { user } = useAuth();
  const { t, fmt } = useI18n();
  const canManage = user.role === "DEVELOPER";
  const [error, setError] = useState("");
  const [rotated, setRotated] = useState(false);
  const devices = employee.devices || [];

  async function signOut(device) {
    if (!confirm(t("work.confirmSignOut"))) return;
    setError("");
    try {
      await api.revokeDevice(employee.id, device.id);
      onChange((prev) => ({ ...prev, devices: prev.devices.filter((d) => d.id !== device.id) }));
    } catch {
      setError(t("team.actionFailed"));
    }
  }

  async function rotate() {
    if (!confirm(t("employee.confirmRegenerate"))) return;
    try {
      const updated = await api.regenerateDeviceId(employee.id);
      onChange((prev) => ({ ...prev, ...updated }));
      setRotated(true);
    } catch {
      setError(t("team.actionFailed"));
    }
  }

  return (
    <Card title={t("work.devices")} subtitle={t("work.devicesHint")}>
      {devices.length === 0 ? (
        <p className={pageStyles.note}>{t("work.noDevices")}</p>
      ) : (
        <ul className={styles.deviceList}>
          {devices.map((d) => (
            <li key={d.id} className={styles.device}>
              <Icon name="smartphone" size={20} className={styles.deviceIcon} />
              <div className={styles.deviceText}>
                <div className={styles.deviceName}>
                  {d.label || "Android"}
                  {d.appVersion && <span className={styles.deviceVersion}> · v{d.appVersion}</span>}
                </div>
                <div className={styles.deviceMeta}>{t("work.lastSeen", { time: fmt.relative(d.lastSeenAt) })}</div>
              </div>
              {canManage && (
                <Button size="small" variant="destructive" onClick={() => signOut(d)}>
                  {t("work.signOutDevice")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && employee.collectCalls && (
        <details className={styles.legacy}>
          <summary>{t("work.legacyTitle")}</summary>
          <p className={pageStyles.note}>{t("work.legacyHint")}</p>
          <div className={styles.token}>
            <code className={styles.tokenValue}>{employee.deviceToken}</code>
            <CopyButton value={employee.deviceToken} />
          </div>
          {rotated && <p className={styles.info}>{t("employee.newIdNote")}</p>}
          <Button size="small" icon="refresh" onClick={rotate}>
            {t("employee.regenerate")}
          </Button>
        </details>
      )}
      {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
    </Card>
  );
}

function AccountCard({ employee, onChange }) {
  const { user } = useAuth();
  const { t, fmt } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [tempPassword, setTempPassword] = useState(null);

  if (user.role !== "DEVELOPER") return null;

  async function run(kind, action) {
    setBusy(kind);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err.code === "has_call_history" ? t("employee.hasHistory") : t("team.actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  const ps = employee.passwordStatus;
  return (
    <Card title={t("employee.account")}>
      {ps ? (
        <KeyValue label={t("employee.password")}>
          {ps.mustChangePassword ? (
            <Badge tone="warning" icon="key">
              {t("employee.stillTemp")}
            </Badge>
          ) : (
            t("employee.changedAt", { date: fmt.dateTime(new Date(ps.passwordChangedAt).getTime()) })
          )}
        </KeyValue>
      ) : (
        <p className={pageStyles.note}>{t("employee.noLogin")}</p>
      )}

      {tempPassword && (
        <div className={styles.creds}>
          <CredentialsView note={t("team.newTempPassword")} items={[{ label: t("team.tempPasswordLabel"), value: tempPassword }]} />
        </div>
      )}

      <div className={pageStyles.actionsRow}>
        {employee.username && (
          <Button
            icon="key"
            busy={busy === "reset"}
            onClick={() => {
              if (!confirm(t("team.confirmReset", { name: employee.name }))) return;
              run("reset", async () => {
                const res = await api.resetEmployeePassword(employee.id);
                onChange((prev) => ({ ...prev, ...res.employee }));
                setTempPassword(res.credentials.temporaryPassword);
              });
            }}
          >
            {t("team.resetPassword")}
          </Button>
        )}
        <Button
          variant={employee.active ? "destructive" : "primary"}
          busy={busy === "active"}
          onClick={() =>
            run("active", async () => {
              const updated = await api.updateEmployee(employee.id, { active: !employee.active });
              onChange((prev) => ({ ...prev, ...updated }));
            })
          }
        >
          {employee.active ? t("team.deactivate") : t("team.reactivate")}
        </Button>
      </div>

      <div className={styles.danger}>
        <h3 className={styles.subhead}>{t("employee.dangerTitle")}</h3>
        <p className={pageStyles.note}>{t("employee.dangerNote")}</p>
        <div className={pageStyles.actionsRow}>
          <Button
            variant="destructive"
            busy={busy === "remove"}
            onClick={() => {
              if (!confirm(t("employee.confirmDelete", { name: employee.name }))) return;
              run("remove", async () => {
                await api.deleteEmployee(employee.id);
                navigate("/team", { replace: true });
              });
            }}
          >
            {t("employee.remove")}
          </Button>
        </div>
      </div>
      {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
    </Card>
  );
}
