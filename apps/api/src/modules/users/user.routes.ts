import { Router } from "express";
import { z } from "zod";
import { Role } from "@unihub/shared-types";
import { ErrorCodes } from "@unihub/shared-utils";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { validateBody } from "../../common/middleware/validate.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";

const updateRolesSchema = z.object({
  roles: z.array(z.nativeEnum(Role)).min(1)
});

export const userRouter = Router();

userRouter.use(requireAuth);

userRouter.get(
  "/",
  requireRole([Role.ADMIN]),
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, fullName: true, roles: true, status: true }
    });
    res.json(users);
  })
);

userRouter.patch(
  "/:id/roles",
  requireRole([Role.ADMIN]),
  validateBody(updateRolesSchema),
  asyncHandler(async (req, res) => {
    const userId = String(req.params.id);
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, "User not found");
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { roles: req.body.roles },
      select: { id: true, email: true, fullName: true, roles: true, status: true }
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id,
        action: "USER_ROLES_UPDATED",
        entityType: "User",
        entityId: user.id,
        oldValue: { roles: existing.roles },
        newValue: { roles: user.roles },
        requestId: req.requestId
      }
    });

    res.json(user);
  })
);
