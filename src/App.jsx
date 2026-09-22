import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import AppShell from "./components/AppShell";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CallsPage from "./pages/CallsPage";
import CallDetailPage from "./pages/CallDetailPage";
import TeamPage from "./pages/TeamPage";
import EmployeeDetailPage from "./pages/EmployeeDetailPage";
import ProfilePage from "./pages/ProfilePage";

function Splash() {
  return (
    <div className="splash">
      <div className="splash-mark">Ledger</div>
      <style>{`
        .splash {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--navy);
        }
        .splash-mark {
          font-family: var(--font-display);
          font-size: 1.5rem;
          color: var(--paper);
          letter-spacing: 0.02em;
        }
      `}</style>
    </div>
  );
}

function Protected({ children, roles }) {
  const { user, status } = useAuth();
  if (status === "checking") return <Splash />;
  if (status === "anon") return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function Routed() {
  const { status } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={status === "authed" ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="calls" element={<CallsPage />} />
        <Route path="calls/:id" element={<CallDetailPage />} />
        <Route
          path="team"
          element={
            <Protected roles={["BOSS", "DEVELOPER"]}>
              <TeamPage />
            </Protected>
          }
        />
        <Route
          path="team/:id"
          element={
            <Protected roles={["BOSS", "DEVELOPER"]}>
              <EmployeeDetailPage />
            </Protected>
          }
        />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routed />
      </AuthProvider>
    </BrowserRouter>
  );
}
