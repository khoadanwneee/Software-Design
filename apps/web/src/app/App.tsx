import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Role } from "@unihub/shared-types";
import { Shell } from "../components/Shell";
import { RoleGuard } from "../components/RoleGuard";
import { useAuth } from "../features/auth/AuthProvider";
import { syncPendingCheckins } from "../features/offline/sync";
import { LoginPage } from "../features/auth/LoginPage";
import { WorkshopListPage } from "../features/workshops/WorkshopListPage";
import { WorkshopDetailPage } from "../features/workshops/WorkshopDetailPage";
import { RegistrationQrPage } from "../features/registrations/RegistrationQrPage";
import { CheckinPage } from "../features/checkin/CheckinPage";
import { CheckinQueuePage } from "../features/checkin/CheckinQueuePage";
import { AdminDashboardPage } from "../features/admin/AdminDashboardPage";
import { AdminWorkshopsPage } from "../features/admin/AdminWorkshopsPage";
import { AdminWorkshopFormPage } from "../features/admin/AdminWorkshopFormPage";
import { AdminStatisticsPage } from "../features/admin/AdminStatisticsPage";
import { AdminAiSummaryPage } from "../features/ai-summary/AdminAiSummaryPage";
import { ForbiddenPage } from "./ForbiddenPage";

export function App() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      return;
    }
    const onOnline = () => {
      void syncPendingCheckins();
    };
    window.addEventListener("online", onOnline);
    if (navigator.onLine) {
      void syncPendingCheckins();
    }
    return () => window.removeEventListener("online", onOnline);
  }, [user]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RoleGuard>
            <Shell />
          </RoleGuard>
        }
      >
        <Route index element={<Navigate to="/workshops" replace />} />
        <Route path="/workshops" element={<WorkshopListPage />} />
        <Route path="/workshops/:id" element={<WorkshopDetailPage />} />
        <Route path="/registrations/:id/qr" element={<RegistrationQrPage />} />
        <Route
          path="/checkin"
          element={
            <RoleGuard roles={[Role.CHECKIN_STAFF, Role.ORGANIZER, Role.ADMIN]}>
              <CheckinPage />
            </RoleGuard>
          }
        />
        <Route
          path="/checkin/queue"
          element={
            <RoleGuard roles={[Role.CHECKIN_STAFF, Role.ORGANIZER, Role.ADMIN]}>
              <CheckinQueuePage />
            </RoleGuard>
          }
        />
        <Route
          path="/admin"
          element={
            <RoleGuard roles={[Role.ORGANIZER, Role.ADMIN]}>
              <AdminDashboardPage />
            </RoleGuard>
          }
        />
        <Route
          path="/admin/workshops"
          element={
            <RoleGuard roles={[Role.ORGANIZER, Role.ADMIN]}>
              <AdminWorkshopsPage />
            </RoleGuard>
          }
        />
        <Route
          path="/admin/workshops/new"
          element={
            <RoleGuard roles={[Role.ORGANIZER, Role.ADMIN]}>
              <AdminWorkshopFormPage />
            </RoleGuard>
          }
        />
        <Route
          path="/admin/workshops/:id/edit"
          element={
            <RoleGuard roles={[Role.ORGANIZER, Role.ADMIN]}>
              <AdminWorkshopFormPage />
            </RoleGuard>
          }
        />
        <Route
          path="/admin/statistics"
          element={
            <RoleGuard roles={[Role.ORGANIZER, Role.ADMIN]}>
              <AdminStatisticsPage />
            </RoleGuard>
          }
        />
        <Route
          path="/admin/ai-summary"
          element={
            <RoleGuard roles={[Role.ORGANIZER, Role.ADMIN]}>
              <AdminAiSummaryPage />
            </RoleGuard>
          }
        />
        <Route path="/forbidden" element={<ForbiddenPage />} />
      </Route>
    </Routes>
  );
}
