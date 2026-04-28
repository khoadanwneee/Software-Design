import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Role, UserStatus } from "@unihub/shared-types";
import { RoleGuard } from "../src/components/RoleGuard";
import { AuthProvider } from "../src/features/auth/AuthProvider";
import { setSession } from "../src/features/auth/session";

describe("RoleGuard", () => {
  it("allows an ADMIN route for admin users", () => {
    setSession("test-token", {
      id: "admin",
      email: "admin@example.test",
      fullName: "Admin",
      roles: [Role.ADMIN],
      status: UserStatus.ACTIVE
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AuthProvider>
          <Routes>
            <Route
              path="/admin"
              element={
                <RoleGuard roles={[Role.ADMIN]}>
                  <span>Admin content</span>
                </RoleGuard>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("Admin content")).toBeInTheDocument();
  });
});
