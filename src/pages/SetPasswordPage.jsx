import styles from "./LoginPage.module.css";
import Button from "../components/ui/Button";
import { BrandMark } from "../components/layout/AppShell";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../i18n";
import { PasswordCard } from "./ProfilePage";

// Still on a temporary password (a new account, or one a manager reset):
// choosing their own comes before anything else — the server answers the
// rest with 403 "must_change_password". Once it's changed, refreshMe()
// clears the flag and Ledger opens.
export default function SetPasswordPage() {
  const { logout } = useAuth();
  const { t } = useI18n();
  return (
    <main className={styles.page}>
      <div className={styles.column}>
        <div className={styles.brand}>
          <BrandMark size={60} />
          <h1 className={styles.title}>{t("profile.changePassword")}</h1>
        </div>
        <PasswordCard />
        <Button variant="plain" onClick={logout}>
          {t("profile.signOut")}
        </Button>
      </div>
    </main>
  );
}
