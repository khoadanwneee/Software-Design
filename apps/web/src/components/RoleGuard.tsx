import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import type { Role } from "@unihub/shared-types";
import { useAuth } from "../features/auth/AuthProvider";

export function RoleGuard({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !user.roles.some((role) => roles.includes(role))) {
    return <Navigate to="/forbidden" replace />;
  }

  return children;
}
