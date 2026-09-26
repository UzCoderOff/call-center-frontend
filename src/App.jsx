import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import AppShell, { BrandMark } from "./components/layout/AppShell";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CallsPage from "./pages/CallsPage";
import CallDetailPage from "./pages/CallDetailPage";
import ReportsPage from "./pages/ReportsPage";
import ReportDetailPage from "./pages/ReportDetailPage";
import TeamPage from "./pages/TeamPage";
import EmployeeDetailPage from "./pages/EmployeeDetailPage";
import SettingsPage from "./pages/SettingsPage";
import TemplateEditorPage from "./pages/TemplateEditorPage";
import ProfilePage from "./pages/ProfilePage";
import CalendarPage, { PlannerRedirect } from "./pages/CalendarPage";
import MorePage from "./pages/MorePage";
import { canSeeCalendar, canSeeCalls, canSeeReports, canSeeTeam } from "./lib/access";

export function Splash() {
  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
      <BrandMark size={52} />
    </div>
  );
}

// `allow(user)` decides access to a section; without it, any signed-in
// person may enter.
function Protected({ children, allow }) {
  const { user, status } = useAuth();
  if (status === "checking") return <Splash />;
  if (status === "anon") return <Navigate to="/login" replace />;
  if (allow && !allow(user)) return <Navigate to="/" replace />;
  return children;
}

function guarded(allow, element) {
  return <Protected allow={allow}>{element}</Protected>;
}

function Routed() {
  const { status } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={status === "authed" ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="calls" element={guarded(canSeeCalls, <CallsPage />)} />
        <Route path="calls/:id" element={guarded(canSeeCalls, <CallDetailPage />)} />
        <Route path="calendar" element={guarded(canSeeCalendar, <CalendarPage />)} />
        <Route path="calendar/:calendarId/plan/:weekStart" element={<PlannerRedirect />} />
        <Route path="reports" element={guarded(canSeeReports, <ReportsPage />)} />
        <Route path="reports/:id" element={guarded(canSeeReports, <ReportDetailPage />)} />
        <Route path="team" element={guarded(canSeeTeam, <TeamPage />)} />
        <Route path="team/:id" element={guarded(canSeeTeam, <EmployeeDetailPage />)} />
        <Route path="settings" element={guarded(canSeeTeam, <SettingsPage />)} />
        <Route path="settings/templates/:id" element={guarded(canSeeTeam, <TemplateEditorPage />)} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="more" element={<MorePage />} />
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
