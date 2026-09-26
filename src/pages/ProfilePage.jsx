import { useState } from "react";
import styles from "./ProfilePage.module.css";
import pageStyles from "./Pages.module.css";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Segmented from "../components/ui/Segmented";
import { TextField } from "../components/ui/Field";
import Icon from "../components/ui/Icon";
import { List, ListRow } from "../components/ui/List";
import { Avatar, KeyValue, PageHeader } from "../components/ui/Misc";
import { useAuth, isManagerRole } from "../hooks/useAuth";
import { api } from "../lib/api";
import { callBridge, hasBridge, inApp } from "../lib/appBridge";
import { applyTheme, readPref, writePref } from "../lib/prefs";
import { LANGUAGES, useI18n } from "../i18n";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const displayName = user.employee?.name || user.username;

  return (
    <div>
      <PageHeader title={t("profile.title")} subtitle={t("profile.subtitle")} />

      <div className={styles.layout}>
        <Card>
          <div className={styles.who}>
            <Avatar name={displayName} size={64} />
            <div className={styles.whoText}>
              <div className={styles.name}>{displayName}</div>
              <div className={styles.meta}>
                @{user.username} · {t(`roles.${user.role}`)}
              </div>
            </div>
          </div>
        </Card>

        {inApp && <AppPanel />}
        {isManagerRole(user.role) && (
          <List>
            <ListRow to="/settings" leading={<Icon name="settings" size={20} />} title={t("nav.settings")} subtitle={t("settings.subtitle")} />
          </List>
        )}
        <PreferencesCard />
        <PasswordCard />

        <Button variant="destructive" size="large" block icon="logOut" onClick={logout}>
          {t("profile.signOut")}
        </Button>
      </div>
    </div>
  );
}

// Only inside the Android app: version, "sync now", and the diagnostics log
// to send when something's wrong with syncing.
function AppPanel() {
  const { t } = useI18n();
  const [started, setStarted] = useState(false);
  const collecting = callBridge("isCollectingCalls") === true;
  return (
    <Card title={t("appPanel.title")}>
      <KeyValue label={t("appPanel.version")}>{callBridge("appVersion") || "—"}</KeyValue>
      <p className={pageStyles.note} style={{ margin: "6px 0 4px" }}>
        {collecting ? t("appPanel.collecting") : t("appPanel.notCollecting")}
      </p>
      <div className={pageStyles.actionsRow}>
        {collecting && (
          <Button
            icon="refresh"
            onClick={() => {
              callBridge("syncNow");
              setStarted(true);
            }}
          >
            {started ? t("appPanel.syncStarted") : t("appPanel.syncNow")}
          </Button>
        )}
        {collecting && hasBridge("openSetup") && (
          <Button icon="smartphone" onClick={() => callBridge("openSetup")}>
            {t("appPanel.setup")}
          </Button>
        )}
        <Button icon="copy" onClick={() => callBridge("shareDiagnostics")}>
          {t("appPanel.diagnostics")}
        </Button>
      </div>
    </Card>
  );
}

function PreferencesCard() {
  const { t, lang, setLang } = useI18n();
  const [theme, setTheme] = useState(() => readPref("theme", "auto"));

  function chooseTheme(value) {
    setTheme(value);
    writePref("theme", value);
    applyTheme(value);
  }

  return (
    <Card title={t("profile.preferences")}>
      <div className={pageStyles.formStack}>
        <div className={styles.pref}>
          <span className={styles.prefLabel}>{t("profile.language")}</span>
          <Segmented
            full
            value={lang}
            onChange={setLang}
            label={t("profile.language")}
            options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
          />
        </div>
        <div className={styles.pref}>
          <span className={styles.prefLabel}>{t("profile.theme")}</span>
          <Segmented
            full
            value={theme}
            onChange={chooseTheme}
            label={t("profile.theme")}
            options={[
              { value: "auto", label: t("profile.themeAuto") },
              { value: "light", label: t("profile.themeLight") },
              { value: "dark", label: t("profile.themeDark") },
            ]}
          />
        </div>
      </div>
    </Card>
  );
}

function PasswordCard() {
  const { user, refreshMe } = useAuth();
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmValue, setConfirmValue] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (next.length < 8) return setError(t("profile.tooShort"));
    if (next !== confirmValue) return setError(t("profile.mismatch"));

    setBusy(true);
    try {
      await api.changePassword(current, next);
      setSuccess(true);
      setCurrent("");
      setNext("");
      setConfirmValue("");
      refreshMe().catch(() => {});
    } catch (err) {
      setError(
        err.code === "invalid_current_password"
          ? t("profile.wrongCurrent")
          : err.code === "password_too_short"
            ? t("profile.tooShort")
            : t("profile.failed")
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={t("profile.changePassword")} subtitle={user.mustChangePassword ? t("profile.tempNote") : t("profile.normalNote")}>
      <form onSubmit={submit} className={pageStyles.formStack}>
        {/* Lets password managers attach the new password to the right account. */}
        <input type="text" name="username" autoComplete="username" value={user.username} readOnly hidden />
        <TextField
          label={t("profile.currentPassword")}
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          required
        />
        <TextField
          label={t("profile.newPassword")}
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <TextField
          label={t("profile.confirmPassword")}
          type="password"
          value={confirmValue}
          onChange={(e) => setConfirmValue(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
        {error && <p className={`${pageStyles.message} ${pageStyles.messageError}`}>{error}</p>}
        {success && <p className={`${pageStyles.message} ${pageStyles.messageSuccess}`}>{t("profile.updated")}</p>}
        <div className={pageStyles.formActions}>
          <Button type="submit" variant="primary" busy={busy}>
            {busy ? t("profile.updating") : t("profile.update")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
