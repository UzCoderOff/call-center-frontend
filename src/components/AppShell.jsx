import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const ICONS = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  calls: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 5.5C4 4.67 4.67 4 5.5 4h2.68c.55 0 1.03.36 1.19.89l1.09 3.6a1.24 1.24 0 0 1-.34 1.27l-1.6 1.5a13.5 13.5 0 0 0 6.2 6.2l1.5-1.6c.34-.36.85-.48 1.27-.34l3.6 1.09c.53.16.89.64.89 1.19V20.5c0 .83-.67 1.5-1.5 1.5C10.8 22 2 13.2 2 5.5 2 4.67 2.67 4 3.5 4" transform="scale(1)" />
    </svg>
  ),
  team: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.6 2.9-6.2 5.5-6.2S14.5 16.4 14.5 20" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15.2 13.5c2.6.2 4.8 2.4 4.8 6" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8.2" r="3.6" />
      <path d="M4.5 20c0-4.3 3.4-7.4 7.5-7.4s7.5 3.1 7.5 7.4" />
    </svg>
  ),
};

function NavItems({ role, className, onNavigate }) {
  const isManager = role === "BOSS" || role === "DEVELOPER";
  return (
    <>
      <NavLink to="/" end className={className} onClick={onNavigate}>
        {ICONS.dashboard}
        <span>{isManager ? "Overview" : "My stats"}</span>
      </NavLink>
      <NavLink to="/calls" className={className} onClick={onNavigate}>
        {ICONS.calls}
        <span>Calls</span>
      </NavLink>
      {isManager && (
        <NavLink to="/team" className={className} onClick={onNavigate}>
          {ICONS.team}
          <span>Team</span>
        </NavLink>
      )}
      <NavLink to="/profile" className={className} onClick={onNavigate}>
        {ICONS.profile}
        <span>Profile</span>
      </NavLink>
    </>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark">Ledger</span>
            <span className="brand-sub">Call Center Portal</span>
          </div>
          <nav className="topnav" aria-label="Primary">
            <NavItems role={user.role} className={({ isActive }) => `topnav-link${isActive ? " is-active" : ""}`} />
          </nav>
          <div className="who">
            <div className="who-text">
              <span className="who-name">{user.employee?.name || user.username}</span>
              <span className="who-role">{user.role}</span>
            </div>
            <button className="logout-btn" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Primary">
        <NavItems role={user.role} className={({ isActive }) => `tabbar-link${isActive ? " is-active" : ""}`} />
      </nav>

      <style>{`
        .shell {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          background: var(--paper);
        }

        /* ---------- Top bar (desktop) ---------- */
        .topbar {
          display: none;
          background: var(--navy);
          position: sticky;
          top: 0;
          z-index: 20;
        }
        .topbar-inner {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 24px;
          height: 64px;
          display: flex;
          align-items: center;
          gap: 32px;
        }
        .brand {
          display: flex;
          align-items: baseline;
          gap: 10px;
          white-space: nowrap;
        }
        .brand-mark {
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 1.2rem;
          color: var(--paper);
        }
        .brand-sub {
          font-size: 0.78rem;
          color: rgba(250, 248, 244, 0.55);
          font-weight: 500;
        }
        .topnav {
          display: flex;
          gap: 4px;
          flex: 1;
        }
        .topnav-link {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 8px 14px;
          border-radius: var(--radius-md);
          color: rgba(250, 248, 244, 0.68);
          text-decoration: none;
          font-size: 0.88rem;
          font-weight: 500;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .topnav-link svg {
          width: 17px;
          height: 17px;
        }
        .topnav-link:hover {
          background: rgba(250, 248, 244, 0.08);
          color: var(--paper);
        }
        .topnav-link.is-active {
          background: rgba(250, 248, 244, 0.12);
          color: var(--paper);
        }
        .who {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .who-text {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          line-height: 1.25;
        }
        .who-name {
          color: var(--paper);
          font-size: 0.85rem;
          font-weight: 600;
        }
        .who-role {
          color: var(--brass-soft);
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.04em;
        }
        .logout-btn {
          background: transparent;
          border: 1px solid rgba(250, 248, 244, 0.25);
          color: rgba(250, 248, 244, 0.85);
          padding: 7px 13px;
          border-radius: var(--radius-sm);
          font-size: 0.8rem;
          font-weight: 500;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .logout-btn:hover {
          border-color: rgba(250, 248, 244, 0.6);
          background: rgba(250, 248, 244, 0.06);
        }

        /* ---------- Content ---------- */
        .content {
          flex: 1;
          width: 100%;
          max-width: 1180px;
          margin: 0 auto;
          padding: 20px 16px 96px;
        }

        /* ---------- Bottom tab bar (mobile) ---------- */
        .tabbar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          background: var(--paper-raised);
          border-top: 1px solid var(--line);
          padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
          z-index: 20;
        }
        .tabbar-link {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 6px 4px;
          text-decoration: none;
          color: var(--ink-soft);
          font-size: 0.68rem;
          font-weight: 600;
          border-radius: var(--radius-sm);
        }
        .tabbar-link svg {
          width: 21px;
          height: 21px;
        }
        .tabbar-link.is-active {
          color: var(--navy);
        }
        .tabbar-link.is-active svg {
          stroke: var(--brass);
        }

        @media (min-width: 860px) {
          .topbar {
            display: block;
          }
          .tabbar {
            display: none;
          }
          .content {
            padding: 32px 24px 48px;
          }
        }
      `}</style>
    </div>
  );
}
