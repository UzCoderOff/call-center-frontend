import styles from "./LoginPage.module.css";
import Button from "../components/ui/Button";
import { BrandMark } from "../components/layout/AppShell";
import { useI18n } from "../i18n";
import { PasswordCard } from "./ProfilePage";

// Still on a temporary password (a new account, or one a manager reset):
// asked to choose their own when Ledger opens. Once it's changed,
// refreshMe() clears the flag and Ledger opens; "Keyinroq" (onLater) puts
// it off — someone who doesn't know their current password asks a manager
// for a new one meanwhile. No sign-out here: on a phone it would sign the
// app out too, and calls would stop ringing.
export default function SetPasswordPage({ onLater }) {
  const { t } = useI18n();
  return (
    <main className={styles.page}>
      <div className={styles.column}>
        <div className={styles.brand}>
          <BrandMark size={60} />
          <h1 className={styles.title}>{t("profile.changePassword")}</h1>
          <p className={styles.subtitle}>{t("profile.tempForgot")}</p>
        </div>
        <PasswordCard />
        <Button variant="plain" onClick={onLater}>
          {t("profile.tempLater")}
        </Button>
      </div>
    </main>
  );
}
