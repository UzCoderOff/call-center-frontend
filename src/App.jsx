import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Button from "./components/ui/Button";
import { EmptyState } from "./components/ui/Misc";
import { useI18n } from "./i18n";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import AppShell, { BrandMark } from "./components/layout/AppShell";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CallsPage from "./pages/CallsPage";
import CallDetailPage from "./pages/CallDetailPage";
import ReportsPage from "./pages/ReportsPage";
import ReportDetailPage from "./pages/ReportDetailPage";
import AutoReportPage from "./pages/AutoReportPage";
import TeamPage from "./pages/TeamPage";
import EmployeeDetailPage from "./pages/EmployeeDetailPage";
import SettingsPage from "./pages/SettingsPage";
import TemplateEditorPage from "./pages/TemplateEditorPage";
import ProfilePage from "./pages/ProfilePage";
import CalendarPage, { PlannerRedirect } from "./pages/CalendarPage";
import MorePage from "./pages/MorePage";
import { canManageClients, canManageMaterials, canSeeFinance, canSeeCalendar, canSeeCalls, canSeeClients, canSeeReports, canSeeTeam } from "./lib/access";
import ClientsPage from "./pages/ClientsPage";
import ClientPage from "./pages/ClientPage";
import ClientImportPage from "./pages/ClientImportPage";
import MaterialsPage from "./pages/MaterialsPage";
import MaterialPage from "./pages/MaterialPage";
import MaterialEditorPage from "./pages/MaterialEditorPage";
import FinancePage from "./pages/FinancePage";
import TasksPage from "./pages/TasksPage";

export function Splash() {
  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
      <BrandMark size={52} />
    </div>
  );
}

// `allow(user)` decides access to a section; without it, any signed-in
// person may enter.
// The server couldn't be reached while opening the portal (no internet, the
// server restarting): say so, with a button — not the login form.
function Offline() {
  const { retry } = useAuth();
  const { t } = useI18n();
  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <EmptyState icon="alertTriangle" title={t("common.offlineTitle")} text={t("common.offlineText")} action={<Button icon="refresh" onClick={retry}>{t("common.retry")}</Button>} />
    </div>
  );
}

function Protected({ children, allow }) {
  const { user, status } = useAuth();
  if (status === "checking") return <Splash />;
  if (status === "offline") return <Offline />;
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
        <Route path="clients" element={guarded(canSeeClients, <ClientsPage />)} />
        <Route path="clients/import" element={guarded(canManageClients, <ClientImportPage />)} />
        <Route path="clients/:id" element={guarded(canSeeClients, <ClientPage />)} />
        <Route path="calendar" element={guarded(canSeeCalendar, <CalendarPage />)} />
        <Route path="calendar/:calendarId/plan/:weekStart" element={<PlannerRedirect />} />
        <Route path="reports" element={guarded(canSeeReports, <ReportsPage />)} />
        <Route path="reports/auto/:employeeId/:date" element={guarded(canSeeReports, <AutoReportPage />)} />
        <Route path="reports/:id" element={guarded(canSeeReports, <ReportDetailPage />)} />
        <Route path="team" element={guarded(canSeeTeam, <TeamPage />)} />
        <Route path="team/:id" element={guarded(canSeeTeam, <EmployeeDetailPage />)} />
        <Route path="settings" element={guarded(canSeeTeam, <SettingsPage />)} />
        <Route path="settings/templates/:id" element={guarded(canSeeTeam, <TemplateEditorPage />)} />
        <Route path="finance" element={guarded(canSeeFinance, <FinancePage />)} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="materials" element={<MaterialsPage />} />
        <Route path="materials/new" element={guarded(canManageMaterials, <MaterialEditorPage />)} />
        <Route path="materials/:id" element={<MaterialPage />} />
        <Route path="materials/:id/edit" element={guarded(canManageMaterials, <MaterialEditorPage />)} />
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
