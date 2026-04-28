import { describe, expect, it, vi } from "vitest";
import { Role, UserStatus } from "@unihub/shared-types";
import { requireRole } from "../src/modules/auth/auth.middleware";

describe("auth RBAC middleware", () => {
  it("returns 403 when a STUDENT calls an organizer endpoint", () => {
    const req = {
      user: {
        id: "u1",
        email: "student@example.test",
        fullName: "Student",
        roles: [Role.STUDENT],
        status: UserStatus.ACTIVE
      }
    };
    const next = vi.fn();

    requireRole([Role.ORGANIZER, Role.ADMIN])(req as never, {} as never, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});
