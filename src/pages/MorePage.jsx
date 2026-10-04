import { Link } from "react-router-dom";
import styles from "./MorePage.module.css";
import Icon from "../components/ui/Icon";
import { PageHeader } from "../components/ui/Misc";
import { tabLayout } from "../components/layout/AppShell";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../i18n";

// The phone tab bar's "More": everything that didn't fit in the bar, as
// tiles — each section with a colour of its own.
const COLORS = {
  "/clients": "#0a84ff",
  "/calls": "#34c759",
  "/finance": "#30b0c7",
  "/calendar": "#ff9f0a",
  "/reports": "#5e5ce6",
  "/performance": "#ff375f",
  "/tasks": "#32ade6",
  "/days-off": "#a2845e",
  "/team": "#bf5af2",
  "/settings": "#8e8e93",
  "/materials": "#ff6b35",
  "/profile": "#64748b",
  "/chat": "#0a84ff",
};

export default function MorePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { overflow } = tabLayout(user);

  return (
    <div>
      <PageHeader title={t("nav.more")} />
      <div className={styles.grid}>
        {overflow.map((item) => (
          <Link key={item.to} to={item.to} className={styles.tile}>
            <span className={styles.icon} style={{ background: COLORS[item.to] || "var(--accent)" }}>
              <Icon name={item.icon} size={22} />
            </span>
            {t(item.label)}
          </Link>
        ))}
      </div>
    </div>
  );
}
