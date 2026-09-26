import { useId } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import styles from "./AppShell.module.css";
import Icon from "../ui/Icon";
import { Avatar } from "../ui/Misc";
import { useAuth, isManagerRole } from "../../hooks/useAuth";
import { canSeeCalendar, canSeeCalls, canSeeReports } from "../../lib/access";
import { useI18n } from "../../i18n";

// Navigation is one list, rendered twice: a sidebar on wide screens and an
// iOS-style tab bar on phones. New modules are added here once and appear in
// both. Each person only sees what applies to them (see lib/access.js).
export function navItems(user) {
  const manager = isManagerRole(user.role);
  return [
    { to: "/", end: true, icon: "home", label: "nav.home" },
    ...(canSeeCalls(user) ? [{ to: "/calls", icon: "phone", label: "nav.calls" }] : []),
    ...(canSeeCalendar(user) ? [{ to: "/calendar", icon: "calendar", label: "nav.calendar" }] : []),
    ...(canSeeReports(user) ? [{ to: "/reports", icon: "clipboard", label: "nav.reports" }] : []),
    ...(manager ? [{ to: "/team", icon: "users", label: "nav.team" }] : []),
    ...(manager ? [{ to: "/settings", icon: "settings", label: "nav.settings", sidebarOnly: true }] : []),
    { to: "/profile", icon: "user", label: "nav.profile" },
  ];
}

const MAX_TABS = 5;

// A phone tab bar holds five items. With more, the first four stay and the
// rest move behind "More" (like iOS).
export function tabLayout(user) {
  const items = navItems(user);
  const tabbable = items.filter((i) => !i.sidebarOnly);
  if (tabbable.length <= MAX_TABS) return { tabs: tabbable, overflow: items.filter((i) => i.sidebarOnly) };
  const tabs = tabbable.slice(0, MAX_TABS - 1);
  const overflow = items.filter((i) => !tabs.includes(i));
  return { tabs: [...tabs, { to: "/more", icon: "more", label: "nav.more" }], overflow };
}

// The Ledger mark — the same as the Android app's icon: a bold "L" whose
// foot underlines two lines of text.
export function BrandMark({ size = 28 }) {
  const gradient = `brand${useId().replace(/:/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 108 108" aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="108" y2="108" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--brand-start)" }} />
          <stop offset="1" style={{ stopColor: "var(--brand-end)" }} />
        </linearGradient>
      </defs>
      <rect width="108" height="108" rx="25" fill={`url(#${gradient})`} />
      <g transform="translate(54 54) scale(1.35) translate(-54 -54)" fill="var(--on-accent)">
        <path d="M36,35a5,5 0,0 1,10 0V64H69a5,5 0,0 1,0 10H41a5,5 0,0 1,-5 -5Z" />
        <path fillOpacity="0.72" d="M55,36h14a3,3 0,0 1,0 6H55a3,3 0,0 1,0 -6ZM55,48h14a3,3 0,0 1,0 6H55a3,3 0,0 1,0 -6Z" />
      </g>
    </svg>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const items = navItems(user);
  const { tabs, overflow } = tabLayout(user);
  const displayName = user.employee?.name || user.username;
  const inOverflow = overflow.some((i) => location.pathname === i.to || location.pathname.startsWith(`${i.to}/`));

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <BrandMark />
          <div>
            <div className={styles.brandName}>{t("app.name")}</div>
            <div className={styles.brandTagline}>{t("app.tagline")}</div>
          </div>
        </div>

        <nav className={styles.sideNav} aria-label="Primary">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `${styles.sideLink} ${isActive ? styles.active : ""}`}
            >
              <Icon name={item.icon} size={19} />
              <span>{t(item.label)}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.account}>
          <NavLink to="/profile" className={styles.accountLink}>
            <Avatar name={displayName} size={34} />
            <span className={styles.accountText}>
              <span className={styles.accountName}>{displayName}</span>
              <span className={styles.accountRole}>{t(`roles.${user.role}`)}</span>
            </span>
          </NavLink>
          <button type="button" className={styles.signOut} onClick={logout} title={t("nav.signOut")} aria-label={t("nav.signOut")}>
            <Icon name="logOut" size={18} />
          </button>
        </div>
      </aside>

      <main className={styles.content}>
        <div className={styles.contentInner}>
          <Outlet />
        </div>
      </main>

      <nav className={styles.tabBar} aria-label="Primary">
        {tabs.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `${styles.tab} ${isActive || (item.to === "/more" && inOverflow) ? styles.active : ""}`
            }
          >
            <Icon name={item.icon} size={24} strokeWidth={1.7} />
            <span>{t(item.label)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
