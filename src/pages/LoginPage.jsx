import { useEffect, useState } from "react";
import styles from "./LoginPage.module.css";
import Button from "../components/ui/Button";
import Spinner from "../components/ui/Spinner";
import { TextField } from "../components/ui/Field";
import { BrandMark } from "../components/layout/AppShell";
import { useAuth } from "../hooks/useAuth";
import { callBridge, inApp } from "../lib/appBridge";
import { LANGUAGES, useI18n } from "../i18n";

// Inside the Android app the person never sees the web sign-in form: the
// app signed in natively and holds a device token. Landing here means the
// portal session lapsed, so the app renews it (or, if this phone was signed
// out remotely, shows its own sign-in screen).
function InAppReconnect() {
  const { t } = useI18n();
  useEffect(() => {
    callBridge("sessionExpired");
  }, []);
  return (
    <main className={styles.page}>
      <div className={styles.brand}>
        <BrandMark size={60} />
        <Spinner size={22} label={t("common.loading")} />
      </div>
    </main>
  );
}

export default function LoginPage() {
  return inApp ? <InAppReconnect /> : <WebLogin />;
}

function WebLogin() {
  const { login } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      if (err.code === "cookie_not_saved") setError(t("login.cookieBlocked"));
      else if (err.status === 401) setError(t("login.invalid"));
      else setError(t("login.network"));
    } finally {
      setBusy(false);
    }
  }

  const otherLang = LANGUAGES.find((l) => l.code !== lang);

  return (
    <main className={styles.page}>
      <div className={styles.column}>
        <div className={styles.brand}>
          <BrandMark size={60} />
          <h1 className={styles.title}>{t("login.title")}</h1>
          <p className={styles.subtitle}>
            {t("app.name")} · {t("app.tagline")}
          </p>
        </div>

        <form onSubmit={submit} className={styles.card}>
          <TextField
            label={t("login.username")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            required
          />
          <TextField
            label={t("login.password")}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="large" block busy={busy}>
            {busy ? t("login.submitting") : t("login.submit")}
          </Button>
        </form>

        {otherLang && (
          <button type="button" className={styles.lang} onClick={() => setLang(otherLang.code)}>
            {otherLang.label}
          </button>
        )}
      </div>
    </main>
  );
}
