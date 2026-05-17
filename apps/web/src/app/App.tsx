import { Navigate, Route, Routes } from "react-router-dom";
import { Role } from "@unihub/shared-types";
import { Shell } from "../components/Shell";
import { RoleGuard } from "../components/RoleGuard";
import { LoginPage } from "../features/auth/LoginPage";
import { WorkshopListPage } from "../features/workshops/WorkshopListPage";
import { WorkshopDetailPage } from "../features/workshops/WorkshopDetailPage";
import { NotificationsPage } from "../features/notifications/NotificationsPage";
import { RegistrationQrPage } from "../features/registrations/RegistrationQrPage";
import { AdminDashboardPage } from "../features/admin/AdminDashboardPage";
import { AdminWorkshopsPage } from "../features/admin/AdminWorkshopsPage";
import { AdminWorkshopFormPage } from "../features/admin/AdminWorkshopFormPage";
import { AdminStatisticsPage } from "../features/admin/AdminStatisticsPage";
import { AdminRoomsPage } from "../features/admin/AdminRoomsPage";
import { AdminUsersPage } from "../features/admin/AdminUsersPage";
import { AdminStudentImportsPage } from "../features/admin/AdminStudentImportsPage";
import { AdminAiSummaryPage } from "../features/ai-summary/AdminAiSummaryPage";
import { ForbiddenPage } from "./ForbiddenPage";
import { PaymentSuccessPage } from "./PaymentSuccessPage";
import { PaymentFailedPage } from "./PaymentFailedPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/payment-success" element={<PaymentSuccessPage />} />
      <Route path="/payment-failed" element={<PaymentFailedPage />} />
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
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/registrations/:id/qr" element={<RegistrationQrPage />} />
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
          path="/admin/rooms"
          element={
            <RoleGuard roles={[Role.ORGANIZER, Role.ADMIN]}>
              <AdminRoomsPage />
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
        <Route
          path="/admin/student-imports"
          element={
            <RoleGuard roles={[Role.ADMIN]}>
              <AdminStudentImportsPage />
            </RoleGuard>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RoleGuard roles={[Role.ADMIN]}>
              <AdminUsersPage />
            </RoleGuard>
          }
        />
        <Route path="/forbidden" element={<ForbiddenPage />} />
      </Route>
    </Routes>
  );
}
